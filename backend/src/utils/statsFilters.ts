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
  rankTier: string | string[] | null | undefined,
  options?: { excludeUnrankedWhenEmpty?: boolean }
): void {
  const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
  if (ranks.length === 1) where.rankTier = ranks[0]
  else if (ranks.length > 1) where.rankTier = { in: ranks }
  else if (options?.excludeUnrankedWhenEmpty) where.rankTier = { not: 'UNRANKED' }
}

/** Ligues normalisées depuis le query (exclut ALL, *). Vide = pas de filtre ligue. */
export function normalizedRankTiers(rankTier: string | string[] | null | undefined): string[] {
  return toQueryStringArrayParam(rankTier)
    .map((r) => r.toUpperCase())
    .filter((r) => r && r !== 'ALL' && r !== '*')
}

/**
 * Fragments SQL `alias.rank_tier` : vide si aucun filtre (tous les tiers, y compris UNRANKED).
 */
export function buildRankTierSqlConditions(
  alias: string,
  rankTier?: string | string[] | null,
): string[] {
  const ranks = normalizedRankTiers(rankTier)
  if (ranks.length === 1) return [`${alias}.rank_tier = '${ranks[0]}'`]
  if (ranks.length > 1) {
    return [`${alias}.rank_tier IN (${ranks.map((r) => `'${r}'`).join(',')})`]
  }
  return []
}

/** Clé de cache stable pour plusieurs ligues. */
export function rankTierCacheKey(rankTier: string | string[] | null | undefined): string | null {
  const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
  if (ranks.length === 0) return null
  return [...ranks].sort().join(',')
}

/** Rôles stockés dans `champion_stats` et tables dérivées (poller v2). */
const STATS_ROLE_CHAMPION: Record<string, string> = {
  TOP: 'TOP',
  JUNGLE: 'JUNGLE',
  MIDDLE: 'MID',
  MID: 'MID',
  BOTTOM: 'ADC',
  ADC: 'ADC',
  BOT: 'ADC',
  SUPPORT: 'SUPPORT',
  UTILITY: 'SUPPORT',
}

/** Libellés `banner_role_norm` (fragment bans SQL legacy). */
const STATS_ROLE_BANNER: Record<string, string> = {
  TOP: 'TOP',
  JUNGLE: 'JUNGLE',
  MIDDLE: 'MIDDLE',
  MID: 'MIDDLE',
  BOTTOM: 'BOTTOM',
  ADC: 'BOTTOM',
  BOT: 'BOTTOM',
  SUPPORT: 'SUPPORT',
  UTILITY: 'SUPPORT',
}

function normalizeStatsRole(
  role: string | null | undefined,
  map: Record<string, string>,
): string | null {
  if (!role?.trim()) return null
  const u = role.trim().toUpperCase()
  return map[u] ?? u
}

/** Filtre rôle pour `champion_stats.role`, `role_norm` (= upper(role)), spell pairs, etc. */
export function normalizeStatsRoleForChampion(role: string | null | undefined): string | null {
  return normalizeStatsRole(role, STATS_ROLE_CHAMPION)
}

/** Filtre rôle pour `banner_role_norm` (bans par rôle du banneur). */
export function normalizeStatsRoleForBanner(role: string | null | undefined): string | null {
  return normalizeStatsRole(role, STATS_ROLE_BANNER)
}

export function statsRoleSqlLiteral(role: string): string {
  return role.replace(/'/g, "''")
}

/** Clé cache / query string (garde MIDDLE/BOTTOM côté front). */
export function statsRoleCacheKey(role: string | null | undefined): string {
  if (!role?.trim()) return ''
  return role.trim().toUpperCase()
}
