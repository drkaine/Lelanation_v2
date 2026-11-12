import { TREND_PRESET_TIERS } from '~/composables/statistics/useStatisticsDailyTrendCharts'

export type TrendLevel = 'all' | keyof typeof TREND_PRESET_TIERS

/** Divisions conservées pour un niveau (Moyen / Confirmé / Élite) ; `all` = inchangé. */
export function trendTiersForLevel(tiers: string[], level: TrendLevel): string[] {
  if (level === 'all') return tiers
  const keep = new Set(TREND_PRESET_TIERS[level])
  return tiers.filter(t => keep.has(t))
}
