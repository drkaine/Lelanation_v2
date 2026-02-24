import { join } from 'path'
import { promises as fs } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'
import { Result } from '../utils/Result.js'
import { AppError } from '../utils/errors.js'
import { FileManager } from '../utils/fileManager.js'

const execAsync = promisify(exec)

interface ItemData {
  [key: string]: any
}

interface ItemJson {
  data: ItemData
}

/**
 * Service to copy game data and images to frontend public directory
 * This allows the frontend to serve static assets directly (faster, more scalable)
 */
export class StaticAssetsService {
  private readonly backendDataDir: string
  private readonly backendImagesDir: string
  private readonly backendYouTubeDir: string
  private readonly backendCommunityDragonDir: string
  private readonly frontendPublicDir: string

  constructor(
    backendDataDir: string = join(process.cwd(), 'data', 'game'),
    backendImagesDir: string = join(process.cwd(), 'data', 'images'),
    backendYouTubeDir: string = join(process.cwd(), 'data', 'youtube'),
    backendCommunityDragonDir: string = join(process.cwd(), 'data', 'community-dragon'),
    frontendPublicDir: string = join(process.cwd(), '..', 'frontend', 'public')
  ) {
    this.backendDataDir = backendDataDir
    this.backendImagesDir = backendImagesDir
    this.backendYouTubeDir = backendYouTubeDir
    this.backendCommunityDragonDir = backendCommunityDragonDir
    this.frontendPublicDir = frontendPublicDir
  }

  /**
   * Delete old version game data from frontend public directory
   * Keeps only the specified version to save disk space
   */
  async deleteOldVersionDataFromFrontend(
    keepVersion: string
  ): Promise<Result<{ deleted: number }, AppError>> {
    try {
      let deleted = 0
      const frontendDataDir = join(this.frontendPublicDir, 'data', 'game')

      // Check if data directory exists
      const exists = await FileManager.exists(frontendDataDir)
      if (!exists) {
        return Result.ok({ deleted: 0 })
      }

      // List all directories in data/game
      const entries = await fs.readdir(frontendDataDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const version = entry.name

        // Skip if it's the version we want to keep or if it's not a version directory (like version.json)
        if (version === keepVersion || version === 'version.json') continue

        // Delete the version directory
        const versionDir = join(frontendDataDir, version)
        await fs.rm(versionDir, { recursive: true, force: true })
        deleted++
        console.log(`[StaticAssets] Deleted old version data from frontend: ${version}`)
      }

      return Result.ok({ deleted })
    } catch (error) {
      return Result.err(
        new AppError(
          `Failed to delete old version data from frontend: ${error}`,
          'FILE_ERROR',
          error
        )
      )
    }
  }

  /**
   * Delete game data from backend after copying to frontend
   * Keeps only version.json (needed to know current version)
   * This saves disk space since frontend serves data directly from static files
   */
  async deleteBackendGameData(version: string): Promise<Result<void, AppError>> {
    try {
      const versionDir = join(this.backendDataDir, version)

      // Check if version directory exists
      const exists = await FileManager.exists(versionDir)
      if (!exists) {
        // No data for this version, nothing to delete
        return Result.ok(undefined)
      }

      // Recursively delete the entire version directory
      await fs.rm(versionDir, { recursive: true, force: true })

      console.log(`[StaticAssets] Deleted backend game data for version ${version}`)
      return Result.ok(undefined)
    } catch (error) {
      return Result.err(
        new AppError(
          `Failed to delete backend game data for version ${version}: ${error}`,
          'FILE_ERROR',
          error
        )
      )
    }
  }

