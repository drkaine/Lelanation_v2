import { promises as fs } from 'fs'
import { join } from 'path'
import sharp from 'sharp'
import { Result } from '../utils/Result.js'
import { AppError } from '../utils/errors.js'
import { FileManager } from '../utils/fileManager.js'
import { fetchBuffer } from '../utils/httpFetch.js'

/** Base URL for ranked emblems (static assets). */
const CD_RANKED_EMBLEM_BASE =
  'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem'
const CD_SCOREBOARD_BASE = 'https://raw.communitydragon.org/latest/game/assets/ux/scoreboard'
const CD_MINIMAP_ICONS_BASE = 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons'
const CD_MATCH_HISTORY_BASE =
  'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default'

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
const MINIMAP_OBJECTIVE_ICONS: Array<{ source: string; target: string }> = [
  { source: 'tower.png', target: 'tower.png' },
  { source: 'inhibitor.png', target: 'inhibitor.png' },
  { source: 'kindred_minimap_icon.png', target: 'kindred_minimap_icon.png' },
  { source: 'kindred_minimap_icon_enemy.png', target: 'kindred_minimap_icon_enemy.png' },
  { source: 'grub.png', target: 'grub.png' },
]
const CD_KAYN_HUD_BASE =
  'https://raw.communitydragon.org/latest/game/assets/characters/kayn/hud'
const KAYN_HUD_FILES = ['kayn_slay_square.png', 'kayn_ass_square.png'] as const

const MAP_PLANNER_FILES: Array<{ source: string; target: string }> = [
  { source: 'map11.png', target: 'map11.png' },
  { source: 'inhibitor-200.png', target: 'inhibitor-200.png' },
  { source: 'inhibitor-100.png', target: 'inhibitor-100.png' },
  { source: 'herald-200.png', target: 'herald-200.png' },
  { source: 'herald-100.png', target: 'herald-100.png' },
  { source: 'dead_blue.png', target: 'dead_blue.png' },
  { source: 'dead_red.png', target: 'dead_red.png' },
  { source: 'baron-200.png', target: 'baron-200.png' },
  { source: 'baron-100.png', target: 'baron-100.png' },
  { source: 'nexus_building_blue.png', target: 'nexus_building_blue.png' },
  { source: 'nexus_building_red.png', target: 'nexus_building_red.png' },
  { source: 'tower-100.png', target: 'tower-100.png' },
  { source: 'tower-200.png', target: 'tower-200.png' },
]

/**
 * Sync Community Dragon static assets (emblems, scoreboard icons, map planner).
 * Champion spell data for theorycraft is fetched by TheorycraftDataBuilderService.
 */
export class CommunityDragonService {
  private readonly dataDir: string

  constructor(
    dataDir: string = join(process.cwd(), '..', 'frontend', 'public', 'data', 'community-dragon')
  ) {
    this.dataDir = dataDir
  }

