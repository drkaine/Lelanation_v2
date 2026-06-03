/** Couleurs tier graphique tier list (palette divergente d’origine). */
export const TIER_CHART_COLORS = {
  F: '#dc2626',
  D: '#dc2626',
  C: '#a78bfa',
  B: '#7dd3fc',
  A: '#3b82f6',
  S: '#22c55e',
  'S+': '#e5c558',
} as const

export type TierChartColorKey = keyof typeof TIER_CHART_COLORS

export function tierChartColor(tier: string): string {
  const key = tier === 'F' ? 'D' : tier
  return TIER_CHART_COLORS[key as TierChartColorKey] ?? TIER_CHART_COLORS.D
}

export function tierChartColorMuted(tier: string, alpha = 0.22): string {
  const hex = tierChartColor(tier)
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${r} ${g} ${b} / ${alpha})`
}