  /**
   * Delete images from backend after copying to frontend
   * This saves disk space since frontend serves images directly from static files
   */
  async deleteBackendImages(version: string): Promise<Result<void, AppError>> {
    try {
      const latestDir = join(this.backendImagesDir, 'latest')
      if (await FileManager.exists(latestDir)) {
        await fs.rm(latestDir, { recursive: true, force: true })
      }
      // Legacy cleanup if older versioned folder still exists.
      const legacyVersionDir = join(this.backendImagesDir, version)
      if (await FileManager.exists(legacyVersionDir)) {
        await fs.rm(legacyVersionDir, { recursive: true, force: true })
      }

      console.log(`[StaticAssets] Deleted backend latest images (requested version: ${version})`)
      return Result.ok(undefined)
    } catch (error) {
      return Result.err(
        new AppError(
          `Failed to delete backend images for version ${version}: ${error}`,
          'FILE_ERROR',
          error
        )
      )
    }
  }

  /**
   * Filter items using the same logic as DataDragonService.fetchItems()
   * Excludes items from excluded-items.json and applies standard filters
   */
  private async filterItems(
    items: ItemData,
    excludedItemIds: Set<string>
  ): Promise<ItemData> {
    // Items to exclude from selection (by name - legacy filter)
    const FILTERED_ITEMS = [
      'Oracle Lens',
      'Farsight Alteration',
      'Stealth Ward',
      'Your Cut',
      'Ardent Censer',
      "Mikael's Blessing",
      'Redemption',
      "Staff of Flowing Water",
      "Shurelya's Battlesong",
      'Moonstone Renewer',
      'Chemtech Putrifier',
    ]

    const filteredItems: ItemData = {}
    const seenNames = new Set<string>()

    for (const [itemId, item] of Object.entries(items)) {
      const itemData = item as any

      // Skip if item ID is in excluded list
      if (excludedItemIds.has(itemId)) {
        continue
      }

      if (
        itemData.maps?.['11'] === true &&
        itemData.gold?.purchasable === true &&
        itemData.gold?.total > 0 &&
        !FILTERED_ITEMS.includes(itemData.name)
      ) {
        // Deduplicate by name
        if (!seenNames.has(itemData.name)) {
          seenNames.add(itemData.name)
          filteredItems[itemId] = item
        }
      }
    }

    return filteredItems
  }

  /**
   * Load excluded items from excluded-items.json
   */
  private async loadExcludedItems(): Promise<Set<string>> {
    const excludedItemsPath = join(process.cwd(), 'data', 'excluded-items.json')
    const excludedItemsResult = await FileManager.readJson<{
      excludedIds: string[]
    }>(excludedItemsPath)

    if (excludedItemsResult.isOk()) {
      const excludedIds = excludedItemsResult.unwrap().excludedIds
      console.log(
        `[StaticAssets] Loaded ${excludedIds.length} excluded item IDs from excluded-items.json`
      )
      return new Set(excludedIds)
    } else {
      console.warn(
        `[StaticAssets] Could not load excluded-items.json: ${excludedItemsResult.unwrapErr().message}. Continuing without exclusion list.`
      )
      return new Set<string>()
    }
  }

