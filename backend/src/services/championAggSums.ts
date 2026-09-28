/**
 * Per-champion sums over `agg_champion_team_objective_stats` (pings, vision, misc stats):
 * cohort scope (FROM / WHERE), SUM select and per-game averages.
 */
import { buildChampionScopedWhere, buildRawMatchCond } from './ChampionGlobalTableService.js'
import { matchVersionedAggFrom } from './statsAggArchive.js'
import {
  normalizeStatsRoleForChampion,
  normalizedRankTiers,
  statsRoleSqlLiteral,
  toQueryStringArrayParam,
} from '../utils/statsFilters.js'

const AGG_TABLE = 'agg_champion_team_objective_stats'

export type ChampionAggScope = {
  championId: number
  version?: string | string[] | null
  rankTier?: string | string[] | null
  role?: string | null
}

/** Per-game average rounded to `decimals` (0 without games). */
export function avgPerGame(sum: number, games: number, decimals = 2): number {
  if (games <= 0) return 0
  const f = 10 ** decimals
  return Math.round((sum / games) * f) / f
}

/** `COALESCE(SUM(cs.col), 0)::cast AS col` for each column (snake_case aliases: PG lower-cases). */
export function sumColumnsSelect(columns: readonly string[], cast: 'bigint' | 'double precision'): string {
  return columns.map(col => `COALESCE(SUM(cs.${col}), 0)::${cast} AS ${col}`).join(',\n      ')
}

/** Sums per champion (champions without games dropped). */
export function championSumsQuery(q: { from: string; where: string; sums: string; ordered?: boolean }): string {
  return `
    SELECT
      cs.champion_id::int AS champion_id,
      COALESCE(SUM(cs.count_game), 0)::bigint AS games,
      ${q.sums}
    FROM ${q.from}
    WHERE ${q.where}
    GROUP BY cs.champion_id
    HAVING COALESCE(SUM(cs.count_game), 0) > 0${q.ordered ? '\n    ORDER BY champion_id ASC' : ''}
  `
}

/** Cohort of one champion (champion page). */
export async function championScopeAgg(scope: ChampionAggScope): Promise<{ from: string; where: string }> {
  const version = toQueryStringArrayParam(scope.version)
  const rankTier = toQueryStringArrayParam(scope.rankTier)
  const from = await matchVersionedAggFrom(AGG_TABLE, version.length ? version : null, 'cs')
  const where = buildChampionScopedWhere('cs', {
    championId: scope.championId,
    version: version.length ? version : null,
    rankTier: rankTier.length ? rankTier : null,
    role: normalizeStatsRoleForChampion(scope.role ?? null),
  })
  return { from, where }
}

/** Cohort of all champions (tables): unranked rows excluded unless tiers are selected. */
export function championTableWhere(
  version?: string | string[] | null,
  rankTier?: string | string[] | null,
  role?: string | null
): string {
  const whereParts = [buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'cs.')]
  if (normalizedRankTiers(rankTier).length === 0) {
    whereParts.push(`cs.rank_tier <> 'UNRANKED'`)
  }
  const roleDb = normalizeStatsRoleForChampion(role ?? null)
  if (roleDb) whereParts.push(`cs.role = '${statsRoleSqlLiteral(roleDb)}'`)
  return whereParts.join(' AND ')
}

/** FROM / WHERE of the all-champions table. */
export async function championTableAgg(
  version?: string | string[] | null,
  rankTier?: string | string[] | null,
  role?: string | null
): Promise<{ from: string; where: string }> {
  const from = await matchVersionedAggFrom(AGG_TABLE, version, 'cs')
  return { from, where: championTableWhere(version, rankTier, role) }
}
