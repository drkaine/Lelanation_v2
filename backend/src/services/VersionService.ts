import { join } from 'path'
import { Result } from '../utils/Result.js'
import { AppError } from '../utils/errors.js'
import { FileManager } from '../utils/fileManager.js'
import { DataDragonService } from './DataDragonService.js'

interface VersionInfo {
  currentVersion: string
  lastSyncDate: string
  lastSyncTimestamp: number
  releaseDate?: string
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

/** Major.minor key used in active_patches / close_patch (e.g. 16.4.1 → 16.4). */
export function normalizeGamePatchKey(versionOrPatch: string): string {
  const p = (versionOrPatch ?? '').trim()
  if (!p) return ''
  const parts = p.split('.').filter((s) => s.length > 0)
  if (parts.length >= 2) return `${parts[0]}.${parts[1]}`
  return p
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
  async updateVersion(version: string, releaseDateOverride?: string): Promise<Result<void, AppError>> {
    const releaseDate = this.normalizeReleaseDate(releaseDateOverride) ?? await this.resolveReleaseDateForVersion(version)
    const versionInfo: VersionInfo = {
      currentVersion: version,
      lastSyncDate: new Date().toISOString(),
      lastSyncTimestamp: Date.now(),
      releaseDate,
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

  private normalizeReleaseDate(date: string | undefined): string | null {
    const d = (date ?? '').trim()
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
  }

  private async resolveReleaseDateForVersion(version: string): Promise<string> {
    const fallback = new Date().toISOString().slice(0, 10)
    const readResult = await FileManager.readJson<VersionsRecapJson>(this.versionsFile)
    if (readResult.isErr()) return fallback
    const data = readResult.unwrap()
    const entry = (data?.versions ?? []).find((e) => e.version === version)
    const date = (entry?.releaseDate ?? '').trim()
    return this.normalizeReleaseDate(date) ?? fallback
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

  async readVersionsRecap(): Promise<VersionsRecapJson | null> {
    const readResult = await FileManager.readJson<VersionsRecapJson>(this.versionsFile)
    if (readResult.isErr()) return null
    return readResult.unwrap()
  }

  private tomorrowUtcYyyyMmDd(): string {
    const t = new Date()
    t.setUTCDate(t.getUTCDate() + 1)
    return t.toISOString().slice(0, 10)
  }

  /**
   * Entries in versions.json are newest-first. For index i, patch window is
   * [versions[i].releaseDate, versions[i-1].releaseDate) when a newer patch exists;
   * otherwise end is tomorrow UTC (exclusive) so the current recap head stays consistent.
   */
  async listPatchCloseOptions(): Promise<
    Array<{
      patchLabel: string
      version: string
      releaseDate: string
      endExclusive: string
      isLatestInRecap: boolean
    }>
  > {
    const recap = await this.readVersionsRecap()
    const versions = recap?.versions ?? []
    const out: Array<{
      patchLabel: string
      version: string
      releaseDate: string
      endExclusive: string
      isLatestInRecap: boolean
    }> = []
    for (let i = 0; i < versions.length; i++) {
      const v = versions[i]!
      const rd = this.normalizeReleaseDate(v.releaseDate)
      if (!rd) continue
      const endExclusive =
        i > 0 ? this.normalizeReleaseDate(versions[i - 1]!.releaseDate) : this.tomorrowUtcYyyyMmDd()
      if (!endExclusive || endExclusive <= rd) continue
      out.push({
        patchLabel: normalizeGamePatchKey(v.patchLabel),
        version: v.version,
        releaseDate: rd,
        endExclusive,
        isLatestInRecap: i === 0,
      })
    }
    return out
  }

  async resolveSnapshotWindowForPatch(patchLabelInput: string): Promise<{
    startInclusive: string
    endExclusive: string
    patchLabel: string
    version: string
    isLatestInRecap: boolean
  } | null> {
    const want = normalizeGamePatchKey(patchLabelInput)
    if (!want) return null
    const recap = await this.readVersionsRecap()
    const versions = recap?.versions ?? []
    const idx = versions.findIndex(
      (e) =>
        normalizeGamePatchKey(e.patchLabel) === want || normalizeGamePatchKey(e.version) === want,
    )
    if (idx < 0) return null
    const v = versions[idx]!
    const startInclusive = this.normalizeReleaseDate(v.releaseDate)
    if (!startInclusive) return null
    const endExclusive =
      idx > 0
        ? this.normalizeReleaseDate(versions[idx - 1]!.releaseDate)
        : this.tomorrowUtcYyyyMmDd()
    if (!endExclusive || endExclusive <= startInclusive) return null
    return {
      startInclusive,
      endExclusive,
      patchLabel: normalizeGamePatchKey(v.patchLabel),
      version: v.version,
      isLatestInRecap: idx === 0,
    }
  }
}
