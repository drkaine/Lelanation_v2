import 'dotenv/config'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prisma } from '../db.js'

const RETRYABLE_DB_CODES = new Set(['40P01', '40001'])
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const BACKEND_ROOT = path.resolve(__dirname, '..', '..')
const BACKFILL_AGG_LOCK_DIR = path.join(BACKEND_ROOT, 'data', 'locks')
const BACKFILL_AGG_LOCK_FILE = path.join(BACKFILL_AGG_LOCK_DIR, 'backfill-agg.lock')

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function createBackfillLockFile(): Promise<void> {
  await mkdir(BACKFILL_AGG_LOCK_DIR, { recursive: true })
  await writeFile(
    BACKFILL_AGG_LOCK_FILE,
    JSON.stringify({ startedAt: new Date().toISOString(), pid: process.pid }),
    'utf8'
  )
}

async function releaseBackfillLockFile(): Promise<void> {
  await unlink(BACKFILL_AGG_LOCK_FILE).catch(() => undefined)
}

function isRetryableDbError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code
  if (typeof code === 'string' && RETRYABLE_DB_CODES.has(code)) return true
  const message = err instanceof Error ? err.message : String(err)
  return (
    message.includes('Code: `40P01`') ||
    message.includes('Code: `40001`') ||
    message.toLowerCase().includes('deadlock detected') ||
    message.toLowerCase().includes('could not serialize access')
  )
}

