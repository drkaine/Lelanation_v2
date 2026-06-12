import type {
  ChampionMiscBaseStatKey,
  ChampionMiscGrowthStatKey,
  ChampionMiscStatRow,
} from './championBaseStatsFromJson'
import { resolveChampionResourceKind } from './theorycraftStats'

export const CHAMPION_MISC_MIN_LEVEL = 1
export const CHAMPION_MISC_MAX_LEVEL = 20

const GROWTH_STAT_KEYS: readonly ChampionMiscGrowthStatKey[] = [
  'hp',
  'hpRegen',
  'mp',
  'mpRegen',
  'armor',
  'magicResist',
  'attackDamage',
  'attackSpeed',
]

export function clampChampionMiscLevel(level: number): number {
  const n = Math.round(Number(level))
  if (!Number.isFinite(n)) return CHAMPION_MISC_MIN_LEVEL
  return Math.min(CHAMPION_MISC_MAX_LEVEL, Math.max(CHAMPION_MISC_MIN_LEVEL, n))
}

const FLAT_LEVEL_KEYS = new Set<ChampionMiscBaseStatKey>(['movespeed', 'attackRange'])

/** Riot utilise parfois 10 000 comme valeur sentinelle pour les champions sans mana. */
export function championMiscManaUnavailable(
  row: Pick<ChampionMiscStatRow, 'partype' | 'base'>
): boolean {
  if (resolveChampionResourceKind(row.partype) === 'none') return true
  return (row.base.mp ?? 0) >= 9999
}

export function championMiscStatUnavailable(
  row: Pick<ChampionMiscStatRow, 'partype' | 'base'>,
  key: ChampionMiscBaseStatKey | ChampionMiscGrowthStatKey
): boolean {
  if (key !== 'mp' && key !== 'mpRegen') return false
  return championMiscManaUnavailable(row)
}

export function computeChampionMiscStatAtLevel(
  key: ChampionMiscBaseStatKey,
  base: number,
  growth: number,
  level: number
): number {
  const lvl = clampChampionMiscLevel(level)
  if (FLAT_LEVEL_KEYS.has(key)) return base
  if (key === 'attackSpeed') {
    return base * (1 + (growth / 100) * (lvl - 1))
  }
  if ((GROWTH_STAT_KEYS as readonly string[]).includes(key)) {
    return base + growth * (lvl - 1)
  }
  return base
}

export function championMiscStatValueAtLevel(
  row: ChampionMiscStatRow,
  key: ChampionMiscBaseStatKey,
  level: number
): number {
  const growth = (GROWTH_STAT_KEYS as readonly string[]).includes(key)
    ? row.growth[key as ChampionMiscGrowthStatKey]
    : 0
  return computeChampionMiscStatAtLevel(key, row.base[key] ?? 0, growth ?? 0, level)
}
