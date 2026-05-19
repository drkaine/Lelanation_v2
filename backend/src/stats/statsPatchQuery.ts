/**
 * FROM fragments for stats reads on `lelanation_statistiques` (partitioned by `patch`).
 * Exposes legacy column names (`game_version`, `role_norm`, `team_num`, …) for existing SQL.
 */
import { toQueryStringArrayParam } from '../utils/statsFilters.js'
import { isSafeIdentSegment, normalizeAggTableName, physicalTableName } from './statsTableMap.js'

export function normalizePatchMajorMinor(version: string): string {
  const parts = String(version ?? '')
    .trim()
    .split('.')
    .filter(Boolean)
  if (parts.length >= 2) return `${parts[0]}.${parts[1]}`
  if (parts.length === 1) return `${parts[0]}.0`
  return '0.0'
}

export function invalidateAggArchivePartitionCache(): void {
  /* no-op — partitions LIST(patch), no archive cache */
}

function patchVersionSqlPredicate(alias: string, p: string): string {
  const esc = p.replace(/'/g, "''")
  return `(${alias}.patch = '${esc}' OR ${alias}.patch LIKE '${esc}.%')`
}

function patchFilterClause(tableAlias: string, patchKey: string | null): string {
  if (!patchKey || !/^\d+\.\d+$/.test(patchKey)) return 'TRUE'
  return patchVersionSqlPredicate(tableAlias, patchKey)
}

function sqlChampionCoreFragment(patchKey: string | null): string {
  const pf = patchFilterClause('cs', patchKey)
  return `(
    SELECT
      (ROW_NUMBER() OVER ())::bigint AS id,
      cs.patch AS game_version,
      cs.role,
      upper(cs.role) AS role_norm,
      cs.rank_tier,
      cs.region,
      cs.champion_id,
      cs.team AS team_num,
      cs.count_win,
      cs.count_game,
      0::integer AS count_ban,
      cs.sum_gold_earned,
      cs.sum_gold_spent,
      cs.sum_max_level_lead_lane_opponent,
      cs.sum_max_kill_deficit,
      cs.sum_more_enemy_jungle_than_opponent,
      cs.sum_max_cs_advantage_on_lane_opponent,
      cs.sum_vision_score_advantage_lane_opponent,
      cs.sum_laning_phase_gold_exp_advantage,
      cs.sum_early_laning_phase_gold_exp_advantage,
      cs.updated_at
    FROM champion_stats cs
    WHERE ${pf}
  )`
}

function sqlChampionSideFragment(patchKey: string | null): string {
  const pf = patchFilterClause('cs', patchKey)
  return `(
    SELECT
      (ROW_NUMBER() OVER ())::bigint AS id,
      cs.patch AS game_version,
      cs.role,
      upper(cs.role) AS role_norm,
      cs.rank_tier,
      cs.region,
      cs.champion_id,
      cs.team AS team_num,
      cs.count_win,
      cs.count_game,
      cs.sum_gold_earned,
      cs.sum_gold_spent,
      cs.sum_max_level_lead_lane_opponent,
      cs.sum_max_kill_deficit,
      cs.sum_more_enemy_jungle_than_opponent,
      cs.sum_max_cs_advantage_on_lane_opponent,
      cs.sum_vision_score_advantage_lane_opponent,
      cs.sum_laning_phase_gold_exp_advantage,
      cs.sum_early_laning_phase_gold_exp_advantage,
      cs.sum_physical_damage_done_to_champions AS sum_physical_damage_to_champions,
      cs.sum_magic_damage_done_to_champions AS sum_magic_damage_to_champions,
      cs.sum_true_damage_done_to_champions AS sum_true_damage_to_champions,
      cs.sum_total_damage_dealt_to_champions AS sum_total_damage_dealt_to_champions,
      cs.sum_total_heal AS sum_total_units_healed,
      cs.sum_total_heal_on_teammates AS sum_total_units_healed_to_champions,
      cs.sum_damage_self_mitigated,
      cs.sum_damage_dealt_to_buildings,
      cs.sum_damage_dealt_to_turrets,
      cs.sum_damage_dealt_to_objectives,
      cs.sum_damage_dealt_to_epic_monsters,
      cs.sum_damage_per_minute,
      cs.updated_at
    FROM champion_stats cs
    WHERE ${pf} AND cs.team IN (100, 200)
  )`
}

function sqlMatchOutcomeFragment(patchKey: string | null): string {
  const pf = patchFilterClause('mo', patchKey)
  return `(
    SELECT
      mo.patch AS game_version,
      mo.rank_tier,
      mo.region,
      mo.count_match,
      mo.updated_at
    FROM match_outcome_stats mo
    WHERE ${pf}
  )`
}

function sqlTeamCoreFragment(patchKey: string | null): string {
  const pf = patchFilterClause('tc', patchKey)
  return `(
    SELECT
      (ROW_NUMBER() OVER ())::bigint AS id,
      tc.patch AS game_version,
      tc.rank_tier,
      tc.region,
      tc.team,
      tc.count_win,
      tc.count_game,
      tc.count_team_early_surrendered,
      tc.count_team_surrendered,
      0::integer AS sum_baron_kills,
      0::integer AS count_baron_first,
      0::integer AS sum_dragon_kills,
      0::integer AS count_dragon_first,
      0::integer AS sum_tower_kills,
      0::integer AS count_tower_first,
      0::integer AS sum_horde_kills,
      0::integer AS count_horde_first,
      0::integer AS sum_rift_herald_kills,
      0::integer AS count_rift_herald_first,
      0::integer AS sum_inhibitor_kills,
      0::integer AS count_inhibitor_first,
      0::integer AS count_first_blood,
      0::integer AS sum_elder_kills,
      tc.updated_at
    FROM team_core_stat tc
    WHERE ${pf}
  )`
}

function sqlBansBannerFragment(patchKey: string | null): string {
  const pf = patchFilterClause('bb', patchKey)
  return `(
    SELECT patch AS game_version, rank_tier, region, banned_champion_id,
      100::smallint AS team_num, count_banner_team_100 AS ban_count, 'TOP'::text AS banner_role_norm
    FROM champion_bans_by_banner bb WHERE ${pf} AND count_banner_team_100 > 0
    UNION ALL
    SELECT patch, rank_tier, region, banned_champion_id,
      200, count_banner_team_200, 'TOP'
    FROM champion_bans_by_banner bb WHERE ${pf} AND count_banner_team_200 > 0
    UNION ALL
    SELECT patch, rank_tier, region, banned_champion_id,
      100, count_banner_top, 'TOP'
    FROM champion_bans_by_banner bb WHERE ${pf} AND count_banner_top > 0
    UNION ALL
    SELECT patch, rank_tier, region, banned_champion_id,
      100, count_banner_jungle, 'JUNGLE'
    FROM champion_bans_by_banner bb WHERE ${pf} AND count_banner_jungle > 0
    UNION ALL
    SELECT patch, rank_tier, region, banned_champion_id,
      100, count_banner_mid, 'MIDDLE'
    FROM champion_bans_by_banner bb WHERE ${pf} AND count_banner_mid > 0
    UNION ALL
    SELECT patch, rank_tier, region, banned_champion_id,
      100, count_banner_adc, 'BOTTOM'
    FROM champion_bans_by_banner bb WHERE ${pf} AND count_banner_adc > 0
    UNION ALL
    SELECT patch, rank_tier, region, banned_champion_id,
      100, count_banner_support, 'SUPPORT'
    FROM champion_bans_by_banner bb WHERE ${pf} AND count_banner_support > 0
    UNION ALL
    SELECT patch, rank_tier, region, banned_champion_id,
      200, count_banner_top, 'TOP'
    FROM champion_bans_by_banner bb WHERE ${pf} AND count_banner_top > 0
    UNION ALL
    SELECT patch, rank_tier, region, banned_champion_id,
      200, count_banner_jungle, 'JUNGLE'
    FROM champion_bans_by_banner bb WHERE ${pf} AND count_banner_jungle > 0
    UNION ALL
    SELECT patch, rank_tier, region, banned_champion_id,
      200, count_banner_mid, 'MIDDLE'
    FROM champion_bans_by_banner bb WHERE ${pf} AND count_banner_mid > 0
    UNION ALL
    SELECT patch, rank_tier, region, banned_champion_id,
      200, count_banner_adc, 'BOTTOM'
    FROM champion_bans_by_banner bb WHERE ${pf} AND count_banner_adc > 0
    UNION ALL
    SELECT patch, rank_tier, region, banned_champion_id,
      200, count_banner_support, 'SUPPORT'
    FROM champion_bans_by_banner bb WHERE ${pf} AND count_banner_support > 0
  )`
}

function sqlGenericPatchTableFragment(physical: string, patchKey: string | null): string {
  const pf = patchFilterClause('t', patchKey)
  return `(SELECT t.*, t.patch AS game_version FROM ${physical} t WHERE ${pf})`
}

function sqlBotlaneFragment(patchKey: string | null): string {
  const pf = patchFilterClause('bd', patchKey)
  return `(SELECT bd.*, bd.patch AS game_version FROM botlane_duo_vs_duo_stats bd WHERE ${pf})`
}

function sqlPatchFragmentForLogical(logicalTable: string, patchKey: string | null): string {
  const normalized = normalizeAggTableName(logicalTable)
  switch (normalized) {
    case 'agg_champion_core_stats':
      return sqlChampionCoreFragment(patchKey)
    case 'agg_champion_side_stats':
      return sqlChampionSideFragment(patchKey)
    case 'agg_match_outcome_stats':
      return sqlMatchOutcomeFragment(patchKey)
    case 'agg_team_core_stats':
      return sqlTeamCoreFragment(patchKey)
    case 'agg_champion_bans_by_banner':
      return sqlBansBannerFragment(patchKey)
    case 'agg_botlane_duo_vs_duo_stats':
      return sqlBotlaneFragment(patchKey)
    case 'agg_champion_damage_stats':
    case 'agg_champion_participant_stats':
      return sqlChampionSideFragment(patchKey)
    case 'agg_team_bucket':
      return sqlGenericPatchTableFragment('champion_bucket', patchKey)
    default: {
      const physical = physicalTableName(normalized)
      if (!isSafeIdentSegment(physical)) {
        throw new Error(`[statsPatchQuery] invalid physical table for ${logicalTable}`)
      }
      return sqlGenericPatchTableFragment(physical, patchKey)
    }
  }
}

function normalizeSingleVersionKey(version: string | string[] | null | undefined): string | null {
  const arr = toQueryStringArrayParam(version)
  if (arr.length !== 1) return null
  return normalizePatchMajorMinor(arr[0]!)
}

export async function matchVersionedAggFrom(
  aggTableName: string,
  version: string | string[] | null | undefined,
  asAlias: string,
): Promise<string> {
  const normalizedTable = normalizeAggTableName(aggTableName)
  if (!isSafeIdentSegment(normalizedTable) || !/^[a-z][a-z0-9_]*$/.test(asAlias)) {
    throw new Error(`[statsPatchQuery] invalid identifier: ${aggTableName} ${asAlias}`)
  }
  const single = normalizeSingleVersionKey(version)
  const patchKey = single ? normalizePatchMajorMinor(single) : null
  const physical = sqlPatchFragmentForLogical(normalizedTable, patchKey)
  return `${physical} ${asAlias}`
}

export async function sqlAggUnionAllLiveAndArchives(aggTableName: string, asAlias: string): Promise<string> {
  return matchVersionedAggFrom(aggTableName, null, asAlias)
}

export async function sqlAggOrArchiveRelation(
  aggTableName: string,
  patchKey: string,
): Promise<string | null> {
  const normalizedTable = normalizeAggTableName(aggTableName)
  if (!isSafeIdentSegment(normalizedTable)) return null
  const p = normalizePatchMajorMinor(patchKey)
  if (!/^\d+\.\d+$/.test(p)) return null
  return sqlPatchFragmentForLogical(normalizedTable, p)
}

export async function liveAggRelationExists(aggTableName: string): Promise<boolean> {
  const physical = physicalTableName(aggTableName)
  if (!isSafeIdentSegment(physical)) return false
  const { queryRawUnsafe } = await import('../db/query.js')
  const rows = await queryRawUnsafe<Array<{ x: boolean }>>(
    `SELECT to_regclass('public.${physical}') IS NOT NULL AS x`,
  )
  return Boolean(rows[0]?.x)
}
