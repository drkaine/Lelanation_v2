/**
 * Benchmark stats for the companion ranked recap (same champion / rank / role / patch).
 */
import { queryRawUnsafe, isDatabaseConfigured } from '../db/query.js'
import { buildChampionScopedWhere } from './ChampionGlobalTableService.js'
import { matchVersionedAggFrom } from './statsAggArchive.js'
import { toQueryStringArrayParam } from '../utils/statsFilters.js'
import { normalizeStatsRoleForChampion } from '../utils/statsFilters.js'
import { CHAMPION_VS_STATS_LEGACY_METRIC_COLUMNS } from '../constants/championVsStatsMetricColumns.js'

/** Metrics aligned with companion journal keys (champion_vs_stats legacy columns). */
export const COMPANION_BENCHMARK_METRIC_KEYS = CHAMPION_VS_STATS_LEGACY_METRIC_COLUMNS.filter(
  (k) =>
    k === 'sum_gold_earned' ||
    k === 'sum_gold_spent' ||
    k === 'sum_kill_u15' ||
    k === 'sum_death_u15' ||
    k === 'sum_assist_u15' ||
    k === 'sum_minions_killed_u15' ||
    k === 'sum_vision_score_u15',
) as readonly string[]

export type CompanionChampionBenchmark = {
  championId: number
  patch: string | null
  rankTier: string | null
  role: string | null
  games: number
  metrics: Record<string, number | null>
  avgDamageToChampions: number | null
  winrate: number | null
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function avg(sum: number, games: number): number | null {
  if (games <= 0) return null
  return round1(sum / games)
}

type Scope = {
  championId: number
  version?: string | null
  rankTier?: string | null
  role?: string | null
}

export async function getCompanionChampionBenchmark(
  scope: Scope,
): Promise<CompanionChampionBenchmark | null> {
  if (!isDatabaseConfigured() || scope.championId <= 0) return null

  const version = toQueryStringArrayParam(scope.version ?? null)
  const rankTier = toQueryStringArrayParam(scope.rankTier ?? null)
  const role = normalizeStatsRoleForChampion(scope.role ?? null)

  const vsFrom = await matchVersionedAggFrom(
    'agg_champion_vs_stats',
    version.length ? version : null,
    'vs',
  )
  const vsWhere = buildChampionScopedWhere('vs', {
    championId: scope.championId,
    version: version.length ? version : null,
    rankTier: rankTier.length ? rankTier : null,
    role,
  })

  const sumCols = COMPANION_BENCHMARK_METRIC_KEYS.map(
    (k) => `COALESCE(SUM(vs.${k}), 0)::double precision AS ${k}`,
  ).join(',\n      ')

  const vsRows = await queryRawUnsafe<
    Array<{ games: bigint } & Record<string, number>>
  >(`
    SELECT
      COALESCE(SUM(vs.count_game), 0)::bigint AS games,
      ${sumCols}
    FROM ${vsFrom}
    WHERE ${vsWhere}
  `)

  const vsRow = vsRows[0]
  const games = Number(vsRow?.games ?? 0)

  const coreFrom = await matchVersionedAggFrom(
    'agg_champion_core_stats',
    version.length ? version : null,
    'cs',
  )
  const coreWhere = buildChampionScopedWhere('cs', {
    championId: scope.championId,
    version: version.length ? version : null,
    rankTier: rankTier.length ? rankTier : null,
    role,
  })

  const coreRows = await queryRawUnsafe<
    Array<{
      games: bigint
      wins: bigint
      sum_phys: bigint
      sum_magic: bigint
      sum_true: bigint
    }>
  >(`
    SELECT
      COALESCE(SUM(cs.count_game), 0)::bigint AS games,
      COALESCE(SUM(cs.count_win), 0)::bigint AS wins,
      COALESCE(SUM(cs.sum_physical_damage_to_champions), 0)::bigint AS sum_phys,
      COALESCE(SUM(cs.sum_magic_damage_to_champions), 0)::bigint AS sum_magic,
      COALESCE(SUM(cs.sum_true_damage_to_champions), 0)::bigint AS sum_true
    FROM ${coreFrom}
    WHERE ${coreWhere}
  `)

  const coreRow = coreRows[0]
  const coreGames = Number(coreRow?.games ?? 0)
  const effectiveGames = Math.max(games, coreGames)

  const metrics: Record<string, number | null> = {}
  for (const key of COMPANION_BENCHMARK_METRIC_KEYS) {
    const sum = Number(vsRow?.[key] ?? 0)
    metrics[key] = avg(sum, games)
  }

  const dmgSum =
    Number(coreRow?.sum_phys ?? 0) +
    Number(coreRow?.sum_magic ?? 0) +
    Number(coreRow?.sum_true ?? 0)
  const avgDamageToChampions = avg(dmgSum, coreGames)

  const wins = Number(coreRow?.wins ?? 0)
  const winrate =
    coreGames > 0 ? round1((wins / coreGames) * 100) : null

  if (effectiveGames <= 0) {
    return {
      championId: scope.championId,
      patch: scope.version ?? null,
      rankTier: scope.rankTier ?? null,
      role: role ?? null,
      games: 0,
      metrics,
      avgDamageToChampions: null,
      winrate: null,
    }
  }

  return {
    championId: scope.championId,
    patch: scope.version ?? null,
    rankTier: scope.rankTier ?? null,
    role: role ?? null,
    games: effectiveGames,
    metrics,
    avgDamageToChampions,
    winrate,
  }
}
