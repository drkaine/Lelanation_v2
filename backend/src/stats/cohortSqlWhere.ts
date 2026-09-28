import { normalizePatchMajorMinor } from './statsPatchQuery.js'
import {
  normalizeStatsRoleForChampion,
  statsRoleSqlLiteral,
  toQueryStringArrayParam,
} from '../utils/statsFilters.js'

const sqlLiteral = (s: string) => s.replace(/'/g, "''")

/**
 * WHERE of a stats cohort on `alias` (`1=1` without filters): champion, rank tiers
 * (every value kept, upper-cased), patch prefix of `version`, role.
 */
export function cohortSqlWhere(
  alias: string,
  filters: {
    championId?: number
    version?: string | null
    rankTier?: string | string[] | null
    role?: string | null
  }
): string {
  const parts: string[] = [filters.championId != null ? `${alias}.champion_id = ${filters.championId}` : '1=1']
  const ranks = toQueryStringArrayParam(filters.rankTier).map((r) => r.toUpperCase())
  if (ranks.length === 1) parts.push(`${alias}.rank_tier = '${sqlLiteral(ranks[0]!)}'`)
  else if (ranks.length > 1) {
    parts.push(`${alias}.rank_tier IN (${ranks.map((r) => `'${sqlLiteral(r)}'`).join(',')})`)
  }
  if (filters.version != null && filters.version !== '') {
    parts.push(`${alias}.game_version LIKE '${sqlLiteral(normalizePatchMajorMinor(filters.version))}%'`)
  }
  const roleDb = normalizeStatsRoleForChampion(filters.role)
  if (roleDb) parts.push(`${alias}.role = '${statsRoleSqlLiteral(roleDb)}'`)
  return parts.join(' AND ')
}
