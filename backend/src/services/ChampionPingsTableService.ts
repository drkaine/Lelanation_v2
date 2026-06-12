/**
 * Pings moyens par champion (match-v5 participant ping counters agrégés dans champion_stats).
 */
import { queryRawUnsafe, isDatabaseConfigured } from '../db/query.js'
import {
  CHAMPION_PING_METRIC_KEYS,
  CHAMPION_PING_SQL_COLUMN,
  CHAMPION_PING_TOTAL_SQL_COLUMNS,
  type ChampionPingMetricKey,
} from '../constants/championPingMetrics.js'
import { buildChampionScopedWhere, buildRawMatchCond } from './ChampionGlobalTableService.js'
import { toQueryStringArrayParam } from '../utils/statsFilters.js'
import { matchVersionedAggFrom } from './statsAggArchive.js'
import {
  normalizeStatsRoleForChampion,
  normalizedRankTiers,
  statsRoleSqlLiteral,
} from '../utils/statsFilters.js'

export { CHAMPION_PING_METRIC_KEYS, type ChampionPingMetricKey }

export type ChampionPingsTableRow = {
  championId: number
  games: number
  totalPerGame: number
} & Record<ChampionPingMetricKey, number>

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function avgPerGame(sum: number, games: number): number {
  return games > 0 ? round2(sum / games) : 0
}

type ChampionPingsScope = {
  championId: number
  version?: string | string[] | null
  rankTier?: string | string[] | null
  role?: string | null
}

function mapPingsSqlRow(row: {
  champion_id: number
  games: bigint
} & Record<(typeof CHAMPION_PING_TOTAL_SQL_COLUMNS)[number], bigint>): ChampionPingsTableRow {
  const games = Number(row.games ?? 0)
  const pings = {} as Record<ChampionPingMetricKey, number>
  let totalSum = 0
  for (const col of CHAMPION_PING_TOTAL_SQL_COLUMNS) {
    totalSum += Number(row[col] ?? 0)
  }
  for (const key of CHAMPION_PING_METRIC_KEYS) {
    pings[key] = avgPerGame(Number(row[CHAMPION_PING_SQL_COLUMN[key]] ?? 0), games)
  }
  return {
    championId: Number(row.champion_id),
    games,
    totalPerGame: avgPerGame(totalSum, games),
    ...pings,
  }
}

/** Pings moyens pour un seul champion (fiche champion). */
export async function getChampionPingsSummary(
  scope: ChampionPingsScope
): Promise<ChampionPingsTableRow | null> {
  if (!isDatabaseConfigured() || scope.championId <= 0) return null

  const version = toQueryStringArrayParam(scope.version)
  const rankTier = toQueryStringArrayParam(scope.rankTier)
  const role = normalizeStatsRoleForChampion(scope.role ?? null)

  const csFrom = await matchVersionedAggFrom(
    'agg_champion_team_objective_stats',
    version.length ? version : null,
    'cs'
  )
  const where = buildChampionScopedWhere('cs', {
    championId: scope.championId,
    version: version.length ? version : null,
    rankTier: rankTier.length ? rankTier : null,
    role,
  })

  const sumSelect = CHAMPION_PING_TOTAL_SQL_COLUMNS.map(
    col => `COALESCE(SUM(cs.${col}), 0)::bigint AS ${col}`,
  ).join(',\n      ')

  type SqlRow = {
    champion_id: number
    games: bigint
  } & Record<(typeof CHAMPION_PING_TOTAL_SQL_COLUMNS)[number], bigint>

  const raw = await queryRawUnsafe<SqlRow[]>(`
    SELECT
      cs.champion_id::int AS champion_id,
      COALESCE(SUM(cs.count_game), 0)::bigint AS games,
      ${sumSelect}
    FROM ${csFrom}
    WHERE ${where}
    GROUP BY cs.champion_id
    HAVING COALESCE(SUM(cs.count_game), 0) > 0
  `)

  const row = raw[0]
  if (!row) return null
  return mapPingsSqlRow(row)
}

export async function getChampionPingsTable(
  version?: string | string[] | null,
  rankTier?: string | string[] | null,
  role?: string | null
): Promise<{ rows: ChampionPingsTableRow[] } | null> {
  if (!isDatabaseConfigured()) return null

  const csFrom = await matchVersionedAggFrom('agg_champion_team_objective_stats', version, 'cs')
  const whereParts = [buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'cs.')]
  if (normalizedRankTiers(rankTier).length === 0) {
    whereParts.push(`cs.rank_tier <> 'UNRANKED'`)
  }
  const roleDb = normalizeStatsRoleForChampion(role ?? null)
  if (roleDb) whereParts.push(`cs.role = '${statsRoleSqlLiteral(roleDb)}'`)
  const where = whereParts.join(' AND ')

  // Alias SQL en snake_case (nom de colonne) : PostgreSQL lower-case les identifiants non quotés
  // (`AS sum_onMyWay` → `sum_onmyway`), ce qui cassait la lecture `row.sum_onMyWay` côté Node.
  const sumSelect = CHAMPION_PING_TOTAL_SQL_COLUMNS.map(
    col => `COALESCE(SUM(cs.${col}), 0)::bigint AS ${col}`,
  ).join(',\n      ')

  type SqlRow = {
    champion_id: number
    games: bigint
  } & Record<(typeof CHAMPION_PING_TOTAL_SQL_COLUMNS)[number], bigint>

  const raw = await queryRawUnsafe<SqlRow[]>(`
    SELECT
      cs.champion_id::int AS champion_id,
      COALESCE(SUM(cs.count_game), 0)::bigint AS games,
      ${sumSelect}
    FROM ${csFrom}
    WHERE ${where}
    GROUP BY cs.champion_id
    HAVING COALESCE(SUM(cs.count_game), 0) > 0
    ORDER BY champion_id ASC
  `)

  const rows: ChampionPingsTableRow[] = raw.map(row => mapPingsSqlRow(row))

  rows.sort((a, b) => b.totalPerGame - a.totalPerGame || a.championId - b.championId)
  return { rows }
}
