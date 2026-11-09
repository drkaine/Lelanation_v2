/** Clé de cache stable pour getChampionGlobalTable (versions/rangs triés, casse normalisée). */
function normList(v: string | string[] | null | undefined, upper: boolean): string {
  const arr = (Array.isArray(v) ? v : [v ?? ''])
    .map((s) => String(s ?? '').trim())
    .map((s) => (upper ? s.toUpperCase() : s))
    .filter((s) => s !== '' && s !== 'ALL' && s !== 'all')
  return [...new Set(arr)].sort().join(',')
}

export function championGlobalTableCacheKey(
  version?: string | string[] | null,
  rankTier?: string | string[] | null,
  role?: string | null,
  splitTransform = false
): string {
  return [
    normList(version, false),
    normList(rankTier, true),
    String(role ?? '').trim().toUpperCase(),
    splitTransform ? '1' : '0',
  ].join('|')
}
