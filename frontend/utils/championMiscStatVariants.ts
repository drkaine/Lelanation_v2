import type {
  ChampionMiscBaseStatKey,
  ChampionMiscGrowthStatKey,
  ChampionMiscStatRow,
} from '~/utils/championBaseStatsFromJson'

export const KLED_CHAMPION_ID = 240

/** Kled désarçonné, monture Skaarl (PV seulement), ou duo monté (PV combinés). */
export type ChampionMiscStatVariant = 'kled' | 'skaarl' | 'duo'

const KLED_VARIANT_ORDER: Record<ChampionMiscStatVariant, number> = {
  kled: 0,
  skaarl: 1,
  duo: 2,
}

const KLED_DISMOUNTED_ATTACK_RANGE_BONUS = 125

type JsonPassive = {
  calculations?: Array<{ key?: string; baseValues?: number[] }>
  dataValues?: Array<{ name?: string; values?: number[] }>
}

type JsonChampionDetail = {
  key?: number
  baseStats?: Partial<Record<ChampionMiscBaseStatKey, number>>
  growthStats?: Partial<Record<ChampionMiscGrowthStatKey, number>>
  passive?: JsonPassive
}

function passiveDataValue(passive: JsonPassive | null | undefined, name: string): number | null {
  const entry = passive?.dataValues?.find(d => d.name === name)
  const value = entry?.values?.[0]
  return Number.isFinite(Number(value)) ? Number(value) : null
}

function passiveCalculationBaseValues(
  passive: JsonPassive | null | undefined,
  key: string
): number[] {
  const calc = passive?.calculations?.find(c => c.key === key)
  return Array.isArray(calc?.baseValues)
    ? calc.baseValues.map(v => Number(v)).filter(Number.isFinite)
    : []
}

/** PV de Skaarl et croissance / niveau dérivés du passif (niveaux 1 → 5 du passif). */
export function deriveSkaarlHpStats(passive: JsonPassive | null | undefined): {
  base: number
  growth: number
} {
  const values = passiveCalculationBaseValues(passive, 'skaarlhealth')
  if (values.length === 0) return { base: 400, growth: 58.82 }
  const base = values[0]!
  if (values.length < 2) return { base, growth: 58.82 }
  return { base, growth: (values[1]! - base) / 4 }
}

export function isKledMiscStatChampion(championId: number): boolean {
  return championId === KLED_CHAMPION_ID
}

export function championMiscStatRowKey(
  championId: number,
  variant?: ChampionMiscStatVariant | null
): string {
  if (!variant || !isKledMiscStatChampion(championId)) return String(championId)
  return `${championId}:${variant}`
}

export type ChampionMiscStatVariantLabelKey =
  | 'statisticsPage.miscVariantKled'
  | 'statisticsPage.miscVariantSkaarl'
  | 'statisticsPage.miscVariantDuo'

export function championMiscStatVariantLabelKey(
  variant: ChampionMiscStatVariant
): ChampionMiscStatVariantLabelKey {
  if (variant === 'skaarl') return 'statisticsPage.miscVariantSkaarl'
  if (variant === 'duo') return 'statisticsPage.miscVariantDuo'
  return 'statisticsPage.miscVariantKled'
}

export function championMiscStatDisplayName(
  row: Pick<ChampionMiscStatRow, 'name' | 'championId' | 'variant'>,
  t: (key: string) => string
): string {
  if (!row.variant || !isKledMiscStatChampion(row.championId)) return row.name
  return `${row.name} · ${t(championMiscStatVariantLabelKey(row.variant))}`
}

export function compareChampionMiscStatRowsByChampion(
  a: ChampionMiscStatRow,
  b: ChampionMiscStatRow
): number {
  const byName = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  if (byName !== 0) return byName
  const av = a.variant ? (KLED_VARIANT_ORDER[a.variant] ?? 99) : 0
  const bv = b.variant ? (KLED_VARIANT_ORDER[b.variant] ?? 99) : 0
  return av - bv
}

const KLED_VARIANT_SEARCH_TERMS: Record<ChampionMiscStatVariant, readonly string[]> = {
  kled: ['kled désarçonné', 'kled dismounted', 'dismounted kled', 'désarçonné'],
  skaarl: ['skaarl', 'monture', 'mount', 'lizard', 'lézard'],
  duo: ['duo', 'kled & skaarl', 'kled et skaarl', 'mounted', 'monté', 'kled skaarl'],
}

function variantMatchesSearch(variant: ChampionMiscStatVariant, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return KLED_VARIANT_SEARCH_TERMS[variant].some(term => q === term || q.includes(term))
}

function resolveKledVariantFromSearch(query: string): ChampionMiscStatVariant | null {
  const q = query.trim().toLowerCase()
  if (!q) return null

  let best: { variant: ChampionMiscStatVariant; len: number } | null = null
  for (const variant of ['skaarl', 'duo', 'kled'] as ChampionMiscStatVariant[]) {
    for (const term of KLED_VARIANT_SEARCH_TERMS[variant]) {
      if (q === term || q.includes(term)) {
        if (!best || term.length > best.len) best = { variant, len: term.length }
      }
    }
  }
  return best?.variant ?? null
}

export function championMiscRowMatchesSearch(row: ChampionMiscStatRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const name = row.name.toLowerCase()
  const slug = row.championSlug.toLowerCase()
  const idStr = String(row.championId)

  if (!isKledMiscStatChampion(row.championId) || !row.variant) {
    return name.includes(q) || slug.includes(q) || idStr.includes(q)
  }

  const qualifiedVariant = resolveKledVariantFromSearch(q)
  if (qualifiedVariant != null) {
    return row.variant === qualifiedVariant
  }

  if (name.includes(q) || slug.includes(q) || idStr.includes(q)) {
    return true
  }

  return variantMatchesSearch(row.variant, q)
}

export function expandKledMiscStatRows(
  row: ChampionMiscStatRow,
  champion: JsonChampionDetail
): ChampionMiscStatRow[] {
  if (!isKledMiscStatChampion(row.championId)) return [row]

  const passive = champion.passive
  const skaarlHp = deriveSkaarlHpStats(passive)
  const msPenalty = passiveDataValue(passive, 'DismountedMSPenalty') ?? 40

  const kledBase = { ...row.base }
  const kledGrowth = { ...row.growth }

  const dismountedBase = {
    ...kledBase,
    movespeed: kledBase.movespeed - msPenalty,
    attackRange: kledBase.attackRange + KLED_DISMOUNTED_ATTACK_RANGE_BONUS,
  }

  const skaarlBase = {
    ...kledBase,
    hp: skaarlHp.base,
  }
  const skaarlGrowth = {
    ...kledGrowth,
    hp: skaarlHp.growth,
  }

  const duoBase = {
    ...kledBase,
    hp: kledBase.hp + skaarlHp.base,
  }
  const duoGrowth = {
    ...kledGrowth,
    hp: kledGrowth.hp + skaarlHp.growth,
  }

  return [
    { ...row, variant: 'kled', base: dismountedBase, growth: kledGrowth },
    { ...row, variant: 'skaarl', base: skaarlBase, growth: skaarlGrowth },
    { ...row, variant: 'duo', base: duoBase, growth: duoGrowth },
  ]
}
