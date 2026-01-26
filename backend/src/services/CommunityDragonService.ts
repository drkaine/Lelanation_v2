import axios, { AxiosInstance } from 'axios'
import { join } from 'path'
import { Result } from '../utils/Result.js'
import { ExternalApiError, AppError } from '../utils/errors.js'
import { FileManager } from '../utils/fileManager.js'
import { VersionService } from './VersionService.js'

interface ChampionData {
  data: {
    [key: string]: {
      id: string
      key: string
      name: string
    }
  }
}

/**
 * Service for fetching champion data from Community Dragon
 * Community Dragon provides more detailed game data than Data Dragon
 */
export class CommunityDragonService {
  private readonly api: AxiosInstance
  private readonly baseUrl = 'https://raw.communitydragon.org/latest/game/data/characters'
  private readonly dataDir: string
  private readonly versionService: VersionService

  // Special champion variants/forms that need to be fetched
  private readonly specialVariants = [
    'aniviaegg',
    'aniviaiceblock',
    'annietibbers',
    'apheliosturret',
    'aprilfool2025_clickablediscoball',
    'auroraspirits',
    'azirsundisc',
    'azirtowerclicker',
    'azirultsoldier',
    'bardfollower',
    'bardhealthshrine',
    'bardpickup',
    'bardpickupnoicon',
    'bardportalclickable',
    'belvethspore',
    'belvethvoidling',
    'caitlyntrap',
    'cassiopeia_death',
    'elisespider',
    'elisespiderling',
    'fiddlestickseffigy',
    'fizzbait',
    'fizzshark',
    'gangplankbarrel',
    'gnarbig',
    'illaoiminion',
    'ireliablades',
    'ivernminion',
    'iverntotem',
    'jarvanivstandard',
    'jarvanivwall',
    'jhintrap',
    'jinxmine',
    'kalistaaltar',
    'kalistaspawn',
    'kindredjunglebountyminion',
    'kindredwolf',
    'kledmount',
    'kledrider',
    'kogmawdead',
    'lissandrapassive',
    'lulufaerie',
    'lulupolymorphcritter',
    'malzaharvoidling',
    'maokaisproutling',
    'miliominion',
    'monkeykingclone',
    'monkeykingflying',
    'naafiripackmate',
    'nasusult',
    'nidaleecougar',
    'nidaleespear',
    'nunusnowball',
    'olafaxe',
    'oriannaball',
    'oriannanoball',
    'ornnram',
    'quinnvalor',
    'rammusdbc',
    'rammuspb',
    'reksaitunnel',
    'sennasoul',
    'shacobox',
    'shenspirit',
    'shyvanadragon',
    'swaindemonform',
    'syndraorbs',
    'syndrasphere',
    'taliyahwallchunk',
    'teemomushroom',
    'threshlantern',
    'trundlewall',
    'turret',
    'turretovergrowth',
    'turretrubble',
    'viegosoul',
    'viktorsingularity',
    'yorickbigghoul',
    'yorickghoulmelee',
    'yorickwghoul',
    'yorickwinvisible',
    'zacrebirthbloblet',
    'zedshadow',
    'zoeorbs',
    'zyragraspingplant',
    'zyrapassive',
    'zyraseed',
    'zyrathornplant',
    'inhibitor',
    'nexus',
    'destroyedtower',
  ]

