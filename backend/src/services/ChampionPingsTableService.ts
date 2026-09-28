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
import {
  avgPerGame,
  championScopeAgg,
  championSumsQuery,
  championTableAgg,
  sumColumnsSelect,
  type ChampionAggScope,
} from './championAggSums.js'

export { CHAMPION_PING_METRIC_KEYS, type ChampionPingMetricKey }

export type ChampionPingsTableRow = {
  championId: number
  games: number
  totalPerGame: number
} & Record<ChampionPingMetricKey, number>

type PingsSqlRow = {
  champion_id: number
  games: bigint
} & Record<(typeof CHAMPION_PING_TOTAL_SQL_COLUMNS)[number], bigint>

// Alias SQL en snake_case (nom de colonne) : PostgreSQL lower-case les identifiants non quotés
// (`AS sum_onMyWay` → `sum_onmyway`), ce qui cassait la lecture `row.sum_onMyWay` côté Node.
const PINGS_SUMS = sumColumnsSelect(CHAMPION_PING_TOTAL_SQL_COLUMNS, 'bigint')

function mapPingsSqlRow(row: PingsSqlRow): ChampionPingsTableRow {
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
  scope: ChampionAggScope
): Promise<ChampionPingsTableRow | null> {
  if (!isDatabaseConfigured() || scope.championId <= 0) return null

  const { from: csFrom, where } = await championScopeAgg(scope)

  const raw = await queryRawUnsafe<PingsSqlRow[]>(
    championSumsQuery({ from: csFrom, where, sums: PINGS_SUMS })
  )

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

  const { from: csFrom, where } = await championTableAgg(version, rankTier, role)

  const raw = await queryRawUnsafe<PingsSqlRow[]>(
    championSumsQuery({ from: csFrom, where, sums: PINGS_SUMS, ordered: true })
  )

  const rows: ChampionPingsTableRow[] = raw.map(row => mapPingsSqlRow(row))

  rows.sort((a, b) => b.totalPerGame - a.totalPerGame || a.championId - b.championId)
  return { rows }
}
