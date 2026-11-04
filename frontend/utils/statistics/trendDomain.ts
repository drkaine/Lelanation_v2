/** Domaine vertical d'une courbe de tendance ; les pourcentages restent dans [0, 100]. */
export function trendChartDomain(
  minValue: number,
  maxValue: number,
  metricId: string
): { min: number; max: number } {
  let minVal = Number.isFinite(minValue) ? minValue : 0
  let maxVal = Number.isFinite(maxValue) ? maxValue : 1
  if (metricId === 'games') {
    minVal = 0
    if (maxVal <= 0) maxVal = 1
  } else if (maxVal <= minVal) {
    maxVal = minVal + (metricId === 'pickrate' || metricId === 'banrate' ? 0.5 : 1)
  }
  const spread = Math.max(1e-6, maxVal - minVal)
  if (metricId === 'games') return { min: 0, max: maxVal + spread * 0.08 }
  return {
    min: Math.max(0, minVal - spread * 0.12),
    max: Math.min(100, maxVal + spread * 0.08),
  }
}