  constructor(dataDir: string = join(process.cwd(), 'data', 'community-dragon')) {
    this.dataDir = dataDir
    this.versionService = new VersionService()
    this.api = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'User-Agent': 'Lelanation/1.0',
      },
    })
  }

  /**
   * Get list of champion IDs from local champion.json
   */
  private async getChampionIds(): Promise<Result<string[], AppError>> {
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

      // Try to read from backend data directory first
      const backendPath = join(
        process.cwd(),
        'data',
        'game',
        versionInfo.currentVersion,
        'fr_FR',
        'champion.json'
      )

      // Fallback to frontend public directory
      const frontendPath = join(
        process.cwd(),
        '..',
        'frontend',
        'public',
        'data',
        'game',
        versionInfo.currentVersion,
        'fr_FR',
        'champion.json'
      )

      let championData: ChampionData | null = null

      // Try backend first
      const backendResult = await FileManager.readJson<ChampionData>(backendPath)
      if (backendResult.isOk()) {
        championData = backendResult.unwrap()
      } else {
        // Try frontend
        const frontendResult = await FileManager.readJson<ChampionData>(frontendPath)
        if (frontendResult.isOk()) {
          championData = frontendResult.unwrap()
        } else {
          return Result.err(
            new AppError(
              'Failed to read champion.json from both backend and frontend',
              'FILE_ERROR'
            )
          )
        }
      }

      if (!championData?.data) {
        return Result.err(new AppError('Invalid champion.json structure', 'DATA_ERROR'))
      }

      // Extract champion IDs (keys are champion IDs like "Aatrox", "Ahri", etc.)
      const championIds = Object.keys(championData.data)
      return Result.ok(championIds)
    } catch (error) {
      return Result.err(
        new AppError('Failed to get champion IDs', 'FILE_ERROR', error)
      )
    }
  }

  /**
   * Fetch Community Dragon data for a specific champion/variant
   */
  private async fetchChampionData(
    championName: string
  ): Promise<Result<unknown, AppError>> {
    try {
      const url = `/${championName}/${championName}.bin.json`
      const response = await this.api.get<unknown>(url)

      if (!response.data) {
        return Result.err(
          new ExternalApiError(`No data returned for ${championName}`, response.status)
        )
      }

      return Result.ok(response.data)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // 404 is expected for some variants that don't exist
        if (error.response?.status === 404) {
          return Result.err(
            new ExternalApiError(
              `Champion variant not found: ${championName}`,
              404,
              error
            )
          )
        }
        return Result.err(
          new ExternalApiError(
            `Failed to fetch ${championName}: ${error.message}`,
            error.response?.status,
            error
          )
        )
      }
      return Result.err(
        new ExternalApiError(`Failed to fetch ${championName}`, undefined, error)
      )
    }
  }

  /**
   * Save champion data to file
   */
  private async saveChampionData(
    championName: string,
    data: unknown
  ): Promise<Result<void, AppError>> {
    try {
      const filePath = join(this.dataDir, `${championName}.json`)
      return await FileManager.writeJson(filePath, data)
    } catch (error) {
      return Result.err(
        new AppError(
          `Failed to save data for ${championName}`,
          'FILE_ERROR',
          error
        )
      )
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

      // Get list of champions
      const championsResult = await this.getChampionIds()
      if (championsResult.isErr()) {
        return Result.err(
          new AppError(
            'Failed to get champion list',
            'DATA_ERROR',
            championsResult.unwrapErr()
          )
        )
      }

      const championIds = championsResult.unwrap()
      const allChampions = [...championIds, ...this.specialVariants]

      let synced = 0
      let failed = 0
      let skipped = 0
      const errors: Array<{ champion: string; error: string }> = []

      console.log(`[CommunityDragon] Starting sync for ${allChampions.length} champions/variants...`)

      // Fetch data for each champion (with rate limiting)
      for (const championName of allChampions) {
        try {
          // Convert champion ID to lowercase for URL (e.g., "Aatrox" -> "aatrox")
          const urlName = championName.toLowerCase()

          const fetchResult = await this.fetchChampionData(urlName)
          if (fetchResult.isErr()) {
            const error = fetchResult.unwrapErr()
            // Skip 404 errors (variant doesn't exist)
            if (error instanceof ExternalApiError && error.statusCode === 404) {
              skipped++
              console.log(`[CommunityDragon] Skipped ${championName} (not found)`)
              continue
            }
            failed++
            errors.push({
              champion: championName,
              error: error.message,
            })
            console.error(`[CommunityDragon] Failed to fetch ${championName}: ${error.message}`)
            continue
          }

          const data = fetchResult.unwrap()
          const saveResult = await this.saveChampionData(championName, data)
          if (saveResult.isErr()) {
            failed++
            errors.push({
              champion: championName,
              error: saveResult.unwrapErr().message,
            })
            console.error(`[CommunityDragon] Failed to save ${championName}: ${saveResult.unwrapErr().message}`)
            continue
          }

          synced++
          console.log(`[CommunityDragon] Synced ${championName} (${synced}/${allChampions.length})`)

          // Rate limiting: wait 100ms between requests to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (error) {
          failed++
          const errorMessage = error instanceof Error ? error.message : String(error)
          errors.push({
            champion: championName,
            error: errorMessage,
          })
          console.error(`[CommunityDragon] Unexpected error for ${championName}: ${errorMessage}`)
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
