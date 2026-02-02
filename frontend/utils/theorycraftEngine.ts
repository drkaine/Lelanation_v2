/**
 * Theorycraft engine: real champion stats and spell damage from CommunityDragon + Data Dragon.
 * No resistances, items, runes, or temporary buffs.
 */

import type {
  ChampionStats,
  ChampionLevelStats,
  SpellDefinition,
  SpellScaling,
  SpellDamageResult,
  ChampionSpellSummary,
} from '~/types/theorycraft'
import type { Champion } from '~/types/build'

// --- Raw CommunityDragon types (minimal for parsing) ---

interface SpellDataValue {
  mName?: string
  mValues?: number[]
  __type?: string
}

interface SpellEffectAmount {
  value?: number[]
  __type?: string
}

interface SpellDataResource {
  DataValues?: SpellDataValue[]
  mEffectAmount?: SpellEffectAmount[]
  cooldownTime?: number[]
  mana?: number[]
}

interface SpellObject {
  mScriptName?: string
  mSpell?: SpellDataResource
  __type?: string
}

interface CommunityDragonJson {
  [path: string]:
    | {
        spells?: string[]
        spellNames?: string[]
        [key: string]: unknown
      }
    | SpellObject
}

const SPELL_KEYS = ['Q', 'W', 'E', 'R'] as const

/** DataValue names we treat as base damage (first matching wins for primary damage). */
const BASE_DAMAGE_NAMES = ['BaseDamage', 'STBaseDamage', 'AoEBaseDamage', 'ExplosionBaseDamage']

/** DataValue names for ratios (we take first value per rank). */
const RATIO_NAMES: Record<string, keyof SpellScaling> = {
  TotalADRatio: 'adRatio',
  BonusADRatio: 'bonusAdRatio',
  APRatio: 'apRatio',
  SpellDamageRatio: 'apRatio',
  AbilityPowerRatio: 'apRatio',
  WAoEAPRatio: 'apRatio',
  WSingleTargetAPRatio: 'apRatio',
}

// --- 1) Champion stats at level ---

/**
 * Compute champion stats at a given level.
 * Formula: stat = base + (level - 1) * perLevel.
 * Attack speed: baseAS * (1 + (level - 1) * attackspeedperlevel / 100).
 */
export function computeChampionStats(baseStats: ChampionStats, level: number): ChampionLevelStats {
  const lvl = Math.max(1, Math.min(18, level))
  const mult = lvl - 1

  return {
    level: lvl,
    hp: baseStats.hp + baseStats.hpperlevel * mult,
    hpRegen: baseStats.hpregen + baseStats.hpregenperlevel * mult,
    mana: baseStats.mp + baseStats.mpperlevel * mult,
    manaRegen: baseStats.mpregen + baseStats.mpregenperlevel * mult,
    attackDamage: baseStats.attackdamage + baseStats.attackdamageperlevel * mult,
    attackSpeed: baseStats.attackspeed * (1 + (baseStats.attackspeedperlevel / 100) * mult),
    armor: baseStats.armor + baseStats.armorperlevel * mult,
    magicResist: baseStats.spellblock + baseStats.spellblockperlevel * mult,
    movementSpeed: baseStats.movespeed,
    attackRange: baseStats.attackrange,
    abilityPower: 0,
  }
}

// --- 2) Parse CommunityDragon JSON into SpellDefinitions ---

function getCharacterSpellPaths(json: CommunityDragonJson, championId: string): string[] {
  const prefix = `Characters/${championId}/`
  for (const key of Object.keys(json)) {
    if (!key.startsWith(prefix)) continue
    const entry = json[key]
    if (entry && typeof entry === 'object' && 'spells' in entry && Array.isArray(entry.spells)) {
      return entry.spells as string[]
    }
  }
  return []
}

/** Normalize champion id to CommunityDragon file name (e.g. Aatrox, JarvanIV). */
export function getCommunityDragonChampionFileName(championId: string): string {
  return championId
}

/**
 * Load CommunityDragon JSON from static path and return spell definitions.
 * Path: /data/community-dragon/{championId}.json (no fetch to web).
 */
export async function loadCommunityDragonSpellDefinitions(
  championId: string
): Promise<SpellDefinition[]> {
  const fileName = getCommunityDragonChampionFileName(championId)
  const url = `/data/community-dragon/${fileName}.json`
  const res = await fetch(url)
  if (!res.ok) return []
  const json = (await res.json()) as CommunityDragonJson
  return parseCommunityDragonSpells(championId, json)
}

