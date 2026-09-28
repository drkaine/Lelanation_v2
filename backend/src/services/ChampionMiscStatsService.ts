import { queryRawUnsafe, isDatabaseConfigured } from '../db/query.js'
import { avgPerGame as avgPerGameRounded, championScopeAgg, type ChampionAggScope } from './championAggSums.js'

export type ChampionMiscMetric = {
  key: string
  avgPerGame: number
}

export type ChampionMiscMetricGroup = {
  key: string
  metrics: ChampionMiscMetric[]
}

export type ChampionMiscSummary = {
  championId: number
  games: number
  groups: ChampionMiscMetricGroup[]
}

function avgPerGame(sum: number, games: number): number {
  return avgPerGameRounded(sum, games, 1)
}

export async function getChampionMiscSummary(scope: ChampionAggScope): Promise<ChampionMiscSummary | null> {
  if (!isDatabaseConfigured() || scope.championId <= 0) return null

  const { from: csFrom, where } = await championScopeAgg(scope)

  const rows = await queryRawUnsafe<
    Array<{
      games: bigint
      sum_total_heal: bigint
      sum_total_heals_on_teammates: bigint
      sum_effective_heal_and_shielding: bigint
      sum_total_damage_shielded_on_teammates: bigint
      sum_physical_damage_done: bigint
      sum_magic_damage_done: bigint
      sum_true_damage_done: bigint
      sum_double_kills: bigint
      sum_triple_kills: bigint
      sum_quadra_kills: bigint
      sum_penta_kills: bigint
      sum_unreal_kills: bigint
    }>
  >(`
    SELECT
      COALESCE(SUM(cs.count_game), 0)::bigint AS games,
      COALESCE(SUM(cs.sum_total_heal), 0)::bigint AS sum_total_heal,
      COALESCE(SUM(cs.sum_total_heals_on_teammates), 0)::bigint AS sum_total_heals_on_teammates,
      COALESCE(SUM(cs.sum_effective_heal_and_shielding), 0)::bigint AS sum_effective_heal_and_shielding,
      COALESCE(SUM(cs.sum_total_damage_shielded_on_teammates), 0)::bigint AS sum_total_damage_shielded_on_teammates,
      COALESCE(SUM(cs.sum_physical_damage_done), 0)::bigint AS sum_physical_damage_done,
      COALESCE(SUM(cs.sum_magic_damage_done), 0)::bigint AS sum_magic_damage_done,
      COALESCE(SUM(cs.sum_true_damage_done), 0)::bigint AS sum_true_damage_done,
      COALESCE(SUM(cs.sum_double_kills), 0)::bigint AS sum_double_kills,
      COALESCE(SUM(cs.sum_triple_kills), 0)::bigint AS sum_triple_kills,
      COALESCE(SUM(cs.sum_quadra_kills), 0)::bigint AS sum_quadra_kills,
      COALESCE(SUM(cs.sum_penta_kills), 0)::bigint AS sum_penta_kills,
      COALESCE(SUM(cs.sum_unreal_kills), 0)::bigint AS sum_unreal_kills
    FROM ${csFrom}
    WHERE ${where}
  `)

  const row = rows[0]
  const games = Number(row?.games ?? 0)
  if (games <= 0) {
    return { championId: scope.championId, games: 0, groups: [] }
  }

  const n = (col: keyof NonNullable<typeof row>) => Number(row?.[col] ?? 0)

  const groups: ChampionMiscMetricGroup[] = [
    {
      key: 'healing',
      metrics: [
        { key: 'totalHeal', avgPerGame: avgPerGame(n('sum_total_heal'), games) },
        { key: 'healsOnTeammates', avgPerGame: avgPerGame(n('sum_total_heals_on_teammates'), games) },
        { key: 'effectiveHealShield', avgPerGame: avgPerGame(n('sum_effective_heal_and_shielding'), games) },
        {
          key: 'damageShieldedOnTeammates',
          avgPerGame: avgPerGame(n('sum_total_damage_shielded_on_teammates'), games),
        },
      ],
    },
    {
      key: 'damageTypes',
      metrics: [
        { key: 'physicalDone', avgPerGame: avgPerGame(n('sum_physical_damage_done'), games) },
        { key: 'magicDone', avgPerGame: avgPerGame(n('sum_magic_damage_done'), games) },
        { key: 'trueDone', avgPerGame: avgPerGame(n('sum_true_damage_done'), games) },
      ],
    },
    {
      key: 'multikills',
      metrics: [
        { key: 'double', avgPerGame: avgPerGame(n('sum_double_kills'), games) },
        { key: 'triple', avgPerGame: avgPerGame(n('sum_triple_kills'), games) },
        { key: 'quadra', avgPerGame: avgPerGame(n('sum_quadra_kills'), games) },
        { key: 'penta', avgPerGame: avgPerGame(n('sum_penta_kills'), games) },
        { key: 'unreal', avgPerGame: avgPerGame(n('sum_unreal_kills'), games) },
      ],
    },
  ]

  return { championId: scope.championId, games, groups }
}
