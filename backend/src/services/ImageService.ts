import axios, { AxiosInstance } from 'axios'
import { join } from 'path'
import { promises as fs } from 'fs'
import { Result } from '../utils/Result.js'
import { ExternalApiError, AppError } from '../utils/errors.js'
import { FileManager } from '../utils/fileManager.js'

interface ImageDownloadTask {
  url: string
  localPath: string
  type: 'champion' | 'item' | 'rune' | 'spell' | 'champion-spell'
}

const RUNE_PATH_SVG_SOURCES: Array<{ name: string; url: string }> = [
  {
    name: 'domination_icon.svg',
    url: 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/domination/domination_icon.svg'
  },
  {
    name: 'inspiration_icon.svg',
    url: 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/inspiration/inspiration_icon.svg'
  },
  {
    name: 'precision_icon.svg',
    url: 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/precision/precision_icon.svg'
  },
  {
    name: 'resolve_icon.svg',
    url: 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/resolve/resolve_icon.svg'
  },
  {
    name: 'sorcery_icon.svg',
    url: 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/sorcery/sorcery_icon.svg'
  }
]

export class ImageService {
  private readonly api: AxiosInstance
  private readonly baseUrl = 'https://ddragon.leagueoflegends.com/cdn'
  private readonly imagesDir: string
  private readonly latestDirName = 'latest'

