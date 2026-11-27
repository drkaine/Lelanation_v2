/** Onglet « OTP » : réponse de GET /api/stats/otp-compare (groupes anonymes, aucun joueur nommé). */
import type { RegionChampionStat, RegionSpread } from './regionCompare'

export type OtpGroup = 'otp' | 'others'

export interface OtpGroupSummary {
  group: OtpGroup
  games: number
  winRate: number
  kda: number
  avgKills: number
  afkRate: number
  champions: number
}
export interface OtpTop {
  group: OtpGroup
  picked: RegionChampionStat[]
  winrate: RegionChampionStat[]
}
/** Joueurs OTP par région et par tier (dernier rang connu ; UNRANKED sans rang). */
export interface OtpPopulation {
  total: number
  byRegion: { region: string; players: number; pct: number }[]
  byTier: { tier: string; players: number; pct: number }[]
  cells: { region: string; tier: string; players: number }[]
}
export interface OtpCompareData {
  groups: OtpGroupSummary[]
  top: OtpTop[]
  spreads: { pickRate: RegionSpread[]; winRate: RegionSpread[] }
  population: OtpPopulation
}

export function emptyOtpPopulation(): OtpPopulation {
  return { total: 0, byRegion: [], byTier: [], cells: [] }
}

export function emptyOtpCompare(): OtpCompareData {
  return {
    groups: [],
    top: [],
    spreads: { pickRate: [], winRate: [] },
    population: emptyOtpPopulation(),
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function isOtpPopulation(v: unknown): v is OtpPopulation {
  return (
    isRecord(v) &&
    typeof v.total === 'number' &&
    Array.isArray(v.byRegion) &&
    Array.isArray(v.byTier) &&
    Array.isArray(v.cells)
  )
}

function isOtpCompare(v: unknown): v is Omit<OtpCompareData, 'population'> {
  if (!isRecord(v) || !Array.isArray(v.groups) || !Array.isArray(v.top)) return false
  const s = v.spreads
  return isRecord(s) && Array.isArray(s.pickRate) && Array.isArray(s.winRate)
}

export function parseOtpCompare(v: unknown): OtpCompareData {
  const raw = isRecord(v) ? v.population : undefined
  if (!isOtpCompare(v)) return emptyOtpCompare()
  const population = isOtpPopulation(raw) ? raw : emptyOtpPopulation()
  return { groups: v.groups, top: v.top, spreads: v.spreads, population }
}

export function otpGroupSummary(data: OtpCompareData, group: OtpGroup): OtpGroupSummary | null {
  return data.groups.find(g => g.group === group) ?? null
}
