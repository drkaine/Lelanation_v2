import axios, { AxiosInstance } from 'axios'
import { join } from 'path'
import { Result } from '../utils/Result.js'
import { ExternalApiError, AppError } from '../utils/errors.js'
import { FileManager } from '../utils/fileManager.js'
import { VersionService } from './VersionService.js'

interface ChampionFullData {
  data: Record<string, { key: string; [k: string]: unknown }>
}

const CD_BASE =
  'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global'

/**
 * Locale for Community Dragon (default = en_US, use fr_fr for French).
 * Full list: default, fr_fr, de_de, es_es, it_it, pt_br, ja_jp, ko_kr, zh_cn, etc.
 */
function getCommunityDragonLocale(): string {
  const env = process.env.COMMUNITY_DRAGON_LOCALE ?? ''
  return env && /^[a-z]{2}_[a-z]{2}$/i.test(env) ? env.toLowerCase() : 'fr_fr'
}

/**
 * Service for fetching champion data from Community Dragon (v1 API).
 * Uses configurable locale (default fr_fr); default = en_US on CD.
 */
export class CommunityDragonService {
  private readonly api: AxiosInstance
  private readonly dataDir: string
  private readonly versionService: VersionService
  /** Locale used for sync (e.g. fr_fr, default). */
  public readonly locale: string

  constructor(
    dataDir: string = join(process.cwd(), 'data', 'community-dragon'),
    locale: string = getCommunityDragonLocale()
  ) {
    this.dataDir = dataDir
    this.locale = locale
    this.versionService = new VersionService()
    const baseUrl = `${CD_BASE}/${this.locale}/v1/champions`
    this.api = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'User-Agent': 'Lelanation/1.0',
      },
    })
  }

  /**
   * Get list of champion numeric keys from championFull.json (single source after merge).
   */
  private async getChampionKeys(): Promise<Result<string[], AppError>> {
    try {
      const versionResult = await this.versionService.getCurrentVersion()
      if (versionResult.isErr()) {
        return Result.err(
          new AppError('Failed to get game version', 'VERSION_ERROR', versionResult.unwrapErr())
        )
      }

      const versionInfo = versionResult.unwrap()
      if (!versionInfo) {
        return Result.err(new AppError('No game version found', 'VERSION_ERROR'))
      }

      const backendPath = join(
        process.cwd(),
        'data',
        'game',
        versionInfo.currentVersion,
        'fr_FR',
        'championFull.json'
      )
      const frontendPath = join(
        process.cwd(),
        '..',
        'frontend',
        'public',
        'data',
        'game',
        versionInfo.currentVersion,
        'fr_FR',
        'championFull.json'
      )

      let championData: ChampionFullData | null = null
      const backendResult = await FileManager.readJson<ChampionFullData>(backendPath)
      if (backendResult.isOk()) {
        championData = backendResult.unwrap()
      } else {
        const frontendResult = await FileManager.readJson<ChampionFullData>(frontendPath)
        if (frontendResult.isOk()) {
          championData = frontendResult.unwrap()
        } else {
          return Result.err(
            new AppError(
              'Failed to read championFull.json from both backend and frontend',
              'FILE_ERROR'
            )
          )
        }
      }

      if (!championData?.data || typeof championData.data !== 'object') {
        return Result.err(new AppError('Invalid championFull structure', 'DATA_ERROR'))
      }

      const keys = Object.values(championData.data)
        .map(c => c?.key)
        .filter((k): k is string => typeof k === 'string')
      return Result.ok(keys)
    } catch (error) {
      return Result.err(
        new AppError('Failed to get champion keys', 'FILE_ERROR', error)
      )
    }
  }

  /**
   * Fetch v1 champion JSON by numeric key (e.g. 1.json, 266.json).
   */
  private async fetchChampionData(key: string): Promise<Result<unknown, AppError>> {
    try {
      const response = await this.api.get<unknown>(`/${key}.json`)
      if (!response.data) {
        return Result.err(new ExternalApiError(`No data returned for ${key}`, response.status))
      }
      return Result.ok(response.data)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          return Result.err(new ExternalApiError(`Champion not found: ${key}`, 404, error))
        }
        return Result.err(
          new ExternalApiError(`Failed to fetch ${key}: ${error.message}`, error.response?.status, error)
        )
      }
      return Result.err(new ExternalApiError(`Failed to fetch ${key}`, undefined, error))
    }
  }

  /**
   * Save champion data as {key}.json (e.g. 1.json, 266.json).
   */
  private async saveChampionData(key: string, data: unknown): Promise<Result<void, AppError>> {
    try {
      const filePath = join(this.dataDir, `${key}.json`)
      return await FileManager.writeJson(filePath, data)
    } catch (error) {
      return Result.err(new AppError(`Failed to save data for ${key}`, 'FILE_ERROR', error))
    }
  }

  /**
   * Sync all champion data from Community Dragon
   */
  async syncAllChampions(): Promise<
    Result<
      {
        synced: number
        failed: number
        skipped: number
        errors: Array<{ champion: string; error: string }>
      },
      AppError
    >
  > {
    try {
      // Ensure data directory exists
      const dirResult = await FileManager.ensureDir(this.dataDir)
      if (dirResult.isErr()) {
        return Result.err(
          new AppError(
            'Failed to create data directory',
            'FILE_ERROR',
            dirResult.unwrapErr()
          )
        )
      }

      const championsResult = await this.getChampionKeys()
      if (championsResult.isErr()) {
        return Result.err(
          new AppError(
            'Failed to get champion list',
            'DATA_ERROR',
            championsResult.unwrapErr()
          )
        )
      }

      const championKeys = championsResult.unwrap()
      let synced = 0
      let failed = 0
      let skipped = 0
      const errors: Array<{ champion: string; error: string }> = []

      console.log(
        `[CommunityDragon] Starting sync for ${championKeys.length} champions (v1 API, locale=${this.locale})...`
      )

      for (const key of championKeys) {
        try {
          const fetchResult = await this.fetchChampionData(key)
          if (fetchResult.isErr()) {
            const error = fetchResult.unwrapErr()
            if (error instanceof ExternalApiError && error.statusCode === 404) {
              skipped++
              console.log(`[CommunityDragon] Skipped ${key} (not found)`)
              continue
            }
            failed++
            errors.push({ champion: key, error: error.message })
            console.error(`[CommunityDragon] Failed to fetch ${key}: ${error.message}`)
            continue
          }

          const data = fetchResult.unwrap()
          const saveResult = await this.saveChampionData(key, data)
          if (saveResult.isErr()) {
            failed++
            errors.push({ champion: key, error: saveResult.unwrapErr().message })
            console.error(`[CommunityDragon] Failed to save ${key}: ${saveResult.unwrapErr().message}`)
            continue
          }

          synced++
          console.log(`[CommunityDragon] Synced ${key} (${synced}/${championKeys.length})`)

          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (error) {
          failed++
          const errorMessage = error instanceof Error ? error.message : String(error)
          errors.push({ champion: key, error: errorMessage })
          console.error(`[CommunityDragon] Unexpected error for ${key}: ${errorMessage}`)
        }
      }

      console.log(
        `[CommunityDragon] Sync completed: ${synced} synced, ${failed} failed, ${skipped} skipped`
      )

      return Result.ok({
        synced,
        failed,
        skipped,
        errors,
      })
    } catch (error) {
      return Result.err(
        new AppError('Failed to sync Community Dragon data', 'SYNC_ERROR', error)
      )
    }
  }
}
