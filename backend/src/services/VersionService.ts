import { join } from 'path'
import { Result } from '../utils/Result.js'
import { AppError } from '../utils/errors.js'
import { FileManager } from '../utils/fileManager.js'
import { DataDragonService } from './DataDragonService.js'

interface VersionInfo {
  currentVersion: string
  lastSyncDate: string
  lastSyncTimestamp: number
}

interface VersionsRecapEntry {
  version: string
  releaseDate: string
  patchLabel: string
}

interface VersionsRecapJson {
  updatedAt?: string
  description?: string
  versions: VersionsRecapEntry[]
}

export class VersionService {
  private readonly versionFile: string
  private readonly versionsFile: string
  private readonly dataDragonService: DataDragonService

  constructor(dataDir: string = join(process.cwd(), 'data', 'game')) {
    this.versionFile = join(dataDir, 'version.json')
    this.versionsFile = join(dataDir, 'versions.json')
    this.dataDragonService = new DataDragonService(dataDir)
  }

  /**
   * Get current stored version
   */
  async getCurrentVersion(): Promise<Result<VersionInfo | null, AppError>> {
    const exists = await FileManager.exists(this.versionFile)
    if (!exists) {
      return Result.ok(null)
    }

    const result = await FileManager.readJson<VersionInfo>(this.versionFile)
    if (result.isErr()) {
      return result
    }

    const data = result.unwrap()
    // Defensive: if version.json exists but is malformed/empty, treat as not initialized.
    if (
      !data ||
      typeof data.currentVersion !== 'string' ||
      data.currentVersion.length === 0 ||
      typeof data.lastSyncDate !== 'string' ||
      typeof data.lastSyncTimestamp !== 'number'
    ) {
      return Result.ok(null)
    }

    return Result.ok(data)
  }

  /**
   * Update version info after successful sync.
   * Also ensures versions.json contains this version (for match collection filter).
   */
  async updateVersion(version: string): Promise<Result<void, AppError>> {
    const versionInfo: VersionInfo = {
      currentVersion: version,
      lastSyncDate: new Date().toISOString(),
      lastSyncTimestamp: Date.now()
    }

    const writeResult = await FileManager.writeJson(this.versionFile, versionInfo)
    if (writeResult.isErr()) return writeResult

    const recapResult = await this.ensureVersionInVersionsRecap(version)
    if (recapResult.isErr()) {
      // Don't fail the whole update; version.json is the source of truth
      console.warn('[VersionService] Failed to update versions.json:', recapResult.unwrapErr())
    }
    return Result.ok(undefined)
  }

  /**
   * Add the given version to data/game/versions.json if not already present (newest first).
   * Uses today as releaseDate and derives patchLabel from version (e.g. 16.4.1 -> 16.4).
   */
  private async ensureVersionInVersionsRecap(version: string): Promise<Result<void, AppError>> {
    const now = new Date()
    const releaseDate = now.toISOString().slice(0, 10) // YYYY-MM-DD
    const patchLabel = version.replace(/\.\d+$/, '') // 16.4.1 -> 16.4
    const newEntry: VersionsRecapEntry = { version, releaseDate, patchLabel }

    let data: VersionsRecapJson
    const readResult = await FileManager.readJson<VersionsRecapJson>(this.versionsFile)
    if (readResult.isErr()) {
      const err = readResult.unwrapErr()
      if (err.code !== 'FILE_NOT_FOUND') return Result.err(err)
      data = {
        updatedAt: now.toISOString(),
        description:
          'Recap of game versions with release dates. Used for match collection (patch filter), archiving, and stats by patch.',
        versions: [newEntry]
      }
    } else {
      data = readResult.unwrap()
      if (!data.versions || !Array.isArray(data.versions)) {
        data = { ...data, versions: [newEntry] }
      } else {
        const exists = data.versions.some((e) => e.version === version)
        if (!exists) {
          data.versions = [newEntry, ...data.versions]
        }
      }
      data.updatedAt = now.toISOString()
    }

    return FileManager.writeJson(this.versionsFile, data)
  }

  /**
   * Check if a new version is available
   */
  async checkForNewVersion(): Promise<Result<{ hasNew: boolean; current?: string; latest: string }, AppError>> {
    const latestResult = await this.dataDragonService.getLatestVersion()
    if (latestResult.isErr()) {
      return Result.err(latestResult.unwrapErr())
    }

    const latestVersion = latestResult.unwrap()
    const currentResult = await this.getCurrentVersion()

    if (currentResult.isErr()) {
      return Result.err(currentResult.unwrapErr())
    }

    const currentVersion = currentResult.unwrap()

    if (!currentVersion) {
      return Result.ok<{ hasNew: boolean; current?: string; latest: string }, AppError>({
        hasNew: true,
        latest: latestVersion
      })
    }

    return Result.ok<{ hasNew: boolean; current?: string; latest: string }, AppError>({
      hasNew: currentVersion.currentVersion !== latestVersion,
      current: currentVersion.currentVersion,
      latest: latestVersion
    })
  }

  /**
   * Compare build version with current game version
   */
  async isBuildOutdated(buildVersion: string): Promise<Result<boolean, AppError>> {
    const currentResult = await this.getCurrentVersion()
    if (currentResult.isErr()) {
      return Result.err(currentResult.unwrapErr())
    }

    const currentVersion = currentResult.unwrap()
    if (!currentVersion) {
      // No version stored, consider outdated
      return Result.ok<boolean, AppError>(true)
    }

    return Result.ok<boolean, AppError>(buildVersion !== currentVersion.currentVersion)
  }
}
