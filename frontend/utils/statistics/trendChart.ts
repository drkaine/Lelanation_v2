import { RANK_TIERS } from '~/utils/rankTiers'

/** Line color of each rank tier in trend charts (`GLOBAL`: all-divisions line). */
export const RANK_TIER_COLORS: Record<string, string> = {
  IRON: '#6b7280',
  BRONZE: '#92400e',
  SILVER: '#94a3b8',
  GOLD: '#a16207',
  PLATINUM: '#0f766e',
  EMERALD: '#166534',
  DIAMOND: '#1d4ed8',
  MASTER: '#6d28d9',
  GRANDMASTER: '#991b1b',
  CHALLENGER: '#9a3412',
  GLOBAL: '#c084fc',
}

/** `GOLD_II` → `GOLD`; empty for unranked. */
export function normalizeRankTier(value: string): string {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .split('_')[0]!
  if (!normalized || normalized === 'UNRANKED') return ''
  return normalized
}

/** SVG path through the points (a single point becomes a tiny visible segment). */
export function svgLinePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ''
  if (points.length === 1)
    return `M ${points[0]!.x},${points[0]!.y} L ${points[0]!.x + 0.1},${points[0]!.y}`
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ')
}

/** Trailing moving average over `window` values (series of 2 values or less unchanged). */
export function smoothSeries(values: number[], window = 3): number[] {
  if (values.length <= 2) return values
  const w = Math.max(1, window | 0)
  return values.map((_, idx) => {
    const from = Math.max(0, idx - (w - 1))
    const slice = values.slice(from, idx + 1)
    const sum = slice.reduce((acc, v) => acc + v, 0)
    return slice.length ? sum / slice.length : values[idx]!
  })
}

function rankTierOrder(tier: string): number {
  const idx = (RANK_TIERS as readonly string[]).indexOf(tier)
  return idx === -1 ? 999 : idx
}

/** Sort comparator: Iron → Challenger, unknown tiers (e.g. `GLOBAL`) last. */
export function compareRankTiers(a: string, b: string): number {
  return rankTierOrder(a) - rankTierOrder(b)
}
