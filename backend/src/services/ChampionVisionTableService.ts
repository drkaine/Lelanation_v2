/**
 * Stats vision moyennes par champion (score, balises posées / détruites, etc.).
 */
import { queryRawUnsafe, isDatabaseConfigured } from '../db/query.js'
import {
  avgPerGame,
  championScopeAgg,
  championSumsQuery,
  championTableAgg,
  sumColumnsSelect,
  type ChampionAggScope,
} from './championAggSums.js'

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

type VisionSqlRow = {
  champion_id: number
  games: bigint
} & Record<(typeof VISION_SQL_COLUMN)[ChampionVisionMetricKey], number>

const VISION_SUMS = sumColumnsSelect(
  CHAMPION_VISION_METRIC_KEYS.map(key => VISION_SQL_COLUMN[key]),
  'double precision'
)

function mapVisionSqlRow(row: VisionSqlRow): ChampionVisionSummary {
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
  scope: ChampionAggScope
): Promise<ChampionVisionSummary | null> {
  if (!isDatabaseConfigured() || scope.championId <= 0) return null

  const { from: csFrom, where } = await championScopeAgg(scope)

  const raw = await queryRawUnsafe<VisionSqlRow[]>(
    championSumsQuery({ from: csFrom, where, sums: VISION_SUMS })
  )

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

  const { from: csFrom, where } = await championTableAgg(version, rankTier, role)

  const raw = await queryRawUnsafe<VisionSqlRow[]>(
    championSumsQuery({ from: csFrom, where, sums: VISION_SUMS, ordered: true })
  )

  const rows: ChampionVisionTableRow[] = raw.map(row => mapVisionSqlRow(row))

  rows.sort((a, b) => b.visionScore - a.visionScore || a.championId - b.championId)
  return { rows }
}