  /**
   * Copy game data JSON files to frontend public directory
   * Filters item.json to exclude items from excluded-items.json
   * If backend data doesn't exist, filters the existing frontend file directly
   */
  async copyGameDataToFrontend(
    version: string,
    languages: string[] = ['fr_FR', 'en_US']
  ): Promise<Result<{ copied: number }, AppError>> {
    let copied = 0

    try {
      // Load excluded items once for all languages
      const excludedItemIds = await this.loadExcludedItems()

      const frontendDataDir = join(this.frontendPublicDir, 'data', 'game', version)

      for (const language of languages) {
        const sourceDir = join(this.backendDataDir, version, language)
        const targetDir = join(frontendDataDir, language)

        // Ensure target directory exists
        const dirResult = await FileManager.ensureDir(targetDir)
        if (dirResult.isErr()) {
          return Result.err(dirResult.unwrapErr())
        }

        // Copy JSON files
        const files = ['champion.json', 'championFull.json', 'item.json', 'runesReforged.json', 'summoner.json']
        for (const file of files) {
          const sourcePath = join(sourceDir, file)
          const targetPath = join(targetDir, file)

          // For item.json, always filter (even if source is frontend file)
          if (file === 'item.json') {
            // Try backend first, fallback to frontend if backend doesn't exist
            let itemJsonPath = sourcePath
            const backendExists = await FileManager.exists(sourcePath)
            if (!backendExists) {
              // Backend data was deleted, use existing frontend file as source
              const frontendPath = targetPath
              const frontendExists = await FileManager.exists(frontendPath)
              if (!frontendExists) {
                console.warn(`[StaticAssets] Item.json not found in backend or frontend: ${sourcePath}`)
                continue
              }
              itemJsonPath = frontendPath
              console.log(`[StaticAssets] Backend data not found, filtering existing frontend file: ${itemJsonPath}`)
            }

            const content = await fs.readFile(itemJsonPath, 'utf-8')
            const itemJson: ItemJson = JSON.parse(content)

            if (itemJson.data && typeof itemJson.data === 'object') {
              // Filter items
              const filteredItems = await this.filterItems(itemJson.data, excludedItemIds)
              
              // Write filtered items
              const filteredContent = JSON.stringify(
                { data: filteredItems },
                null,
                2
              )
              await fs.writeFile(targetPath, filteredContent, 'utf-8')
              
              console.log(
                `[StaticAssets] Filtered item.json: ${Object.keys(filteredItems).length} items (excluded ${excludedItemIds.size} by ID)`
              )
              copied++
            } else {
              console.warn(`[StaticAssets] Invalid item.json structure in ${itemJsonPath}`)
              // Copy as-is if structure is invalid
              await fs.writeFile(targetPath, content, 'utf-8')
              copied++
            }
          } else {
            // For other files, check if source exists
            const exists = await FileManager.exists(sourcePath)
            if (!exists) {
              console.warn(`[StaticAssets] Source file not found: ${sourcePath}`)
              continue
            }

            // Copy other files as-is
            const content = await fs.readFile(sourcePath, 'utf-8')
            await fs.writeFile(targetPath, content, 'utf-8')
            copied++
          }
        }
      }

      // Copy version.json and versions.json to root of data/game
      const gameRoot = join(process.cwd(), 'data', 'game')
      const frontendGameRoot = join(this.frontendPublicDir, 'data', 'game')
      await FileManager.ensureDir(frontendGameRoot)
      for (const name of ['version.json', 'versions.json']) {
        const source = join(gameRoot, name)
        const target = join(frontendGameRoot, name)
        if (await FileManager.exists(source)) {
          const content = await fs.readFile(source, 'utf-8')
          await fs.writeFile(target, content, 'utf-8')
          copied++
        }
      }

      return Result.ok({ copied })
    } catch (error) {
      return Result.err(
        new AppError(
          `Failed to copy game data to frontend: ${error}`,
          'FILE_ERROR',
          error
        )
      )
    }
  }

  /**
   * Delete old version images from frontend public directory
   * Keeps only the specified version to save disk space
   */
  async deleteOldVersionImagesFromFrontend(
    _keepVersion: string
  ): Promise<Result<{ deleted: number }, AppError>> {
    try {
      let deleted = 0
      const frontendImagesDir = join(this.frontendPublicDir, 'images', 'game')

      // Check if images directory exists
      const exists = await FileManager.exists(frontendImagesDir)
      if (!exists) {
        return Result.ok({ deleted: 0 })
      }

      // List all directories in images/game
      const entries = await fs.readdir(frontendImagesDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const version = entry.name

        // New structure keeps only /images/game/latest
        if (version === 'latest') continue

        // Delete the version directory
        const versionDir = join(frontendImagesDir, version)
        await fs.rm(versionDir, { recursive: true, force: true })
        deleted++
        console.log(`[StaticAssets] Deleted old version images from frontend: ${version}`)
      }

      return Result.ok({ deleted })
    } catch (error) {
      return Result.err(
        new AppError(
          `Failed to delete old version images from frontend: ${error}`,
          'FILE_ERROR',
          error
        )
      )
    }
  }

