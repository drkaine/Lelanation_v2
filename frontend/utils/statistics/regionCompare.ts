/** Onglet « Régions » : réponse de GET /api/stats/region-compare et helpers d'affichage. */

export interface RegionSummary {
  region: string
  matches: number
  surrenderRate: number
  earlySurrenderRate: number
  afkRate: number
  avgDurationMin: number
  avgKills: number
}
export interface RegionChampionStat {
  championId: number
  rate: number
  games: number
}
export interface RegionTop {
  region: string
  picked: RegionChampionStat[]
  banned: RegionChampionStat[]
  winrate: RegionChampionStat[]
}
export interface RegionSpread {
  championId: number
  byRegion: Record<string, number>
  spread: number
  high: string
  low: string
}
export interface RegionCompareData {
  regions: RegionSummary[]
  topByRegion: RegionTop[]
  spreads: { pickRate: RegionSpread[]; banRate: RegionSpread[]; winRate: RegionSpread[] }
}

export type RegionMetric = Exclude<keyof RegionSummary, 'region'>

export function emptyRegionCompare(): RegionCompareData {
  return { regions: [], topByRegion: [], spreads: { pickRate: [], banRate: [], winRate: [] } }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function isRegionCompare(v: unknown): v is RegionCompareData {
  if (!isRecord(v) || !Array.isArray(v.regions) || !Array.isArray(v.topByRegion)) return false
  const s = v.spreads
  return (
    isRecord(s) && Array.isArray(s.pickRate) && Array.isArray(s.banRate) && Array.isArray(s.winRate)
  )
}

export function parseRegionCompare(v: unknown): RegionCompareData {
  return isRegionCompare(v) ? v : emptyRegionCompare()
}

/** Région max et min sur une métrique (au moins 2 régions). */
export function extremeRegions(
  rows: readonly RegionSummary[],
  metric: RegionMetric
): { high: string | null; low: string | null } {
  if (rows.length < 2) return { high: null, low: null }
  let high = rows[0]!
  let low = rows[0]!
  for (const r of rows) {
    if (r[metric] > high[metric]) high = r
    if (r[metric] < low[metric]) low = r
  }
  return { high: high.region, low: low.region }
}

const REGION_LABELS: Record<string, string> = {
  EUW1: 'EUW',
  EUN1: 'EUNE',
  NA1: 'NA',
  BR1: 'BR',
  LA1: 'LAN',
  LA2: 'LAS',
  OC1: 'OCE',
  TR1: 'TR',
  RU: 'RU',
  JP1: 'JP',
  KR: 'KR',
  ME1: 'ME',
  SG2: 'SEA',
  TW2: 'TW',
  VN2: 'VN',
}

export function regionLabel(region: string): string {
  return REGION_LABELS[region.toUpperCase()] ?? region
}

export function formatSpread(v: number): string {
  return `${v.toFixed(2)} pts`
}
