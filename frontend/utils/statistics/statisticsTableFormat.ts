import {
  type ChampionTransform,
  championTransformRowKey,
  normalizeChampionTransform,
} from '~/utils/championTransformStats'
import { RANK_TIERS } from '~/utils/rankTiers'

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

export function tierListWinrateClass(pct: number): string {
  if (!Number.isFinite(pct)) return 'text-text/80'
  if (pct >= 52.5) return 'font-medium text-info'
  if (pct >= 51) return 'text-info/95'
  if (pct >= 50) return 'text-primary-light/85'
  return 'text-error/90'
}

export function formatTierListPatchDeltaPp(pp: number): string {
  const sign = pp > 0 ? '+' : ''
  return `${sign}${pp.toFixed(2)}`
}

export function formatTierListPatchDeltaGames(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${Math.round(n).toLocaleString()}`
}

export function tierListPatchDeltaClass(pp: number): string {
  if (pp > 0.05) return 'text-info/90'
  if (pp < -0.05) return 'text-error/90'
  return 'text-text/55'
}

export function tierListPatchDeltaGamesClass(n: number): string {
  if (n > 0) return 'text-info/90'
  if (n < 0) return 'text-error/90'
  return 'text-text/55'
}

/** Pourcentage de parties pour une division (sur le total des divisions). */
export function formatDivisionLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase()
}

export const roleToBansColumnKey = Object.freeze({
  TOP: 'top',
  JUNGLE: 'jungle',
  MIDDLE: 'middle',
  BOTTOM: 'bottom',
  SUPPORT: 'support',
} as const)

export const COHORT_DIVISION_DEBOUNCE_MS = 280

const PROGRESSION_DELTA_EPS = 0.01

export function hasMeaningfulProgressionDelta(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) >= PROGRESSION_DELTA_EPS
}

export type OverviewSidesProgRow = {
  championId: number
  wrOldest: number
  wrSince: number
  deltaWr: number
  pickrateOldest: number
  pickrateSince: number
  deltaPick: number
  banrateOldest: number
  banrateSince: number
  deltaBan: number
}

export const FAST_STAT_ROW_COUNT = 5
/** Aligné sur STATS_OTP_PICKRATE_THRESHOLD backend (défaut 1 %). */

export const STATS_OTP_PICKRATE_THRESHOLD_PCT = 1

export const rankTiers = [...RANK_TIERS]

export const roles = [
  { value: 'TOP', label: 'Top', icon: '/icons/roles/top.png' },
  { value: 'JUNGLE', label: 'Jungle', icon: '/icons/roles/jungle.png' },
  { value: 'MIDDLE', label: 'Mid', icon: '/icons/roles/mid.png' },
  { value: 'BOTTOM', label: 'ADC', icon: '/icons/roles/bot.png' },
  { value: 'SUPPORT', label: 'Support', icon: '/icons/roles/support.png' },
]

export function normalizeStatsRoleKey(mainRole: string | null | undefined): string {
  const raw = (mainRole ?? '').trim().toUpperCase()
  if (!raw) return ''
  if (raw === 'UTILITY' || raw === 'SUPPORT') return 'SUPPORT'
  if (raw === 'MID' || raw === 'MIDDLE') return 'MIDDLE'
  if (raw === 'ADC' || raw === 'BOTTOM' || raw === 'BOT') return 'BOTTOM'
  return raw
}

export function mainRoleIconSrc(mainRole: string | null | undefined): string | null {
  const key = normalizeStatsRoleKey(mainRole)
  if (!key) return null
  return roles.find(r => r.value === key)?.icon ?? null
}

export function mainRoleLabel(mainRole: string | null | undefined): string {
  const key = normalizeStatsRoleKey(mainRole)
  if (!key) return String(mainRole ?? '—')
  return roles.find(r => r.value === key)?.label ?? String(mainRole)
}

export type ChampionGlobalTableRow = {
  championId: number
  championTransform?: ChampionTransform
  blue: {
    games: number
    wins: number
    winrate: number
    pickrate: number
    banrate: number
  }
  red: {
    games: number
    wins: number
    winrate: number
    pickrate: number
    banrate: number
  }
  totalGames: number
  avgDamageToChamps: number
  avgDamageToChampsPhys: number
  avgDamageToChampsMagic: number
  avgDamageToChampsTrue: number
  avgDamageTakenPhys: number
  avgDamageTakenMagic: number
  avgDamageTakenTrue: number
  avgDamageTakenTotal: number
  avgKills: number
  avgDeaths: number
  avgAssists: number
  avgTotalHeal: number
  avgHealsOnTeammates: number
  avgEffectiveHealShield: number
  avgDamageShieldedOnTeammates: number
  avgDamageSelfMitigated: number
  avgTimeCcDealt: number
}

export type ChampionGlobalNumericDeltaKey =
  | 'avgDamageToChamps'
  | 'avgDamageToChampsPhys'
  | 'avgDamageToChampsMagic'
  | 'avgDamageToChampsTrue'
  | 'avgDamageTakenTotal'
  | 'avgDamageTakenPhys'
  | 'avgDamageTakenMagic'
  | 'avgDamageTakenTrue'
  | 'avgKills'
  | 'avgDeaths'
  | 'avgAssists'
  | 'avgTotalHeal'
  | 'avgHealsOnTeammates'
  | 'avgEffectiveHealShield'
  | 'avgDamageShieldedOnTeammates'
  | 'avgDamageSelfMitigated'
  | 'avgTimeCcDealt'

export const CHAMPION_GLOBAL_SORT_COLUMNS = [
  'champion',
  'blueWinrate',
  'bluePickrate',
  'blueWinrateDelta',
  'bluePickrateDelta',
  'redWinrate',
  'redPickrate',
  'redWinrateDelta',
  'redPickrateDelta',
  'dmgTotal',
  'dmgTotalDelta',
  'dmgPhys',
  'dmgPhysDelta',
  'dmgMagic',
  'dmgMagicDelta',
  'dmgTrue',
  'dmgTrueDelta',
  'takenTotal',
  'takenTotalDelta',
  'takenPhys',
  'takenPhysDelta',
  'takenMagic',
  'takenMagicDelta',
  'takenTrue',
  'takenTrueDelta',
  'kills',
  'killsDelta',
  'deaths',
  'deathsDelta',
  'assists',
  'assistsDelta',
  'healTotal',
  'healTotalDelta',
  'healTeam',
  'healTeamDelta',
  'healEffective',
  'healEffectiveDelta',
  'shieldTeam',
  'shieldTeamDelta',
  'mitigated',
  'mitigatedDelta',
  'ccTime',
  'ccTimeDelta',
  'totalGames',
] as const

export type ChampionGlobalSortColumn = (typeof CHAMPION_GLOBAL_SORT_COLUMNS)[number]

export function championGlobalRowKey(row: ChampionGlobalTableRow): string {
  return championTransformRowKey(row.championId, normalizeChampionTransform(row.championTransform))
}

export function championGlobalNumericDeltaClass(delta: number, invert = false): string {
  const hi = invert ? delta < -0.05 : delta > 0.05
  const lo = invert ? delta > 0.05 : delta < -0.05
  if (hi) return 'text-info/90'
  if (lo) return 'text-error/90'
  return 'text-text/55'
}

export function formatChampionGlobalNumericDelta(d: number): string {
  const sign = d > 0 ? '+' : ''
  return `${sign}${Number(d).toFixed(1)}`
}
