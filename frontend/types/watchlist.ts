export type WatchMetric = 'winRate' | 'pickRate' | 'banRate'

export type WatchOperator = '>' | '<' | 'increase_plus' | 'decrease_plus'

export type WatchRule = {
  id: string
  targetType: 'CHAMPION' | 'ROLE' | 'GLOBAL'
  /** Champion numeric id (as number or string), or lane role e.g. JUNGLE when targetType is ROLE */
  targetValue: string | number
  /** When targetType is CHAMPION, optional lane filter (TOP, JUNGLE, …) */
  roleFilter?: string | null
  /** Optional rank filter (DIAMOND, GOLD, …); null/undefined = all ranks */
  rankTier?: string | null
  metric: WatchMetric
  operator: WatchOperator
  /** Absolute % for win/pick/ban, or delta % for increase_plus / decrease_plus */
  threshold: number
  timeframe: number
}

export function parseChampionIdFromRule(rule: WatchRule): number | null {
  if (rule.targetType !== 'CHAMPION') return null
  const v = rule.targetValue
  const n = typeof v === 'number' ? v : Number.parseInt(String(v), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function parseLaneFromRule(rule: WatchRule): string | null {
  if (rule.targetType === 'ROLE') {
    const s = String(rule.targetValue).toUpperCase().trim()
    return s || null
  }
  return rule.roleFilter ? String(rule.roleFilter).toUpperCase().trim() : null
}

/** Normalized rank tier for API keys (first segment before _). */
export function parseRankTierFromRule(rule: WatchRule): string | null {
  const raw = rule.rankTier
  if (raw == null || String(raw).trim() === '') return null
  return String(raw).toUpperCase().split('_')[0]?.trim() || null
}

/** Win/pick/ban thresholds are percentages in [0, 100]. Delta thresholds typically [0, 100] as well. */
export function validateWatchRuleThreshold(rule: WatchRule): { ok: boolean; message?: string } {
  const t = Number(rule.threshold)
  if (!Number.isFinite(t)) return { ok: false, message: 'Invalid threshold' }
  if (rule.metric === 'winRate' || rule.metric === 'pickRate' || rule.metric === 'banRate') {
    if (t < 0 || t > 100) return { ok: false, message: 'Threshold must be between 0 and 100.' }
  }
  return { ok: true }
}
