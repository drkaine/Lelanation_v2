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

/** Semver-style compare on major.minor patch labels (16.10 < 16.11). */
export function comparePatchMajorMinor(a: string, b: string): number {
  const [aMajRaw, aMinRaw] = normalizePatchMajorMinor(a).split('.')
  const [bMajRaw, bMinRaw] = normalizePatchMajorMinor(b).split('.')
  const aMaj = Number(aMajRaw)
  const aMin = Number(aMinRaw)
  const bMaj = Number(bMajRaw)
  const bMin = Number(bMinRaw)
  if (aMaj !== bMaj) return aMaj - bMaj
  return aMin - bMin
}

function escapePatchSqlLiteral(patch: string): string {
  return patch.replace(/'/g, "''")
}

/** Winrate on the reference patch only (not cumulative). */
export function buildProgressionOldestOnlySql(alias: string, refPatch: string): string {
  const esc = escapePatchSqlLiteral(normalizePatchMajorMinor(refPatch))
  return `(${alias}.game_version = '${esc}' OR ${alias}.game_version LIKE '${esc}.%')`
}

/**
 * Patches for the « since » side of progression stats.
 * - Sans plafond (`capPatch` null) : ref inclus → cumul depuis ref (16.10 + 16.11 + …).
 * - Avec plafond (`sinceVersion` = patch filtre) : strictement après ref jusqu’au plafond
 *   (ex. ref 16.10, cap 16.11 → 16.11 seul), pour ne pas mélanger ref dans les deux colonnes.
 */
export function patchesInProgressionSinceRange(
  refPatch: string,
  capPatch: string | null,
  availablePatches: string[],
): string[] {
  const ref = normalizePatchMajorMinor(refPatch)
  const cap = capPatch ? normalizePatchMajorMinor(capPatch) : null
  const afterRefOnly = cap != null
  return [...new Set(availablePatches.map(normalizePatchMajorMinor))]
    .filter((p) => (afterRefOnly ? comparePatchMajorMinor(p, ref) > 0 : comparePatchMajorMinor(p, ref) >= 0))
    .filter((p) => !cap || comparePatchMajorMinor(p, cap) <= 0)
}

/** True when « depuis ref » can differ from « ref seul » (au moins un patch strictement plus récent dans la fenêtre). */
export function progressionHasComparableSinceRange(
  refPatch: string,
  capPatch: string | null,
  availablePatches: string[],
): boolean {
  const ref = normalizePatchMajorMinor(refPatch)
  const sincePatches = patchesInProgressionSinceRange(refPatch, capPatch, availablePatches)
  return sincePatches.some((p) => comparePatchMajorMinor(p, ref) > 0)
}

export function buildProgressionSinceSql(
  alias: string,
  refPatch: string,
  capPatch: string | null,
  availablePatches: string[],
): string {
  const patches = patchesInProgressionSinceRange(refPatch, capPatch, availablePatches)
  if (patches.length === 0) return 'FALSE'
  const parts = patches.map((p) => {
    const esc = escapePatchSqlLiteral(p)
    return `(${alias}.game_version = '${esc}' OR ${alias}.game_version LIKE '${esc}.%')`
  })
  return `(${parts.join(' OR ')})`
}

export async function listDistinctPatchVersions(): Promise<string[]> {
  const union = await sqlAggUnionAllLiveAndArchives('agg_match_outcome_stats', 'mo')
  const { queryRawUnsafe } = await import('../db/query.js')
  const rows = await queryRawUnsafe<Array<{ game_version: string }>>(`
    SELECT DISTINCT mo.game_version
    FROM ${union}
    WHERE mo.game_version IS NOT NULL AND TRIM(mo.game_version) <> ''
    ORDER BY mo.game_version
  `)
  return rows.map((r) => String(r.game_version ?? '').trim()).filter(Boolean)
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
      COALESCE(cs.champion_transform, 0)::smallint AS champion_transform,
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
      cs.sum_kills,
      cs.sum_deaths_by_enemy_champs AS sum_deaths,
      cs.sum_assists,
      cs.sum_physical_damage_done_to_champions,
      cs.sum_magic_damage_done_to_champions,
      cs.sum_true_damage_done_to_champions,
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
      COALESCE(cs.champion_transform, 0)::smallint AS champion_transform,
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
      (cs.sum_physical_damage_done_to_champions + cs.sum_magic_damage_done_to_champions + cs.sum_true_damage_done_to_champions) AS sum_total_damage_dealt_to_champions,
      cs.sum_physical_damage_done_to_champions,
      cs.sum_magic_damage_done_to_champions,
      cs.sum_true_damage_done_to_champions,
      cs.sum_total_heal AS sum_total_units_healed,
      cs.sum_total_heals_on_teammates AS sum_total_units_healed_to_champions,
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
      0::integer AS count_earth_drake,
      0::integer AS count_water_drake,
      0::integer AS count_wind_drake,
      0::integer AS count_fire_drake,
      0::integer AS count_hextec_drake,
      0::integer AS count_chem_drake,
      0::integer AS count_earth_drake_soul,
      0::integer AS count_water_drake_soul,
      0::integer AS count_wind_drake_soul,
      0::integer AS count_fire_drake_soul,
      0::integer AS count_hextec_drake_soul,
      0::integer AS count_chem_drake_soul,
      NULL::timestamptz AS updated_at
    FROM team_core_stat tc
    WHERE ${pf}
  )`
}

function sqlSummonerSpellsFragment(patchKey: string | null): string {
  const pf = patchFilterClause('ss', patchKey)
  return `(
    SELECT
      ss.*,
      ss.patch AS game_version,
      (ss.count_win_d + ss.count_win_f)::integer AS count_win,
      (ss.count_game_d + ss.count_game_f)::integer AS count_game,
      ss.count_slotd AS count_slot0,
      ss.count_slotf AS count_slot1
    FROM champion_summoner_spells ss
    WHERE ${pf}
  )`
}

/** Une ligne par (patch, rank, region, champion) — totaux bans sans éclatement par rôle. */
function sqlBansCoreFragment(patchKey: string | null): string {
  const pf = patchFilterClause('bb', patchKey)
  return `(
    SELECT
      bb.patch AS game_version,
      bb.rank_tier,
      bb.region,
      bb.banned_champion_id,
      bb.count_banner_team_100,
      bb.count_banner_team_200,
      (bb.count_banner_team_100 + bb.count_banner_team_200)::integer AS ban_count,
      bb.count_banner_top,
      bb.count_banner_jungle,
      bb.count_banner_mid,
      bb.count_banner_adc,
      bb.count_banner_support,
      bb.count_ban_when_team_won,
      bb.count_ban_when_team_lost
    FROM champion_bans_by_banner bb
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
    case 'agg_champion_bans_by_banner_core':
      return sqlBansCoreFragment(patchKey)
    case 'agg_champion_summoner_spells':
      return sqlSummonerSpellsFragment(patchKey)
    case 'agg_botlane_duo_vs_duo_stats':
      return sqlBotlaneFragment(patchKey)
    case 'agg_champion_damage_stats':
    case 'agg_champion_participant_stats':
      return sqlChampionSideFragment(patchKey)
    case 'agg_champion_bucket':
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
