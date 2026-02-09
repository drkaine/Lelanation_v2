import { join } from 'path'
import { Result } from '../utils/Result.js'
import { AppError } from '../utils/errors.js'
import { FileManager } from '../utils/fileManager.js'

/** Community Dragon v1 spell (rcp-be-lol-game-data). */
interface CDSpell {
  spellKey?: string
  name?: string
  description?: string
  dynamicDescription?: string
  costCoefficients?: number[]
  cooldownCoefficients?: number[]
  effectAmounts?: Record<string, number[]>
}

/** Community Dragon v1 champion JSON. */
interface CDChampionJson {
  id?: number
  name?: string
  title?: string
  passive?: { name?: string; description?: string }
  spells?: CDSpell[]
}

/**
 * Merge Community Dragon (v1, localized) with Data Dragon championFull.
 * Single source: CD for names/descriptions/spell values, DDragon for stats/images/structure.
 * Writes merged championFull.json (one file instead of champion.json + championFull.json for display).
 */
export class ChampionMergeService {
  private readonly gameDataDir: string
  private readonly communityDragonDir: string

  constructor(
    gameDataDir: string = join(process.cwd(), 'data', 'game'),
    communityDragonDir: string = join(process.cwd(), 'data', 'community-dragon')
  ) {
    this.gameDataDir = gameDataDir
    this.communityDragonDir = communityDragonDir
  }

  /**
   * Build effect array for DDragon spell from CD effectAmounts (first non-zero array, 5 ranks).
   */
  private static effectFromCD(spell: CDSpell | undefined): Array<number[] | null> | undefined {
    if (!spell?.effectAmounts) return undefined
    for (const arr of Object.values(spell.effectAmounts)) {
      if (!Array.isArray(arr) || arr.length === 0) continue
      const values = arr.slice(0, 5).filter((v): v is number => typeof v === 'number')
      if (values.some(v => v !== 0)) {
        return [null, values, values, values, values, values]
      }
    }
    return undefined
  }

  /**
   * Merge one champion: DDragon base (id, key, image, stats, tags, spell images) + CD (name, title, passive, spell text and values).
   */
  private mergeChampion(ddChamp: Record<string, unknown>, cd: CDChampionJson): Record<string, unknown> {
    const merged = { ...ddChamp }
    if (cd.name != null) merged.name = cd.name
    if (cd.title != null) merged.title = cd.title
    if (cd.passive) {
      const passive = (merged.passive as Record<string, unknown>) ?? {}
      merged.passive = {
        ...passive,
        name: cd.passive.name ?? passive.name,
        description: cd.passive.description ?? passive.description,
      }
    }
    const ddSpells = (merged.spells as Record<string, unknown>[] | undefined) ?? []
    const cdSpells = cd.spells ?? []
    merged.spells = ddSpells.map((s, i) => {
      const cdSpell = cdSpells[i]
      const spell = { ...s }
      if (cdSpell?.name != null) spell.name = cdSpell.name
      if (cdSpell?.description != null) spell.description = cdSpell.description
      if (cdSpell?.dynamicDescription != null) spell.tooltip = cdSpell.dynamicDescription
      if (cdSpell?.cooldownCoefficients?.length) spell.cooldown = cdSpell.cooldownCoefficients
      if (cdSpell?.costCoefficients?.length) spell.cost = cdSpell.costCoefficients
      const effect = ChampionMergeService.effectFromCD(cdSpell)
      if (effect != null) spell.effect = effect
      return spell
    })
    return merged
  }

  /**
   * Run merge for a version and language. Reads DDragon championFull and CD JSONs from backend, writes merged championFull.
   */
  async mergeChampionFull(
    version: string,
    language: string = 'fr_FR'
  ): Promise<Result<{ merged: number; skipped: number }, AppError>> {
    const versionDir = join(this.gameDataDir, version, language)
    const championFullPath = join(versionDir, 'championFull.json')

    const readResult = await FileManager.readJson<{ data: Record<string, Record<string, unknown>> }>(
      championFullPath
    )
    if (readResult.isErr()) {
      return Result.err(
        new AppError(
          `Failed to read championFull for merge: ${championFullPath}`,
          'FILE_ERROR',
          readResult.unwrapErr()
        )
      )
    }

    const ddData = readResult.unwrap().data
    if (!ddData || typeof ddData !== 'object') {
      return Result.err(new AppError('Invalid championFull structure', 'DATA_ERROR'))
    }

    let merged = 0
    let skipped = 0
    const mergedData: Record<string, Record<string, unknown>> = {}

    for (const [id, ddChamp] of Object.entries(ddData)) {
      const key = (ddChamp.key as string) ?? (ddChamp as { key?: string }).key
      if (!key) {
        mergedData[id] = ddChamp as Record<string, unknown>
        skipped++
        continue
      }
      const cdPath = join(this.communityDragonDir, `${key}.json`)
      const cdResult = await FileManager.readJson<CDChampionJson>(cdPath)
      if (cdResult.isErr()) {
        mergedData[id] = ddChamp as Record<string, unknown>
        skipped++
        continue
      }
      mergedData[id] = this.mergeChampion(ddChamp as Record<string, unknown>, cdResult.unwrap())
      merged++
    }

    const writeResult = await FileManager.writeJson(championFullPath, { data: mergedData })
    if (writeResult.isErr()) {
      return Result.err(
        new AppError(
          `Failed to write merged championFull: ${championFullPath}`,
          'FILE_ERROR',
          writeResult.unwrapErr()
        )
      )
    }
    return Result.ok({ merged, skipped })
  }
}
