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

export class VersionService {
  private readonly versionFile: string
  private readonly dataDragonService: DataDragonService

  constructor(dataDir: string = join(process.cwd(), 'data', 'game')) {
    this.versionFile = join(dataDir, 'version.json')
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
   * Update version info after successful sync
   */
  async updateVersion(version: string): Promise<Result<void, AppError>> {
    const versionInfo: VersionInfo = {
      currentVersion: version,
      lastSyncDate: new Date().toISOString(),
      lastSyncTimestamp: Date.now()
    }

    return FileManager.writeJson(this.versionFile, versionInfo)
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
