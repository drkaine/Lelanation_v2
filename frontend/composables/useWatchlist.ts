import { apiUrl } from '~/utils/apiUrl'
import type { WatchRule } from '~/types/watchlist'
import {
  parseChampionIdFromRule,
  parseLaneFromRule,
  parseRankTierFromRule,
  validateWatchRuleThreshold,
} from '~/types/watchlist'

export type WatchlistDeltaApi = {
  ok: boolean
  championId: number | null
  role: string | null
  rankTier: string | null
  days: number
  dLatest: string | null
  dPast: string | null
  current: {
    dateOfGame: string
    games: number
    wins: number
    winRate: number
    pickRate: number
    banRate: number
  } | null
  past: WatchlistDeltaApi['current']
  deltaWinRate: number | null
  deltaPickRate: number | null
  deltaBanRate: number | null
  message?: string
}

export type WatchlistAlert = {
  rule: WatchRule
  delta: WatchlistDeltaApi
  triggered: boolean
}

/** Batch payload item for POST /api/stats/watchlist/deltas/batch */
export type WatchlistBatchQueryPayload = {
  id: string
  days: number
  rankTier?: string | null
  global?: boolean
  championId?: number | null
  role?: string | null
}

function tierKeyPart(rule: WatchRule): string {
  const t = parseRankTierFromRule(rule)
  return t ? `tier:${t}` : 'tier:*'
}

function specKey(rule: WatchRule): string | null {
  const days = Math.min(30, Math.max(1, Math.floor(rule.timeframe || 1)))
  const tk = tierKeyPart(rule)

  if (rule.targetType === 'GLOBAL') {
    return `global|${tk}|${days}`
  }
  const cid = parseChampionIdFromRule(rule)
  const lane = parseLaneFromRule(rule)
  if (rule.targetType === 'ROLE') {
    if (!lane) return null
    return `role|${lane}|${tk}|${days}`
  }
  if (rule.targetType === 'CHAMPION') {
    if (cid == null) return null
    const lanePart = lane ? `|${lane}` : ''
    return `champ|${cid}${lanePart}|${tk}|${days}`
  }
  return null
}

function ruleToQuery(rule: WatchRule): WatchlistBatchQueryPayload | null {
  const key = specKey(rule)
  if (!key) return null
  const days = Math.min(30, Math.max(1, Math.floor(rule.timeframe || 1)))
  const rankTier = parseRankTierFromRule(rule)

  if (rule.targetType === 'GLOBAL') {
    return { id: key, days, rankTier: rankTier ?? null, global: true }
  }
  const cid = parseChampionIdFromRule(rule)
  const lane = parseLaneFromRule(rule)
  if (rule.targetType === 'ROLE') {
    if (!lane) return null
    return { id: key, championId: null, role: lane, rankTier: rankTier ?? null, days }
  }
  if (rule.targetType === 'CHAMPION' && cid != null) {
    return { id: key, championId: cid, role: lane, rankTier: rankTier ?? null, days }
  }
  return null
}

export function evaluateRule(rule: WatchRule, delta: WatchlistDeltaApi): boolean {
  const v = validateWatchRuleThreshold(rule)
  if (!v.ok || !delta.ok || !delta.current) return false
  const thr = rule.threshold
  if (rule.operator === '>' || rule.operator === '<') {
    const cur =
      rule.metric === 'winRate'
        ? delta.current.winRate
        : rule.metric === 'pickRate'
          ? delta.current.pickRate
          : delta.current.banRate
    return rule.operator === '>' ? cur > thr : cur < thr
  }
  const d =
    rule.metric === 'winRate'
      ? (delta.deltaWinRate ?? 0)
      : rule.metric === 'pickRate'
        ? (delta.deltaPickRate ?? 0)
        : (delta.deltaBanRate ?? 0)
  if (rule.operator === 'increase_plus') return d > thr
  if (rule.operator === 'decrease_plus') return d < -thr
  return false
}

export async function fetchWatchlistDeltasForRules(
  rules: WatchRule[]
): Promise<Map<string, WatchlistDeltaApi>> {
  const unique = new Map<string, WatchlistBatchQueryPayload>()
  for (const rule of rules) {
    const q = ruleToQuery(rule)
    if (q) unique.set(q.id, q)
  }
  const queries = [...unique.values()]
  if (queries.length === 0) return new Map()

  const res = await $fetch<{ results: Array<WatchlistDeltaApi & { queryId: string }> }>(
    apiUrl('/api/stats/watchlist/deltas/batch'),
    { method: 'POST', body: { queries } }
  )
  const out = new Map<string, WatchlistDeltaApi>()
  for (const row of res.results) {
    const { queryId, ...rest } = row
    out.set(queryId, rest)
  }
  return out
}

export async function buildWatchlistAlerts(rules: WatchRule[]): Promise<WatchlistAlert[]> {
  const byKey = await fetchWatchlistDeltasForRules(rules)
  const alerts: WatchlistAlert[] = []
  for (const rule of rules) {
    const key = specKey(rule)
    if (!key) {
      alerts.push({
        rule,
        delta: {
          ok: false,
          championId: null,
          role: null,
          rankTier: parseRankTierFromRule(rule),
          days: rule.timeframe,
          dLatest: null,
          dPast: null,
          current: null,
          past: null,
          deltaWinRate: null,
          deltaPickRate: null,
          deltaBanRate: null,
          message: 'Invalid rule target',
        },
        triggered: false,
      })
      continue
    }
    const delta = byKey.get(key) ?? {
      ok: false,
      championId: null,
      role: null,
      rankTier: parseRankTierFromRule(rule),
      days: rule.timeframe,
      dLatest: null,
      dPast: null,
      current: null,
      past: null,
      deltaWinRate: null,
      deltaPickRate: null,
      deltaBanRate: null,
      message: 'Missing delta',
    }
    alerts.push({ rule, delta, triggered: evaluateRule(rule, delta) })
  }
  return alerts
}

export async function fetchGlobalWinrateMovers(params?: {
  days?: number
  limit?: number
}): Promise<{
  dLatest: string | null
  dPast: string | null
  movers: Array<{
    championId: number
    gamesLatest: number
    gamesPast: number
    winRateLatest: number
    winRatePast: number
    deltaWinRate: number
  }>
}> {
  const q = new URLSearchParams()
  if (params?.days != null) q.set('days', String(params.days))
  if (params?.limit != null) q.set('limit', String(params.limit))
  const qs = q.toString()
  const url = qs
    ? `${apiUrl('/api/stats/watchlist/global-movers')}?${qs}`
    : apiUrl('/api/stats/watchlist/global-movers')
  return await $fetch(url)
}
