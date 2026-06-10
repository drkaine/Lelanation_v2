/**
 * Stats vision moyennes par champion (score, balises posées / détruites, etc.).
 */
import { queryRawUnsafe, isDatabaseConfigured } from '../db/query.js'
import { buildRawMatchCond } from './ChampionGlobalTableService.js'
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
} & Record<ChampionVisionMetricKey, number>

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function avgPerGame(sum: number, games: number): number {
  return games > 0 ? round2(sum / games) : 0
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

  const sumSelect = CHAMPION_VISION_METRIC_KEYS.map(
    key => `COALESCE(SUM(cs.${VISION_SQL_COLUMN[key]}), 0)::double precision AS sum_${key}`
  ).join(',\n      ')

  type SqlRow = {
    champion_id: number
    games: bigint
  } & Record<`sum_${ChampionVisionMetricKey}`, number>

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

  const rows: ChampionVisionTableRow[] = raw.map(row => {
    const games = Number(row.games ?? 0)
    const metrics = {} as Record<ChampionVisionMetricKey, number>
    for (const key of CHAMPION_VISION_METRIC_KEYS) {
      metrics[key] = avgPerGame(Number(row[`sum_${key}`] ?? 0), games)
    }
    return {
      championId: Number(row.champion_id),
      ...metrics,
    }
  })

  rows.sort((a, b) => b.visionScore - a.visionScore || a.championId - b.championId)
  return { rows }
}