async function runBackfillOnce(): Promise<void> {
  console.log('[backfill-agg] starting')

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      agg_objective_outcome_stats,
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
    ON CONFLICT (champion_id, role, rank_tier, game_version, region) DO UPDATE
    SET
      count_win = EXCLUDED.count_win,
      count_game = EXCLUDED.count_game,
      count_ban = EXCLUDED.count_ban,
      updated_at = NOW()
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
      src.champion_stat_id,
      src.opponent_champion_id,
      src.role,
      src.rank_tier,
      src.game_version,
      src.region,
      SUM(src.count_win)::int AS count_win,
      SUM(src.count_game)::int AS count_game,
      NOW()
    FROM (
      SELECT
        ac.id AS champion_stat_id,
        p.opponent_champion_id,
        p.role,
        p.rank_tier,
        p.game_version,
        p.region,
        p.count_win,
        p.count_game
      FROM agg_pairs p
      INNER JOIN agg_champion_core_stats ac
        ON ac.champion_id = p.champion_id
       AND ac.role = p.role
       AND ac.rank_tier = p.rank_tier
       AND ac.game_version = p.game_version
       AND ac.region = p.region
    ) src
    GROUP BY
      src.champion_stat_id,
      src.opponent_champion_id,
      src.role,
      src.rank_tier,
      src.game_version,
      src.region
    ON CONFLICT (champion_stat_id, opponent_champion_id) DO UPDATE
    SET
      role = EXCLUDED.role,
      rank_tier = EXCLUDED.rank_tier,
      game_version = EXCLUDED.game_version,
      region = EXCLUDED.region,
      count_win = EXCLUDED.count_win,
      count_game = EXCLUDED.count_game,
      updated_at = NOW()
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
    ON CONFLICT (champion_stat_id, duration_bucket) DO UPDATE
    SET
      count_win = EXCLUDED.count_win,
      count_game = EXCLUDED.count_game,
      updated_at = NOW()
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
    ON CONFLICT (champion_stat_id, spell_id) DO UPDATE
    SET
      count_win = EXCLUDED.count_win,
      count_game = EXCLUDED.count_game,
      count_slot0 = EXCLUDED.count_slot0,
      count_slot1 = EXCLUDED.count_slot1,
      updated_at = NOW()
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
    ON CONFLICT (champion_stat_id, rune_list, shard_list) DO UPDATE
    SET
      count_win = EXCLUDED.count_win,
      count_game = EXCLUDED.count_game,
      updated_at = NOW()
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
    ON CONFLICT (champion_stat_id, perk_id, style) DO UPDATE
    SET
      style = EXCLUDED.style,
      count_win = EXCLUDED.count_win,
      count_game = EXCLUDED.count_game,
      updated_at = NOW()
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
    ON CONFLICT (champion_stat_id, shard_id, slot) DO UPDATE
    SET
      slot = EXCLUDED.slot,
      count_win = EXCLUDED.count_win,
      count_game = EXCLUDED.count_game,
      updated_at = NOW()
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
    ON CONFLICT (champion_stat_id, item_id) DO UPDATE
    SET
      count_starter = EXCLUDED.count_starter,
      count_core = EXCLUDED.count_core,
      count_final = EXCLUDED.count_final,
      count_win = EXCLUDED.count_win,
      count_game = EXCLUDED.count_game,
      sum_timestamp_ms = EXCLUDED.sum_timestamp_ms,
      updated_at = NOW()
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
    ON CONFLICT (champion_stat_id, item_list) DO UPDATE
    SET
      count_win = EXCLUDED.count_win,
      count_game = EXCLUDED.count_game,
      sum_timestamp_ms = EXCLUDED.sum_timestamp_ms,
      updated_at = NOW()
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
    ON CONFLICT (game_version, rank_tier, role_norm, champion_id, spell_d, spell_f) DO UPDATE
    SET
      count_game = EXCLUDED.count_game,
      count_win = EXCLUDED.count_win,
      updated_at = NOW()
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
    ON CONFLICT (game_version, rank_tier, role_norm, champion_id, starter_key) DO UPDATE
    SET
      count_game = EXCLUDED.count_game,
      count_win = EXCLUDED.count_win,
      updated_at = NOW()
  `)

  await prisma.$executeRawUnsafe(`
    WITH drake_stats AS (
      SELECT
        it.id AS team_id,
        SUM(CASE WHEN UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%MOUNTAIN%' OR UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%EARTH%' THEN 1 ELSE 0 END)::int AS count_earth_drake,
        SUM(CASE WHEN UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%OCEAN%' OR UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%WATER%' THEN 1 ELSE 0 END)::int AS count_water_drake,
        SUM(CASE WHEN UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%CLOUD%' OR UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%WIND%' OR UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%AIR%' THEN 1 ELSE 0 END)::int AS count_wind_drake,
        SUM(CASE WHEN UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%INFERNAL%' OR UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%FIRE%' THEN 1 ELSE 0 END)::int AS count_fire_drake,
        SUM(CASE WHEN UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%HEXTECH%' OR UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%HEXTEC%' THEN 1 ELSE 0 END)::int AS count_hextec_drake,
        SUM(CASE WHEN UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%CHEMTECH%' OR UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%CHEM%' THEN 1 ELSE 0 END)::int AS count_chem_drake,
        MAX(CASE WHEN UPPER(COALESCE(d.elem->>'soul', '')) IN ('MOUNTAIN','EARTH_DRAGON','MOUNTAIN_DRAGON','EARTH_DRAGON_SOUL','MOUNTAIN_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_earth_drake_soul,
        MAX(CASE WHEN UPPER(COALESCE(d.elem->>'soul', '')) IN ('OCEAN','WATER_DRAGON','OCEAN_DRAGON','WATER_DRAGON_SOUL','OCEAN_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_water_drake_soul,
        MAX(CASE WHEN UPPER(COALESCE(d.elem->>'soul', '')) IN ('CLOUD','AIR_DRAGON','WIND_DRAGON','CLOUD_DRAGON','AIR_DRAGON_SOUL','WIND_DRAGON_SOUL','CLOUD_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_wind_drake_soul,
        MAX(CASE WHEN UPPER(COALESCE(d.elem->>'soul', '')) IN ('INFERNAL','FIRE_DRAGON','INFERNAL_DRAGON','FIRE_DRAGON_SOUL','INFERNAL_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_fire_drake_soul,
        MAX(CASE WHEN UPPER(COALESCE(d.elem->>'soul', '')) IN ('HEXTECH','HEXTECH_DRAGON','HEXTEC_DRAGON','HEXTECH_DRAGON_SOUL','HEXTEC_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_hextec_drake_soul,
        MAX(CASE WHEN UPPER(COALESCE(d.elem->>'soul', '')) IN ('CHEMTECH','CHEMTECH_DRAGON','CHEM_DRAGON','CHEMTECH_DRAGON_SOUL','CHEM_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_chem_drake_soul,
        SUM(CASE WHEN UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) = 'ELDER_DRAGON' OR LOWER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) = 'elder' THEN 1 ELSE 0 END)::int AS elder_from_timeline
      FROM ingest_teams it
      LEFT JOIN LATERAL jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(it.drakes_json::jsonb) = 'array' THEN it.drakes_json::jsonb
          ELSE '[]'::jsonb
        END
      ) AS d(elem) ON TRUE
      GROUP BY it.id
    ),
    team_source AS (
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
        SUM(GREATEST(COALESCE(it.elder_kills, 0), COALESCE(ds.elder_from_timeline, 0)))::int AS sum_elder_kills,
        SUM(COALESCE(ds.count_earth_drake, 0))::int AS count_earth_drake,
        SUM(COALESCE(ds.count_water_drake, 0))::int AS count_water_drake,
        SUM(COALESCE(ds.count_wind_drake, 0))::int AS count_wind_drake,
        SUM(COALESCE(ds.count_fire_drake, 0))::int AS count_fire_drake,
        SUM(COALESCE(ds.count_hextec_drake, 0))::int AS count_hextec_drake,
        SUM(COALESCE(ds.count_chem_drake, 0))::int AS count_chem_drake,
        SUM(COALESCE(ds.count_earth_drake_soul, 0))::int AS count_earth_drake_soul,
        SUM(COALESCE(ds.count_water_drake_soul, 0))::int AS count_water_drake_soul,
        SUM(COALESCE(ds.count_wind_drake_soul, 0))::int AS count_wind_drake_soul,
        SUM(COALESCE(ds.count_fire_drake_soul, 0))::int AS count_fire_drake_soul,
        SUM(COALESCE(ds.count_hextec_drake_soul, 0))::int AS count_hextec_drake_soul,
        SUM(COALESCE(ds.count_chem_drake_soul, 0))::int AS count_chem_drake_soul
      FROM ingest_teams it
      INNER JOIN ingest_matchs im ON im.id = it.match_id
      LEFT JOIN drake_stats ds ON ds.team_id = it.id
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
    ON CONFLICT (team, rank_tier, game_version) DO UPDATE
    SET
      count_win = EXCLUDED.count_win,
      count_game = EXCLUDED.count_game,
      count_team_early_surrendered = EXCLUDED.count_team_early_surrendered,
      count_team_surrendered = EXCLUDED.count_team_surrendered,
      sum_baron_kills = EXCLUDED.sum_baron_kills,
      count_baron_first = EXCLUDED.count_baron_first,
      sum_dragon_kills = EXCLUDED.sum_dragon_kills,
      count_dragon_first = EXCLUDED.count_dragon_first,
      sum_tower_kills = EXCLUDED.sum_tower_kills,
      count_tower_first = EXCLUDED.count_tower_first,
      sum_horde_kills = EXCLUDED.sum_horde_kills,
      count_horde_first = EXCLUDED.count_horde_first,
      sum_rift_herald_kills = EXCLUDED.sum_rift_herald_kills,
      count_rift_herald_first = EXCLUDED.count_rift_herald_first,
      sum_inhibitor_kills = EXCLUDED.sum_inhibitor_kills,
      count_first_blood = EXCLUDED.count_first_blood,
      sum_elder_kills = EXCLUDED.sum_elder_kills,
      count_earth_drake = EXCLUDED.count_earth_drake,
      count_water_drake = EXCLUDED.count_water_drake,
      count_wind_drake = EXCLUDED.count_wind_drake,
      count_fire_drake = EXCLUDED.count_fire_drake,
      count_hextec_drake = EXCLUDED.count_hextec_drake,
      count_chem_drake = EXCLUDED.count_chem_drake,
      count_earth_drake_soul = EXCLUDED.count_earth_drake_soul,
      count_water_drake_soul = EXCLUDED.count_water_drake_soul,
      count_wind_drake_soul = EXCLUDED.count_wind_drake_soul,
      count_fire_drake_soul = EXCLUDED.count_fire_drake_soul,
      count_hextec_drake_soul = EXCLUDED.count_hextec_drake_soul,
      count_chem_drake_soul = EXCLUDED.count_chem_drake_soul,
      updated_at = NOW()
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
    WITH drake_stats AS (
      SELECT
        it.id AS team_id,
        SUM(CASE WHEN UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) = 'ELDER_DRAGON' OR LOWER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) = 'elder' THEN 1 ELSE 0 END)::int AS elder_from_timeline,
        SUM(CASE WHEN UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%MOUNTAIN%' OR UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%EARTH%' THEN 1 ELSE 0 END)::int AS earth_drake_count,
        SUM(CASE WHEN UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%OCEAN%' OR UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%WATER%' THEN 1 ELSE 0 END)::int AS water_drake_count,
        SUM(CASE WHEN UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%CLOUD%' OR UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%WIND%' THEN 1 ELSE 0 END)::int AS wind_drake_count,
        SUM(CASE WHEN UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%INFERNAL%' OR UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%FIRE%' THEN 1 ELSE 0 END)::int AS fire_drake_count,
        SUM(CASE WHEN UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%HEXTECH%' OR UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%HEXTEC%' THEN 1 ELSE 0 END)::int AS hextec_drake_count,
        SUM(CASE WHEN UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%CHEMTECH%' OR UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%CHEM%' THEN 1 ELSE 0 END)::int AS chem_drake_count,
        MAX(CASE WHEN UPPER(COALESCE(d.elem->>'soul', '')) IN ('MOUNTAIN','EARTH_DRAGON','MOUNTAIN_DRAGON','EARTH_DRAGON_SOUL','MOUNTAIN_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS earth_soul,
        MAX(CASE WHEN UPPER(COALESCE(d.elem->>'soul', '')) IN ('OCEAN','WATER_DRAGON','OCEAN_DRAGON','WATER_DRAGON_SOUL','OCEAN_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS water_soul,
        MAX(CASE WHEN UPPER(COALESCE(d.elem->>'soul', '')) IN ('CLOUD','AIR_DRAGON','WIND_DRAGON','CLOUD_DRAGON','AIR_DRAGON_SOUL','WIND_DRAGON_SOUL','CLOUD_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS wind_soul,
        MAX(CASE WHEN UPPER(COALESCE(d.elem->>'soul', '')) IN ('INFERNAL','FIRE_DRAGON','INFERNAL_DRAGON','FIRE_DRAGON_SOUL','INFERNAL_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS fire_soul,
        MAX(CASE WHEN UPPER(COALESCE(d.elem->>'soul', '')) IN ('HEXTECH','HEXTECH_DRAGON','HEXTEC_DRAGON','HEXTECH_DRAGON_SOUL','HEXTEC_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS hextec_soul,
        MAX(CASE WHEN UPPER(COALESCE(d.elem->>'soul', '')) IN ('CHEMTECH','CHEMTECH_DRAGON','CHEM_DRAGON','CHEMTECH_DRAGON_SOUL','CHEM_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS chem_soul
      FROM ingest_teams it
      LEFT JOIN LATERAL jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(it.drakes_json::jsonb) = 'array' THEN it.drakes_json::jsonb
          ELSE '[]'::jsonb
        END
      ) AS d(elem) ON TRUE
      GROUP BY it.id
    ),
    team_match_rows AS (
      SELECT
        atc.id AS team_stat_id,
        it.win,
        LEAST(20, GREATEST(0, COALESCE(it.baron_kills, 0)))::int AS baron_bucket,
        LEAST(20, GREATEST(0, COALESCE(it.dragon_kills, 0)))::int AS dragon_bucket,
        LEAST(20, GREATEST(0, GREATEST(COALESCE(it.elder_kills, 0), COALESCE(ds.elder_from_timeline, 0))))::int AS elder_bucket,
        LEAST(20, GREATEST(0, COALESCE(it.tower_kills, 0)))::int AS tower_bucket,
        LEAST(20, GREATEST(0, COALESCE(it.inhibitor_kills, 0)))::int AS inhibitor_bucket,
        LEAST(20, GREATEST(0, COALESCE(it.rift_herald_kills, 0)))::int AS herald_bucket,
        LEAST(20, GREATEST(0, COALESCE(it.horde_kills, 0)))::int AS horde_bucket,
        CASE WHEN it.first_blood THEN 1 ELSE 0 END::int AS first_blood_bucket,
        LEAST(20, GREATEST(0, COALESCE(ds.earth_drake_count, 0)))::int AS earth_drake_bucket,
        LEAST(20, GREATEST(0, COALESCE(ds.water_drake_count, 0)))::int AS water_drake_bucket,
        LEAST(20, GREATEST(0, COALESCE(ds.wind_drake_count, 0)))::int AS wind_drake_bucket,
        LEAST(20, GREATEST(0, COALESCE(ds.fire_drake_count, 0)))::int AS fire_drake_bucket,
        LEAST(20, GREATEST(0, COALESCE(ds.hextec_drake_count, 0)))::int AS hextec_drake_bucket,
        LEAST(20, GREATEST(0, COALESCE(ds.chem_drake_count, 0)))::int AS chem_drake_bucket,
        CASE WHEN COALESCE(ds.earth_soul, 0) > 0 THEN 1 ELSE 0 END::int AS earth_soul_bucket,
        CASE WHEN COALESCE(ds.water_soul, 0) > 0 THEN 1 ELSE 0 END::int AS water_soul_bucket,
        CASE WHEN COALESCE(ds.wind_soul, 0) > 0 THEN 1 ELSE 0 END::int AS wind_soul_bucket,
        CASE WHEN COALESCE(ds.fire_soul, 0) > 0 THEN 1 ELSE 0 END::int AS fire_soul_bucket,
        CASE WHEN COALESCE(ds.hextec_soul, 0) > 0 THEN 1 ELSE 0 END::int AS hextec_soul_bucket,
        CASE WHEN COALESCE(ds.chem_soul, 0) > 0 THEN 1 ELSE 0 END::int AS chem_soul_bucket
      FROM ingest_teams it
      INNER JOIN ingest_matchs im ON im.id = it.match_id
      INNER JOIN agg_team_core_stats atc
        ON atc.team = it.team
       AND atc.rank_tier = UPPER(COALESCE(NULLIF(TRIM(im.rank_tier), ''), 'UNRANKED'))
       AND atc.game_version = im.game_version
      LEFT JOIN drake_stats ds ON ds.team_id = it.id
      WHERE UPPER(COALESCE(NULLIF(TRIM(im.rank_tier), ''), 'UNRANKED')) <> 'UNRANKED'
    ),
    flattened AS (
      SELECT team_stat_id, 'baron'::text AS objective_key, baron_bucket AS objective_bucket, SUM(CASE WHEN win THEN 1 ELSE 0 END)::int AS count_win, COUNT(*)::int AS count_game FROM team_match_rows GROUP BY team_stat_id, baron_bucket
      UNION ALL
      SELECT team_stat_id, 'dragon'::text, dragon_bucket, SUM(CASE WHEN win THEN 1 ELSE 0 END)::int, COUNT(*)::int FROM team_match_rows GROUP BY team_stat_id, dragon_bucket
      UNION ALL
      SELECT team_stat_id, 'elder'::text, elder_bucket, SUM(CASE WHEN win THEN 1 ELSE 0 END)::int, COUNT(*)::int FROM team_match_rows GROUP BY team_stat_id, elder_bucket
      UNION ALL
      SELECT team_stat_id, 'tower'::text, tower_bucket, SUM(CASE WHEN win THEN 1 ELSE 0 END)::int, COUNT(*)::int FROM team_match_rows GROUP BY team_stat_id, tower_bucket
      UNION ALL
      SELECT team_stat_id, 'inhibitor'::text, inhibitor_bucket, SUM(CASE WHEN win THEN 1 ELSE 0 END)::int, COUNT(*)::int FROM team_match_rows GROUP BY team_stat_id, inhibitor_bucket
      UNION ALL
      SELECT team_stat_id, 'riftHerald'::text, herald_bucket, SUM(CASE WHEN win THEN 1 ELSE 0 END)::int, COUNT(*)::int FROM team_match_rows GROUP BY team_stat_id, herald_bucket
      UNION ALL
      SELECT team_stat_id, 'horde'::text, horde_bucket, SUM(CASE WHEN win THEN 1 ELSE 0 END)::int, COUNT(*)::int FROM team_match_rows GROUP BY team_stat_id, horde_bucket
      UNION ALL
      SELECT team_stat_id, 'first_blood'::text, first_blood_bucket, SUM(CASE WHEN win THEN 1 ELSE 0 END)::int, COUNT(*)::int FROM team_match_rows GROUP BY team_stat_id, first_blood_bucket
      UNION ALL
      SELECT team_stat_id, 'earth_drake'::text, earth_drake_bucket, SUM(CASE WHEN win THEN 1 ELSE 0 END)::int, COUNT(*)::int FROM team_match_rows GROUP BY team_stat_id, earth_drake_bucket
      UNION ALL
      SELECT team_stat_id, 'water_drake'::text, water_drake_bucket, SUM(CASE WHEN win THEN 1 ELSE 0 END)::int, COUNT(*)::int FROM team_match_rows GROUP BY team_stat_id, water_drake_bucket
      UNION ALL
      SELECT team_stat_id, 'wind_drake'::text, wind_drake_bucket, SUM(CASE WHEN win THEN 1 ELSE 0 END)::int, COUNT(*)::int FROM team_match_rows GROUP BY team_stat_id, wind_drake_bucket
      UNION ALL
      SELECT team_stat_id, 'fire_drake'::text, fire_drake_bucket, SUM(CASE WHEN win THEN 1 ELSE 0 END)::int, COUNT(*)::int FROM team_match_rows GROUP BY team_stat_id, fire_drake_bucket
      UNION ALL
      SELECT team_stat_id, 'hextec_drake'::text, hextec_drake_bucket, SUM(CASE WHEN win THEN 1 ELSE 0 END)::int, COUNT(*)::int FROM team_match_rows GROUP BY team_stat_id, hextec_drake_bucket
      UNION ALL
      SELECT team_stat_id, 'chem_drake'::text, chem_drake_bucket, SUM(CASE WHEN win THEN 1 ELSE 0 END)::int, COUNT(*)::int FROM team_match_rows GROUP BY team_stat_id, chem_drake_bucket
      UNION ALL
      SELECT team_stat_id, 'earth_soul'::text, earth_soul_bucket, SUM(CASE WHEN win THEN 1 ELSE 0 END)::int, COUNT(*)::int FROM team_match_rows GROUP BY team_stat_id, earth_soul_bucket
      UNION ALL
      SELECT team_stat_id, 'water_soul'::text, water_soul_bucket, SUM(CASE WHEN win THEN 1 ELSE 0 END)::int, COUNT(*)::int FROM team_match_rows GROUP BY team_stat_id, water_soul_bucket
      UNION ALL
      SELECT team_stat_id, 'wind_soul'::text, wind_soul_bucket, SUM(CASE WHEN win THEN 1 ELSE 0 END)::int, COUNT(*)::int FROM team_match_rows GROUP BY team_stat_id, wind_soul_bucket
      UNION ALL
      SELECT team_stat_id, 'fire_soul'::text, fire_soul_bucket, SUM(CASE WHEN win THEN 1 ELSE 0 END)::int, COUNT(*)::int FROM team_match_rows GROUP BY team_stat_id, fire_soul_bucket
      UNION ALL
      SELECT team_stat_id, 'hextec_soul'::text, hextec_soul_bucket, SUM(CASE WHEN win THEN 1 ELSE 0 END)::int, COUNT(*)::int FROM team_match_rows GROUP BY team_stat_id, hextec_soul_bucket
      UNION ALL
      SELECT team_stat_id, 'chem_soul'::text, chem_soul_bucket, SUM(CASE WHEN win THEN 1 ELSE 0 END)::int, COUNT(*)::int FROM team_match_rows GROUP BY team_stat_id, chem_soul_bucket
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

  await prisma.$executeRawUnsafe(`
    WITH objective_bucket_rows AS (
      SELECT
        team_stat_id,
        objective_key,
        objective_bucket,
        SUM(count_win)::int AS count_win,
        SUM(count_game - count_win)::int AS count_loss
      FROM agg_team_bucket
      GROUP BY team_stat_id, objective_key, objective_bucket
    ),
    objective_bucket_json AS (
      SELECT
        team_stat_id,
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
      GROUP BY team_stat_id, objective_key
    )
    UPDATE agg_team_core_stats atc
    SET
      baron_win_team = COALESCE(ob_baron.win_json, '{}'::jsonb),
      baron_loose_team = COALESCE(ob_baron.loss_json, '{}'::jsonb),
      drake_win_team = COALESCE(ob_dragon.win_json, '{}'::jsonb),
      drake_loose_team = COALESCE(ob_dragon.loss_json, '{}'::jsonb),
      void_win_team = COALESCE(ob_horde.win_json, '{}'::jsonb),
      void_loose_team = COALESCE(ob_horde.loss_json, '{}'::jsonb),
      herald_win_team = COALESCE(ob_herald.win_json, '{}'::jsonb),
      herald_loose_team = COALESCE(ob_herald.loss_json, '{}'::jsonb),
      inhibitor_win_team = COALESCE(ob_inhibitor.win_json, '{}'::jsonb),
      inhibitor_loose_team = COALESCE(ob_inhibitor.loss_json, '{}'::jsonb),
      tower_win_team = COALESCE(ob_tower.win_json, '{}'::jsonb),
      tower_loose_team = COALESCE(ob_tower.loss_json, '{}'::jsonb),
      first_blood_win_team = COALESCE(ob_first_blood.win_json, '{}'::jsonb),
      first_blood_loose_team = COALESCE(ob_first_blood.loss_json, '{}'::jsonb),
      elder_win_team = COALESCE(ob_elder.win_json, '{}'::jsonb),
      elder_loose_team = COALESCE(ob_elder.loss_json, '{}'::jsonb),
      earth_drake_win_team = COALESCE(ob_earth_drake.win_json, '{}'::jsonb),
      earth_drake_loose_team = COALESCE(ob_earth_drake.loss_json, '{}'::jsonb),
      water_drake_win_team = COALESCE(ob_water_drake.win_json, '{}'::jsonb),
      water_drake_loose_team = COALESCE(ob_water_drake.loss_json, '{}'::jsonb),
      wind_drake_win_team = COALESCE(ob_wind_drake.win_json, '{}'::jsonb),
      wind_drake_loose_team = COALESCE(ob_wind_drake.loss_json, '{}'::jsonb),
      fire_drake_win_team = COALESCE(ob_fire_drake.win_json, '{}'::jsonb),
      fire_drake_loose_team = COALESCE(ob_fire_drake.loss_json, '{}'::jsonb),
      hextec_drake_win_team = COALESCE(ob_hextec_drake.win_json, '{}'::jsonb),
      hextec_drake_loose_team = COALESCE(ob_hextec_drake.loss_json, '{}'::jsonb),
      chem_drake_win_team = COALESCE(ob_chem_drake.win_json, '{}'::jsonb),
      chem_drake_loose_team = COALESCE(ob_chem_drake.loss_json, '{}'::jsonb),
      earth_soul_win_team = COALESCE(ob_earth_soul.win_json, '{}'::jsonb),
      earth_soul_loose_team = COALESCE(ob_earth_soul.loss_json, '{}'::jsonb),
      water_soul_win_team = COALESCE(ob_water_soul.win_json, '{}'::jsonb),
      water_soul_loose_team = COALESCE(ob_water_soul.loss_json, '{}'::jsonb),
      wind_soul_win_team = COALESCE(ob_wind_soul.win_json, '{}'::jsonb),
      wind_soul_loose_team = COALESCE(ob_wind_soul.loss_json, '{}'::jsonb),
      fire_soul_win_team = COALESCE(ob_fire_soul.win_json, '{}'::jsonb),
      fire_soul_loose_team = COALESCE(ob_fire_soul.loss_json, '{}'::jsonb),
      hextec_soul_win_team = COALESCE(ob_hextec_soul.win_json, '{}'::jsonb),
      hextec_soul_loose_team = COALESCE(ob_hextec_soul.loss_json, '{}'::jsonb),
      chem_soul_win_team = COALESCE(ob_chem_soul.win_json, '{}'::jsonb),
      chem_soul_loose_team = COALESCE(ob_chem_soul.loss_json, '{}'::jsonb),
      updated_at = NOW()
    FROM objective_bucket_json ob_baron
    LEFT JOIN objective_bucket_json ob_dragon
      ON ob_dragon.team_stat_id = ob_baron.team_stat_id AND ob_dragon.objective_key = 'dragon'
    LEFT JOIN objective_bucket_json ob_horde
      ON ob_horde.team_stat_id = ob_baron.team_stat_id AND ob_horde.objective_key = 'horde'
    LEFT JOIN objective_bucket_json ob_herald
      ON ob_herald.team_stat_id = ob_baron.team_stat_id AND ob_herald.objective_key = 'riftHerald'
    LEFT JOIN objective_bucket_json ob_inhibitor
      ON ob_inhibitor.team_stat_id = ob_baron.team_stat_id AND ob_inhibitor.objective_key = 'inhibitor'
    LEFT JOIN objective_bucket_json ob_tower
      ON ob_tower.team_stat_id = ob_baron.team_stat_id AND ob_tower.objective_key = 'tower'
    LEFT JOIN objective_bucket_json ob_first_blood
      ON ob_first_blood.team_stat_id = ob_baron.team_stat_id AND ob_first_blood.objective_key = 'first_blood'
    LEFT JOIN objective_bucket_json ob_elder
      ON ob_elder.team_stat_id = ob_baron.team_stat_id AND ob_elder.objective_key = 'elder'
    LEFT JOIN objective_bucket_json ob_earth_drake
      ON ob_earth_drake.team_stat_id = ob_baron.team_stat_id AND ob_earth_drake.objective_key = 'earth_drake'
    LEFT JOIN objective_bucket_json ob_water_drake
      ON ob_water_drake.team_stat_id = ob_baron.team_stat_id AND ob_water_drake.objective_key = 'water_drake'
    LEFT JOIN objective_bucket_json ob_wind_drake
      ON ob_wind_drake.team_stat_id = ob_baron.team_stat_id AND ob_wind_drake.objective_key = 'wind_drake'
    LEFT JOIN objective_bucket_json ob_fire_drake
      ON ob_fire_drake.team_stat_id = ob_baron.team_stat_id AND ob_fire_drake.objective_key = 'fire_drake'
    LEFT JOIN objective_bucket_json ob_hextec_drake
      ON ob_hextec_drake.team_stat_id = ob_baron.team_stat_id AND ob_hextec_drake.objective_key = 'hextec_drake'
    LEFT JOIN objective_bucket_json ob_chem_drake
      ON ob_chem_drake.team_stat_id = ob_baron.team_stat_id AND ob_chem_drake.objective_key = 'chem_drake'
    LEFT JOIN objective_bucket_json ob_earth_soul
      ON ob_earth_soul.team_stat_id = ob_baron.team_stat_id AND ob_earth_soul.objective_key = 'earth_soul'
    LEFT JOIN objective_bucket_json ob_water_soul
      ON ob_water_soul.team_stat_id = ob_baron.team_stat_id AND ob_water_soul.objective_key = 'water_soul'
    LEFT JOIN objective_bucket_json ob_wind_soul
      ON ob_wind_soul.team_stat_id = ob_baron.team_stat_id AND ob_wind_soul.objective_key = 'wind_soul'
    LEFT JOIN objective_bucket_json ob_fire_soul
      ON ob_fire_soul.team_stat_id = ob_baron.team_stat_id AND ob_fire_soul.objective_key = 'fire_soul'
    LEFT JOIN objective_bucket_json ob_hextec_soul
      ON ob_hextec_soul.team_stat_id = ob_baron.team_stat_id AND ob_hextec_soul.objective_key = 'hextec_soul'
    LEFT JOIN objective_bucket_json ob_chem_soul
      ON ob_chem_soul.team_stat_id = ob_baron.team_stat_id AND ob_chem_soul.objective_key = 'chem_soul'
    WHERE ob_baron.objective_key = 'baron'
      AND atc.id = ob_baron.team_stat_id
  `)

  await prisma.$executeRawUnsafe(`
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
        SUM(CASE WHEN it.win AND it.tower_first THEN 1 ELSE 0 END)::int AS tower_first_win,
        SUM(CASE WHEN NOT it.win AND it.tower_first THEN 1 ELSE 0 END)::int AS tower_first_loss,
        SUM(CASE WHEN it.win AND it.first_blood THEN 1 ELSE 0 END)::int AS first_blood_win,
        SUM(CASE WHEN NOT it.win AND it.first_blood THEN 1 ELSE 0 END)::int AS first_blood_loss
      FROM ingest_teams it
      INNER JOIN ingest_matchs im ON im.id = it.match_id
      WHERE UPPER(COALESCE(NULLIF(TRIM(im.rank_tier), ''), 'UNRANKED')) <> 'UNRANKED'
      GROUP BY im.game_version, UPPER(COALESCE(NULLIF(TRIM(im.rank_tier), ''), 'UNRANKED'))
    ),
    drake_type_per_team AS (
      SELECT
        src.game_version,
        src.rank_tier,
        src.win,
        src.team_id,
        SUM(CASE WHEN src.drake_type = 'earth' THEN 1 ELSE 0 END)::int AS earth_count,
        SUM(CASE WHEN src.drake_type = 'water' THEN 1 ELSE 0 END)::int AS water_count,
        SUM(CASE WHEN src.drake_type = 'wind' THEN 1 ELSE 0 END)::int AS wind_count,
        SUM(CASE WHEN src.drake_type = 'fire' THEN 1 ELSE 0 END)::int AS fire_count,
        SUM(CASE WHEN src.drake_type = 'hextec' THEN 1 ELSE 0 END)::int AS hextec_count,
        SUM(CASE WHEN src.drake_type = 'chem' THEN 1 ELSE 0 END)::int AS chem_count,
        MAX(CASE WHEN src.soul_type = 'earth' THEN 1 ELSE 0 END)::int AS earth_soul,
        MAX(CASE WHEN src.soul_type = 'water' THEN 1 ELSE 0 END)::int AS water_soul,
        MAX(CASE WHEN src.soul_type = 'wind' THEN 1 ELSE 0 END)::int AS wind_soul,
        MAX(CASE WHEN src.soul_type = 'fire' THEN 1 ELSE 0 END)::int AS fire_soul,
        MAX(CASE WHEN src.soul_type = 'hextec' THEN 1 ELSE 0 END)::int AS hextec_soul,
        MAX(CASE WHEN src.soul_type = 'chem' THEN 1 ELSE 0 END)::int AS chem_soul
      FROM (
        SELECT
          it.id AS team_id,
          it.win,
          im.game_version,
          UPPER(COALESCE(NULLIF(TRIM(im.rank_tier), ''), 'UNRANKED')) AS rank_tier,
          CASE
            WHEN UPPER(COALESCE(d.elem->>'drakeType', '')) LIKE '%MOUNTAIN%'
              OR UPPER(COALESCE(d.elem->>'drakeType', '')) LIKE '%EARTH%' THEN 'earth'
            WHEN UPPER(COALESCE(d.elem->>'drakeType', '')) LIKE '%OCEAN%'
              OR UPPER(COALESCE(d.elem->>'drakeType', '')) LIKE '%WATER%' THEN 'water'
            WHEN UPPER(COALESCE(d.elem->>'drakeType', '')) LIKE '%CLOUD%'
              OR UPPER(COALESCE(d.elem->>'drakeType', '')) LIKE '%WIND%' THEN 'wind'
            WHEN UPPER(COALESCE(d.elem->>'drakeType', '')) LIKE '%INFERNAL%'
              OR UPPER(COALESCE(d.elem->>'drakeType', '')) LIKE '%FIRE%' THEN 'fire'
            WHEN UPPER(COALESCE(d.elem->>'drakeType', '')) LIKE '%HEXTECH%'
              OR UPPER(COALESCE(d.elem->>'drakeType', '')) LIKE '%HEXTEC%' THEN 'hextec'
            WHEN UPPER(COALESCE(d.elem->>'drakeType', '')) LIKE '%CHEMTECH%'
              OR UPPER(COALESCE(d.elem->>'drakeType', '')) LIKE '%CHEM%' THEN 'chem'
            ELSE NULL
          END AS drake_type,
          CASE
            WHEN UPPER(COALESCE(d.elem->>'soul', '')) IN ('MOUNTAIN','EARTH_DRAGON','MOUNTAIN_DRAGON','EARTH_DRAGON_SOUL','MOUNTAIN_DRAGON_SOUL') THEN 'earth'
            WHEN UPPER(COALESCE(d.elem->>'soul', '')) IN ('OCEAN','WATER_DRAGON','OCEAN_DRAGON','WATER_DRAGON_SOUL','OCEAN_DRAGON_SOUL') THEN 'water'
            WHEN UPPER(COALESCE(d.elem->>'soul', '')) IN ('CLOUD','AIR_DRAGON','WIND_DRAGON','CLOUD_DRAGON','AIR_DRAGON_SOUL','WIND_DRAGON_SOUL','CLOUD_DRAGON_SOUL') THEN 'wind'
            WHEN UPPER(COALESCE(d.elem->>'soul', '')) IN ('INFERNAL','FIRE_DRAGON','INFERNAL_DRAGON','FIRE_DRAGON_SOUL','INFERNAL_DRAGON_SOUL') THEN 'fire'
            WHEN UPPER(COALESCE(d.elem->>'soul', '')) IN ('HEXTECH','HEXTECH_DRAGON','HEXTEC_DRAGON','HEXTECH_DRAGON_SOUL','HEXTEC_DRAGON_SOUL') THEN 'hextec'
            WHEN UPPER(COALESCE(d.elem->>'soul', '')) IN ('CHEMTECH','CHEMTECH_DRAGON','CHEM_DRAGON','CHEMTECH_DRAGON_SOUL','CHEM_DRAGON_SOUL') THEN 'chem'
            ELSE NULL
          END AS soul_type
        FROM ingest_teams it
        INNER JOIN ingest_matchs im ON im.id = it.match_id
        LEFT JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(it.drakes_json::jsonb) = 'array' THEN it.drakes_json::jsonb
            ELSE '[]'::jsonb
          END
        ) AS d(elem) ON TRUE
        WHERE UPPER(COALESCE(NULLIF(TRIM(im.rank_tier), ''), 'UNRANKED')) <> 'UNRANKED'
      ) src
      GROUP BY src.game_version, src.rank_tier, src.win, src.team_id
    ),
    drake_type_bucket AS (
      SELECT game_version, rank_tier, win, 'earth_drake'::text AS objective_key, earth_count AS objective_bucket FROM drake_type_per_team
      UNION ALL
      SELECT game_version, rank_tier, win, 'water_drake'::text, water_count FROM drake_type_per_team
      UNION ALL
      SELECT game_version, rank_tier, win, 'wind_drake'::text, wind_count FROM drake_type_per_team
      UNION ALL
      SELECT game_version, rank_tier, win, 'fire_drake'::text, fire_count FROM drake_type_per_team
      UNION ALL
      SELECT game_version, rank_tier, win, 'hextec_drake'::text, hextec_count FROM drake_type_per_team
      UNION ALL
      SELECT game_version, rank_tier, win, 'chem_drake'::text, chem_count FROM drake_type_per_team
    ),
    drake_type_bucket_rows AS (
      SELECT
        game_version,
        rank_tier,
        objective_key,
        objective_bucket,
        SUM(CASE WHEN win THEN 1 ELSE 0 END)::int AS count_win,
        SUM(CASE WHEN win THEN 0 ELSE 1 END)::int AS count_loss
      FROM drake_type_bucket
      GROUP BY game_version, rank_tier, objective_key, objective_bucket
    ),
    drake_type_bucket_json AS (
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
      FROM drake_type_bucket_rows
      GROUP BY game_version, rank_tier, objective_key
    ),
    drake_soul_counts AS (
      SELECT
        game_version,
        rank_tier,
        SUM(CASE WHEN win AND earth_soul = 1 THEN 1 ELSE 0 END)::int AS earth_soul_win,
        SUM(CASE WHEN NOT win AND earth_soul = 1 THEN 1 ELSE 0 END)::int AS earth_soul_loss,
        SUM(CASE WHEN win AND water_soul = 1 THEN 1 ELSE 0 END)::int AS water_soul_win,
        SUM(CASE WHEN NOT win AND water_soul = 1 THEN 1 ELSE 0 END)::int AS water_soul_loss,
        SUM(CASE WHEN win AND wind_soul = 1 THEN 1 ELSE 0 END)::int AS wind_soul_win,
        SUM(CASE WHEN NOT win AND wind_soul = 1 THEN 1 ELSE 0 END)::int AS wind_soul_loss,
        SUM(CASE WHEN win AND fire_soul = 1 THEN 1 ELSE 0 END)::int AS fire_soul_win,
        SUM(CASE WHEN NOT win AND fire_soul = 1 THEN 1 ELSE 0 END)::int AS fire_soul_loss,
        SUM(CASE WHEN win AND hextec_soul = 1 THEN 1 ELSE 0 END)::int AS hextec_soul_win,
        SUM(CASE WHEN NOT win AND hextec_soul = 1 THEN 1 ELSE 0 END)::int AS hextec_soul_loss,
        SUM(CASE WHEN win AND chem_soul = 1 THEN 1 ELSE 0 END)::int AS chem_soul_win,
        SUM(CASE WHEN NOT win AND chem_soul = 1 THEN 1 ELSE 0 END)::int AS chem_soul_loss
      FROM drake_type_per_team
      GROUP BY game_version, rank_tier
    )
    SELECT
      d.game_version,
      d.rank_tier,
      COALESCE(ob_baron.win_json, '{}'::jsonb) || jsonb_build_object('first', COALESCE(fc.baron_first_win, 0)),
      COALESCE(ob_baron.loss_json, '{}'::jsonb) || jsonb_build_object('first', COALESCE(fc.baron_first_loss, 0)),
      COALESCE(ob_dragon.win_json, '{}'::jsonb) || jsonb_build_object('first', COALESCE(fc.dragon_first_win, 0)),
      COALESCE(ob_dragon.loss_json, '{}'::jsonb) || jsonb_build_object('first', COALESCE(fc.dragon_first_loss, 0)),
      COALESCE(ob_horde.win_json, '{}'::jsonb) || jsonb_build_object('first', COALESCE(fc.horde_first_win, 0)),
      COALESCE(ob_horde.loss_json, '{}'::jsonb) || jsonb_build_object('first', COALESCE(fc.horde_first_loss, 0)),
      COALESCE(ob_herald.win_json, '{}'::jsonb) || jsonb_build_object('first', COALESCE(fc.herald_first_win, 0)),
      COALESCE(ob_herald.loss_json, '{}'::jsonb) || jsonb_build_object('first', COALESCE(fc.herald_first_loss, 0)),
      COALESCE(ob_inhibitor.win_json, '{}'::jsonb),
      COALESCE(ob_inhibitor.loss_json, '{}'::jsonb),
      COALESCE(ob_tower.win_json, '{}'::jsonb) || jsonb_build_object('first', COALESCE(fc.tower_first_win, 0)),
      COALESCE(ob_tower.loss_json, '{}'::jsonb) || jsonb_build_object('first', COALESCE(fc.tower_first_loss, 0)),
      jsonb_build_object('first', COALESCE(fc.first_blood_win, 0)),
      jsonb_build_object('first', COALESCE(fc.first_blood_loss, 0)),
      COALESCE(ob_elder.win_json, '{}'::jsonb),
      COALESCE(ob_elder.loss_json, '{}'::jsonb),
      COALESCE(dt_earth.win_json, '{}'::jsonb) || jsonb_build_object('soul', COALESCE(dsoul.earth_soul_win, 0)),
      COALESCE(dt_earth.loss_json, '{}'::jsonb) || jsonb_build_object('soul', COALESCE(dsoul.earth_soul_loss, 0)),
      COALESCE(dt_water.win_json, '{}'::jsonb) || jsonb_build_object('soul', COALESCE(dsoul.water_soul_win, 0)),
      COALESCE(dt_water.loss_json, '{}'::jsonb) || jsonb_build_object('soul', COALESCE(dsoul.water_soul_loss, 0)),
      COALESCE(dt_wind.win_json, '{}'::jsonb) || jsonb_build_object('soul', COALESCE(dsoul.wind_soul_win, 0)),
      COALESCE(dt_wind.loss_json, '{}'::jsonb) || jsonb_build_object('soul', COALESCE(dsoul.wind_soul_loss, 0)),
      COALESCE(dt_fire.win_json, '{}'::jsonb) || jsonb_build_object('soul', COALESCE(dsoul.fire_soul_win, 0)),
      COALESCE(dt_fire.loss_json, '{}'::jsonb) || jsonb_build_object('soul', COALESCE(dsoul.fire_soul_loss, 0)),
      COALESCE(dt_hextec.win_json, '{}'::jsonb) || jsonb_build_object('soul', COALESCE(dsoul.hextec_soul_win, 0)),
      COALESCE(dt_hextec.loss_json, '{}'::jsonb) || jsonb_build_object('soul', COALESCE(dsoul.hextec_soul_loss, 0)),
      COALESCE(dt_chem.win_json, '{}'::jsonb) || jsonb_build_object('soul', COALESCE(dsoul.chem_soul_win, 0)),
      COALESCE(dt_chem.loss_json, '{}'::jsonb) || jsonb_build_object('soul', COALESCE(dsoul.chem_soul_loss, 0)),
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
    LEFT JOIN first_counts fc ON fc.game_version = d.game_version AND fc.rank_tier = d.rank_tier
    LEFT JOIN objective_bucket_json ob_baron
      ON ob_baron.game_version = d.game_version AND ob_baron.rank_tier = d.rank_tier AND ob_baron.objective_key = 'baron'
    LEFT JOIN objective_bucket_json ob_dragon
      ON ob_dragon.game_version = d.game_version AND ob_dragon.rank_tier = d.rank_tier AND ob_dragon.objective_key = 'dragon'
    LEFT JOIN objective_bucket_json ob_horde
      ON ob_horde.game_version = d.game_version AND ob_horde.rank_tier = d.rank_tier AND ob_horde.objective_key = 'horde'
    LEFT JOIN objective_bucket_json ob_herald
      ON ob_herald.game_version = d.game_version AND ob_herald.rank_tier = d.rank_tier AND ob_herald.objective_key = 'riftHerald'
    LEFT JOIN objective_bucket_json ob_inhibitor
      ON ob_inhibitor.game_version = d.game_version AND ob_inhibitor.rank_tier = d.rank_tier AND ob_inhibitor.objective_key = 'inhibitor'
    LEFT JOIN objective_bucket_json ob_tower
      ON ob_tower.game_version = d.game_version AND ob_tower.rank_tier = d.rank_tier AND ob_tower.objective_key = 'tower'
    LEFT JOIN objective_bucket_json ob_elder
      ON ob_elder.game_version = d.game_version AND ob_elder.rank_tier = d.rank_tier AND ob_elder.objective_key = 'elder'
    LEFT JOIN drake_type_bucket_json dt_earth
      ON dt_earth.game_version = d.game_version AND dt_earth.rank_tier = d.rank_tier AND dt_earth.objective_key = 'earth_drake'
    LEFT JOIN drake_type_bucket_json dt_water
      ON dt_water.game_version = d.game_version AND dt_water.rank_tier = d.rank_tier AND dt_water.objective_key = 'water_drake'
    LEFT JOIN drake_type_bucket_json dt_wind
      ON dt_wind.game_version = d.game_version AND dt_wind.rank_tier = d.rank_tier AND dt_wind.objective_key = 'wind_drake'
    LEFT JOIN drake_type_bucket_json dt_fire
      ON dt_fire.game_version = d.game_version AND dt_fire.rank_tier = d.rank_tier AND dt_fire.objective_key = 'fire_drake'
    LEFT JOIN drake_type_bucket_json dt_hextec
      ON dt_hextec.game_version = d.game_version AND dt_hextec.rank_tier = d.rank_tier AND dt_hextec.objective_key = 'hextec_drake'
    LEFT JOIN drake_type_bucket_json dt_chem
      ON dt_chem.game_version = d.game_version AND dt_chem.rank_tier = d.rank_tier AND dt_chem.objective_key = 'chem_drake'
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
    LEFT JOIN drake_soul_counts dsoul
      ON dsoul.game_version = d.game_version AND dsoul.rank_tier = d.rank_tier
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

  const counts = await prisma.$queryRawUnsafe<Array<{ k: string; c: bigint }>>(`
    SELECT 'agg_objective_outcome_stats'::text AS k, COUNT(*)::bigint AS c FROM agg_objective_outcome_stats
    UNION ALL
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

async function main(): Promise<void> {
  await createBackfillLockFile()
  const maxAttemptsRaw = Number.parseInt(process.env.BACKFILL_AGG_MAX_RETRIES ?? '', 10)
  const maxAttempts = Number.isFinite(maxAttemptsRaw) && maxAttemptsRaw > 0 ? Math.min(maxAttemptsRaw, 10) : 6
  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await runBackfillOnce()
        return
      } catch (err) {
        if (!isRetryableDbError(err) || attempt >= maxAttempts) throw err
        const backoffMs = Math.min(30_000, 1000 * 2 ** (attempt - 1))
        console.warn(
          `[backfill-agg] retryable DB error (attempt ${attempt}/${maxAttempts}): ${
            err instanceof Error ? err.message : String(err)
          }`
        )
        console.warn(`[backfill-agg] retrying in ${backoffMs}ms...`)
        await sleep(backoffMs)
      }
    }
  } finally {
    await releaseBackfillLockFile()
  }
}

void main()
  .catch((err) => {
    console.error('[backfill-agg] failed:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined)
  })