  constructor(imagesDir: string = join(process.cwd(), 'data', 'images')) {
    this.imagesDir = imagesDir
    this.api = axios.create({
      timeout: 30000,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Lelanation/1.0'
      }
    })
  }

  /**
   * Download a single image from URL and save it locally
   * Always overwrites existing images to ensure we have the latest version
   */
  async downloadImage(
    url: string,
    localPath: string
  ): Promise<Result<void, AppError>> {
    try {
      // Ensure directory exists
      const dir = join(localPath, '..')
      const dirResult = await FileManager.ensureDir(dir)
      if (dirResult.isErr()) {
        return Result.err(dirResult.unwrapErr())
      }

      // Download image (always overwrite if exists)
      const response = await this.api.get(url, { responseType: 'arraybuffer' })

      if (!response.data || response.data.length === 0) {
        return Result.err(
          new ExternalApiError(`Empty response when downloading image: ${url}`)
        )
      }

      // Save to file (overwrites if exists)
      await fs.writeFile(localPath, response.data)

      return Result.ok(undefined)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          return Result.err(
            new ExternalApiError(`Image not found: ${url}`, 404, error)
          )
        }
        if (error.response?.status === 429) {
          return Result.err(
            new ExternalApiError(
              'Rate limit exceeded when downloading images',
              429,
              error
            )
          )
        }
        return Result.err(
          new ExternalApiError(
            `Failed to download image: ${url}`,
            error.response?.status,
            error
          )
        )
      }
      return Result.err(
        new ExternalApiError(`Failed to download image: ${url}`, undefined, error)
      )
    }
  }

  /**
   * Download all champion images for a version
   */
  async downloadChampionImages(
    version: string,
    champions: Record<string, { id: string; image: { full: string } }>
  ): Promise<Result<{ downloaded: number; skipped: number }, AppError>> {
    const tasks: ImageDownloadTask[] = []
    const versionDir = join(this.imagesDir, this.latestDirName, 'champion')

    for (const champion of Object.values(champions)) {
      if (!champion.image?.full) continue

      const imageName = champion.image.full
      const url = `${this.baseUrl}/${version}/img/champion/${imageName}`
      const localPath = join(versionDir, imageName)

      tasks.push({
        url,
        localPath,
        type: 'champion'
      })
    }

    return this.downloadImagesBatch(tasks)
  }

  /**
   * Download all item images for a version
   */
  async downloadItemImages(
    version: string,
    items: Record<string, { id?: string; image?: { full: string } }>
  ): Promise<Result<{ downloaded: number; skipped: number }, AppError>> {
    const tasks: ImageDownloadTask[] = []
    const versionDir = join(this.imagesDir, this.latestDirName, 'item')

    for (const item of Object.values(items)) {
      if (!item.image?.full) continue

      const imageName = item.image.full
      const url = `${this.baseUrl}/${version}/img/item/${imageName}`
      const localPath = join(versionDir, imageName)

      tasks.push({
        url,
        localPath,
        type: 'item'
      })
    }

    return this.downloadImagesBatch(tasks)
  }

  /**
   * Download all rune images for a version
   */
  async downloadRuneImages(
    version: string,
    runePaths: Array<{
      id: number
      icon: string
      slots: Array<{
        runes: Array<{ id: number; icon: string }>
      }>
    }>
  ): Promise<Result<{ downloaded: number; skipped: number }, AppError>> {
    // Rune icon URLs are not versioned in Data Dragon (cdn/img/perk-images/...).
    void version
    const tasks: ImageDownloadTask[] = []
    const versionDir = join(this.imagesDir, this.latestDirName, 'rune')
    const pathDir = join(versionDir, 'paths')

    // Drop legacy PNG path icons so consumers use the new local SVG set.
    await this.removeLegacyRunePathPngs(pathDir)

    // Download path icons
    for (const icon of RUNE_PATH_SVG_SOURCES) {
      tasks.push({ url: icon.url, localPath: join(pathDir, icon.name), type: 'rune' })
    }
    for (const path of runePaths) {

      // Download rune icons
      for (const slot of path.slots || []) {
        for (const rune of slot.runes || []) {
          if (rune.icon) {
            const url = `${this.baseUrl}/img/${rune.icon}`
            const localPath = join(versionDir, 'runes', rune.icon.split('/').pop() || rune.icon)
            tasks.push({ url, localPath, type: 'rune' })
          }
        }
      }
    }

    return this.downloadImagesBatch(tasks)
  }

  /**
   * Download all summoner spell images for a version
   */
  async downloadSummonerSpellImages(
    version: string,
    spells: Record<string, { id: string; image: { full: string } }>
  ): Promise<Result<{ downloaded: number; skipped: number }, AppError>> {
    const tasks: ImageDownloadTask[] = []
    const versionDir = join(this.imagesDir, this.latestDirName, 'spell')

    for (const spell of Object.values(spells)) {
      if (!spell.image?.full) continue

      const imageName = spell.image.full
      const url = `${this.baseUrl}/${version}/img/spell/${imageName}`
      const localPath = join(versionDir, imageName)

      tasks.push({
        url,
        localPath,
        type: 'spell'
      })
    }

    return this.downloadImagesBatch(tasks)
  }

  /**
   * Download all champion spell images for a version
   */
  async downloadChampionSpellImages(
    version: string,
    champions: Record<
      string,
      {
        id: string
        spells: Array<{ id: string; image: { full: string } }>
        passive: { image: { full: string } }
      }
    >
  ): Promise<Result<{ downloaded: number; skipped: number }, AppError>> {
    const tasks: ImageDownloadTask[] = []
    const versionDir = join(this.imagesDir, this.latestDirName, 'champion-spell')

    for (const champion of Object.values(champions)) {
      // Download passive image
      if (champion.passive?.image?.full) {
        const imageName = champion.passive.image.full
        const url = `${this.baseUrl}/${version}/img/passive/${imageName}`
        const localPath = join(versionDir, 'passive', imageName)
        tasks.push({ url, localPath, type: 'champion-spell' })
      }

      // Download spell images
      for (const spell of champion.spells || []) {
        if (spell.image?.full) {
          const imageName = spell.image.full
          const url = `${this.baseUrl}/${version}/img/spell/${imageName}`
          const localPath = join(versionDir, champion.id, imageName)
          tasks.push({ url, localPath, type: 'champion-spell' })
        }
      }
    }

    return this.downloadImagesBatch(tasks)
  }

  /**
   * Download images in batch with concurrency control
   */
  private async downloadImagesBatch(
    tasks: ImageDownloadTask[],
    concurrency: number = 10
  ): Promise<Result<{ downloaded: number; skipped: number }, AppError>> {
    let downloaded = 0
    let skipped = 0
    let errors: AppError[] = []

    // Process in batches
    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency)

      const results = await Promise.allSettled(
        batch.map(task => this.downloadImage(task.url, task.localPath))
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value.isOk()) {
            // Image downloaded successfully (always overwrites if exists)
            downloaded++
          } else {
            const error = result.value.unwrapErr()
            // Don't fail on 404 (image might not exist)
            if (error instanceof ExternalApiError && error.statusCode === 404) {
              skipped++
            } else {
              errors.push(error)
            }
          }
        } else {
          errors.push(
            new AppError(
              `Failed to download image: ${result.reason}`,
              'DOWNLOAD_ERROR',
              result.reason
            )
          )
        }
      }

      // Small delay between batches to avoid rate limiting
      if (i + concurrency < tasks.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    // If too many errors, return error
    if (errors.length > tasks.length * 0.1) {
      // More than 10% errors
      return Result.err(
        new AppError(
          `Too many image download errors: ${errors.length}/${tasks.length}`,
          'DOWNLOAD_ERROR',
          errors[0]
        )
      )
    }

    return Result.ok({ downloaded, skipped })
  }

  /**
   * Delete all images for a specific version
   * Used to clean up old versions before downloading new ones
   */
  async deleteVersionImages(version: string): Promise<Result<void, AppError>> {
    try {
      // Current structure: data/images/latest/...
      const latestDir = join(this.imagesDir, this.latestDirName)
      if (await FileManager.exists(latestDir)) {
        await fs.rm(latestDir, { recursive: true, force: true })
      }

      // Cleanup legacy versioned directory if it exists.
      const legacyVersionDir = join(this.imagesDir, version)
      if (await FileManager.exists(legacyVersionDir)) {
        await fs.rm(legacyVersionDir, { recursive: true, force: true })
      }
      
      return Result.ok(undefined)
    } catch (error) {
      return Result.err(
        new AppError(
          `Failed to delete images for version ${version}: ${error}`,
          'FILE_ERROR',
          error
        )
      )
    }
  }

  /**
   * Delete all images for versions other than the specified one
   * Keeps only the current version to save disk space
   */
  async deleteOldVersionImages(
    _keepVersion: string
  ): Promise<Result<{ deleted: number }, AppError>> {
    try {
      let deleted = 0

      // List all directories in imagesDir
      const entries = await fs.readdir(this.imagesDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const dirName = entry.name
        // Keep only latest in the new storage model.
        if (dirName === this.latestDirName) continue

        const dirPath = join(this.imagesDir, dirName)
        await fs.rm(dirPath, { recursive: true, force: true })
        deleted++
      }

      return Result.ok({ deleted })
    } catch (error) {
      return Result.err(
        new AppError(
          `Failed to delete old version images: ${error}`,
          'FILE_ERROR',
          error
        )
      )
    }
  }

  private async removeLegacyRunePathPngs(pathDir: string): Promise<void> {
    try {
      const dirResult = await FileManager.ensureDir(pathDir)
      if (dirResult.isErr()) return
      const entries = await fs.readdir(pathDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isFile()) continue
        if (!entry.name.toLowerCase().endsWith('.png')) continue
        await fs.unlink(join(pathDir, entry.name))
      }
    } catch {
      // Non-fatal cleanup: keep sync resilient.
    }
  }
}
