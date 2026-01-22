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

export class ImageService {
  private readonly api: AxiosInstance
  private readonly baseUrl = 'https://ddragon.leagueoflegends.com/cdn'
  private readonly imagesDir: string

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
    const versionDir = join(this.imagesDir, version, 'champion')

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
    const versionDir = join(this.imagesDir, version, 'item')

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
    const tasks: ImageDownloadTask[] = []
    const versionDir = join(this.imagesDir, version, 'rune')

    // Download path icons
    for (const path of runePaths) {
      if (path.icon) {
        const url = `${this.baseUrl}/img/${path.icon}`
        const localPath = join(versionDir, 'paths', path.icon.split('/').pop() || path.icon)
        tasks.push({ url, localPath, type: 'rune' })
      }

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
    const versionDir = join(this.imagesDir, version, 'spell')

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
    const versionDir = join(this.imagesDir, version, 'champion-spell')

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
      const versionDir = join(this.imagesDir, version)

      // Check if version directory exists
      const exists = await FileManager.exists(versionDir)
      if (!exists) {
        // No images for this version, nothing to delete
        return Result.ok(undefined)
      }

      // Recursively delete the entire version directory
      await fs.rm(versionDir, { recursive: true, force: true })

      console.log(`[ImageService] Deleted images for version ${version}`)
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
    keepVersion: string
  ): Promise<Result<{ deleted: number }, AppError>> {
    try {
      let deleted = 0

      // List all directories in imagesDir
      const entries = await fs.readdir(this.imagesDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const version = entry.name

        // Skip if it's the version we want to keep
        if (version === keepVersion) continue

        // Delete the version directory
        const versionDir = join(this.imagesDir, version)
        await fs.rm(versionDir, { recursive: true, force: true })
        deleted++
        console.log(`[ImageService] Deleted old version images: ${version}`)
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
}
