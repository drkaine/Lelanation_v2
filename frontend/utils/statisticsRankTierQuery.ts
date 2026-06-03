/** Parse `rankTier` depuis l’URL (répété, tableau ou liste séparée par des virgules). */
export function parseRankTierQuery(value: string | string[] | null | undefined): string[] {
  if (value == null) return []
  const parts = Array.isArray(value) ? value : [value]
  const out: string[] = []
  for (const raw of parts) {
    const s = String(raw ?? '').trim()
    if (!s) continue
    if (s.includes(',')) {
      for (const piece of s.split(',')) {
        const t = piece.trim().toUpperCase()
        if (t && t !== 'ALL') out.push(t)
      }
    } else {
      const t = s.toUpperCase()
      if (t && t !== 'ALL') out.push(t)
    }
  }
  return [...new Set(out)]
}

export function rankTierQueryKey(tiers: readonly string[]): string {
  return [...tiers]
    .map(t => t.toUpperCase())
    .sort()
    .join(',')
}

export function rankTierSelectionsEqual(a: readonly string[], b: readonly string[]): boolean {
  return rankTierQueryKey(a) === rankTierQueryKey(b)
}
