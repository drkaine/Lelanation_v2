/**
 * Service to fetch Ornn Masterwork items from Community Dragon
 * and enrich the items.json with them.
 *
 * Detection: requiredAlly === "Ornn" OR name contains Masterwork/Chef-d'œuvre OR id >= 7000
 * Base item: from[0]
 * Icons: https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/items/icons2d/{filename}.png
 */

import axios, { AxiosInstance } from 'axios'
import { join } from 'path'
import { Result } from '../utils/Result.js'
import { ExternalApiError, AppError } from '../utils/errors.js'
import { FileManager } from '../utils/fileManager.js'

const CD_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global'
const CD_ICONS_BASE = `${CD_BASE}/default/assets/items/icons2d`

interface CommunityDragonItem {
  id: number
  name: string
  description?: string
  price?: number
  priceTotal?: number
  iconPath?: string
  from?: number[]
  into?: number[]
  requiredAlly?: string
  categories?: string[]
  [key: string]: unknown
}

/** Data Dragon / frontend item format */
interface EnrichedItem {
  id: string
  name: string
  description: string
  colloq: string
  plaintext: string
  image: { full: string; sprite: string; group: string; x: number; y: number; w: number; h: number }
  gold: { base: number; total: number; sell: number; purchasable: boolean }
  tags: string[]
  depth?: number
  from?: string[]
  into?: string[]
  maps?: Record<string, boolean>
  isMasterwork?: boolean
  baseItemId?: string
}

function isMasterworkItem(item: CommunityDragonItem): boolean {
  if (item.requiredAlly === 'Ornn') return true
  const name = (item.name || '').toLowerCase()
  if (
    name.includes('masterwork') ||
    name.includes("chef-d'œuvre") ||
    name.includes("chef d'œuvre")
  ) {
    return true
  }
  if (typeof item.id === 'number' && item.id >= 7000 && item.id < 10000) {
    return true
  }
  return false
}

/** Extract filename from CD iconPath for local storage */
function iconPathToFilename(iconPath: string | undefined): string | null {
  if (!iconPath) return null
  const parts = iconPath.split('/')
  const filename = parts[parts.length - 1]
  if (!filename || !filename.endsWith('.png')) return null
  return filename
}

export class CommunityDragonOrnnService {
  private readonly api: AxiosInstance
  private readonly imagesDir: string

  constructor(imagesDir: string = join(process.cwd(), 'data', 'images')) {
    this.imagesDir = imagesDir
    this.api = axios.create({
      timeout: 30000,
      headers: { 'User-Agent': 'Lelanation/1.0' },
    })
  }

