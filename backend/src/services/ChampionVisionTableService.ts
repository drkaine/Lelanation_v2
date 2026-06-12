/**
 * Stats vision moyennes par champion (score, balises posées / détruites, etc.).
 */
import { queryRawUnsafe, isDatabaseConfigured } from '../db/query.js'
import { buildChampionScopedWhere, buildRawMatchCond } from './ChampionGlobalTableService.js'
import { toQueryStringArrayParam } from '../utils/statsFilters.js'
import { matchVersionedAggFrom } from './statsAggArchive.js'
import {
  normalizeStatsRoleForChampion,
  normalizedRankTiers,
  statsRoleSqlLiteral,
} from '../utils/statsFilters.js'

export const CHAMPION_VISION_METRIC_KEYS = [
  'visionScore',
  'visionScorePerMinute',
  'wardsPlaced',
  'wardsKilled',
  'controlWardsPlaced',
  'stealthWardsPlaced',
] as const

export type ChampionVisionMetricKey = (typeof CHAMPION_VISION_METRIC_KEYS)[number]

const VISION_SQL_COLUMN: Record<ChampionVisionMetricKey, string> = {
  visionScore: 'sum_vision_score',
  visionScorePerMinute: 'sum_vision_score_per_minute',
  wardsPlaced: 'sum_wards_placed',
  wardsKilled: 'sum_wards_killed',
  controlWardsPlaced: 'sum_control_wards_placed',
  stealthWardsPlaced: 'sum_stealth_wards_placed',
}

export type ChampionVisionTableRow = {
  championId: number
  games?: number
} & Record<ChampionVisionMetricKey, number>

export type ChampionVisionSummary = {
  championId: number
  games: number
} & Record<ChampionVisionMetricKey, number>

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function avgPerGame(sum: number, games: number): number {
  return games > 0 ? round2(sum / games) : 0
}

type ChampionVisionScope = {
  championId: number
  version?: string | string[] | null
  rankTier?: string | string[] | null
  role?: string | null
}

function mapVisionSqlRow(row: {
  champion_id: number
  games: bigint
} & Record<(typeof VISION_SQL_COLUMN)[ChampionVisionMetricKey], number>): ChampionVisionSummary {
  const games = Number(row.games ?? 0)
  const metrics = {} as Record<ChampionVisionMetricKey, number>
  for (const key of CHAMPION_VISION_METRIC_KEYS) {
    metrics[key] = avgPerGame(Number(row[VISION_SQL_COLUMN[key]] ?? 0), games)
  }
  return {
    championId: Number(row.champion_id),
    games,
    ...metrics,
  }
}

/** Stats vision moyennes pour un seul champion (fiche champion). */
export async function getChampionVisionSummary(
  scope: ChampionVisionScope
): Promise<ChampionVisionSummary | null> {
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

  const sumSelect = CHAMPION_VISION_METRIC_KEYS.map(key => {
    const col = VISION_SQL_COLUMN[key]
    return `COALESCE(SUM(cs.${col}), 0)::double precision AS ${col}`
  }).join(',\n      ')

  type SqlRow = {
    champion_id: number
    games: bigint
  } & Record<(typeof VISION_SQL_COLUMN)[ChampionVisionMetricKey], number>

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
  return mapVisionSqlRow(row)
}

export async function getChampionVisionTable(
  version?: string | string[] | null,
  rankTier?: string | string[] | null,
  role?: string | null
): Promise<{ rows: ChampionVisionTableRow[] } | null> {
  if (!isDatabaseConfigured()) return null

  const csFrom = await matchVersionedAggFrom('agg_champion_team_objective_stats', version, 'cs')
  const whereParts = [buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'cs.')]
  if (normalizedRankTiers(rankTier).length === 0) {
    whereParts.push(`cs.rank_tier <> 'UNRANKED'`)
  }
  const roleDb = normalizeStatsRoleForChampion(role ?? null)
  if (roleDb) whereParts.push(`cs.role = '${statsRoleSqlLiteral(roleDb)}'`)
  const where = whereParts.join(' AND ')

  const sumSelect = CHAMPION_VISION_METRIC_KEYS.map(key => {
    const col = VISION_SQL_COLUMN[key]
    return `COALESCE(SUM(cs.${col}), 0)::double precision AS ${col}`
  }).join(',\n      ')

  type SqlRow = {
    champion_id: number
    games: bigint
  } & Record<(typeof VISION_SQL_COLUMN)[ChampionVisionMetricKey], number>

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

  const rows: ChampionVisionTableRow[] = raw.map(row => mapVisionSqlRow(row))

  rows.sort((a, b) => b.visionScore - a.visionScore || a.championId - b.championId)
  return { rows }
}
