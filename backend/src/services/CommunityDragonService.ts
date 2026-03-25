import axios, { AxiosInstance } from 'axios'
import { promises as fs } from 'fs'
import { join } from 'path'
import sharp from 'sharp'
import { Result } from '../utils/Result.js'
import { ExternalApiError, AppError } from '../utils/errors.js'
import { FileManager } from '../utils/fileManager.js'
import { VersionService } from './VersionService.js'

interface ChampionFullData {
  data: Record<string, { key: string; [k: string]: unknown }>
}

interface CommunityChampionSpellRaw {
  spellKey?: unknown
  cost?: unknown
  cooldown?: unknown
  range?: unknown
  costCoefficients?: unknown
  cooldownCoefficients?: unknown
  coefficients?: unknown
  effectAmounts?: unknown
  ammo?: unknown
  maxLevel?: unknown
}

interface CommunityChampionClean {
  passive?: {
    name?: string
    description?: string
    abilityIconPath?: string
  }
  spells: Array<{
    spellKey?: string
    cost?: string
    cooldown?: string
    range?: number[]
    costCoefficients?: number[]
    cooldownCoefficients?: number[]
    coefficients?: Record<string, number>
    effectAmounts?: Record<string, number[]>
    ammo?: {
      ammoRechargeTime?: number[]
      maxAmmo?: number[]
    }
    maxLevel?: number
  }>
}

const CD_BASE =
  'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global'

/** Base URL for ranked emblems (static assets). */
const CD_RANKED_EMBLEM_BASE =
  'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem'
const CD_SCOREBOARD_BASE = 'https://raw.communitydragon.org/latest/game/assets/ux/scoreboard'

