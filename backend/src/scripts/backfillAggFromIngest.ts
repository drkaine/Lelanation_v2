import 'dotenv/config'
import { prisma } from '../db.js'

async function main(): Promise<void> {
  console.log('[backfill-agg] starting')

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      agg_champion_item_starter_set_stats,
      agg_champion_summoner_spell_pair_stats,
      agg_champion_item_solo_stats,
      agg_champion_item_stats,
      agg_champion_shard_solo_stats,
      agg_champion_runes_solo_stats,
      agg_champion_runes_stats,
      agg_champion_summoner_spells,
      agg_champion_bucket,
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
      UPPER(COALESCE(NULLIF(TRIM(im.rank_tier), ''), 'UNRANKED')) AS rank_tier,
      COUNT(*)::int AS count_match,
      NOW()
    FROM ingest_matchs im
    WHERE UPPER(COALESCE(NULLIF(TRIM(im.rank_tier), ''), 'UNRANKED')) <> 'UNRANKED'
    GROUP BY im.game_version, UPPER(COALESCE(NULLIF(TRIM(im.rank_tier), ''), 'UNRANKED'))
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
    INSERT INTO agg_champion_bucket (
      champion_stat_id, duration_bucket, count_win, count_game, updated_at
    )
    SELECT
      ac.id AS champion_stat_id,
      GREATEST(0, FLOOR(im.game_duration / 60.0))::int AS duration_bucket,
      SUM(CASE WHEN imp.win THEN 1 ELSE 0 END)::int AS count_win,
      COUNT(*)::int AS count_game,
      NOW()
    FROM imp_resolved imp
    INNER JOIN ingest_matchs im ON im.id = imp.match_id
    INNER JOIN agg_champion_core_stats ac
      ON ac.champion_id = imp.champion_id
     AND ac.role = imp.role_resolved
     AND ac.rank_tier = COALESCE(NULLIF(imp.rank_tier, ''), 'UNRANKED')
     AND ac.game_version = im.game_version
     AND ac.region = im.region
    WHERE COALESCE(NULLIF(imp.rank_tier, ''), 'UNRANKED') <> 'UNRANKED'
      AND imp.role_resolved IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT')
    GROUP BY ac.id, GREATEST(0, FLOOR(im.game_duration / 60.0))::int
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
    spells_per_player AS (
      SELECT
        ac.id AS champion_stat_id,
        imp.win,
        imp.summoner_spells[1]::int AS spell_d,
        imp.summoner_spells[2]::int AS spell_f
      FROM imp_resolved imp
      INNER JOIN ingest_matchs im ON im.id = imp.match_id
      INNER JOIN agg_champion_core_stats ac
        ON ac.champion_id = imp.champion_id
       AND ac.role = imp.role_resolved
       AND ac.rank_tier = COALESCE(NULLIF(imp.rank_tier, ''), 'UNRANKED')
       AND ac.game_version = im.game_version
       AND ac.region = im.region
      WHERE cardinality(imp.summoner_spells) >= 2
        AND COALESCE(NULLIF(imp.rank_tier, ''), 'UNRANKED') <> 'UNRANKED'
        AND imp.role_resolved IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT')
    ),
    spell_rows AS (
      SELECT champion_stat_id, win, spell_d AS spell_id, 1::int AS slot0, 0::int AS slot1 FROM spells_per_player
      UNION ALL
      SELECT champion_stat_id, win, spell_f AS spell_id, 0::int AS slot0, 1::int AS slot1 FROM spells_per_player
    )
    INSERT INTO agg_champion_summoner_spells (
      champion_stat_id, spell_id, count_win, count_game, count_slot0, count_slot1, updated_at
    )
    SELECT
      champion_stat_id,
      spell_id,
      SUM(CASE WHEN win THEN 1 ELSE 0 END)::int AS count_win,
      COUNT(*)::int AS count_game,
      SUM(slot0)::int AS count_slot0,
      SUM(slot1)::int AS count_slot1,
      NOW()
    FROM spell_rows
    WHERE spell_id > 0
    GROUP BY champion_stat_id, spell_id
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
    INSERT INTO agg_champion_runes_stats (
      champion_stat_id, rune_list, shard_list, count_win, count_game, updated_at
    )
    SELECT
      ac.id AS champion_stat_id,
      to_jsonb(imp.runes)::text AS rune_list,
      array_to_string(imp.shards, ',') AS shard_list,
      SUM(CASE WHEN imp.win THEN 1 ELSE 0 END)::int AS count_win,
      COUNT(*)::int AS count_game,
      NOW()
    FROM imp_resolved imp
    INNER JOIN ingest_matchs im ON im.id = imp.match_id
    INNER JOIN agg_champion_core_stats ac
      ON ac.champion_id = imp.champion_id
     AND ac.role = imp.role_resolved
     AND ac.rank_tier = COALESCE(NULLIF(imp.rank_tier, ''), 'UNRANKED')
     AND ac.game_version = im.game_version
     AND ac.region = im.region
    WHERE COALESCE(NULLIF(imp.rank_tier, ''), 'UNRANKED') <> 'UNRANKED'
      AND imp.role_resolved IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT')
    GROUP BY ac.id, to_jsonb(imp.runes)::text, array_to_string(imp.shards, ',')
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
    flat AS (
      SELECT
        ac.id AS champion_stat_id,
        unnest(imp.runes) AS perk_id,
        SUM(CASE WHEN imp.win THEN 1 ELSE 0 END)::int AS count_win,
        COUNT(*)::int AS count_game
      FROM imp_resolved imp
      INNER JOIN ingest_matchs im ON im.id = imp.match_id
      INNER JOIN agg_champion_core_stats ac
        ON ac.champion_id = imp.champion_id
       AND ac.role = imp.role_resolved
       AND ac.rank_tier = COALESCE(NULLIF(imp.rank_tier, ''), 'UNRANKED')
       AND ac.game_version = im.game_version
       AND ac.region = im.region
      WHERE COALESCE(NULLIF(imp.rank_tier, ''), 'UNRANKED') <> 'UNRANKED'
        AND imp.role_resolved IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT')
      GROUP BY ac.id, unnest(imp.runes)
    )
    INSERT INTO agg_champion_runes_solo_stats (
      champion_stat_id, perk_id, style, count_win, count_game, updated_at
    )
    SELECT
      champion_stat_id, perk_id, ''::text AS style, count_win, count_game, NOW()
    FROM flat
    WHERE perk_id > 0
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
    flat AS (
      SELECT
        ac.id AS champion_stat_id,
        u.shard_id,
        (u.ord - 1)::int AS slot,
        SUM(CASE WHEN imp.win THEN 1 ELSE 0 END)::int AS count_win,
        COUNT(*)::int AS count_game
      FROM imp_resolved imp
      INNER JOIN ingest_matchs im ON im.id = imp.match_id
      INNER JOIN agg_champion_core_stats ac
        ON ac.champion_id = imp.champion_id
       AND ac.role = imp.role_resolved
       AND ac.rank_tier = COALESCE(NULLIF(imp.rank_tier, ''), 'UNRANKED')
       AND ac.game_version = im.game_version
       AND ac.region = im.region
      CROSS JOIN LATERAL unnest(imp.shards) WITH ORDINALITY AS u(shard_id, ord)
      WHERE COALESCE(NULLIF(imp.rank_tier, ''), 'UNRANKED') <> 'UNRANKED'
        AND imp.role_resolved IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT')
      GROUP BY ac.id, u.shard_id, (u.ord - 1)::int
    )
    INSERT INTO agg_champion_shard_solo_stats (
      champion_stat_id, shard_id, slot, count_win, count_game, updated_at
    )
    SELECT champion_stat_id, shard_id, slot, count_win, count_game, NOW()
    FROM flat
    WHERE shard_id > 0
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
    INSERT INTO agg_champion_item_solo_stats (
      champion_stat_id, item_id, count_starter, count_core, count_final, count_win, count_game, sum_timestamp_ms, updated_at
    )
    SELECT
      ac.id AS champion_stat_id,
      ((i.elem ->> 'itemId')::int) AS item_id,
      SUM(CASE WHEN COALESCE((i.elem ->> 'starter')::boolean, false) THEN 1 ELSE 0 END)::int AS count_starter,
      SUM(CASE WHEN COALESCE((i.elem ->> 'core')::boolean, false) THEN 1 ELSE 0 END)::int AS count_core,
      SUM(
        CASE
          WHEN NOT COALESCE((i.elem ->> 'starter')::boolean, false)
            AND NOT COALESCE((i.elem ->> 'core')::boolean, false)
          THEN 1 ELSE 0 END
      )::int AS count_final,
      SUM(CASE WHEN imp.win THEN 1 ELSE 0 END)::int AS count_win,
      COUNT(*)::int AS count_game,
      LEAST(SUM(COALESCE((i.elem ->> 'timestampMs')::bigint, 0)), 2147483647::bigint)::int AS sum_timestamp_ms,
      NOW()
    FROM imp_resolved imp
    INNER JOIN ingest_matchs im ON im.id = imp.match_id
    INNER JOIN agg_champion_core_stats ac
      ON ac.champion_id = imp.champion_id
     AND ac.role = imp.role_resolved
     AND ac.rank_tier = COALESCE(NULLIF(imp.rank_tier, ''), 'UNRANKED')
     AND ac.game_version = im.game_version
     AND ac.region = im.region
    JOIN LATERAL jsonb_array_elements(COALESCE(imp.items::jsonb, '[]'::jsonb)) AS i(elem)
      ON COALESCE((i.elem ->> 'order')::int, -1) < 6
     AND COALESCE((i.elem ->> 'itemId')::int, 0) > 0
    WHERE COALESCE(NULLIF(imp.rank_tier, ''), 'UNRANKED') <> 'UNRANKED'
      AND imp.role_resolved IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT')
    GROUP BY ac.id, ((i.elem ->> 'itemId')::int)
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
    item_lists AS (
      SELECT
        imp.id AS match_player_id,
        COALESCE(
          '[' || string_agg((i.elem ->> 'itemId'), ',' ORDER BY COALESCE((i.elem ->> 'order')::int, 0)) || ']',
          '[]'
        ) AS item_list,
        LEAST(
          COALESCE(SUM(COALESCE((i.elem ->> 'timestampMs')::bigint, 0)), 0),
          2147483647::bigint
        )::int AS ts
      FROM imp_resolved imp
      LEFT JOIN LATERAL jsonb_array_elements(COALESCE(imp.items::jsonb, '[]'::jsonb)) AS i(elem)
        ON COALESCE((i.elem ->> 'order')::int, -1) < 6
       AND COALESCE((i.elem ->> 'itemId')::int, 0) > 0
      GROUP BY imp.id
    )
    INSERT INTO agg_champion_item_stats (
      champion_stat_id, item_list, count_win, count_game, sum_timestamp_ms, updated_at
    )
    SELECT
      ac.id AS champion_stat_id,
      COALESCE(il.item_list, '[]') AS item_list,
      SUM(CASE WHEN imp.win THEN 1 ELSE 0 END)::int AS count_win,
      COUNT(*)::int AS count_game,
      LEAST(SUM(COALESCE(il.ts, 0)::bigint), 2147483647::bigint)::int AS sum_timestamp_ms,
      NOW()
    FROM imp_resolved imp
    INNER JOIN ingest_matchs im ON im.id = imp.match_id
    INNER JOIN agg_champion_core_stats ac
      ON ac.champion_id = imp.champion_id
     AND ac.role = imp.role_resolved
     AND ac.rank_tier = COALESCE(NULLIF(imp.rank_tier, ''), 'UNRANKED')
     AND ac.game_version = im.game_version
     AND ac.region = im.region
    LEFT JOIN item_lists il ON il.match_player_id = imp.id
    WHERE COALESCE(NULLIF(imp.rank_tier, ''), 'UNRANKED') <> 'UNRANKED'
      AND imp.role_resolved IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT')
    GROUP BY ac.id, COALESCE(il.item_list, '[]')
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
    INSERT INTO agg_champion_summoner_spell_pair_stats (
      game_version, rank_tier, role_norm, champion_id, spell_d, spell_f, count_game, count_win, updated_at
    )
    SELECT
      im.game_version,
      COALESCE(NULLIF(imp.rank_tier, ''), NULLIF(im.rank_tier, ''), 'UNRANKED') AS rank_tier,
      imp.role_resolved AS role_norm,
      imp.champion_id,
      imp.summoner_spells[1]::int AS spell_d,
      imp.summoner_spells[2]::int AS spell_f,
      COUNT(*)::bigint AS count_game,
      SUM(CASE WHEN it.win THEN 1 ELSE 0 END)::bigint AS count_win,
      NOW()
    FROM imp_resolved imp
    INNER JOIN ingest_matchs im ON im.id = imp.match_id
    INNER JOIN ingest_teams it ON it.id = imp.team_id
    WHERE cardinality(imp.summoner_spells) >= 2
      AND COALESCE(NULLIF(imp.rank_tier, ''), NULLIF(im.rank_tier, ''), 'UNRANKED') <> 'UNRANKED'
      AND imp.role_resolved IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT')
    GROUP BY
      im.game_version,
      COALESCE(NULLIF(imp.rank_tier, ''), NULLIF(im.rank_tier, ''), 'UNRANKED'),
      imp.role_resolved,
      imp.champion_id,
      imp.summoner_spells[1],
      imp.summoner_spells[2]
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
    starter_rows AS (
      SELECT
        im.game_version,
        COALESCE(NULLIF(imp.rank_tier, ''), NULLIF(im.rank_tier, ''), 'UNRANKED') AS rank_tier,
        imp.role_resolved AS role_norm,
        imp.champion_id,
        it.win,
        COALESCE(
          (
            SELECT '[' || string_agg((e ->> 'itemId')::text, ',' ORDER BY (e ->> 'order')::int, (e ->> 'timestampMs')::bigint) || ']'
            FROM jsonb_array_elements(COALESCE(imp.items::jsonb, '[]'::jsonb)) AS e
            WHERE COALESCE((e ->> 'starter')::boolean, false)
              AND (e ->> 'itemId')::int NOT IN (
                3340, 3364, 3363, 2055,
                2003, 2009, 2010, 2031, 2032, 2033, 2060, 2138, 2139, 2140
              )
          ),
          '[]'
        ) AS starter_key
      FROM imp_resolved imp
      INNER JOIN ingest_matchs im ON im.id = imp.match_id
      INNER JOIN ingest_teams it ON it.id = imp.team_id
      WHERE COALESCE(NULLIF(imp.rank_tier, ''), NULLIF(im.rank_tier, ''), 'UNRANKED') <> 'UNRANKED'
        AND imp.role_resolved IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT')
    )
    INSERT INTO agg_champion_item_starter_set_stats (
      game_version, rank_tier, role_norm, champion_id, starter_key, count_game, count_win, updated_at
    )
    SELECT
      game_version, rank_tier, role_norm, champion_id, starter_key,
      COUNT(*)::bigint AS count_game,
      SUM(CASE WHEN win THEN 1 ELSE 0 END)::bigint AS count_win,
      NOW()
    FROM starter_rows
    WHERE starter_key <> '[]'
    GROUP BY game_version, rank_tier, role_norm, champion_id, starter_key
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
          WHEN COALESCE((be.elem->>'pickOrder')::int, (be.elem->>'pickTurn')::int) = 1 THEN 'TOP'
          WHEN COALESCE((be.elem->>'pickOrder')::int, (be.elem->>'pickTurn')::int) = 2 THEN 'JUNGLE'
          WHEN COALESCE((be.elem->>'pickOrder')::int, (be.elem->>'pickTurn')::int) = 3 THEN 'MIDDLE'
          WHEN COALESCE((be.elem->>'pickOrder')::int, (be.elem->>'pickTurn')::int) = 4 THEN 'BOTTOM'
          WHEN COALESCE((be.elem->>'pickOrder')::int, (be.elem->>'pickTurn')::int) = 5 THEN 'SUPPORT'
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
    UPDATE agg_match_outcome_stats SET rank_tier = UPPER(TRIM(rank_tier));
    UPDATE agg_team_core_stats SET rank_tier = UPPER(TRIM(rank_tier));
    UPDATE agg_champion_core_stats SET rank_tier = UPPER(TRIM(rank_tier));
    UPDATE agg_champion_vs_stats SET rank_tier = UPPER(TRIM(rank_tier));
    UPDATE agg_champion_side_stats SET rank_tier = UPPER(TRIM(rank_tier));
    UPDATE agg_champion_bans_by_banner SET rank_tier = UPPER(TRIM(rank_tier));

    DELETE FROM agg_match_outcome_stats WHERE rank_tier = 'UNRANKED';
    DELETE FROM agg_team_core_stats WHERE rank_tier = 'UNRANKED';
    DELETE FROM agg_champion_core_stats WHERE rank_tier = 'UNRANKED';
    DELETE FROM agg_champion_vs_stats WHERE rank_tier = 'UNRANKED';
    DELETE FROM agg_champion_side_stats WHERE rank_tier = 'UNRANKED';
    DELETE FROM agg_champion_bans_by_banner WHERE rank_tier = 'UNRANKED';
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
    UNION ALL SELECT 'agg_champion_summoner_spell_pair_stats', COUNT(*)::bigint FROM agg_champion_summoner_spell_pair_stats
    UNION ALL SELECT 'agg_champion_item_starter_set_stats', COUNT(*)::bigint FROM agg_champion_item_starter_set_stats
    UNION ALL SELECT 'agg_champion_item_stats', COUNT(*)::bigint FROM agg_champion_item_stats
    UNION ALL SELECT 'agg_champion_item_solo_stats', COUNT(*)::bigint FROM agg_champion_item_solo_stats
    UNION ALL SELECT 'agg_champion_runes_stats', COUNT(*)::bigint FROM agg_champion_runes_stats
    UNION ALL SELECT 'agg_champion_runes_solo_stats', COUNT(*)::bigint FROM agg_champion_runes_solo_stats
    UNION ALL SELECT 'agg_champion_shard_solo_stats', COUNT(*)::bigint FROM agg_champion_shard_solo_stats
    UNION ALL SELECT 'agg_champion_summoner_spells', COUNT(*)::bigint FROM agg_champion_summoner_spells
    UNION ALL SELECT 'agg_champion_bucket', COUNT(*)::bigint FROM agg_champion_bucket
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
