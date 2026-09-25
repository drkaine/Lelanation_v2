import type { BotlaneTierRow } from '~/composables/statistics/botlanePatchDeltas'

export type BotlaneMode = 'vs' | 'duo'

export type BotlaneSortKey = 'rank' | 'tier' | 'score' | 'winrate' | 'delta' | 'pickrate' | 'games'

export type WithBotlaneMetrics<R> = R & { score: number; pickrate: number }

const TIER_ORDER: Record<string, number> = { 'S+': 6, S: 5, A: 4, B: 3, C: 2, D: 1, F: 1 }
const TIER_LABEL_SUFFIX = new Set(['S+', 'S', 'A', 'B', 'C'])

/** i18n key of a tier label; D and unknown tiers display as F. */
export function tierLabelKey(tier: string): string {
  return `statisticsPage.tier${TIER_LABEL_SUFFIX.has(tier) ? tier : 'F'}`
}

export function withBotlaneMetrics<R extends BotlaneTierRow>(rows: R[]): WithBotlaneMetrics<R>[] {
  const totalGames = Math.max(
    1,
    rows.reduce((sum, row) => sum + Number(row.games || 0), 0)
  )
  return rows.map(row => ({
    ...row,
    score: Number(row.note ?? 0),
    pickrate: Number(row.games || 0) / totalGames,
  }))
}

function deltaSortValue(v: number | null | undefined): number {
  if (v == null || !Number.isFinite(v)) return Number.NEGATIVE_INFINITY
  return v
}

function sortValue(row: WithBotlaneMetrics<BotlaneTierRow>, key: BotlaneSortKey): number {
  switch (key) {
    case 'tier':
      return TIER_ORDER[row.tier] ?? 0
    case 'delta':
      return deltaSortValue(row.deltaVsPeersPp)
    default:
      return row[key]
  }
}

export function sortBotlaneRows<R extends WithBotlaneMetrics<BotlaneTierRow>>(
  rows: readonly R[],
  key: BotlaneSortKey,
  dir: 'asc' | 'desc'
): R[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => sign * (sortValue(a, key) - sortValue(b, key)))
}

/** Champions a search query can match: our duo, plus the enemy duo in vs mode. */
export function botlaneChampionIds(row: BotlaneTierRow, mode: BotlaneMode): number[] {
  const ours = [row.adcId, row.supportId]
  return mode === 'vs' ? [...ours, row.oppAdcId, row.oppSupportId] : ours
}
