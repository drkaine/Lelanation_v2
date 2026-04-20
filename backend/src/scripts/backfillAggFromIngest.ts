import 'dotenv/config'
import { prisma } from '../db.js'

async function main(): Promise<void> {
  console.log('[backfill-agg] starting')

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      agg_team_bucket,
      agg_champion_bans_by_banner,
      agg_champion_side_stats,
      agg_champion_vs_stats,
      agg_team_core_stats,
      agg_match_outcome_stats,
      agg_champion_core_stats
    RESTART IDENTITY
  `)

  await prisma.$executeRawUnsafe(`
    INSERT INTO agg_match_outcome_stats (game_version, rank_tier, count_match, updated_at)
    SELECT
      im.game_version,
      im.rank_tier,
      COUNT(*)::int AS count_match,
      NOW()
    FROM ingest_matchs im
    GROUP BY im.game_version, im.rank_tier
  `)

  await prisma.$executeRawUnsafe(`
    WITH team_role_inference AS (
      SELECT
        imp.match_id,
        imp.team_id,
        COALESCE(
          ARRAY_AGG(DISTINCT UPPER(imp.role)) FILTER (
            WHERE UPPER(imp.role) IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT')
          ),
          '{}'::text[]
        ) AS known_roles,
        SUM(
          CASE WHEN UPPER(imp.role) IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT') THEN 0 ELSE 1 END
        )::int AS unknown_count
      FROM ingest_match_players imp
      GROUP BY imp.match_id, imp.team_id
    ),
    missing_role_by_team AS (
      SELECT
        tri.match_id,
        tri.team_id,
        CASE
          WHEN tri.unknown_count = 1
            AND (
              SELECT COUNT(*)
              FROM unnest(ARRAY['TOP','JUNGLE','MIDDLE','BOTTOM','SUPPORT']::text[]) AS r
              WHERE NOT (r = ANY(tri.known_roles))
            ) = 1
          THEN (
            SELECT r
            FROM unnest(ARRAY['TOP','JUNGLE','MIDDLE','BOTTOM','SUPPORT']::text[]) AS r
            WHERE NOT (r = ANY(tri.known_roles))
            LIMIT 1
          )
          ELSE NULL
        END AS missing_role
      FROM team_role_inference tri
    ),
    imp_resolved AS (
      SELECT
        imp.*,
        CASE
          WHEN UPPER(imp.role) IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT') THEN UPPER(imp.role)
          WHEN mrt.missing_role IS NOT NULL THEN mrt.missing_role
          ELSE UPPER(imp.role)
        END AS role_resolved
      FROM ingest_match_players imp
      LEFT JOIN missing_role_by_team mrt
        ON mrt.match_id = imp.match_id
       AND mrt.team_id = imp.team_id
    ),
    core_source AS (
      SELECT
        imp.champion_id,
        imp.role_resolved AS role,
        COALESCE(NULLIF(imp.rank_tier, ''), 'UNRANKED') AS rank_tier,
        im.game_version,
        im.region,
        SUM(CASE WHEN imp.win THEN 1 ELSE 0 END)::int AS count_win,
        COUNT(*)::int AS count_game
      FROM imp_resolved imp
      INNER JOIN ingest_matchs im ON im.id = imp.match_id
      WHERE COALESCE(NULLIF(imp.rank_tier, ''), 'UNRANKED') <> 'UNRANKED'
        AND imp.role_resolved IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT')
      GROUP BY
        imp.champion_id,
        imp.role_resolved,
        COALESCE(NULLIF(imp.rank_tier, ''), 'UNRANKED'),
        im.game_version,
        im.region
    )
    INSERT INTO agg_champion_core_stats (
      id, champion_id, role, rank_tier, game_version, region, count_win, count_game, count_ban, updated_at
    )
    SELECT
      ROW_NUMBER() OVER (
        ORDER BY champion_id, role, rank_tier, game_version, region
      )::bigint AS id,
      champion_id,
      role,
      rank_tier,
      game_version,
      region,
      count_win,
      count_game,
      0::int AS count_ban,
      NOW()
    FROM core_source
  `)

  await prisma.$executeRawUnsafe(`
    WITH team_role_inference AS (
      SELECT
        imp.match_id,
        imp.team_id,
        COALESCE(
          ARRAY_AGG(DISTINCT UPPER(imp.role)) FILTER (
            WHERE UPPER(imp.role) IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT')
          ),
          '{}'::text[]
        ) AS known_roles,
        SUM(
          CASE WHEN UPPER(imp.role) IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT') THEN 0 ELSE 1 END
        )::int AS unknown_count
      FROM ingest_match_players imp
      GROUP BY imp.match_id, imp.team_id
    ),
    missing_role_by_team AS (
      SELECT
        tri.match_id,
        tri.team_id,
        CASE
          WHEN tri.unknown_count = 1
            AND (
              SELECT COUNT(*)
              FROM unnest(ARRAY['TOP','JUNGLE','MIDDLE','BOTTOM','SUPPORT']::text[]) AS r
              WHERE NOT (r = ANY(tri.known_roles))
            ) = 1
          THEN (
            SELECT r
            FROM unnest(ARRAY['TOP','JUNGLE','MIDDLE','BOTTOM','SUPPORT']::text[]) AS r
            WHERE NOT (r = ANY(tri.known_roles))
            LIMIT 1
          )
          ELSE NULL
        END AS missing_role
      FROM team_role_inference tri
    ),
    imp_resolved AS (
      SELECT
        imp.*,
        CASE
          WHEN UPPER(imp.role) IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT') THEN UPPER(imp.role)
          WHEN mrt.missing_role IS NOT NULL THEN mrt.missing_role
          ELSE UPPER(imp.role)
        END AS role_resolved
      FROM ingest_match_players imp
      LEFT JOIN missing_role_by_team mrt
        ON mrt.match_id = imp.match_id
       AND mrt.team_id = imp.team_id
    ),
    pairs AS (
      SELECT
        a.match_id,
        a.champion_id AS champion_id,
        b.champion_id AS opponent_champion_id,
        a.role_resolved AS role,
        COALESCE(NULLIF(a.rank_tier, ''), 'UNRANKED') AS rank_tier,
        im.game_version,
        im.region,
        SUM(CASE WHEN a.win THEN 1 ELSE 0 END)::int AS count_win,
        COUNT(*)::int AS count_game
      FROM imp_resolved a
      INNER JOIN imp_resolved b
        ON b.match_id = a.match_id
       AND b.role_resolved = a.role_resolved
       AND b.team_id <> a.team_id
      INNER JOIN ingest_matchs im ON im.id = a.match_id
      WHERE COALESCE(NULLIF(a.rank_tier, ''), 'UNRANKED') <> 'UNRANKED'
        AND a.role_resolved IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT')
        AND b.role_resolved IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT')
      GROUP BY
        a.match_id,
        a.champion_id,
        b.champion_id,
        a.role_resolved,
        COALESCE(NULLIF(a.rank_tier, ''), 'UNRANKED'),
        im.game_version,
        im.region
    ),
    agg_pairs AS (
      SELECT
        champion_id,
        opponent_champion_id,
        role,
        rank_tier,
        game_version,
        region,
        SUM(count_win)::int AS count_win,
        SUM(count_game)::int AS count_game
      FROM pairs
      GROUP BY champion_id, opponent_champion_id, role, rank_tier, game_version, region
    )
    INSERT INTO agg_champion_vs_stats (
      champion_stat_id, opponent_champion_id, role, rank_tier, game_version, region, count_win, count_game, updated_at
    )
    SELECT
      ac.id,
      p.opponent_champion_id,
      p.role,
      p.rank_tier,
      p.game_version,
      p.region,
      p.count_win,
      p.count_game,
      NOW()
    FROM agg_pairs p
    INNER JOIN agg_champion_core_stats ac
      ON ac.champion_id = p.champion_id
     AND ac.role = p.role
     AND ac.rank_tier = p.rank_tier
     AND ac.game_version = p.game_version
     AND ac.region = p.region
  `)

  await prisma.$executeRawUnsafe(`
    WITH team_source AS (
      SELECT
        it.team,
        im.rank_tier,
        im.game_version,
        SUM(CASE WHEN it.win THEN 1 ELSE 0 END)::int AS count_win,
        COUNT(*)::int AS count_game,
        SUM(CASE WHEN it.team_early_surrendered THEN 1 ELSE 0 END)::int AS count_team_early_surrendered,
        SUM(CASE WHEN im.game_ended_in_surrender THEN 1 ELSE 0 END)::int AS count_team_surrendered,
        SUM(it.baron_kills)::int AS sum_baron_kills,
        SUM(CASE WHEN it.baron_first THEN 1 ELSE 0 END)::int AS count_baron_first,
        SUM(it.dragon_kills)::int AS sum_dragon_kills,
        SUM(CASE WHEN it.dragon_first THEN 1 ELSE 0 END)::int AS count_dragon_first,
        SUM(it.tower_kills)::int AS sum_tower_kills,
        SUM(CASE WHEN it.tower_first THEN 1 ELSE 0 END)::int AS count_tower_first,
        SUM(it.horde_kills)::int AS sum_horde_kills,
        SUM(CASE WHEN it.horde_first THEN 1 ELSE 0 END)::int AS count_horde_first,
        SUM(it.rift_herald_kills)::int AS sum_rift_herald_kills,
        SUM(CASE WHEN it.rift_herald_first THEN 1 ELSE 0 END)::int AS count_rift_herald_first,
        SUM(it.inhibitor_kills)::int AS sum_inhibitor_kills,
        SUM(CASE WHEN it.first_blood THEN 1 ELSE 0 END)::int AS count_first_blood,
        SUM(it.elder_kills)::int AS sum_elder_kills,
        0::int AS count_earth_drake,
        0::int AS count_water_drake,
        0::int AS count_wind_drake,
        0::int AS count_fire_drake,
        0::int AS count_hextec_drake,
        0::int AS count_chem_drake,
        0::int AS count_earth_drake_soul,
        0::int AS count_water_drake_soul,
        0::int AS count_wind_drake_soul,
        0::int AS count_fire_drake_soul,
        0::int AS count_hextec_drake_soul,
        0::int AS count_chem_drake_soul
      FROM ingest_teams it
      INNER JOIN ingest_matchs im ON im.id = it.match_id
      WHERE COALESCE(NULLIF(im.rank_tier, ''), 'UNRANKED') <> 'UNRANKED'
      GROUP BY it.team, im.rank_tier, im.game_version
    )
    INSERT INTO agg_team_core_stats (
      id, team, rank_tier, game_version, count_win, count_game,
      count_team_early_surrendered, count_team_surrendered,
      sum_baron_kills, count_baron_first, sum_dragon_kills, count_dragon_first,
      sum_tower_kills, count_tower_first, sum_horde_kills, count_horde_first,
      sum_rift_herald_kills, count_rift_herald_first, sum_inhibitor_kills, count_first_blood,
      sum_elder_kills, count_earth_drake, count_water_drake, count_wind_drake, count_fire_drake,
      count_hextec_drake, count_chem_drake, count_earth_drake_soul, count_water_drake_soul,
      count_wind_drake_soul, count_fire_drake_soul, count_hextec_drake_soul, count_chem_drake_soul,
      updated_at
    )
    SELECT
      ROW_NUMBER() OVER (ORDER BY team, rank_tier, game_version)::bigint,
      team, rank_tier, game_version, count_win, count_game,
      count_team_early_surrendered, count_team_surrendered,
      sum_baron_kills, count_baron_first, sum_dragon_kills, count_dragon_first,
      sum_tower_kills, count_tower_first, sum_horde_kills, count_horde_first,
      sum_rift_herald_kills, count_rift_herald_first, sum_inhibitor_kills, count_first_blood,
      sum_elder_kills, count_earth_drake, count_water_drake, count_wind_drake, count_fire_drake,
      count_hextec_drake, count_chem_drake, count_earth_drake_soul, count_water_drake_soul,
      count_wind_drake_soul, count_fire_drake_soul, count_hextec_drake_soul, count_chem_drake_soul,
      NOW()
    FROM team_source
  `)

  await prisma.$executeRawUnsafe(`
    WITH bans AS (
      SELECT
        it.team AS team_num,
        CASE
          WHEN (be.elem->>'pickOrder')::int = 1 THEN 'TOP'
          WHEN (be.elem->>'pickOrder')::int = 2 THEN 'JUNGLE'
          WHEN (be.elem->>'pickOrder')::int = 3 THEN 'MIDDLE'
          WHEN (be.elem->>'pickOrder')::int = 4 THEN 'BOTTOM'
          WHEN (be.elem->>'pickOrder')::int = 5 THEN 'SUPPORT'
          ELSE 'UNKNOWN'
        END AS banner_role_norm,
        (be.elem->>'championId')::int AS banned_champion_id,
        im.game_version,
        im.rank_tier
      FROM ingest_teams it
      INNER JOIN ingest_matchs im ON im.id = it.match_id
      CROSS JOIN LATERAL jsonb_array_elements(it.bans_json) AS be(elem)
      WHERE (be.elem->>'championId') IS NOT NULL
        AND COALESCE(NULLIF(im.rank_tier, ''), 'UNRANKED') <> 'UNRANKED'
    )
    INSERT INTO agg_champion_bans_by_banner (
      team_num, banner_role_norm, banned_champion_id, game_version, rank_tier, ban_count, updated_at
    )
    SELECT
      team_num, banner_role_norm, banned_champion_id, game_version, rank_tier,
      COUNT(*)::int AS ban_count,
      NOW()
    FROM bans
    GROUP BY team_num, banner_role_norm, banned_champion_id, game_version, rank_tier
  `)

  await prisma.$executeRawUnsafe(`
    WITH team_role_inference AS (
      SELECT
        imp.match_id,
        imp.team_id,
        COALESCE(
          ARRAY_AGG(DISTINCT UPPER(imp.role)) FILTER (
            WHERE UPPER(imp.role) IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT')
          ),
          '{}'::text[]
        ) AS known_roles,
        SUM(
          CASE WHEN UPPER(imp.role) IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT') THEN 0 ELSE 1 END
        )::int AS unknown_count
      FROM ingest_match_players imp
      GROUP BY imp.match_id, imp.team_id
    ),
    missing_role_by_team AS (
      SELECT
        tri.match_id,
        tri.team_id,
        CASE
          WHEN tri.unknown_count = 1
            AND (
              SELECT COUNT(*)
              FROM unnest(ARRAY['TOP','JUNGLE','MIDDLE','BOTTOM','SUPPORT']::text[]) AS r
              WHERE NOT (r = ANY(tri.known_roles))
            ) = 1
          THEN (
            SELECT r
            FROM unnest(ARRAY['TOP','JUNGLE','MIDDLE','BOTTOM','SUPPORT']::text[]) AS r
            WHERE NOT (r = ANY(tri.known_roles))
            LIMIT 1
          )
          ELSE NULL
        END AS missing_role
      FROM team_role_inference tri
    ),
    imp_resolved AS (
      SELECT
        imp.*,
        CASE
          WHEN UPPER(imp.role) IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT') THEN UPPER(imp.role)
          WHEN mrt.missing_role IS NOT NULL THEN mrt.missing_role
          ELSE UPPER(imp.role)
        END AS role_resolved
      FROM ingest_match_players imp
      LEFT JOIN missing_role_by_team mrt
        ON mrt.match_id = imp.match_id
       AND mrt.team_id = imp.team_id
    )
    INSERT INTO agg_champion_side_stats (
      team_num, champion_id, role_norm, game_version, rank_tier, count_win, count_game, updated_at
    )
    SELECT
      it.team,
      imp.champion_id,
      imp.role_resolved AS role_norm,
      im.game_version,
      COALESCE(NULLIF(imp.rank_tier, ''), 'UNRANKED') AS rank_tier,
      SUM(CASE WHEN imp.win THEN 1 ELSE 0 END)::int AS count_win,
      COUNT(*)::int AS count_game,
      NOW()
    FROM imp_resolved imp
    INNER JOIN ingest_teams it ON it.id = imp.team_id
    INNER JOIN ingest_matchs im ON im.id = imp.match_id
    WHERE COALESCE(NULLIF(imp.rank_tier, ''), 'UNRANKED') <> 'UNRANKED'
      AND imp.role_resolved IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT')
    GROUP BY it.team, imp.champion_id, imp.role_resolved, im.game_version, COALESCE(NULLIF(imp.rank_tier, ''), 'UNRANKED')
  `)

  await prisma.$executeRawUnsafe(`
    WITH source AS (
      SELECT
        atc.id AS team_stat_id,
        atc.count_win,
        atc.count_game,
        atc.sum_baron_kills,
        atc.sum_dragon_kills,
        atc.sum_elder_kills,
        atc.sum_tower_kills,
        atc.sum_inhibitor_kills,
        atc.sum_rift_herald_kills,
        atc.sum_horde_kills
      FROM agg_team_core_stats atc
    ),
    flattened AS (
      SELECT team_stat_id, 'baron'::text AS objective_key, LEAST(20, GREATEST(0, sum_baron_kills)) AS objective_bucket, count_win, count_game FROM source
      UNION ALL
      SELECT team_stat_id, 'dragon', LEAST(20, GREATEST(0, sum_dragon_kills)), count_win, count_game FROM source
      UNION ALL
      SELECT team_stat_id, 'elder', LEAST(20, GREATEST(0, sum_elder_kills)), count_win, count_game FROM source
      UNION ALL
      SELECT team_stat_id, 'tower', LEAST(20, GREATEST(0, sum_tower_kills)), count_win, count_game FROM source
      UNION ALL
      SELECT team_stat_id, 'inhibitor', LEAST(20, GREATEST(0, sum_inhibitor_kills)), count_win, count_game FROM source
      UNION ALL
      SELECT team_stat_id, 'riftHerald', LEAST(20, GREATEST(0, sum_rift_herald_kills)), count_win, count_game FROM source
      UNION ALL
      SELECT team_stat_id, 'horde', LEAST(20, GREATEST(0, sum_horde_kills)), count_win, count_game FROM source
    )
    INSERT INTO agg_team_bucket (team_stat_id, objective_key, objective_bucket, count_win, count_game, updated_at)
    SELECT team_stat_id, objective_key, objective_bucket, count_win, count_game, NOW()
    FROM flattened
    ON CONFLICT (team_stat_id, objective_key, objective_bucket) DO UPDATE
    SET
      count_win = EXCLUDED.count_win,
      count_game = EXCLUDED.count_game,
      updated_at = NOW()
  `)

  const counts = await prisma.$queryRawUnsafe<Array<{ k: string; c: bigint }>>(`
    SELECT 'agg_champion_core_stats'::text AS k, COUNT(*)::bigint AS c FROM agg_champion_core_stats
    UNION ALL SELECT 'agg_champion_vs_stats', COUNT(*)::bigint FROM agg_champion_vs_stats
    UNION ALL SELECT 'agg_match_outcome_stats', COUNT(*)::bigint FROM agg_match_outcome_stats
    UNION ALL SELECT 'agg_team_core_stats', COUNT(*)::bigint FROM agg_team_core_stats
    UNION ALL SELECT 'agg_champion_bans_by_banner', COUNT(*)::bigint FROM agg_champion_bans_by_banner
    UNION ALL SELECT 'agg_champion_side_stats', COUNT(*)::bigint FROM agg_champion_side_stats
    UNION ALL SELECT 'agg_team_bucket', COUNT(*)::bigint FROM agg_team_bucket
  `)
  for (const row of counts) {
    console.log(`[backfill-agg] ${row.k}: ${Number(row.c)}`)
  }
  console.log('[backfill-agg] done')
}

void main()
  .catch((err) => {
    console.error('[backfill-agg] failed:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined)
  })
