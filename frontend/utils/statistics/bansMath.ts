/** Ban rate in % (2 decimals): ban count over match count, same definition as the overview. */
export function banPct(count: number, matchCount: number): number {
  if (matchCount <= 0) return 0
  return Math.round((10000 * count) / matchCount) / 100
}

/** Delta in points vs the reference patch; null when the champion has no reference row. */
export function banPctDelta(
  count: number,
  refCount: number | null,
  matchCount: number,
  refMatchCount: number
): number | null {
  if (refCount == null || matchCount <= 0 || refMatchCount <= 0) return null
  return Math.round((banPct(count, matchCount) - banPct(refCount, refMatchCount)) * 100) / 100
}

/** Largeur (%) de la barre de banrate, relative au banrate maximal affiché. */
export function banBarWidth(rate: number, maxRate: number): number {
  if (!Number.isFinite(rate) || !Number.isFinite(maxRate) || maxRate <= 0) return 0
  return Math.min(100, Math.max(0, (rate / maxRate) * 100))
}

/** Part (0–100) du premier terme dans a + b, pour une barre de répartition ; null sans donnée. */
export function banSplitShare(a: number, b: number): number | null {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  const total = a + b
  if (total <= 0) return null
  return (a / total) * 100
}