  private async fetchBinary(baseUrl: string, relativePath: string): Promise<Buffer> {
    return fetchBuffer(`${baseUrl}${relativePath}`, {
      timeoutMs: 30_000,
      headers: { 'User-Agent': 'Lelanation/1.0' },
    })
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

    for (const file of RANKED_EMBLEM_FILES) {
      try {
        const data = await this.fetchBinary(CD_RANKED_EMBLEM_BASE, `/${file}`)
        if (data == null || data.byteLength === 0) {
          failed++
          errors.push({ file, error: 'No data returned' })
          continue
        }
        const targetPath = join(emblemDir, file)
        const buffer = Buffer.from(data)
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

    for (const file of SCOREBOARD_OBJECTIVE_FILES) {
      try {
        const data = await this.fetchBinary(CD_SCOREBOARD_BASE, `/${file}`)
        if (data == null || data.byteLength === 0) {
          failed++
          errors.push({ file, error: 'No data returned' })
          continue
        }
        const targetPath = join(objectiveDir, file)
        await fs.writeFile(targetPath, Buffer.from(data))
        synced++
      } catch (error) {
        failed++
        const errorMessage = error instanceof Error ? error.message : String(error)
        errors.push({ file, error: errorMessage })
        console.error(`[CommunityDragon] Failed to sync scoreboard icon ${file}: ${errorMessage}`)
      }
    }

    for (const icon of MINIMAP_OBJECTIVE_ICONS) {
      try {
        const data = await this.fetchBinary(CD_MINIMAP_ICONS_BASE, `/${icon.source}`)
        if (data == null || data.byteLength === 0) {
          failed++
          errors.push({ file: icon.source, error: 'No data returned' })
          continue
        }
        const targetPath = join(objectiveDir, icon.target)
        await fs.writeFile(targetPath, Buffer.from(data))
        synced++
      } catch (error) {
        failed++
        const errorMessage = error instanceof Error ? error.message : String(error)
        errors.push({ file: icon.source, error: errorMessage })
        console.error(`[CommunityDragon] Failed to sync minimap icon ${icon.source}: ${errorMessage}`)
      }
    }

    return Result.ok({ synced, failed, errors })
  }

  /**
   * Sync map planner assets from Community Dragon match-history package.
   * Saves to {dataDir}/map-planner/*.png for frontend tactical board usage.
   */
  async syncMapPlannerAssets(): Promise<
    Result<
      { synced: number; failed: number; errors: Array<{ file: string; error: string }> },
      AppError
    >
  > {
    const mapPlannerDir = join(this.dataDir, 'map-planner')
    const dirResult = await FileManager.ensureDir(mapPlannerDir)
    if (dirResult.isErr()) {
      return Result.err(dirResult.unwrapErr())
    }

    let synced = 0
    let failed = 0
    const errors: Array<{ file: string; error: string }> = []

    for (const asset of MAP_PLANNER_FILES) {
      try {
        const data = await this.fetchBinary(CD_MATCH_HISTORY_BASE, `/${asset.source}`)
        if (data == null || data.byteLength === 0) {
          failed++
          errors.push({ file: asset.source, error: 'No data returned' })
          continue
        }
        const targetPath = join(mapPlannerDir, asset.target)
        await fs.writeFile(targetPath, Buffer.from(data))
        synced++
      } catch (error) {
        failed++
        const errorMessage = error instanceof Error ? error.message : String(error)
        errors.push({ file: asset.source, error: errorMessage })
        console.error(`[CommunityDragon] Failed to sync map planner asset ${asset.source}: ${errorMessage}`)
      }
    }

    return Result.ok({ synced, failed, errors })
  }

  /**
   * Sync Kayn transformation HUD squares (Darkin / Assassin) from Community Dragon.
   * Saves to backend staging and frontend `/images/game/latest/champion/`.
   */
  async syncKaynHudImages(): Promise<
    Result<
      { synced: number; failed: number; errors: Array<{ file: string; error: string }> },
      AppError
    >
  > {
    const targetDirs = [
      join(process.cwd(), 'data', 'images', 'latest', 'champion'),
      join(process.cwd(), '..', 'frontend', 'public', 'images', 'game', 'latest', 'champion'),
    ]

    let synced = 0
    let failed = 0
    const errors: Array<{ file: string; error: string }> = []

    for (const dir of targetDirs) {
      const dirResult = await FileManager.ensureDir(dir)
      if (dirResult.isErr()) {
        return Result.err(dirResult.unwrapErr())
      }
    }

    for (const file of KAYN_HUD_FILES) {
      try {
        const data = await this.fetchBinary(CD_KAYN_HUD_BASE, `/${file}`)
        if (data == null || data.byteLength === 0) {
          failed++
          errors.push({ file, error: 'No data returned' })
          continue
        }
        const buffer = Buffer.from(data)
        for (const dir of targetDirs) {
          await fs.writeFile(join(dir, file), buffer)
        }
        synced++
      } catch (error) {
        failed++
        const errorMessage = error instanceof Error ? error.message : String(error)
        errors.push({ file, error: errorMessage })
        console.error(`[CommunityDragon] Failed to sync Kayn HUD image ${file}: ${errorMessage}`)
      }
    }

    return Result.ok({ synced, failed, errors })
  }
}
