import { basename, join } from 'path'
import { promises as fs } from 'fs'
import { Result } from '../utils/Result.js'
import { AppError } from '../utils/errors.js'
import { FileManager } from '../utils/fileManager.js'

/** Community Dragon cleaned spell payload. */
interface CDSpell {
  spellKey?: string
  cost?: string
  cooldown?: string
  range?: number[]
  costCoefficients?: number[]
  cooldownCoefficients?: number[]
  effectAmounts?: Record<string, number[]>
  maxLevel?: number
}

/** Community Dragon cleaned champion JSON. */
interface CDChampionJson {
  passive?: {
    name?: string
    description?: string
    abilityIconPath?: string
  }
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
  private readonly frontendGameDataDir: string
  private readonly frontendCommunityDragonDir: string

  constructor(
    gameDataDir: string = join(process.cwd(), 'data', 'game'),
    communityDragonDir: string = join(process.cwd(), 'data', 'community-dragon'),
    frontendGameDataDir: string = join(process.cwd(), '..', 'frontend', 'public', 'data', 'game'),
    frontendCommunityDragonDir: string = join(
      process.cwd(),
      '..',
      'frontend',
      'public',
      'data',
      'community-dragon'
    )
  ) {
    this.gameDataDir = gameDataDir
    this.communityDragonDir = communityDragonDir
    this.frontendGameDataDir = frontendGameDataDir
    this.frontendCommunityDragonDir = frontendCommunityDragonDir
  }

  private async resolveChampionFullPaths(
    version: string,
    language: string
  ): Promise<Result<string[], AppError>> {
    const backendPath = join(this.gameDataDir, version, language, 'championFull.json')
    const frontendPath = join(this.frontendGameDataDir, version, language, 'championFull.json')
    const paths: string[] = []
    if (await FileManager.exists(backendPath)) paths.push(backendPath)
    if (await FileManager.exists(frontendPath)) paths.push(frontendPath)
    if (paths.length === 0) {
      return Result.err(
        new AppError(
          `championFull.json not found in backend or frontend for ${version}/${language}`,
          'FILE_ERROR'
        )
      )
    }
    return Result.ok(paths)
  }

  private async readCommunityChampionByKey(key: string): Promise<Result<CDChampionJson | null, AppError>> {
    for (const baseDir of [this.communityDragonDir, this.frontendCommunityDragonDir]) {
      const filePath = join(baseDir, `${key}.json`)
      const readResult = await FileManager.readJson<CDChampionJson>(filePath)
      if (readResult.isOk()) {
        return Result.ok(readResult.unwrap())
      }
    }
    return Result.ok(null)
  }

  private async deleteCommunityJsonFiles(baseDir: string): Promise<number> {
    if (!(await FileManager.exists(baseDir))) return 0
    let deleted = 0
    const entries = await fs.readdir(baseDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue
      await fs.unlink(join(baseDir, entry.name)).catch(() => {})
      deleted++
    }
    return deleted
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

  private static toSpellKey(index: number): string {
    return ['q', 'w', 'e', 'r'][index] ?? ''
  }

  /**
   * Merge one champion: DDragon base + Community spell values (strict Q/W/E/R mapping).
   */
  private mergeChampion(ddChamp: Record<string, unknown>, cd: CDChampionJson): Record<string, unknown> {
    const merged = { ...ddChamp }
    const ddSpells = (merged.spells as Record<string, unknown>[] | undefined) ?? []
    const cdSpells = cd.spells ?? []
    const cdByKey = new Map<string, CDSpell>()
    cdSpells.forEach((s, idx) => {
      const key = (s.spellKey || ChampionMergeService.toSpellKey(idx) || '').toLowerCase()
      if (key) cdByKey.set(key, s)
    })

    merged.spells = ddSpells.map((s, i) => {
      const expectedKey = ChampionMergeService.toSpellKey(i)
      const cdSpell = cdByKey.get(expectedKey) ?? cdSpells[i]
      const spell = { ...s }
      if (cdSpell?.cooldown != null) spell.cooldownBurn = cdSpell.cooldown
      if (cdSpell?.cooldownCoefficients?.length) spell.cooldown = cdSpell.cooldownCoefficients
      if (cdSpell?.cost != null) spell.costBurn = cdSpell.cost
      if (cdSpell?.costCoefficients?.length) spell.cost = cdSpell.costCoefficients
      if (cdSpell?.range?.length) {
        spell.range = cdSpell.range
        spell.rangeBurn = cdSpell.range.join('/')
      }
      if (typeof cdSpell?.maxLevel === 'number' && cdSpell.maxLevel > 0) spell.maxrank = cdSpell.maxLevel
      const effect = ChampionMergeService.effectFromCD(cdSpell)
      if (effect != null) spell.effect = effect
      return spell
    })

    if (cd.passive && typeof cd.passive === 'object') {
      const ddPassive = (merged.passive as Record<string, unknown> | undefined) ?? {}
      const nextPassive: Record<string, unknown> = { ...ddPassive }
      if (typeof cd.passive.name === 'string' && cd.passive.name.length > 0) {
        nextPassive.name = cd.passive.name
      }
      if (typeof cd.passive.description === 'string' && cd.passive.description.length > 0) {
        nextPassive.description = cd.passive.description
      }
      if (typeof cd.passive.abilityIconPath === 'string' && cd.passive.abilityIconPath.length > 0) {
        const iconFile = basename(cd.passive.abilityIconPath)
        nextPassive.image = { full: iconFile }
      }
      merged.passive = nextPassive
    }

    return merged
  }

  /**
   * Run merge for a version and language. Reads DDragon championFull and CD JSONs from backend, writes merged championFull.
   */
  async mergeChampionFull(
    version: string,
    language: string = 'fr_FR'
  ): Promise<Result<{ merged: number; skipped: number }, AppError>> {
    const pathResult = await this.resolveChampionFullPaths(version, language)
    if (pathResult.isErr()) return Result.err(pathResult.unwrapErr())
    const championFullPaths = pathResult.unwrap()

    const primaryChampionFullPath = championFullPaths[0]
    const readResult = await FileManager.readJson<{ data: Record<string, Record<string, unknown>> }>(
      primaryChampionFullPath
    )
    if (readResult.isErr()) {
      return Result.err(
        new AppError(
          `Failed to read championFull for merge: ${primaryChampionFullPath}`,
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
      const ddChampObj = ddChamp as { key?: unknown }
      const champKey = typeof ddChampObj.key === 'string' ? ddChampObj.key : undefined
      if (!champKey) {
        mergedData[id] = ddChamp as Record<string, unknown>
        skipped++
        continue
      }
      const cdResult = await this.readCommunityChampionByKey(champKey)
      if (cdResult.isErr() || cdResult.unwrap() == null) {
        mergedData[id] = ddChamp as Record<string, unknown>
        skipped++
        continue
      }
      mergedData[id] = this.mergeChampion(ddChamp as Record<string, unknown>, cdResult.unwrap()!)
      merged++
    }

    for (const championFullPath of championFullPaths) {
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
    }

    // After a successful merge, community champion JSON files are no longer needed.
    await this.deleteCommunityJsonFiles(this.communityDragonDir)
    await this.deleteCommunityJsonFiles(this.frontendCommunityDragonDir)

    return Result.ok({ merged, skipped })
  }
}
