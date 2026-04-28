/**
 * Patch cleanup service:
 * close patches that reached maxMatches (archive + remove from active list + raw cleanup).
 */
import { prisma, isDatabaseConfigured } from '../db.js'
import { createRiotPollerLogger } from '../utils/riotPollerLogger.js'
import { loadMatchFilters } from './RiotConfigService.js'
import { closePatch } from './PatchLifecycleService.js'

type LoggerType = ReturnType<typeof createRiotPollerLogger>

/**
 * Load active patch counters and close patches that have reached their target.
 * Contrainte : on ne clôture un patch que si games_number >= game_number_max.
 * Utilise close_patch() SQL : copie des tables agg_* vers les archives unifiées archive_agg_* (tous les patches), purge des hot agg_* + ingest pour le patch, gel de la ligne `active_patches` (archived_at, is_current).
 */
export async function runPatchCleanupFromConfig(logger?: LoggerType): Promise<void> {
  if (!isDatabaseConfigured()) return

  const filtersRes = await loadMatchFilters()
  if (filtersRes.isErr()) return

  const filters = filtersRes.unwrap()
  const currentPatch = filters.versions[filters.versions.length - 1]?.version
  if (!currentPatch) return

  const candidates = await prisma.activePatch.findMany({
    where: { gameNumberMax: { gt: 0 } },
    select: { gameVersion: true, gamesNumber: true, gameNumberMax: true },
  })

  for (const c of candidates) {
    const patch = c.gameVersion
    if (patch === currentPatch) continue
    if (c.gamesNumber < c.gameNumberMax) continue
    if (logger) void logger.step('Patch cleanup: closing patch (archive + delete raw)', { patch, matchCount: c.gamesNumber })
    try {
      const summary = await closePatch(patch)
      if (logger) void logger.step('Patch cleanup complete', { patch, summary })
    } catch (err) {
      if (logger) void logger.alerte('close_patch failed', { patch, error: String(err) })
    }
  }
}