const RANKED_EMBLEM_FILES = [
  'emblem-iron.png',
  'emblem-bronze.png',
  'emblem-silver.png',
  'emblem-gold.png',
  'emblem-platinum.png',
  'emblem-emerald.png',
  'emblem-diamond.png',
  'emblem-master.png',
  'emblem-grandmaster.png',
  'emblem-challenger.png',
]
const SCOREBOARD_OBJECTIVE_FILES = [
  '_baronnashor.png',
  '_dragon.png',
  '_elderdrake.png',
  '_riftherald.png',
  '_mountaindrake.png',
  '_oceandrake.png',
  '_clouddrake.png',
  '_infernaldrake.png',
  '_hextechdrake.png',
  '_chemtechdrake.png',
]

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
    dataDir: string = join(process.cwd(), '..', 'frontend', 'public', 'data', 'community-dragon'),
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
      return await FileManager.writeJson(filePath, this.cleanChampionData(data))
    } catch (error) {
      return Result.err(new AppError(`Failed to save data for ${key}`, 'FILE_ERROR', error))
    }
  }

  /**
   * Keep only fields needed for spells merge/processing.
   */
  private cleanChampionData(data: unknown): CommunityChampionClean {
    const raw = (data && typeof data === 'object' ? data : {}) as {
      passive?: unknown
      spells?: unknown
    }
    const spells = Array.isArray(raw.spells) ? (raw.spells as CommunityChampionSpellRaw[]) : []
    const passiveRaw =
      raw.passive && typeof raw.passive === 'object'
        ? (raw.passive as Record<string, unknown>)
        : undefined

    return {
      passive: passiveRaw
        ? {
            name: typeof passiveRaw.name === 'string' ? passiveRaw.name : undefined,
            description: typeof passiveRaw.description === 'string' ? passiveRaw.description : undefined,
            abilityIconPath:
              typeof passiveRaw.abilityIconPath === 'string'
                ? passiveRaw.abilityIconPath
                : undefined,
          }
        : undefined,
      spells: spells.map(spell => ({
        spellKey: typeof spell.spellKey === 'string' ? spell.spellKey : undefined,
        cost: typeof spell.cost === 'string' ? spell.cost : undefined,
        cooldown: typeof spell.cooldown === 'string' ? spell.cooldown : undefined,
        range: Array.isArray(spell.range) ? (spell.range.filter(v => typeof v === 'number') as number[]) : undefined,
        costCoefficients: Array.isArray(spell.costCoefficients)
          ? (spell.costCoefficients.filter(v => typeof v === 'number') as number[])
          : undefined,
        cooldownCoefficients: Array.isArray(spell.cooldownCoefficients)
          ? (spell.cooldownCoefficients.filter(v => typeof v === 'number') as number[])
          : undefined,
        coefficients:
          spell.coefficients && typeof spell.coefficients === 'object'
            ? (Object.fromEntries(
                Object.entries(spell.coefficients as Record<string, unknown>).filter(
                  ([, v]) => typeof v === 'number'
                )
              ) as Record<string, number>)
            : undefined,
        effectAmounts:
          spell.effectAmounts && typeof spell.effectAmounts === 'object'
            ? (Object.fromEntries(
                Object.entries(spell.effectAmounts as Record<string, unknown>).map(([k, arr]) => [
                  k,
                  Array.isArray(arr) ? arr.filter(v => typeof v === 'number') : [],
                ])
              ) as Record<string, number[]>)
            : undefined,
        ammo:
          spell.ammo && typeof spell.ammo === 'object'
            ? {
                ammoRechargeTime: Array.isArray((spell.ammo as Record<string, unknown>).ammoRechargeTime)
                  ? (((spell.ammo as Record<string, unknown>).ammoRechargeTime as unknown[]).filter(
                      v => typeof v === 'number'
                    ) as number[])
                  : undefined,
                maxAmmo: Array.isArray((spell.ammo as Record<string, unknown>).maxAmmo)
                  ? (((spell.ammo as Record<string, unknown>).maxAmmo as unknown[]).filter(
                      v => typeof v === 'number'
                    ) as number[])
                  : undefined,
              }
            : undefined,
        maxLevel: typeof spell.maxLevel === 'number' ? spell.maxLevel : undefined,
      })),
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

      for (const key of championKeys) {
        try {
          const fetchResult = await this.fetchChampionData(key)
          if (fetchResult.isErr()) {
            const error = fetchResult.unwrapErr()
            if (error instanceof ExternalApiError && error.statusCode === 404) {
              skipped++
              continue
            }
            failed++
            errors.push({ champion: key, error: error.message })
            continue
          }

          const data = fetchResult.unwrap()
          const saveResult = await this.saveChampionData(key, data)
          if (saveResult.isErr()) {
            failed++
            errors.push({ champion: key, error: saveResult.unwrapErr().message })
            continue
          }

          synced++

          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (error) {
          failed++
          const errorMessage = error instanceof Error ? error.message : String(error)
          errors.push({ champion: key, error: errorMessage })
        }
      }

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

  /**
   * Sync ranked division emblems (images) from Community Dragon static assets.
   * Saves to {dataDir}/ranked-emblem/*.png for later copy to frontend.
   */
  async syncRankedEmblems(): Promise<
    Result<
      { synced: number; failed: number; errors: Array<{ file: string; error: string }> },
      AppError
    >
  > {
    const emblemDir = join(this.dataDir, 'ranked-emblem')
    const dirResult = await FileManager.ensureDir(emblemDir)
    if (dirResult.isErr()) {
      return Result.err(dirResult.unwrapErr())
    }

    let synced = 0
    let failed = 0
    const errors: Array<{ file: string; error: string }> = []

    const axiosEmblem = axios.create({
      baseURL: CD_RANKED_EMBLEM_BASE,
      timeout: 30000,
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Lelanation/1.0' },
    })

    for (const file of RANKED_EMBLEM_FILES) {
      try {
        const response = await axiosEmblem.get<ArrayBuffer | Buffer>(`/${file}`)
        const data = response.data
        if (data == null || (data as ArrayBuffer).byteLength === 0) {
          failed++
          errors.push({ file, error: 'No data returned' })
          continue
        }
        const targetPath = join(emblemDir, file)
        const buffer = Buffer.from(data as ArrayBuffer)
        const trimmed = await sharp(buffer)
          .trim({ threshold: 0 })
          .png()
          .toBuffer()
        await fs.writeFile(targetPath, trimmed)
        synced++
      } catch (error) {
        failed++
        const errorMessage = error instanceof Error ? error.message : String(error)
        errors.push({ file, error: errorMessage })
        console.error(`[CommunityDragon] Failed to sync ranked emblem ${file}: ${errorMessage}`)
      }
    }

    return Result.ok({ synced, failed, errors })
  }

  /**
   * Sync scoreboard objective icons from Community Dragon.
   * Saves to {dataDir}/scoreboard-objectives/*.png for frontend usage.
   */
  async syncScoreboardObjectiveIcons(): Promise<
    Result<
      { synced: number; failed: number; errors: Array<{ file: string; error: string }> },
      AppError
    >
  > {
    const objectiveDir = join(this.dataDir, 'scoreboard-objectives')
    const dirResult = await FileManager.ensureDir(objectiveDir)
    if (dirResult.isErr()) {
      return Result.err(dirResult.unwrapErr())
    }

    let synced = 0
    let failed = 0
    const errors: Array<{ file: string; error: string }> = []

    const axiosObjective = axios.create({
      baseURL: CD_SCOREBOARD_BASE,
      timeout: 30000,
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Lelanation/1.0' },
    })

    for (const file of SCOREBOARD_OBJECTIVE_FILES) {
      try {
        const response = await axiosObjective.get<ArrayBuffer | Buffer>(`/${file}`)
        const data = response.data
        if (data == null || (data as ArrayBuffer).byteLength === 0) {
          failed++
          errors.push({ file, error: 'No data returned' })
          continue
        }
        const targetPath = join(objectiveDir, file)
        await fs.writeFile(targetPath, Buffer.from(data as ArrayBuffer))
        synced++
      } catch (error) {
        failed++
        const errorMessage = error instanceof Error ? error.message : String(error)
        errors.push({ file, error: errorMessage })
        console.error(`[CommunityDragon] Failed to sync scoreboard icon ${file}: ${errorMessage}`)
      }
    }

    return Result.ok({ synced, failed, errors })
  }
}