function getDataValues(spell: SpellDataResource): Map<string, number[]> {
  const map = new Map<string, number[]>()
  const list = spell.DataValues ?? []
  for (const dv of list) {
    const name = dv.mName
    const values = dv.mValues
    if (name && values && values.length > 0) {
      map.set(name, values)
    }
  }
  return map
}

function getBaseDamageFromSpell(spell: SpellDataResource): number[] {
  const dataValues = getDataValues(spell)
  for (const name of BASE_DAMAGE_NAMES) {
    const values = dataValues.get(name)
    if (values && values.length > 0) {
      // Rank 0 is sometimes unused; use indices 1..5 or 0..4
      const start = values[0] != null && values[0] < 0 ? 1 : 0
      const slice = values.slice(start, start + 6).filter((v): v is number => typeof v === 'number')
      if (slice.length >= 1) return slice
    }
  }
  const effectAmount = spell.mEffectAmount?.[0]?.value
  if (effectAmount && effectAmount.length > 0) {
    const start = effectAmount[0] != null && effectAmount[0] < 0 ? 1 : 0
    return effectAmount.slice(start, start + 6).filter((v): v is number => typeof v === 'number')
  }
  return []
}

function getScalingFromDataValues(dataValues: Map<string, number[]>): SpellScaling {
  const scaling: SpellScaling = {}
  for (const [name, values] of dataValues) {
    const ratioKey = RATIO_NAMES[name]
    if (ratioKey && values.length > 0) {
      const v = values[0] ?? values[1]
      if (v != null && typeof v === 'number') {
        if (ratioKey === 'apRatio' && scaling.apRatio != null) continue
        ;(scaling as Record<string, number>)[ratioKey] = v
      }
    }
  }
  return scaling
}

function normalizeSpellKey(index: number): 'Q' | 'W' | 'E' | 'R' {
  return SPELL_KEYS[Math.max(0, Math.min(index, 3))] ?? 'Q'
}

/**
 * Parse CommunityDragon JSON for a champion into normalized spell definitions (Q/W/E/R).
 * Uses character metadata "spells" array for order; falls back to script name mapping if needed.
 */
export function parseCommunityDragonSpells(
  championId: string,
  json: CommunityDragonJson
): SpellDefinition[] {
  const spellPaths = getCharacterSpellPaths(json, championId)
  const definitions: SpellDefinition[] = []

  for (let i = 0; i < Math.min(4, spellPaths.length); i++) {
    const path = spellPaths[i]
    const entry = json[path] as SpellObject | undefined
    if (!entry?.mSpell) continue

    const key = normalizeSpellKey(i)
    const spellId = `${championId}${key}`
    const mSpell = entry.mSpell

    const baseDamageByRank = getBaseDamageFromSpell(mSpell)
    const dataValues = getDataValues(mSpell)
    const scaling = getScalingFromDataValues(dataValues)

    const cooldownByRank = mSpell.cooldownTime ?? []
    const costByRank = mSpell.mana ?? []

    definitions.push({
      key,
      spellId,
      baseDamageByRank: baseDamageByRank.length > 0 ? baseDamageByRank : [0],
      cooldownByRank: cooldownByRank.length > 0 ? cooldownByRank : [0],
      costByRank: costByRank.length > 0 ? costByRank : [0],
      scaling,
    })
  }

  return definitions
}

// --- 3) Spell damage calculation ---

/**
 * Resolve total damage from base + scaling (flat + total AD + bonus AD + AP).
 * No HP% or target stats in this baseline.
 */
function resolveSpellDamage(
  base: number,
  scaling: SpellScaling,
  stats: ChampionLevelStats,
  championBaseAd: number
): number {
  let total = base
  const bonusAd = Math.max(0, stats.attackDamage - championBaseAd)

  if (scaling.adRatio != null) total += scaling.adRatio * stats.attackDamage
  if (scaling.bonusAdRatio != null) total += scaling.bonusAdRatio * bonusAd
  if (scaling.apRatio != null) total += scaling.apRatio * (stats.abilityPower ?? 0)

  return Math.max(0, total)
}

