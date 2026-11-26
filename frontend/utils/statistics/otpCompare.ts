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
export interface OtpCompareData {
  groups: OtpGroupSummary[]
  top: OtpTop[]
  spreads: { pickRate: RegionSpread[]; winRate: RegionSpread[] }
}

export function emptyOtpCompare(): OtpCompareData {
  return { groups: [], top: [], spreads: { pickRate: [], winRate: [] } }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function isOtpCompare(v: unknown): v is OtpCompareData {
  if (!isRecord(v) || !Array.isArray(v.groups) || !Array.isArray(v.top)) return false
  const s = v.spreads
  return isRecord(s) && Array.isArray(s.pickRate) && Array.isArray(s.winRate)
}

export function parseOtpCompare(v: unknown): OtpCompareData {
  return isOtpCompare(v) ? v : emptyOtpCompare()
}

export function otpGroupSummary(data: OtpCompareData, group: OtpGroup): OtpGroupSummary | null {
  return data.groups.find(g => g.group === group) ?? null
}