  /**
   * Fetch items from Community Dragon for a locale
   */
  async fetchCommunityDragonItems(
    locale: string = 'default'
  ): Promise<Result<CommunityDragonItem[], AppError>> {
    try {
      const url = `${CD_BASE}/${locale}/v1/items.json`
      const response = await this.api.get<CommunityDragonItem[]>(url)

      if (!response.data || !Array.isArray(response.data)) {
        return Result.err(
          new ExternalApiError('Invalid items data from Community Dragon')
        )
      }

      return Result.ok(response.data)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return Result.err(
          new ExternalApiError(
            `Failed to fetch Community Dragon items: ${error.message}`,
            error.response?.status,
            error
          )
        )
      }
      return Result.err(
        new ExternalApiError('Failed to fetch Community Dragon items', undefined, error)
      )
    }
  }

  /**
   * Extract masterwork items and convert to Data Dragon format
   */
  extractMasterworkItems(
    cdItems: CommunityDragonItem[]
  ): { items: EnrichedItem[]; iconUrls: Array<{ url: string; filename: string }> } {
    const items: EnrichedItem[] = []
    const iconUrls: Array<{ url: string; filename: string }> = []

    for (const cd of cdItems) {
      if (!isMasterworkItem(cd)) continue

      const baseItemId = cd.from?.[0]
      if (!baseItemId && cd.from?.length === 0) {
        continue
      }

      const iconFilename = iconPathToFilename(cd.iconPath)
      if (!iconFilename) continue

      const id = String(cd.id)
      const total = cd.priceTotal ?? cd.price ?? 0

      const enriched: EnrichedItem = {
        id,
        name: cd.name || `Item ${id}`,
        description: cd.description || '',
        colloq: '',
        plaintext: '',
        image: {
          full: iconFilename,
          sprite: 'item0.png',
          group: 'item',
          x: 0,
          y: 0,
          w: 48,
          h: 48,
        },
        gold: {
          base: total,
          total,
          sell: Math.floor(total * 0.4),
          purchasable: true,
        },
        tags: cd.categories?.length ? cd.categories : ['OrnnUpgrade'],
        from: baseItemId != null ? [String(baseItemId)] : undefined,
        into: cd.into?.map(String),
        maps: { '11': true },
        depth: 2,
        isMasterwork: true,
        baseItemId: baseItemId != null ? String(baseItemId) : undefined,
      }

      items.push(enriched)

      const url = `${CD_ICONS_BASE}/${iconFilename.toLowerCase()}`
      iconUrls.push({ url, filename: iconFilename })
    }

    return { items, iconUrls }
  }

  /**
   * Download a single Ornn item icon from Community Dragon
   */
  async downloadOrnnIcon(
    url: string,
    filename: string
  ): Promise<Result<void, AppError>> {
    try {
      const itemDir = join(this.imagesDir, 'latest', 'item')
      const dirResult = await FileManager.ensureDir(itemDir)
      if (dirResult.isErr()) {
        return Result.err(dirResult.unwrapErr())
      }

      const response = await this.api.get(url, { responseType: 'arraybuffer' })
      if (!response.data || response.data.length === 0) {
        return Result.err(
          new ExternalApiError(`Empty response when downloading: ${url}`)
        )
      }

      const localPath = join(itemDir, filename)
      const { promises: fs } = await import('fs')
      await fs.writeFile(localPath, response.data)

      return Result.ok(undefined)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          return Result.err(
            new ExternalApiError(`Ornn icon not found: ${url}`, 404, error)
          )
        }
        return Result.err(
          new ExternalApiError(
            `Failed to download Ornn icon: ${error.message}`,
            error.response?.status,
            error
          )
        )
      }
      return Result.err(
        new ExternalApiError(`Failed to download Ornn icon: ${url}`, undefined, error)
      )
    }
  }

  /**
   * Download all Ornn item icons
   */
  async downloadOrnnIcons(
    iconUrls: Array<{ url: string; filename: string }>
  ): Promise<Result<{ downloaded: number; skipped: number }, AppError>> {
    let downloaded = 0
    let skipped = 0

    for (const { url, filename } of iconUrls) {
      const result = await this.downloadOrnnIcon(url, filename)
      if (result.isOk()) {
        downloaded++
      } else {
        const err = result.unwrapErr()
        if (err instanceof ExternalApiError && err.statusCode === 404) {
          skipped++
        } else {
          console.warn(`[CD Ornn] Failed to download ${filename}:`, err.message)
          skipped++
        }
      }
      await new Promise((r) => setTimeout(r, 50))
    }

    return Result.ok({ downloaded, skipped })
  }

  /**
   * Fetch masterwork items for EN and FR, merge into item data
   */
  async fetchAndEnrichMasterworkItems(
    existingItems: Record<string, unknown>,
    languages: { en: string; fr: string } = { en: 'default', fr: 'fr_fr' }
  ): Promise<Result<{ added: number; iconsDownloaded: number }, AppError>> {
    const allMasterwork = new Map<string, EnrichedItem>()
    let iconUrls: Array<{ url: string; filename: string }> = []

    for (const [langKey, locale] of Object.entries(languages)) {
      const fetchResult = await this.fetchCommunityDragonItems(locale)
      if (fetchResult.isErr()) {
        console.warn(
          `[CD Ornn] Failed to fetch items for ${langKey}:`,
          fetchResult.unwrapErr().message
        )
        continue
      }

      const { items, iconUrls: urls } = this.extractMasterworkItems(
        fetchResult.unwrap()
      )

      for (const item of items) {
        if (!allMasterwork.has(item.id)) {
          allMasterwork.set(item.id, item)
        } else {
          const existing = allMasterwork.get(item.id)!
          if (langKey === 'fr' && locale === 'fr_fr') {
            existing.name = item.name
            existing.description = item.description
          }
        }
      }

      if (iconUrls.length === 0) {
        iconUrls = urls
      }
    }

    let added = 0
    for (const [id, item] of allMasterwork) {
      if (!(id in existingItems)) {
        ;(existingItems as Record<string, EnrichedItem>)[id] = item
        added++
      }
    }

    const downloadResult = await this.downloadOrnnIcons(iconUrls)
    const iconsDownloaded = downloadResult.isOk()
      ? downloadResult.unwrap().downloaded
      : 0

    if (downloadResult.isErr()) {
      console.warn(
        '[CD Ornn] Some icon downloads failed:',
        downloadResult.unwrapErr().message
      )
    }

    return Result.ok({ added, iconsDownloaded })
  }
}