export async function refreshObjectiveOutcomeStats(logger?: LoggerType): Promise<number> {
  if (!isDatabaseConfigured()) return 0
  const affected = await prisma.$executeRawUnsafe(`
    INSERT INTO agg_objective_outcome_stats (
      game_version,
      rank_tier,
      baron_win_team,
      baron_loose_team,
      drake_win_team,
      drake_loose_team,
      void_win_team,
      void_loose_team,
      herald_win_team,
      herald_loose_team,
      inhibitor_win_team,
      inhibitor_loose_team,
      tower_win_team,
      tower_loose_team,
      first_blood_win_team,
      first_blood_loose_team,
      elder_win_team,
      elder_loose_team,
      earth_drake_win_team,
      earth_drake_loose_team,
      water_drake_win_team,
      water_drake_loose_team,
      wind_drake_win_team,
      wind_drake_loose_team,
      fire_drake_win_team,
      fire_drake_loose_team,
      hextec_drake_win_team,
      hextec_drake_loose_team,
      chem_drake_win_team,
      chem_drake_loose_team,
      earth_soul_win_team,
      earth_soul_loose_team,
      water_soul_win_team,
      water_soul_loose_team,
      wind_soul_win_team,
      wind_soul_loose_team,
      fire_soul_win_team,
      fire_soul_loose_team,
      hextec_soul_win_team,
      hextec_soul_loose_team,
      chem_soul_win_team,
      chem_soul_loose_team,
      updated_at
    )
    WITH dims AS (
      SELECT DISTINCT atc.game_version, atc.rank_tier
      FROM agg_team_core_stats atc
      WHERE atc.rank_tier <> 'UNRANKED'
    ),
    objective_bucket_rows AS (
      SELECT
        atc.game_version,
        atc.rank_tier,
        tb.objective_key,
        tb.objective_bucket,
        SUM(tb.count_win)::int AS count_win,
        SUM(tb.count_game - tb.count_win)::int AS count_loss
      FROM agg_team_bucket tb
      INNER JOIN agg_team_core_stats atc ON atc.id = tb.team_stat_id
      WHERE atc.rank_tier <> 'UNRANKED'
      GROUP BY atc.game_version, atc.rank_tier, tb.objective_key, tb.objective_bucket
    ),
    objective_bucket_json AS (
      SELECT
        game_version,
        rank_tier,
        objective_key,
        COALESCE(
          jsonb_object_agg(objective_bucket::text, count_win ORDER BY objective_bucket)
            FILTER (WHERE count_win > 0),
          '{}'::jsonb
        ) AS win_json,
        COALESCE(
          jsonb_object_agg(objective_bucket::text, count_loss ORDER BY objective_bucket)
            FILTER (WHERE count_loss > 0),
          '{}'::jsonb
        ) AS loss_json
      FROM objective_bucket_rows
      GROUP BY game_version, rank_tier, objective_key
    ),
    objective_bucket_json_drake_total AS (
      SELECT
        game_version,
        rank_tier,
        COALESCE(
          jsonb_object_agg(objective_bucket::text, count_win ORDER BY objective_bucket)
            FILTER (WHERE count_win > 0),
          '{}'::jsonb
        ) AS win_json,
        COALESCE(
          jsonb_object_agg(objective_bucket::text, count_loss ORDER BY objective_bucket)
            FILTER (WHERE count_loss > 0),
          '{}'::jsonb
        ) AS loss_json
      FROM (
        SELECT
          game_version,
          rank_tier,
          objective_bucket,
          SUM(count_win)::int AS count_win,
          SUM(count_loss)::int AS count_loss
        FROM objective_bucket_rows
        WHERE objective_key IN ('dragon', 'elder')
        GROUP BY game_version, rank_tier, objective_bucket
      ) x
      GROUP BY game_version, rank_tier
    ),
    first_counts AS (
      SELECT
        im.game_version,
        UPPER(COALESCE(NULLIF(TRIM(im.rank_tier), ''), 'UNRANKED')) AS rank_tier,
        SUM(CASE WHEN it.win AND it.baron_first THEN 1 ELSE 0 END)::int AS baron_first_win,
        SUM(CASE WHEN NOT it.win AND it.baron_first THEN 1 ELSE 0 END)::int AS baron_first_loss,
        SUM(CASE WHEN it.win AND it.dragon_first THEN 1 ELSE 0 END)::int AS dragon_first_win,
        SUM(CASE WHEN NOT it.win AND it.dragon_first THEN 1 ELSE 0 END)::int AS dragon_first_loss,
        SUM(CASE WHEN it.win AND it.horde_first THEN 1 ELSE 0 END)::int AS horde_first_win,
        SUM(CASE WHEN NOT it.win AND it.horde_first THEN 1 ELSE 0 END)::int AS horde_first_loss,
        SUM(CASE WHEN it.win AND it.rift_herald_first THEN 1 ELSE 0 END)::int AS herald_first_win,
        SUM(CASE WHEN NOT it.win AND it.rift_herald_first THEN 1 ELSE 0 END)::int AS herald_first_loss,
        SUM(CASE WHEN it.win AND it.inhibitor_first THEN 1 ELSE 0 END)::int AS inhibitor_first_win,
        SUM(CASE WHEN NOT it.win AND it.inhibitor_first THEN 1 ELSE 0 END)::int AS inhibitor_first_loss,
        SUM(CASE WHEN it.win AND it.tower_first THEN 1 ELSE 0 END)::int AS tower_first_win,
        SUM(CASE WHEN NOT it.win AND it.tower_first THEN 1 ELSE 0 END)::int AS tower_first_loss,
        SUM(CASE WHEN it.win AND it.first_blood THEN 1 ELSE 0 END)::int AS first_blood_win,
        SUM(CASE WHEN NOT it.win AND it.first_blood THEN 1 ELSE 0 END)::int AS first_blood_loss
      FROM teams it
      INNER JOIN matchs im ON im.id = it.match_id
      WHERE UPPER(COALESCE(NULLIF(TRIM(im.rank_tier), ''), 'UNRANKED')) <> 'UNRANKED'
      GROUP BY im.game_version, UPPER(COALESCE(NULLIF(TRIM(im.rank_tier), ''), 'UNRANKED'))
    ),
    soul_counts AS (
      SELECT
        game_version,
        rank_tier,
        SUM(CASE WHEN objective_key = 'earth_soul' AND objective_bucket > 0 THEN count_win ELSE 0 END)::int AS earth_soul_win,
        SUM(CASE WHEN objective_key = 'earth_soul' AND objective_bucket > 0 THEN count_loss ELSE 0 END)::int AS earth_soul_loss,
        SUM(CASE WHEN objective_key = 'water_soul' AND objective_bucket > 0 THEN count_win ELSE 0 END)::int AS water_soul_win,
        SUM(CASE WHEN objective_key = 'water_soul' AND objective_bucket > 0 THEN count_loss ELSE 0 END)::int AS water_soul_loss,
        SUM(CASE WHEN objective_key = 'wind_soul' AND objective_bucket > 0 THEN count_win ELSE 0 END)::int AS wind_soul_win,
        SUM(CASE WHEN objective_key = 'wind_soul' AND objective_bucket > 0 THEN count_loss ELSE 0 END)::int AS wind_soul_loss,
        SUM(CASE WHEN objective_key = 'fire_soul' AND objective_bucket > 0 THEN count_win ELSE 0 END)::int AS fire_soul_win,
        SUM(CASE WHEN objective_key = 'fire_soul' AND objective_bucket > 0 THEN count_loss ELSE 0 END)::int AS fire_soul_loss,
        SUM(CASE WHEN objective_key = 'hextec_soul' AND objective_bucket > 0 THEN count_win ELSE 0 END)::int AS hextec_soul_win,
        SUM(CASE WHEN objective_key = 'hextec_soul' AND objective_bucket > 0 THEN count_loss ELSE 0 END)::int AS hextec_soul_loss,
        SUM(CASE WHEN objective_key = 'chem_soul' AND objective_bucket > 0 THEN count_win ELSE 0 END)::int AS chem_soul_win,
        SUM(CASE WHEN objective_key = 'chem_soul' AND objective_bucket > 0 THEN count_loss ELSE 0 END)::int AS chem_soul_loss
      FROM objective_bucket_rows
      GROUP BY game_version, rank_tier
    )
    SELECT
      d.game_version,
      d.rank_tier,
      COALESCE(ob_baron.win_json, '{}'::jsonb) || jsonb_build_object('first', COALESCE(fc.baron_first_win, 0)),
      COALESCE(ob_baron.loss_json, '{}'::jsonb) || jsonb_build_object('first', COALESCE(fc.baron_first_loss, 0)),
      COALESCE(ob_drake_total.win_json, '{}'::jsonb) || jsonb_build_object('first', COALESCE(fc.dragon_first_win, 0)),
      COALESCE(ob_drake_total.loss_json, '{}'::jsonb) || jsonb_build_object('first', COALESCE(fc.dragon_first_loss, 0)),
      COALESCE(ob_horde.win_json, '{}'::jsonb) || jsonb_build_object('first', COALESCE(fc.horde_first_win, 0)),
      COALESCE(ob_horde.loss_json, '{}'::jsonb) || jsonb_build_object('first', COALESCE(fc.horde_first_loss, 0)),
      COALESCE(ob_herald.win_json, '{}'::jsonb) || jsonb_build_object('first', COALESCE(fc.herald_first_win, 0)),
      COALESCE(ob_herald.loss_json, '{}'::jsonb) || jsonb_build_object('first', COALESCE(fc.herald_first_loss, 0)),
      COALESCE(ob_inhibitor.win_json, '{}'::jsonb) || jsonb_build_object('first', COALESCE(fc.inhibitor_first_win, 0)),
      COALESCE(ob_inhibitor.loss_json, '{}'::jsonb) || jsonb_build_object('first', COALESCE(fc.inhibitor_first_loss, 0)),
      COALESCE(ob_tower.win_json, '{}'::jsonb) || jsonb_build_object('first', COALESCE(fc.tower_first_win, 0)),
      COALESCE(ob_tower.loss_json, '{}'::jsonb) || jsonb_build_object('first', COALESCE(fc.tower_first_loss, 0)),
      jsonb_build_object('first', COALESCE(fc.first_blood_win, 0)),
      jsonb_build_object('first', COALESCE(fc.first_blood_loss, 0)),
      COALESCE(ob_elder.win_json, '{}'::jsonb),
      COALESCE(ob_elder.loss_json, '{}'::jsonb),
      COALESCE(ob_earth.win_json, '{}'::jsonb) || jsonb_build_object('soul', COALESCE(sc.earth_soul_win, 0)),
      COALESCE(ob_earth.loss_json, '{}'::jsonb) || jsonb_build_object('soul', COALESCE(sc.earth_soul_loss, 0)),
      COALESCE(ob_water.win_json, '{}'::jsonb) || jsonb_build_object('soul', COALESCE(sc.water_soul_win, 0)),
      COALESCE(ob_water.loss_json, '{}'::jsonb) || jsonb_build_object('soul', COALESCE(sc.water_soul_loss, 0)),
      COALESCE(ob_wind.win_json, '{}'::jsonb) || jsonb_build_object('soul', COALESCE(sc.wind_soul_win, 0)),
      COALESCE(ob_wind.loss_json, '{}'::jsonb) || jsonb_build_object('soul', COALESCE(sc.wind_soul_loss, 0)),
      COALESCE(ob_fire.win_json, '{}'::jsonb) || jsonb_build_object('soul', COALESCE(sc.fire_soul_win, 0)),
      COALESCE(ob_fire.loss_json, '{}'::jsonb) || jsonb_build_object('soul', COALESCE(sc.fire_soul_loss, 0)),
      COALESCE(ob_hextec.win_json, '{}'::jsonb) || jsonb_build_object('soul', COALESCE(sc.hextec_soul_win, 0)),
      COALESCE(ob_hextec.loss_json, '{}'::jsonb) || jsonb_build_object('soul', COALESCE(sc.hextec_soul_loss, 0)),
      COALESCE(ob_chem.win_json, '{}'::jsonb) || jsonb_build_object('soul', COALESCE(sc.chem_soul_win, 0)),
      COALESCE(ob_chem.loss_json, '{}'::jsonb) || jsonb_build_object('soul', COALESCE(sc.chem_soul_loss, 0)),
      COALESCE(ob_earth_soul.win_json, '{}'::jsonb),
      COALESCE(ob_earth_soul.loss_json, '{}'::jsonb),
      COALESCE(ob_water_soul.win_json, '{}'::jsonb),
      COALESCE(ob_water_soul.loss_json, '{}'::jsonb),
      COALESCE(ob_wind_soul.win_json, '{}'::jsonb),
      COALESCE(ob_wind_soul.loss_json, '{}'::jsonb),
      COALESCE(ob_fire_soul.win_json, '{}'::jsonb),
      COALESCE(ob_fire_soul.loss_json, '{}'::jsonb),
      COALESCE(ob_hextec_soul.win_json, '{}'::jsonb),
      COALESCE(ob_hextec_soul.loss_json, '{}'::jsonb),
      COALESCE(ob_chem_soul.win_json, '{}'::jsonb),
      COALESCE(ob_chem_soul.loss_json, '{}'::jsonb),
      NOW()
    FROM dims d
    LEFT JOIN objective_bucket_json ob_baron
      ON ob_baron.game_version = d.game_version AND ob_baron.rank_tier = d.rank_tier AND ob_baron.objective_key = 'baron'
    LEFT JOIN objective_bucket_json_drake_total ob_drake_total
      ON ob_drake_total.game_version = d.game_version AND ob_drake_total.rank_tier = d.rank_tier
    LEFT JOIN objective_bucket_json ob_horde
      ON ob_horde.game_version = d.game_version AND ob_horde.rank_tier = d.rank_tier AND ob_horde.objective_key = 'horde'
    LEFT JOIN objective_bucket_json ob_herald
      ON ob_herald.game_version = d.game_version AND ob_herald.rank_tier = d.rank_tier AND ob_herald.objective_key = 'riftHerald'
    LEFT JOIN objective_bucket_json ob_inhibitor
      ON ob_inhibitor.game_version = d.game_version AND ob_inhibitor.rank_tier = d.rank_tier AND ob_inhibitor.objective_key = 'inhibitor'
    LEFT JOIN objective_bucket_json ob_tower
      ON ob_tower.game_version = d.game_version AND ob_tower.rank_tier = d.rank_tier AND ob_tower.objective_key = 'tower'
    LEFT JOIN objective_bucket_json ob_first_blood
      ON ob_first_blood.game_version = d.game_version AND ob_first_blood.rank_tier = d.rank_tier AND ob_first_blood.objective_key = 'first_blood'
    LEFT JOIN objective_bucket_json ob_elder
      ON ob_elder.game_version = d.game_version AND ob_elder.rank_tier = d.rank_tier AND ob_elder.objective_key = 'elder'
    LEFT JOIN objective_bucket_json ob_earth
      ON ob_earth.game_version = d.game_version AND ob_earth.rank_tier = d.rank_tier AND ob_earth.objective_key = 'earth_drake'
    LEFT JOIN objective_bucket_json ob_water
      ON ob_water.game_version = d.game_version AND ob_water.rank_tier = d.rank_tier AND ob_water.objective_key = 'water_drake'
    LEFT JOIN objective_bucket_json ob_wind
      ON ob_wind.game_version = d.game_version AND ob_wind.rank_tier = d.rank_tier AND ob_wind.objective_key = 'wind_drake'
    LEFT JOIN objective_bucket_json ob_fire
      ON ob_fire.game_version = d.game_version AND ob_fire.rank_tier = d.rank_tier AND ob_fire.objective_key = 'fire_drake'
    LEFT JOIN objective_bucket_json ob_hextec
      ON ob_hextec.game_version = d.game_version AND ob_hextec.rank_tier = d.rank_tier AND ob_hextec.objective_key = 'hextec_drake'
    LEFT JOIN objective_bucket_json ob_chem
      ON ob_chem.game_version = d.game_version AND ob_chem.rank_tier = d.rank_tier AND ob_chem.objective_key = 'chem_drake'
    LEFT JOIN objective_bucket_json ob_earth_soul
      ON ob_earth_soul.game_version = d.game_version AND ob_earth_soul.rank_tier = d.rank_tier AND ob_earth_soul.objective_key = 'earth_soul'
    LEFT JOIN objective_bucket_json ob_water_soul
      ON ob_water_soul.game_version = d.game_version AND ob_water_soul.rank_tier = d.rank_tier AND ob_water_soul.objective_key = 'water_soul'
    LEFT JOIN objective_bucket_json ob_wind_soul
      ON ob_wind_soul.game_version = d.game_version AND ob_wind_soul.rank_tier = d.rank_tier AND ob_wind_soul.objective_key = 'wind_soul'
    LEFT JOIN objective_bucket_json ob_fire_soul
      ON ob_fire_soul.game_version = d.game_version AND ob_fire_soul.rank_tier = d.rank_tier AND ob_fire_soul.objective_key = 'fire_soul'
    LEFT JOIN objective_bucket_json ob_hextec_soul
      ON ob_hextec_soul.game_version = d.game_version AND ob_hextec_soul.rank_tier = d.rank_tier AND ob_hextec_soul.objective_key = 'hextec_soul'
    LEFT JOIN objective_bucket_json ob_chem_soul
      ON ob_chem_soul.game_version = d.game_version AND ob_chem_soul.rank_tier = d.rank_tier AND ob_chem_soul.objective_key = 'chem_soul'
    LEFT JOIN first_counts fc
      ON fc.game_version = d.game_version AND fc.rank_tier = d.rank_tier
    LEFT JOIN soul_counts sc
      ON sc.game_version = d.game_version AND sc.rank_tier = d.rank_tier
    ON CONFLICT (game_version, rank_tier) DO UPDATE
    SET
      baron_win_team = EXCLUDED.baron_win_team,
      baron_loose_team = EXCLUDED.baron_loose_team,
      drake_win_team = EXCLUDED.drake_win_team,
      drake_loose_team = EXCLUDED.drake_loose_team,
      void_win_team = EXCLUDED.void_win_team,
      void_loose_team = EXCLUDED.void_loose_team,
      herald_win_team = EXCLUDED.herald_win_team,
      herald_loose_team = EXCLUDED.herald_loose_team,
      inhibitor_win_team = EXCLUDED.inhibitor_win_team,
      inhibitor_loose_team = EXCLUDED.inhibitor_loose_team,
      tower_win_team = EXCLUDED.tower_win_team,
      tower_loose_team = EXCLUDED.tower_loose_team,
      first_blood_win_team = EXCLUDED.first_blood_win_team,
      first_blood_loose_team = EXCLUDED.first_blood_loose_team,
      elder_win_team = EXCLUDED.elder_win_team,
      elder_loose_team = EXCLUDED.elder_loose_team,
      earth_drake_win_team = EXCLUDED.earth_drake_win_team,
      earth_drake_loose_team = EXCLUDED.earth_drake_loose_team,
      water_drake_win_team = EXCLUDED.water_drake_win_team,
      water_drake_loose_team = EXCLUDED.water_drake_loose_team,
      wind_drake_win_team = EXCLUDED.wind_drake_win_team,
      wind_drake_loose_team = EXCLUDED.wind_drake_loose_team,
      fire_drake_win_team = EXCLUDED.fire_drake_win_team,
      fire_drake_loose_team = EXCLUDED.fire_drake_loose_team,
      hextec_drake_win_team = EXCLUDED.hextec_drake_win_team,
      hextec_drake_loose_team = EXCLUDED.hextec_drake_loose_team,
      chem_drake_win_team = EXCLUDED.chem_drake_win_team,
      chem_drake_loose_team = EXCLUDED.chem_drake_loose_team,
      earth_soul_win_team = EXCLUDED.earth_soul_win_team,
      earth_soul_loose_team = EXCLUDED.earth_soul_loose_team,
      water_soul_win_team = EXCLUDED.water_soul_win_team,
      water_soul_loose_team = EXCLUDED.water_soul_loose_team,
      wind_soul_win_team = EXCLUDED.wind_soul_win_team,
      wind_soul_loose_team = EXCLUDED.wind_soul_loose_team,
      fire_soul_win_team = EXCLUDED.fire_soul_win_team,
      fire_soul_loose_team = EXCLUDED.fire_soul_loose_team,
      hextec_soul_win_team = EXCLUDED.hextec_soul_win_team,
      hextec_soul_loose_team = EXCLUDED.hextec_soul_loose_team,
      chem_soul_win_team = EXCLUDED.chem_soul_win_team,
      chem_soul_loose_team = EXCLUDED.chem_soul_loose_team,
      updated_at = NOW()
  `)
  if (logger) void logger.step('Objective outcome stats refreshed', { affected })
  return Number(affected ?? 0)
}