  /**
   * Copy images to frontend public directory
   * Always overwrites existing images to ensure we have the latest version
   */
  async copyImagesToFrontend(
    _version: string
  ): Promise<Result<{ copied: number; skipped: number }, AppError>> {
    let copied = 0
    let skipped = 0

    try {
      // Images are now always synchronized to latest-only path.
      const sourceImagesDir = join(this.backendImagesDir, 'latest')
      const targetImagesDir = join(this.frontendPublicDir, 'images', 'game', 'latest')

      // Check if source directory exists
      const sourceExists = await FileManager.exists(sourceImagesDir)
      if (!sourceExists) {
        console.warn(`[StaticAssets] Source images directory not found: ${sourceImagesDir}`)
        return Result.ok({ copied: 0, skipped: 0 })
      }

      // Recursively copy all image files
      const copyRecursive = async (source: string, target: string): Promise<void> => {
        const entries = await fs.readdir(source, { withFileTypes: true })

        for (const entry of entries) {
          const sourcePath = join(source, entry.name)
          const targetPath = join(target, entry.name)

          if (entry.isDirectory()) {
            await FileManager.ensureDir(targetPath)
            await copyRecursive(sourcePath, targetPath)
          } else if (entry.isFile()) {
            // Only copy image files
            const ext = entry.name.split('.').pop()?.toLowerCase()
            if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '')) {
              // Check if target already exists and is the same
              const targetExists = await FileManager.exists(targetPath)
              if (targetExists) {
                // Compare file sizes (simple check)
                const sourceStat = await fs.stat(sourcePath)
                const targetStat = await fs.stat(targetPath)
                if (sourceStat.size === targetStat.size) {
                  skipped++
                  continue
                }
              }

              await fs.copyFile(sourcePath, targetPath)
              copied++
            }
          }
        }
      }

      await FileManager.ensureDir(targetImagesDir)
      await copyRecursive(sourceImagesDir, targetImagesDir)

