/**
 * Normalisation des filtres stats (rankTier / version) : query répétée ou chaîne "A,B".
 */
export function toQueryStringArrayParam(value: string | string[] | null | undefined): string[] {
  if (value == null) return []
  if (Array.isArray(value)) {
    const out: string[] = []
    for (const s of value) {
      if (typeof s !== 'string' || s === '' || s.startsWith('[')) continue
      if (s.includes(',')) {
        out.push(...s.split(',').map((x) => x.trim()).filter(Boolean))
      } else {
        out.push(s.trim())
      }
    }
    return out.filter(Boolean)
  }
  if (typeof value === 'string' && value !== '' && !value.startsWith('[')) {
    if (value.includes(',')) {
      return value.split(',').map((x) => x.trim()).filter(Boolean)
    }
    return [value.trim()].filter(Boolean)
  }
  return []
}

/** Filtre Prisma sur rank_tier (une ligue ou plusieurs). */
export function applyRankTierWhere(
  where: Record<string, unknown>,
  rankTier: string | string[] | null | undefined
): void {
  const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
  if (ranks.length === 1) where.rankTier = ranks[0]
  else if (ranks.length > 1) where.rankTier = { in: ranks }
}

/** Clé de cache stable pour plusieurs ligues. */
export function rankTierCacheKey(rankTier: string | string[] | null | undefined): string | null {
  const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
  if (ranks.length === 0) return null
  return [...ranks].sort().join(',')
}
