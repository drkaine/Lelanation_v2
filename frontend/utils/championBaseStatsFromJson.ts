import { expandKledMiscStatRows } from './championMiscStatVariants'
import type { ChampionMiscStatVariant } from './championMiscStatVariants'
import { getChampionDetailUrl, getChampionIndexUrl } from '~/utils/staticDataUrl'

export const CHAMPION_MISC_BASE_STAT_KEYS = [
  'hp',
  'hpRegen',
  'mp',
  'mpRegen',
  'armor',
  'magicResist',
  'attackDamage',
  'attackSpeed',
  'attackRange',
  'movespeed',
] as const

export const CHAMPION_MISC_GROWTH_STAT_KEYS = [
  'hp',
  'hpRegen',
  'mp',
  'mpRegen',
  'armor',
  'magicResist',
  'attackSpeed',
] as const

export type ChampionMiscBaseStatKey = (typeof CHAMPION_MISC_BASE_STAT_KEYS)[number]
export type ChampionMiscGrowthStatKey = (typeof CHAMPION_MISC_GROWTH_STAT_KEYS)[number]

export type ChampionMiscSortCol =
  | 'champion'
  | `base_${ChampionMiscBaseStatKey}`
  | `growth_${ChampionMiscGrowthStatKey}`

/** Icon / i18n label keys (stats.labels.*). */
export const CHAMPION_MISC_STAT_ICON_KEYS: Record<
  ChampionMiscBaseStatKey | ChampionMiscGrowthStatKey,
  string
> = {
  hp: 'health',
  hpRegen: 'healthRegen',
  mp: 'mana',
  mpRegen: 'manaRegen',
  armor: 'armor',
  magicResist: 'magicResist',
  attackDamage: 'attackDamage',
  attackSpeed: 'attackSpeed',
  attackRange: 'attackRange',
  movespeed: 'movementSpeed',
}

export type ChampionMiscStatRow = {
  championId: number
  championSlug: string
  name: string
  imageFull: string
  partype: string
  /** Forme spéciale (ex. Kled désarçonné / Skaarl / duo monté). */
  variant?: ChampionMiscStatVariant
  base: Record<ChampionMiscBaseStatKey, number>
  growth: Record<ChampionMiscGrowthStatKey, number>
}

type JsonBaseStats = Partial<Record<ChampionMiscBaseStatKey, number>>
type JsonGrowthStats = Partial<Record<ChampionMiscGrowthStatKey, number>>

function safeNumber(value: unknown): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function mapBaseStats(
  raw: JsonBaseStats | null | undefined
): Record<ChampionMiscBaseStatKey, number> {
  return {
    hp: safeNumber(raw?.hp),
    hpRegen: safeNumber(raw?.hpRegen),
    mp: safeNumber(raw?.mp),
    mpRegen: safeNumber(raw?.mpRegen),
    armor: safeNumber(raw?.armor),
    magicResist: safeNumber(raw?.magicResist),
    attackDamage: safeNumber(raw?.attackDamage),
    attackSpeed: safeNumber(raw?.attackSpeed),
    attackRange: safeNumber(raw?.attackRange),
    movespeed: safeNumber(raw?.movespeed),
  }
}

function mapGrowthStats(
  raw: JsonGrowthStats | null | undefined
): Record<ChampionMiscGrowthStatKey, number> {
  return {
    hp: safeNumber(raw?.hp),
    hpRegen: safeNumber(raw?.hpRegen),
    mp: safeNumber(raw?.mp),
    mpRegen: safeNumber(raw?.mpRegen),
    armor: safeNumber(raw?.armor),
    magicResist: safeNumber(raw?.magicResist),
    attackDamage: safeNumber(raw?.attackDamage),
    attackSpeed: safeNumber(raw?.attackSpeed),
  }
}

export function formatChampionMiscStatValue(
  key: ChampionMiscBaseStatKey | ChampionMiscGrowthStatKey,
  value: number
): string {
  if (key === 'attackSpeed') {
    return value.toFixed(3)
  }
  if (key === 'attackRange' || key === 'movespeed') {
    return String(Math.round(value))
  }
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(2)
}

export async function loadAllChampionMiscStatsFromJson(
  version: string,
  language: string
): Promise<ChampionMiscStatRow[]> {
  const indexRes = await fetch(getChampionIndexUrl(version, language))
  if (!indexRes.ok) {
    throw new Error(`Champion index returned ${indexRes.status}`)
  }
  const indexPayload = await indexRes.json()
  const champions = Array.isArray(indexPayload?.champions) ? indexPayload.champions : []

  const rows = await Promise.all(
    champions.map(
      async (entry: { id?: string; key?: number; name?: string; image?: { full?: string } }) => {
        const slug = String(entry?.id ?? '').trim()
        if (!slug) return null
        try {
          const detailRes = await fetch(getChampionDetailUrl(version, language, slug))
          if (!detailRes.ok) return null
          const detailPayload = await detailRes.json()
          const champion = detailPayload?.champion
          if (!champion?.baseStats || !champion?.growthStats) return null
          const row = {
            championId: Number(entry?.key ?? champion?.key ?? 0),
            championSlug: slug,
            name: String(champion?.name ?? entry?.name ?? slug),
            imageFull: String(champion?.image?.full ?? entry?.image?.full ?? `${slug}.png`),
            partype: String(champion?.partype ?? ''),
            base: mapBaseStats(champion.baseStats as JsonBaseStats),
            growth: mapGrowthStats(champion.growthStats as JsonGrowthStats),
          } satisfies ChampionMiscStatRow
          return expandKledMiscStatRows(row, champion)
        } catch {
          return null
        }
      }
    )
  )

  return rows
    .flat()
    .filter((row): row is ChampionMiscStatRow => row != null && row.championId > 0)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}