      return Result.ok({ copied, skipped })
    } catch (error) {
      return Result.err(
        new AppError(
          `Failed to copy images to frontend: ${error}`,
          'FILE_ERROR',
          error
        )
      )
    }
  }

  /**
   * Build frontend application
   * This rebuilds the frontend to include new static assets
   */
  async buildFrontend(): Promise<Result<void, AppError>> {
    try {
      const frontendDir = join(process.cwd(), '..', 'frontend')
      console.log(`[StaticAssets] Building frontend in: ${frontendDir}`)

      // Execute npm run build in frontend directory
      const { stdout, stderr } = await execAsync('npm run build', {
        cwd: frontendDir,
        timeout: 300000 // 5 minutes timeout for build
      })

      if (stderr && !stderr.includes('built')) {
        // Some warnings might go to stderr, but check for actual errors
        console.warn(`[StaticAssets] Frontend build warning: ${stderr}`)
      }

      console.log(`[StaticAssets] Frontend built successfully`)
      if (stdout) {
        console.log(`[StaticAssets] Build output: ${stdout.slice(-500)}`) // Last 500 chars
      }

      return Result.ok(undefined)
    } catch (error: any) {
      const errorMessage = error.message || String(error)
      console.error(`[StaticAssets] Failed to build frontend: ${errorMessage}`)
      return Result.err(
        new AppError(
          `Failed to build frontend: ${errorMessage}`,
          'EXTERNAL_ERROR',
          error
        )
      )
    }
  }

  /**
   * Restart frontend PM2 process to pick up new static assets
   * This ensures the frontend serves the newly copied files
   * Optionally builds the frontend before restarting
   */
  async restartFrontendPM2(buildFirst: boolean = false): Promise<Result<void, AppError>> {
    // Build frontend first if requested
    if (buildFirst) {
      console.log(`[StaticAssets] Building frontend before restart...`)
      const buildResult = await this.buildFrontend()
      if (buildResult.isErr()) {
        const buildError = buildResult.unwrapErr()
        console.warn(`[StaticAssets] Frontend build failed: ${buildError.message}`)
        // Continue with restart anyway - might still work with old build
        // But return error to let caller know
        return Result.err(
          new AppError(
            `Failed to build frontend before restart: ${buildError.message}`,
            'EXTERNAL_ERROR',
            buildError
          )
        )
      }
    }
    try {
      // Try to restart the frontend PM2 process
      // Use 'pm2 restart lelanation-frontend' or gracefully handle if PM2 is not available
      const { stderr } = await execAsync('pm2 restart lelanation-frontend', {
        timeout: 10000 // 10 second timeout
      })

      if (stderr && !stderr.includes('restarted')) {
        // PM2 might output to stderr even on success, but check for actual errors
        console.warn(`[StaticAssets] PM2 restart warning: ${stderr}`)
      }

      console.log(`[StaticAssets] Frontend PM2 restarted successfully`)
      return Result.ok(undefined)
    } catch (error: any) {
      // If PM2 command fails (not installed, process not found, etc.), log but don't fail
      // This allows the script to work in dev environments where PM2 might not be used
      const errorMessage = error.message || String(error)
      if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
        console.warn(
          `[StaticAssets] PM2 restart skipped: Frontend process not found or PM2 not available. This is OK in dev mode.`
        )
        return Result.ok(undefined) // Don't fail if PM2 is not available
      }

      console.warn(`[StaticAssets] Failed to restart frontend PM2: ${errorMessage}`)
      // Return error but don't fail the entire copy operation
      return Result.err(
        new AppError(
          `Failed to restart frontend PM2: ${errorMessage}`,
          'EXTERNAL_ERROR',
          error
        )
      )
    }
  }

  /**
   * Copy all static assets (data + images) for a version
   * Optionally restart the frontend PM2 process after copying
   * Optionally build the frontend before restarting
   * Automatically deletes old version assets from frontend to save disk space
   */
  async copyAllAssetsToFrontend(
    version: string,
    languages: string[] = ['fr_FR', 'en_US'],
    restartFrontend: boolean = false,
    buildFrontend: boolean = false
  ): Promise<Result<{ dataCopied: number; imagesCopied: number; imagesSkipped: number }, AppError>> {
    // Delete old version data and images from frontend before copying new ones
    const deleteOldDataResult = await this.deleteOldVersionDataFromFrontend(version)
    if (deleteOldDataResult.isOk()) {
      const deleted = deleteOldDataResult.unwrap()
      if (deleted.deleted > 0) {
        console.log(
          `[StaticAssets] Deleted ${deleted.deleted} old version data directories from frontend`
        )
      }
    } else {
      console.warn(
        `[StaticAssets] Failed to delete old version data from frontend: ${deleteOldDataResult.unwrapErr()}`
      )
      // Continue anyway - not critical
    }

    const deleteOldResult = await this.deleteOldVersionImagesFromFrontend('latest')
    if (deleteOldResult.isOk()) {
      const deleted = deleteOldResult.unwrap()
      if (deleted.deleted > 0) {
        console.log(
          `[StaticAssets] Deleted ${deleted.deleted} old version image directories from frontend`
        )
      }
    } else {
      console.warn(
        `[StaticAssets] Failed to delete old version images from frontend: ${deleteOldResult.unwrapErr()}`
      )
      // Continue anyway - not critical
    }

    const dataResult = await this.copyGameDataToFrontend(version, languages)
    if (dataResult.isErr()) {
      return Result.err(dataResult.unwrapErr())
    }

    const imagesResult = await this.copyImagesToFrontend(version)
    if (imagesResult.isErr()) {
      return Result.err(imagesResult.unwrapErr())
    }

    // Copy Community Dragon data (not version-specific, always latest)
    const communityDragonResult = await this.copyCommunityDragonDataToFrontend()
    if (communityDragonResult.isErr()) {
      console.warn(
        `[StaticAssets] Failed to copy Community Dragon data: ${communityDragonResult.unwrapErr()}`
      )
      // Continue anyway - not critical for main sync
    }

    const dataStats = dataResult.unwrap()
    const imageStats = imagesResult.unwrap()

    // Delete backend data and images after successful copy to frontend
    // This saves disk space since frontend serves directly from static files
    // We keep version.json in backend (needed to know current version)
    console.log(`[StaticAssets] Deleting backend data and images for version ${version}...`)
    
    const deleteDataResult = await this.deleteBackendGameData(version)
    if (deleteDataResult.isErr()) {
      console.warn(
        `[StaticAssets] Failed to delete backend game data: ${deleteDataResult.unwrapErr()}`
      )
      // Continue anyway - not critical
    }

    const deleteImagesResult = await this.deleteBackendImages(version)
    if (deleteImagesResult.isErr()) {
      console.warn(
        `[StaticAssets] Failed to delete backend images: ${deleteImagesResult.unwrapErr()}`
      )
      // Continue anyway - not critical
    }

    // Restart frontend if requested (typically in production with PM2)
    if (restartFrontend) {
      const restartResult = await this.restartFrontendPM2(buildFrontend)
      if (restartResult.isErr()) {
        // Log but don't fail - assets were copied successfully
        console.warn(
          `[StaticAssets] Assets copied but frontend restart failed: ${restartResult.unwrapErr()}`
        )
      }
    }

    return Result.ok({
      dataCopied: dataStats.copied,
      imagesCopied: imageStats.copied,
      imagesSkipped: imageStats.skipped
    })
  }

  /**
   * Copy YouTube channel data files to frontend public directory
   * This allows the frontend to serve YouTube data directly (faster, more scalable)
   */
  async copyYouTubeDataToFrontend(): Promise<Result<{ copied: number }, AppError>> {
    let copied = 0

    try {
      const targetYouTubeDir = join(this.frontendPublicDir, 'data', 'youtube')

      // Ensure target directory exists
      const dirResult = await FileManager.ensureDir(targetYouTubeDir)
      if (dirResult.isErr()) {
        return Result.err(dirResult.unwrapErr())
      }

      // Check if backend YouTube directory exists
      const backendExists = await FileManager.exists(this.backendYouTubeDir)
      if (!backendExists) {
        console.warn(`[StaticAssets] Backend YouTube directory not found: ${this.backendYouTubeDir}`)
        return Result.ok({ copied: 0 })
      }

      // List all JSON files in backend YouTube directory (excluding channels.json config)
      const entries = await fs.readdir(this.backendYouTubeDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.json')) continue
        if (entry.name === 'channels.json') continue // Skip config file

        const sourcePath = join(this.backendYouTubeDir, entry.name)
        const targetPath = join(targetYouTubeDir, entry.name)

        // Copy file (always overwrite to ensure latest data)
        const content = await fs.readFile(sourcePath, 'utf-8')
        await fs.writeFile(targetPath, content, 'utf-8')
        copied++
      }

      // Also copy channels.json (config) for reference
      const configSource = join(this.backendYouTubeDir, 'channels.json')
      const configTarget = join(targetYouTubeDir, 'channels.json')
      if (await FileManager.exists(configSource)) {
        const content = await fs.readFile(configSource, 'utf-8')
        await fs.writeFile(configTarget, content, 'utf-8')
        copied++
      }

      return Result.ok({ copied })
    } catch (error) {
      return Result.err(
        new AppError(
          `Failed to copy YouTube data to frontend: ${error}`,
          'FILE_ERROR',
          error
        )
      )
    }
  }

  /**
   * Delete YouTube data from backend after copying to frontend
   * Keeps only channels.json (needed for sync configuration)
   * This saves disk space since frontend serves data directly from static files
   */
  async deleteBackendYouTubeData(): Promise<Result<{ deleted: number }, AppError>> {
    try {
      let deleted = 0

      // Check if backend YouTube directory exists
      const exists = await FileManager.exists(this.backendYouTubeDir)
      if (!exists) {
        return Result.ok({ deleted: 0 })
      }

      // List all JSON files (excluding channels.json)
      const entries = await fs.readdir(this.backendYouTubeDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.json')) continue
        if (entry.name === 'channels.json') continue // Keep config file

        const filePath = join(this.backendYouTubeDir, entry.name)
        await fs.unlink(filePath)
        deleted++
        console.log(`[StaticAssets] Deleted backend YouTube data: ${entry.name}`)
      }

      return Result.ok({ deleted })
    } catch (error) {
      return Result.err(
        new AppError(
          `Failed to delete backend YouTube data: ${error}`,
          'FILE_ERROR',
          error
        )
      )
    }
  }

  /**
   * Copy all YouTube data to frontend and delete from backend
   * This makes the site more static and scalable
   * Optionally builds and restarts the frontend after copying
   */
  async copyYouTubeAssetsToFrontend(
    restartFrontend: boolean = false,
    buildFrontend: boolean = false
  ): Promise<Result<{ copied: number; deleted: number }, AppError>> {
    // Copy YouTube data to frontend
    const copyResult = await this.copyYouTubeDataToFrontend()
    if (copyResult.isErr()) {
      return Result.err(copyResult.unwrapErr())
    }

    const copied = copyResult.unwrap().copied

    // Delete backend YouTube data after successful copy
    console.log(`[StaticAssets] Deleting backend YouTube data...`)
    const deleteResult = await this.deleteBackendYouTubeData()
    if (deleteResult.isErr()) {
      console.warn(
        `[StaticAssets] Failed to delete backend YouTube data: ${deleteResult.unwrapErr()}`
      )
      // Continue anyway - not critical
    }

    const deleted = deleteResult.isOk() ? deleteResult.unwrap().deleted : 0

    // Restart frontend if requested
    if (restartFrontend) {
      const restartResult = await this.restartFrontendPM2(buildFrontend)
      if (restartResult.isErr()) {
        console.warn(
          `[StaticAssets] YouTube assets copied but frontend restart failed: ${restartResult.unwrapErr()}`
        )
      }
    }

    return Result.ok({ copied, deleted })
  }

  /**
   * Copy Community Dragon data to frontend public directory, then delete from backend.
   * Frontend serves Community Dragon data directly; backend does not keep a copy.
   */
  async copyCommunityDragonDataToFrontend(): Promise<
    Result<{ copied: number; deleted: number }, AppError>
  > {
    let copied = 0
    let deleted = 0

    try {
      const targetCommunityDragonDir = join(this.frontendPublicDir, 'data', 'community-dragon')

      // Ensure target directory exists
      const dirResult = await FileManager.ensureDir(targetCommunityDragonDir)
      if (dirResult.isErr()) {
        return Result.err(dirResult.unwrapErr())
      }

      // Check if backend Community Dragon directory exists
      const backendExists = await FileManager.exists(this.backendCommunityDragonDir)
      if (!backendExists) {
        console.warn(
          `[StaticAssets] Backend Community Dragon directory not found: ${this.backendCommunityDragonDir}`
        )
        return Result.ok({ copied: 0, deleted: 0 })
      }

      const entries = await fs.readdir(this.backendCommunityDragonDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.json')) continue

        const sourcePath = join(this.backendCommunityDragonDir, entry.name)
        const targetPath = join(targetCommunityDragonDir, entry.name)

        const content = await fs.readFile(sourcePath, 'utf-8')
        await fs.writeFile(targetPath, content, 'utf-8')
        copied++
        await fs.unlink(sourcePath).catch(() => {})
        deleted++
      }

      if (deleted > 0) {
        try {
          await fs.rm(this.backendCommunityDragonDir, { recursive: true, force: true })
        } catch {
          // Ignore
        }
      }

      console.log(
        `[StaticAssets] Copied ${copied} Community Dragon files to frontend, deleted ${deleted} from backend`
      )

      return Result.ok({ copied, deleted })
    } catch (error) {
      return Result.err(
        new AppError(
          `Failed to copy Community Dragon data to frontend: ${error}`,
          'FILE_ERROR',
          error
        )
      )
    }
  }
}