function getChampionBaseAdAtLevel(baseStats: ChampionStats, level: number): number {
  const mult = Math.max(0, level - 1)
  return baseStats.attackdamage + baseStats.attackdamageperlevel * mult
}

/**
 * Optional stats override (e.g. from items/runes). When provided, used instead of champion base stats for damage.
 */
export interface SpellDamageStatsOverride {
  attackDamage: number
  abilityPower?: number
}

/**
 * Compute spell damage (and cooldown/cost) for one spell at given spell level and champion level.
 * When overrideStats is provided (e.g. from build with items/runes), damage uses those values.
 */
export function computeSpellDamage(
  _championId: string,
  spellKey: 'Q' | 'W' | 'E' | 'R',
  spellLevel: number,
  championLevel: number,
  champion: Champion,
  spellDefinitions: SpellDefinition[],
  overrideStats?: SpellDamageStatsOverride
): SpellDamageResult | null {
  const def = spellDefinitions.find(d => d.key === spellKey)
  if (!def) return null

  const baseStats = champion.stats
  const levelStats = computeChampionStats(baseStats, championLevel)
  const championBaseAd = getChampionBaseAdAtLevel(baseStats, championLevel)

  const rankIndex = Math.max(0, Math.min(spellLevel - 1, def.baseDamageByRank.length - 1))
  const base = def.baseDamageByRank[rankIndex] ?? 0
  const cooldown = def.cooldownByRank[rankIndex] ?? def.cooldownByRank[0] ?? 0
  const cost = def.costByRank[rankIndex] ?? def.costByRank[0] ?? 0

  const statsForDamage =
    overrideStats != null
      ? {
          ...levelStats,
          attackDamage: overrideStats.attackDamage,
          abilityPower: overrideStats.abilityPower ?? 0,
        }
      : { ...levelStats, abilityPower: levelStats.abilityPower ?? 0 }

  const totalDamage = resolveSpellDamage(base, def.scaling, statsForDamage, championBaseAd)

  return {
    spellKey: def.key,
    spellId: def.spellId,
    spellLevel,
    base,
    adRatio: def.scaling.adRatio ?? 0,
    bonusAdRatio: def.scaling.bonusAdRatio ?? 0,
    apRatio: def.scaling.apRatio ?? 0,
    totalDamage: Math.round(totalDamage),
    cooldown,
    cost,
  }
}

/**
 * Compute full spell summary for a champion at a given level.
 * spellLevels: optional map Q/W/E/R -> rank (default 1 for all).
 */
export function computeChampionSpellSummary(
  champion: Champion,
  level: number,
  spellDefinitions: SpellDefinition[],
  spellLevels?: Partial<Record<'Q' | 'W' | 'E' | 'R', number>>
): ChampionSpellSummary {
  const spells: Record<'Q' | 'W' | 'E' | 'R', SpellDamageResult> = {} as Record<
    'Q' | 'W' | 'E' | 'R',
    SpellDamageResult
  >
  for (const key of SPELL_KEYS) {
    const rank = spellLevels?.[key] ?? 1
    const result = computeSpellDamage(champion.id, key, rank, level, champion, spellDefinitions)
    if (result) spells[key] = result
  }
  return {
    champion: champion.name,
    championId: champion.id,
    level,
    spells,
  }
}

/**
 * Compute spell damage per rank (1..maxRank) for all Q/W/E/R.
 * Returns same shape as getSpellDamageByRank: array of { rank, damage }[] per spell index.
 * When overrideStats is provided (e.g. buildStats), damage includes items/runes.
 */
export function getSpellDamageByRankFromEngine(
  champion: Champion,
  level: number,
  spellDefinitions: SpellDefinition[],
  overrideStats?: SpellDamageStatsOverride
): { rank: number; damage: number }[][] {
  const out: { rank: number; damage: number }[][] = []
  for (const key of SPELL_KEYS) {
    const def = spellDefinitions.find(d => d.key === key)
    const maxRank = def ? Math.max(1, def.baseDamageByRank.length) : 5
    const rows: { rank: number; damage: number }[] = []
    for (let rank = 1; rank <= maxRank; rank++) {
      const result = computeSpellDamage(
        champion.id,
        key,
        rank,
        level,
        champion,
        spellDefinitions,
        overrideStats
      )
      rows.push({ rank, damage: result?.totalDamage ?? 0 })
    }
    out.push(rows)
  }
  return out
}
