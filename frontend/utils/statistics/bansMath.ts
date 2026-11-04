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
