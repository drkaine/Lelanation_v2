import 'dotenv/config'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { prisma } from '../db.js'
import { processRawAggregateAndBurn } from '../worker/rawAggregateProcessor.js'
import type { MatchIngestQueuePayloadV1 } from '../worker/matchIngestQueue.js'
import { selectMatchPlayerItems } from '../worker/itemBuildSelection.js'

const RETRYABLE_DB_CODES = new Set(['40P01', '40001'])
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const BACKEND_ROOT = path.resolve(__dirname, '..', '..')
const BACKFILL_AGG_LOCK_DIR = path.join(BACKEND_ROOT, 'data', 'locks')
const BACKFILL_AGG_LOCK_FILE = path.join(BACKFILL_AGG_LOCK_DIR, 'backfill-agg.lock')
const BACKFILL_AGG_PROGRESS_FILE = path.join(BACKFILL_AGG_LOCK_DIR, 'backfill-agg-raw-progress.json')
const execFileAsync = promisify(execFile)

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

async function loadRawResumeLastId(): Promise<bigint> {
  try {
    const raw = JSON.parse(await readFile(BACKFILL_AGG_PROGRESS_FILE, 'utf8')) as {
      lastId?: string | number
    }
    const parsed = BigInt(String(raw.lastId ?? '0'))
    return parsed > 0n ? parsed : 0n
  } catch {
    return 0n
  }
}

async function saveRawResumeLastId(lastId: bigint): Promise<void> {
  await mkdir(BACKFILL_AGG_LOCK_DIR, { recursive: true })
  await writeFile(
    BACKFILL_AGG_PROGRESS_FILE,
    JSON.stringify({ lastId: lastId.toString(), updatedAt: new Date().toISOString() }),
    'utf8'
  )
}

function shouldPausePoller(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    String(process.env.BACKFILL_AGG_PAUSE_POLLER ?? '')
      .trim()
      .toLowerCase()
  )
}

async function runPm2Command(args: string[]): Promise<void> {
  await execFileAsync('pm2', args, { cwd: BACKEND_ROOT })
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

async function tableExists(tableName: string): Promise<boolean> {
  if (!/^[a-z0-9_]+$/i.test(tableName)) return false
  const rows = await prisma.$queryRawUnsafe<Array<{ ok: boolean }>>(
    `SELECT to_regclass('public.${tableName}') IS NOT NULL AS ok`
  )
  return Boolean(rows[0]?.ok)
}

async function seedLivePatchesFromArchive(): Promise<void> {
  const livePatchRows = await prisma.activePatch.findMany({
    where: { archivedAt: null },
    select: { gameVersion: true },
  })
  const livePatches = livePatchRows
    .map((r) => String(r.gameVersion ?? '').trim())
    .filter((v) => v.length > 0)
  if (livePatches.length === 0) {
    console.log('[backfill-agg] resume seed skipped: no live patch')
    return
  }

  const patchSql = livePatches.map((v) => `'${v.replace(/'/g, "''")}'`).join(',')
  const versionedTables = [
    'agg_match_outcome_stats',
    'agg_champion_core_stats',
    'agg_team_core_stats',
    'agg_champion_vs_stats',
    'agg_champion_side_stats',
    'agg_botlane_duo_vs_duo_stats',
    'agg_champion_summoner_spell_pair_stats',
    'agg_champion_item_starter_set_stats',
    'agg_objective_outcome_stats',
  ] as const
  const championSatTables = [
    'agg_champion_bucket',
    'agg_champion_damage_stats',
    'agg_champion_duo_role_stats',
    'agg_champion_participant_stats',
    'agg_champion_spells_stats',
    'agg_champion_summoner_spells',
    'agg_champion_runes_stats',
    'agg_champion_runes_solo_stats',
    'agg_champion_shard_solo_stats',
    'agg_champion_item_stats',
    'agg_champion_item_solo_stats',
    'agg_champion_bans_by_banner',
  ] as const
  const teamSatTables = ['agg_team_bucket'] as const

  console.log(
    `[backfill-agg] resume seed from archive for live patches: ${livePatches.join(', ')}`
  )

  for (const table of versionedTables) {
    const archiveTable = `archive_${table}`
    if (!(await tableExists(archiveTable))) continue
    await prisma.$executeRawUnsafe(`
      INSERT INTO ${table}
      SELECT *
      FROM ${archiveTable}
      WHERE game_version IN (${patchSql})
      ON CONFLICT DO NOTHING
    `)
  }

  for (const table of championSatTables) {
    const archiveTable = `archive_${table}`
    if (!(await tableExists(archiveTable))) continue
    await prisma.$executeRawUnsafe(`
      INSERT INTO ${table}
      SELECT s.*
      FROM ${archiveTable} s
      INNER JOIN archive_agg_champion_core_stats c ON c.id = s.champion_stat_id
      WHERE c.game_version IN (${patchSql})
      ON CONFLICT DO NOTHING
    `)
  }

  for (const table of teamSatTables) {
    const archiveTable = `archive_${table}`
    if (!(await tableExists(archiveTable))) continue
    await prisma.$executeRawUnsafe(`
      INSERT INTO ${table}
      SELECT s.*
      FROM ${archiveTable} s
      INNER JOIN archive_agg_team_core_stats t ON t.id = s.team_stat_id
      WHERE t.game_version IN (${patchSql})
      ON CONFLICT DO NOTHING
    `)
  }
}

async function runBackfillOnce(): Promise<void> {
  console.log('[backfill-agg] starting')

  const ingestTablesPresent = await prisma.$queryRaw<Array<{ ok: boolean }>>`
    SELECT (
      to_regclass('public.ingest_matchs') IS NOT NULL
      AND to_regclass('public.ingest_match_players') IS NOT NULL
      AND to_regclass('public.ingest_teams') IS NOT NULL
    ) AS ok
  `
  const useRawOnly = !ingestTablesPresent[0]?.ok
  let rawRowCount = 0
  if (useRawOnly) {
    const rawCountRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM match_ingest_raw
      WHERE payload_json IS NOT NULL
    `
    rawRowCount = Number(rawCountRows[0]?.count ?? 0n)
    const allowRawOnly = ['1', 'true', 'yes', 'on'].includes(
      String(process.env.BACKFILL_AGG_ALLOW_RAW_ONLY ?? '')
        .trim()
        .toLowerCase()
    )
    if (!allowRawOnly) {
      throw new Error(
        `[backfill-agg] ingest_* absent and rebuild would rely only on match_ingest_raw (${rawRowCount} rows). ` +
          'Set BACKFILL_AGG_ALLOW_RAW_ONLY=1 to confirm this potentially partial rebuild.'
      )
    }
    console.log(
      `[backfill-agg] ingest_* absent -> rebuilding aggregates from match_ingest_raw (${rawRowCount} rows)`
    )
  }

  const rawResumeEnabled = useRawOnly
    ? ['1', 'true', 'yes', 'on'].includes(
        String(process.env.BACKFILL_AGG_RAW_RESUME ?? '')
          .trim()
          .toLowerCase()
      )
    : false
  const rawResumeLastId = rawResumeEnabled ? await loadRawResumeLastId() : 0n
  const hasRawResumeCheckpoint = rawResumeEnabled && rawResumeLastId > 0n
  if (hasRawResumeCheckpoint) {
    console.log(
      `[backfill-agg] resume checkpoint detected -> preserving current agg tables and continuing from id>${rawResumeLastId.toString()}`
    )
  }

  if (!hasRawResumeCheckpoint) {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        agg_objective_outcome_stats,
        agg_champion_item_starter_set_stats,
        agg_champion_summoner_spell_pair_stats,
        agg_champion_spells_stats,
        agg_champion_item_solo_stats,
        agg_champion_item_stats,
        agg_champion_shard_solo_stats,
        agg_champion_runes_solo_stats,
        agg_champion_runes_stats,
        agg_champion_summoner_spells,
        agg_botlane_duo_vs_duo_stats,
        agg_champion_duo_role_stats,
        agg_champion_participant_stats,
        agg_champion_damage_stats,
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
  }

  if (useRawOnly) {
    const batchSize = Math.max(50, Math.min(2000, Number(process.env.BACKFILL_AGG_RAW_BATCH_SIZE ?? 300)))
    const concurrency = Math.max(1, Math.min(16, Number(process.env.BACKFILL_AGG_RAW_CONCURRENCY ?? 1)))
    console.log(
      `[backfill-agg] raw mode config: batchSize=${batchSize} concurrency=${concurrency} resume=${rawResumeEnabled}`
    )
    let lastId = rawResumeLastId
    if (rawResumeEnabled && lastId > 0n) {
      console.log(`[backfill-agg] raw resume enabled -> starting from id>${lastId.toString()}`)
    }
    if (rawResumeEnabled && !hasRawResumeCheckpoint) {
      await seedLivePatchesFromArchive()
    }
    let processed = 0
    while (true) {
      const rows = await prisma.$queryRaw<
        Array<{
          id: bigint
          riot_match_id: string
          region: string
          payload_json: unknown
          timeline_json: unknown | null
          ingested_at: Date
        }>
      >`
        SELECT id, riot_match_id, region, payload_json, timeline_json, ingested_at
        FROM match_ingest_raw
        WHERE payload_json IS NOT NULL
          AND id > ${lastId}
        ORDER BY id ASC
        LIMIT ${batchSize}
      `
      if (rows.length === 0) break
      lastId = rows[rows.length - 1]!.id
      for (let i = 0; i < rows.length; i += concurrency) {
        const chunk = rows.slice(i, i + concurrency)
        await Promise.all(
          chunk.map(async (row) => {
            const payload: MatchIngestQueuePayloadV1 = {
              v: 1,
              stepId: 'backfill-raw',
              matchId: row.riot_match_id,
              region: row.region,
              matchDto: row.payload_json,
              timelineDto: row.timeline_json,
              puuidKeyVersion: null,
              trackerIdx: -1,
              enqueuedAt: row.ingested_at.getTime(),
            }
            await processRawAggregateAndBurn(row.id, payload, row.riot_match_id)
            processed++
            if (processed % 200 === 0) {
              console.log(`[backfill-agg] raw processed: ${processed}/${rawRowCount}`)
            }
          })
        )
      }
      if (rawResumeEnabled) {
        await saveRawResumeLastId(lastId)
      }
    }
    await backfillItemStarterSetsFromRaw()
    await backfillObjectiveOutcomeFromAgg()
    console.log(`[backfill-agg] raw rebuild done: ${processed}/${rawRowCount} matches`)
    if (rawResumeEnabled) {
      await unlink(BACKFILL_AGG_PROGRESS_FILE).catch(() => undefined)
    }
    return
  }

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
    INSERT INTO agg_champion_spells_stats (
      champion_stat_id,
      spell1_casts,
      spell2_casts,
      spell3_casts,
      spell4_casts,
      spell_order,
      count_game,
      count_win,
      updated_at
    )
    SELECT
      ac.id AS champion_stat_id,
      SUM(COALESCE(NULLIF(imp.stats::jsonb->>'spell1Casts', '')::int, 0))::int AS spell1_casts,
      SUM(COALESCE(NULLIF(imp.stats::jsonb->>'spell2Casts', '')::int, 0))::int AS spell2_casts,
      SUM(COALESCE(NULLIF(imp.stats::jsonb->>'spell3Casts', '')::int, 0))::int AS spell3_casts,
      SUM(COALESCE(NULLIF(imp.stats::jsonb->>'spell4Casts', '')::int, 0))::int AS spell4_casts,
      '{}'::jsonb AS spell_order,
      COUNT(*)::int AS count_game,
      SUM(CASE WHEN imp.win THEN 1 ELSE 0 END)::int AS count_win,
      NOW()
    FROM ingest_match_players imp
    INNER JOIN ingest_matchs im ON im.id = imp.match_id
    INNER JOIN agg_champion_core_stats ac
      ON ac.champion_id = imp.champion_id
     AND ac.role = UPPER(COALESCE(NULLIF(TRIM(imp.role), ''), 'UNKNOWN'))
     AND ac.rank_tier = COALESCE(NULLIF(imp.rank_tier, ''), 'UNRANKED')
     AND ac.game_version = im.game_version
     AND ac.region = im.region
    WHERE COALESCE(NULLIF(imp.rank_tier, ''), 'UNRANKED') <> 'UNRANKED'
      AND UPPER(COALESCE(NULLIF(TRIM(imp.role), ''), 'UNKNOWN')) IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT')
    GROUP BY ac.id
    ON CONFLICT (champion_stat_id) DO UPDATE
    SET
      spell1_casts = EXCLUDED.spell1_casts,
      spell2_casts = EXCLUDED.spell2_casts,
      spell3_casts = EXCLUDED.spell3_casts,
      spell4_casts = EXCLUDED.spell4_casts,
      spell_order = EXCLUDED.spell_order,
      count_game = EXCLUDED.count_game,
      count_win = EXCLUDED.count_win,
      updated_at = NOW()
  `)

  const participantColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agg_champion_participant_stats'
      AND column_name NOT IN ('champion_stat_id', 'updated_at')
    ORDER BY ordinal_position
  `
  const exprForColumn = (column: string): string => {
    const snakeToCamel = (v: string): string =>
      v.replace(/_([a-z0-9])/g, (_, m: string) => String(m).toUpperCase())
    if (column.startsWith('sum_')) {
      const metricKey = snakeToCamel(column.slice(4))
      return `COALESCE((numeric_sums->>'${metricKey}')::bigint, 0)`
    }
    if (column.startsWith('count_') && column.endsWith('_true')) {
      const metricKey = snakeToCamel(column.slice(6, -5))
      return `COALESCE((bool_true_counts->>'${metricKey}')::bigint, 0)`
    }
    if (column.startsWith('count_') && column.endsWith('_false')) {
      const metricKey = snakeToCamel(column.slice(6, -6))
      return `(COALESCE((bool_counts->>'${metricKey}')::bigint, 0) - COALESCE((bool_true_counts->>'${metricKey}')::bigint, 0))`
    }
    if (column.startsWith('count_')) {
      const metricKey = snakeToCamel(column.slice(6))
      return `COALESCE((numeric_sums->>'${metricKey}')::bigint, 0)`
    }
    return '0'
  }
  const participantSelectMetricsSql = participantColumns
    .map((r) => {
      const col = String(r.column_name)
      return `${exprForColumn(col)} AS ${col}`
    })
    .join(',\n      ')
  const participantUpdateSetSql = participantColumns
    .map((r) => {
      const col = String(r.column_name)
      return `${col} = src.${col}`
    })
    .join(',\n      ')
  await prisma.$executeRawUnsafe(`
    WITH base AS (
      SELECT
        ac.id AS champion_stat_id,
        imp.stats::jsonb AS stats
      FROM ingest_match_players imp
      INNER JOIN ingest_matchs im ON im.id = imp.match_id
      INNER JOIN agg_champion_core_stats ac
        ON ac.champion_id = imp.champion_id
       AND ac.role = UPPER(COALESCE(NULLIF(TRIM(imp.role), ''), 'UNKNOWN'))
       AND ac.rank_tier = UPPER(COALESCE(NULLIF(TRIM(imp.rank_tier), ''), 'UNRANKED'))
       AND ac.game_version = im.game_version
       AND ac.region = im.region
      WHERE UPPER(COALESCE(NULLIF(TRIM(imp.rank_tier), ''), 'UNRANKED')) <> 'UNRANKED'
        AND UPPER(COALESCE(NULLIF(TRIM(imp.role), ''), 'UNKNOWN')) IN ('TOP','JUNGLE','MIDDLE','BOTTOM','SUPPORT')
    ),
    metric_rows AS (
      SELECT
        b.champion_stat_id,
        e.key AS metric_key,
        e.value AS metric_value
      FROM base b
      CROSS JOIN LATERAL jsonb_each(COALESCE(b.stats, '{}'::jsonb)) e
      WHERE jsonb_typeof(e.value) IN ('number', 'boolean')
      UNION ALL
      SELECT
        b.champion_stat_id,
        ('challenges.' || e.key) AS metric_key,
        e.value AS metric_value
      FROM base b
      CROSS JOIN LATERAL jsonb_each(COALESCE(b.stats -> 'challenges', '{}'::jsonb)) e
      WHERE jsonb_typeof(e.value) IN ('number', 'boolean')
      UNION ALL
      SELECT
        b.champion_stat_id,
        ('missions.' || e.key) AS metric_key,
        e.value AS metric_value
      FROM base b
      CROSS JOIN LATERAL jsonb_each(COALESCE(b.stats -> 'missions', '{}'::jsonb)) e
      WHERE jsonb_typeof(e.value) IN ('number', 'boolean')
    ),
    num_rows AS (
      SELECT
        champion_stat_id,
        replace(metric_key, 'challenges.', '') AS metric_key,
        SUM((metric_value::text)::numeric)::double precision AS sum_val
      FROM metric_rows
      WHERE jsonb_typeof(metric_value) = 'number'
      GROUP BY champion_stat_id, replace(metric_key, 'challenges.', '')
    ),
    bool_rows AS (
      SELECT
        champion_stat_id,
        replace(metric_key, 'challenges.', '') AS metric_key,
        SUM(CASE WHEN metric_value = 'true'::jsonb THEN 1 ELSE 0 END)::int AS true_cnt,
        COUNT(*)::int AS cnt_val
      FROM metric_rows
      WHERE jsonb_typeof(metric_value) = 'boolean'
      GROUP BY champion_stat_id, replace(metric_key, 'challenges.', '')
    ),
    num_json AS (
      SELECT champion_stat_id, jsonb_object_agg(metric_key, sum_val) AS numeric_sums
      FROM num_rows
      GROUP BY champion_stat_id
    ),
    bool_json AS (
      SELECT
        champion_stat_id,
        jsonb_object_agg(metric_key, true_cnt) AS bool_true_counts,
        jsonb_object_agg(metric_key, cnt_val) AS bool_counts
      FROM bool_rows
      GROUP BY champion_stat_id
    ),
    merged AS (
      SELECT
        COALESCE(n.champion_stat_id, b.champion_stat_id) AS champion_stat_id,
        COALESCE(n.numeric_sums, '{}'::jsonb) AS numeric_sums,
        COALESCE(b.bool_true_counts, '{}'::jsonb) AS bool_true_counts,
        COALESCE(b.bool_counts, '{}'::jsonb) AS bool_counts
      FROM num_json n
      FULL OUTER JOIN bool_json b ON b.champion_stat_id = n.champion_stat_id
    ),
    src AS (
      SELECT
        champion_stat_id,
        ${participantSelectMetricsSql}
      FROM merged
    )
    UPDATE agg_champion_participant_stats aps
    SET
      ${participantUpdateSetSql},
      updated_at = NOW()
    FROM src
    WHERE aps.champion_stat_id = src.champion_stat_id
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
    damage_source AS (
      SELECT
        ac.id AS champion_stat_id,
        SUM(COALESCE((imp.stats ->> 'physicalDamageDealtToChampions')::bigint, 0))::bigint AS sum_phys_d,
        SUM(COALESCE((imp.stats ->> 'magicDamageDealtToChampions')::bigint, 0))::bigint AS sum_magic_d,
        SUM(COALESCE((imp.stats ->> 'trueDamageDealtToChampions')::bigint, 0))::bigint AS sum_true_d,
        SUM(COALESCE((imp.stats ->> 'totalDamageDealtToChampions')::bigint, 0))::bigint AS sum_total_d,
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
      GROUP BY ac.id
    )
    INSERT INTO agg_champion_damage_stats (
      champion_stat_id,
      sum_physical_damage_to_champions,
      sum_magic_damage_to_champions,
      sum_true_damage_to_champions,
      sum_total_damage_to_champions,
      count_game,
      updated_at
    )
    SELECT
      champion_stat_id,
      sum_phys_d,
      sum_magic_d,
      sum_true_d,
      CASE
        WHEN sum_total_d > 0 THEN sum_total_d
        ELSE sum_phys_d + sum_magic_d + sum_true_d
      END AS sum_total_d,
      count_game,
      NOW()
    FROM damage_source
    ON CONFLICT (champion_stat_id) DO UPDATE
    SET
      sum_physical_damage_to_champions = EXCLUDED.sum_physical_damage_to_champions,
      sum_magic_damage_to_champions = EXCLUDED.sum_magic_damage_to_champions,
      sum_true_damage_to_champions = EXCLUDED.sum_true_damage_to_champions,
      sum_total_damage_to_champions = EXCLUDED.sum_total_damage_to_champions,
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
    base AS (
      SELECT
        ac.id AS champion_stat_id,
        imp.stats
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
    ),
    metric_rows AS (
      SELECT
        b.champion_stat_id,
        e.key AS metric_key,
        e.value AS metric_value
      FROM base b
      CROSS JOIN LATERAL jsonb_each(COALESCE(b.stats, '{}'::jsonb)) e
      WHERE e.key NOT IN (
        'puuid', 'riotIdGameName', 'riotIdTagline', 'summonerId', 'summonerName',
        'participantId', 'championId', 'championName', 'teamId', 'teamPosition',
        'individualPosition', 'lane', 'role', 'perks', '_runes', '_shards', '_summonerSpells',
        'challenges', 'missions'
      )
        AND jsonb_typeof(e.value) IN ('number', 'boolean')
      UNION ALL
      SELECT
        b.champion_stat_id,
        ('challenges.' || e.key) AS metric_key,
        e.value AS metric_value
      FROM base b
      CROSS JOIN LATERAL jsonb_each(COALESCE(b.stats -> 'challenges', '{}'::jsonb)) e
      WHERE jsonb_typeof(e.value) IN ('number', 'boolean')
      UNION ALL
      SELECT
        b.champion_stat_id,
        ('missions.' || e.key) AS metric_key,
        e.value AS metric_value
      FROM base b
      CROSS JOIN LATERAL jsonb_each(COALESCE(b.stats -> 'missions', '{}'::jsonb)) e
      WHERE jsonb_typeof(e.value) IN ('number', 'boolean')
    ),
    num_rows AS (
      SELECT
        champion_stat_id,
        metric_key,
        SUM((metric_value::text)::numeric)::double precision AS sum_val,
        COUNT(*)::int AS cnt_val
      FROM metric_rows
      WHERE jsonb_typeof(metric_value) = 'number'
      GROUP BY champion_stat_id, metric_key
    ),
    bool_rows AS (
      SELECT
        champion_stat_id,
        metric_key,
        SUM(CASE WHEN metric_value = 'true'::jsonb THEN 1 ELSE 0 END)::int AS true_cnt,
        COUNT(*)::int AS cnt_val
      FROM metric_rows
      WHERE jsonb_typeof(metric_value) = 'boolean'
      GROUP BY champion_stat_id, metric_key
    ),
    num_json AS (
      SELECT
        champion_stat_id,
        jsonb_object_agg(metric_key, sum_val) AS numeric_sums,
        jsonb_object_agg(metric_key, cnt_val) AS numeric_counts
      FROM num_rows
      GROUP BY champion_stat_id
    ),
    bool_json AS (
      SELECT
        champion_stat_id,
        jsonb_object_agg(metric_key, true_cnt) AS bool_true_counts,
        jsonb_object_agg(metric_key, cnt_val) AS bool_counts
      FROM bool_rows
      GROUP BY champion_stat_id
    ),
    merged AS (
      SELECT
        COALESCE(n.champion_stat_id, b.champion_stat_id) AS champion_stat_id,
        COALESCE(n.numeric_sums, '{}'::jsonb) AS numeric_sums,
        COALESCE(n.numeric_counts, '{}'::jsonb) AS numeric_counts,
        COALESCE(b.bool_true_counts, '{}'::jsonb) AS bool_true_counts,
        COALESCE(b.bool_counts, '{}'::jsonb) AS bool_counts
      FROM num_json n
      FULL OUTER JOIN bool_json b ON b.champion_stat_id = n.champion_stat_id
    )
    INSERT INTO agg_champion_participant_stats (
      champion_stat_id,
      sum_all_in_pings,
      sum_assist_me_pings,
      sum_assists,
      sum_baron_kills,
      sum_basic_pings,
      sum_bounty_gold,
      sum_control_wards_placed,
      sum_damage_per_minute,
      sum_damage_self_mitigated,
      sum_gold_earned,
      sum_kills,
      sum_time_played,
      sum_total_damage_dealt_to_champions,
      sum_total_minions_killed,
      sum_total_time_cc_dealt,
      sum_total_units_healed,
      sum_vision_score,
      sum_wards_killed,
      sum_wards_placed,
      count_first_blood_kill_true,
      count_first_blood_assist_true,
      count_first_tower_kill_true,
      count_first_tower_assist_true,
      updated_at
    )
    SELECT
      champion_stat_id,
      COALESCE((numeric_sums->>'allInPings')::bigint, 0),
      COALESCE((numeric_sums->>'assistMePings')::bigint, 0),
      COALESCE((numeric_sums->>'assists')::bigint, 0),
      COALESCE((numeric_sums->>'baronKills')::bigint, 0),
      COALESCE((numeric_sums->>'basicPings')::bigint, 0),
      COALESCE((numeric_sums->>'bountyGold')::bigint, 0),
      COALESCE((numeric_sums->>'controlWardsPlaced')::bigint, 0),
      COALESCE((numeric_sums->>'damagePerMinute')::bigint, 0),
      COALESCE((numeric_sums->>'damageSelfMitigated')::bigint, 0),
      COALESCE((numeric_sums->>'goldEarned')::bigint, 0),
      COALESCE((numeric_sums->>'kills')::bigint, 0),
      COALESCE((numeric_sums->>'timePlayed')::bigint, 0),
      COALESCE((numeric_sums->>'totalDamageDealtToChampions')::bigint, 0),
      COALESCE((numeric_sums->>'totalMinionsKilled')::bigint, 0),
      COALESCE((numeric_sums->>'totalTimeCCDealt')::bigint, 0),
      COALESCE((numeric_sums->>'totalUnitsHealed')::bigint, 0),
      COALESCE((numeric_sums->>'visionScore')::bigint, 0),
      COALESCE((numeric_sums->>'wardsKilled')::bigint, 0),
      COALESCE((numeric_sums->>'wardsPlaced')::bigint, 0),
      COALESCE((bool_true_counts->>'firstBloodKill')::bigint, 0),
      COALESCE((bool_true_counts->>'firstBloodAssist')::bigint, 0),
      COALESCE((bool_true_counts->>'firstTowerKill')::bigint, 0),
      COALESCE((bool_true_counts->>'firstTowerAssist')::bigint, 0),
      NOW()
    FROM merged
    ON CONFLICT (champion_stat_id) DO UPDATE
    SET
      sum_all_in_pings = EXCLUDED.sum_all_in_pings,
      sum_assist_me_pings = EXCLUDED.sum_assist_me_pings,
      sum_assists = EXCLUDED.sum_assists,
      sum_baron_kills = EXCLUDED.sum_baron_kills,
      sum_basic_pings = EXCLUDED.sum_basic_pings,
      sum_bounty_gold = EXCLUDED.sum_bounty_gold,
      sum_control_wards_placed = EXCLUDED.sum_control_wards_placed,
      sum_damage_per_minute = EXCLUDED.sum_damage_per_minute,
      sum_damage_self_mitigated = EXCLUDED.sum_damage_self_mitigated,
      sum_gold_earned = EXCLUDED.sum_gold_earned,
      sum_kills = EXCLUDED.sum_kills,
      sum_time_played = EXCLUDED.sum_time_played,
      sum_total_damage_dealt_to_champions = EXCLUDED.sum_total_damage_dealt_to_champions,
      sum_total_minions_killed = EXCLUDED.sum_total_minions_killed,
      sum_total_time_cc_dealt = EXCLUDED.sum_total_time_cc_dealt,
      sum_total_units_healed = EXCLUDED.sum_total_units_healed,
      sum_vision_score = EXCLUDED.sum_vision_score,
      sum_wards_killed = EXCLUDED.sum_wards_killed,
      sum_wards_placed = EXCLUDED.sum_wards_placed,
      count_first_blood_kill_true = EXCLUDED.count_first_blood_kill_true,
      count_first_blood_assist_true = EXCLUDED.count_first_blood_assist_true,
      count_first_tower_kill_true = EXCLUDED.count_first_tower_kill_true,
      count_first_tower_assist_true = EXCLUDED.count_first_tower_assist_true,
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
    ),
    duo_pairs AS (
      SELECT
        a.champion_id,
        ally.champion_id AS ally_champion_id,
        ally.role_resolved AS ally_role,
        a.role_resolved AS role,
        COALESCE(NULLIF(a.rank_tier, ''), 'UNRANKED') AS rank_tier,
        im.game_version,
        im.region,
        SUM(CASE WHEN a.win THEN 1 ELSE 0 END)::int AS count_win,
        COUNT(*)::int AS count_game
      FROM imp_resolved a
      INNER JOIN imp_resolved ally
        ON ally.match_id = a.match_id
       AND ally.team_id = a.team_id
       AND ally.id <> a.id
      INNER JOIN ingest_matchs im ON im.id = a.match_id
      WHERE COALESCE(NULLIF(a.rank_tier, ''), 'UNRANKED') <> 'UNRANKED'
        AND a.role_resolved IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT')
        AND ally.role_resolved IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT')
      GROUP BY
        a.champion_id,
        ally.champion_id,
        ally.role_resolved,
        a.role_resolved,
        COALESCE(NULLIF(a.rank_tier, ''), 'UNRANKED'),
        im.game_version,
        im.region
    )
    INSERT INTO agg_champion_duo_role_stats (
      champion_stat_id,
      ally_champion_id,
      ally_role,
      count_win,
      count_game,
      updated_at
    )
    SELECT
      ac.id AS champion_stat_id,
      d.ally_champion_id,
      d.ally_role,
      SUM(d.count_win)::int AS count_win,
      SUM(d.count_game)::int AS count_game,
      NOW()
    FROM duo_pairs d
    INNER JOIN agg_champion_core_stats ac
      ON ac.champion_id = d.champion_id
     AND ac.role = d.role
     AND ac.rank_tier = d.rank_tier
     AND ac.game_version = d.game_version
     AND ac.region = d.region
    GROUP BY ac.id, d.ally_champion_id, d.ally_role
    ON CONFLICT (champion_stat_id, ally_champion_id, ally_role) DO UPDATE
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
    botlane_duos AS (
      SELECT
        im.id AS match_id,
        im.region,
        im.game_version,
        UPPER(COALESCE(NULLIF(TRIM(im.rank_tier), ''), 'UNRANKED')) AS rank_tier,
        ir.team_id,
        BOOL_OR(ir.win) AS team_win,
        MAX(CASE WHEN ir.role_resolved = 'BOTTOM' THEN ir.champion_id END) AS adc_id,
        MAX(CASE WHEN ir.role_resolved = 'SUPPORT' THEN ir.champion_id END) AS support_id
      FROM ingest_matchs im
      INNER JOIN imp_resolved ir ON ir.match_id = im.id
      GROUP BY im.id, im.region, im.game_version, UPPER(COALESCE(NULLIF(TRIM(im.rank_tier), ''), 'UNRANKED')), ir.team_id
      HAVING
        COUNT(*) FILTER (WHERE ir.role_resolved = 'BOTTOM') = 1
        AND COUNT(*) FILTER (WHERE ir.role_resolved = 'SUPPORT') = 1
    ),
    duo_vs_duo AS (
      SELECT
        a.region,
        a.game_version,
        a.rank_tier,
        a.adc_id,
        a.support_id,
        b.adc_id AS opp_adc_id,
        b.support_id AS opp_support_id,
        a.team_win
      FROM botlane_duos a
      INNER JOIN botlane_duos b
        ON b.match_id = a.match_id
       AND b.team_id <> a.team_id
      WHERE a.rank_tier <> 'UNRANKED'
        AND a.adc_id IS NOT NULL
        AND a.support_id IS NOT NULL
        AND b.adc_id IS NOT NULL
        AND b.support_id IS NOT NULL
    )
    INSERT INTO agg_botlane_duo_vs_duo_stats (
      adc_id,
      support_id,
      opp_adc_id,
      opp_support_id,
      rank_tier,
      game_version,
      region,
      count_win,
      count_game,
      updated_at
    )
    SELECT
      adc_id,
      support_id,
      opp_adc_id,
      opp_support_id,
      rank_tier,
      game_version,
      region,
      SUM(CASE WHEN team_win THEN 1 ELSE 0 END)::int AS count_win,
      COUNT(*)::int AS count_game,
      NOW()
    FROM duo_vs_duo
    GROUP BY
      adc_id,
      support_id,
      opp_adc_id,
      opp_support_id,
      rank_tier,
      game_version,
      region
    ON CONFLICT (adc_id, support_id, opp_adc_id, opp_support_id, rank_tier, game_version, region) DO UPDATE
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
      champion_stat_id, perk_id, count_win, count_game, updated_at
    )
    SELECT
      champion_stat_id, perk_id, count_win, count_game, NOW()
    FROM flat
    WHERE perk_id > 0
    ON CONFLICT (champion_stat_id, perk_id) DO UPDATE
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
      game_version, rank_tier, role, champion_id, spell_d, spell_f, spell1_casts, spell2_casts, count_game, count_win, updated_at
    )
    SELECT
      im.game_version,
      COALESCE(NULLIF(imp.rank_tier, ''), NULLIF(im.rank_tier, ''), 'UNRANKED') AS rank_tier,
      imp.role_resolved AS role,
      imp.champion_id,
      imp.summoner_spells[1]::int AS spell_d,
      imp.summoner_spells[2]::int AS spell_f,
      SUM(COALESCE(NULLIF(imp.stats::jsonb->>'spell1Casts', '')::bigint, 0))::bigint AS spell1_casts,
      SUM(COALESCE(NULLIF(imp.stats::jsonb->>'spell2Casts', '')::bigint, 0))::bigint AS spell2_casts,
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
    ON CONFLICT (game_version, rank_tier, role, champion_id, spell_d, spell_f) DO UPDATE
    SET
      spell1_casts = EXCLUDED.spell1_casts,
      spell2_casts = EXCLUDED.spell2_casts,
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
    first_inhibitor_by_match AS (
      SELECT
        it.match_id,
        CASE
          WHEN SUM(CASE WHEN it.inhibitor_first THEN 1 ELSE 0 END) = 1
          THEN MAX(CASE WHEN it.inhibitor_first THEN it.team END)
          WHEN SUM(CASE WHEN it.inhibitor_kills > 0 THEN 1 ELSE 0 END) = 1
          THEN MAX(CASE WHEN it.inhibitor_kills > 0 THEN it.team END)
          ELSE NULL
        END AS first_inhibitor_team
      FROM ingest_teams it
      GROUP BY it.match_id
    ),
    team_source AS (
      SELECT
        it.team,
        im.rank_tier,
        im.game_version,
        SUM(CASE WHEN it.win THEN 1 ELSE 0 END)::int AS count_win,
        COUNT(*)::int AS count_game,
        SUM(CASE WHEN it.win = false AND it.team_early_surrendered THEN 1 ELSE 0 END)::int AS count_team_early_surrendered,
        SUM(CASE WHEN it.win = false AND im.game_ended_in_surrender THEN 1 ELSE 0 END)::int AS count_team_surrendered,
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
        SUM(
          CASE
            WHEN it.inhibitor_first OR fibm.first_inhibitor_team = it.team THEN 1
            ELSE 0
          END
        )::int AS count_inhibitor_first,
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
      LEFT JOIN first_inhibitor_by_match fibm ON fibm.match_id = im.id
      WHERE COALESCE(NULLIF(im.rank_tier, ''), 'UNRANKED') <> 'UNRANKED'
      GROUP BY it.team, im.rank_tier, im.game_version
    )
    INSERT INTO agg_team_core_stats (
      id, team, rank_tier, game_version, count_win, count_game,
      count_team_early_surrendered, count_team_surrendered,
      sum_baron_kills, count_baron_first, sum_dragon_kills, count_dragon_first,
      sum_tower_kills, count_tower_first, sum_horde_kills, count_horde_first,
      sum_rift_herald_kills, count_rift_herald_first, sum_inhibitor_kills, count_inhibitor_first, count_first_blood,
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
      sum_rift_herald_kills, count_rift_herald_first, sum_inhibitor_kills, count_inhibitor_first, count_first_blood,
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
      count_inhibitor_first = EXCLUDED.count_inhibitor_first,
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
    TRUNCATE TABLE agg_champion_bans_by_banner;

    WITH bans AS (
      SELECT
        it.team AS team_num,
        CASE
          WHEN ((COALESCE((be.elem->>'pickOrder')::int, (be.elem->>'pickTurn')::int, 0) - 1) % 5) + 1 = 1 THEN 'TOP'
          WHEN ((COALESCE((be.elem->>'pickOrder')::int, (be.elem->>'pickTurn')::int, 0) - 1) % 5) + 1 = 2 THEN 'JUNGLE'
          WHEN ((COALESCE((be.elem->>'pickOrder')::int, (be.elem->>'pickTurn')::int, 0) - 1) % 5) + 1 = 3 THEN 'MIDDLE'
          WHEN ((COALESCE((be.elem->>'pickOrder')::int, (be.elem->>'pickTurn')::int, 0) - 1) % 5) + 1 = 4 THEN 'BOTTOM'
          WHEN ((COALESCE((be.elem->>'pickOrder')::int, (be.elem->>'pickTurn')::int, 0) - 1) % 5) + 1 = 5 THEN 'SUPPORT'
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
        SUM(CASE WHEN UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%CLOUD%' OR UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%WIND%' OR UPPER(COALESCE(d.elem->>'drakeType', d.elem->>'drake_type', '')) LIKE '%AIR%' THEN 1 ELSE 0 END)::int AS wind_drake_count,
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
    ),
    objective_bucket_json_drake_total AS (
      SELECT
        team_stat_id,
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
          team_stat_id,
          objective_bucket,
          SUM(count_win)::int AS count_win,
          SUM(count_loss)::int AS count_loss
        FROM objective_bucket_rows
        WHERE objective_key IN ('dragon', 'elder')
        GROUP BY team_stat_id, objective_bucket
      ) x
      GROUP BY team_stat_id
    )
    UPDATE agg_team_core_stats atc
    SET
      baron_win_team = COALESCE(ob_baron.win_json, '{}'::jsonb),
      baron_loose_team = COALESCE(ob_baron.loss_json, '{}'::jsonb),
      drake_win_team = COALESCE(ob_drake_total.win_json, '{}'::jsonb),
      drake_loose_team = COALESCE(ob_drake_total.loss_json, '{}'::jsonb),
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
    LEFT JOIN objective_bucket_json_drake_total ob_drake_total
      ON ob_drake_total.team_stat_id = ob_baron.team_stat_id
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
    first_inhibitor_by_match AS (
      SELECT
        it.match_id,
        CASE
          WHEN SUM(CASE WHEN it.inhibitor_first THEN 1 ELSE 0 END) = 1
          THEN MAX(CASE WHEN it.inhibitor_first THEN it.team END)
          WHEN SUM(CASE WHEN it.inhibitor_kills > 0 THEN 1 ELSE 0 END) = 1
          THEN MAX(CASE WHEN it.inhibitor_kills > 0 THEN it.team END)
          ELSE NULL
        END AS first_inhibitor_team
      FROM ingest_teams it
      GROUP BY it.match_id
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
        SUM(CASE WHEN it.win AND (it.inhibitor_first OR fibm.first_inhibitor_team = it.team) THEN 1 ELSE 0 END)::int AS inhibitor_first_win,
        SUM(CASE WHEN NOT it.win AND (it.inhibitor_first OR fibm.first_inhibitor_team = it.team) THEN 1 ELSE 0 END)::int AS inhibitor_first_loss,
        SUM(CASE WHEN it.win AND it.tower_first THEN 1 ELSE 0 END)::int AS tower_first_win,
        SUM(CASE WHEN NOT it.win AND it.tower_first THEN 1 ELSE 0 END)::int AS tower_first_loss,
        SUM(CASE WHEN it.win AND it.first_blood THEN 1 ELSE 0 END)::int AS first_blood_win,
        SUM(CASE WHEN NOT it.win AND it.first_blood THEN 1 ELSE 0 END)::int AS first_blood_loss
      FROM ingest_teams it
      INNER JOIN ingest_matchs im ON im.id = it.match_id
      LEFT JOIN first_inhibitor_by_match fibm ON fibm.match_id = im.id
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
              OR UPPER(COALESCE(d.elem->>'drakeType', '')) LIKE '%WIND%'
              OR UPPER(COALESCE(d.elem->>'drakeType', '')) LIKE '%AIR%' THEN 'wind'
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
    UNION ALL SELECT 'agg_champion_spells_stats', COUNT(*)::bigint FROM agg_champion_spells_stats
    UNION ALL SELECT 'agg_champion_item_starter_set_stats', COUNT(*)::bigint FROM agg_champion_item_starter_set_stats
    UNION ALL SELECT 'agg_champion_item_stats', COUNT(*)::bigint FROM agg_champion_item_stats
    UNION ALL SELECT 'agg_champion_item_solo_stats', COUNT(*)::bigint FROM agg_champion_item_solo_stats
    UNION ALL SELECT 'agg_champion_runes_stats', COUNT(*)::bigint FROM agg_champion_runes_stats
    UNION ALL SELECT 'agg_champion_runes_solo_stats', COUNT(*)::bigint FROM agg_champion_runes_solo_stats
    UNION ALL SELECT 'agg_champion_shard_solo_stats', COUNT(*)::bigint FROM agg_champion_shard_solo_stats
    UNION ALL SELECT 'agg_champion_summoner_spells', COUNT(*)::bigint FROM agg_champion_summoner_spells
    UNION ALL SELECT 'agg_champion_damage_stats', COUNT(*)::bigint FROM agg_champion_damage_stats
    UNION ALL SELECT 'agg_champion_participant_stats', COUNT(*)::bigint FROM agg_champion_participant_stats
    UNION ALL SELECT 'agg_champion_duo_role_stats', COUNT(*)::bigint FROM agg_champion_duo_role_stats
    UNION ALL SELECT 'agg_botlane_duo_vs_duo_stats', COUNT(*)::bigint FROM agg_botlane_duo_vs_duo_stats
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

type RawStarterRow = {
  id: bigint
  riot_match_id: string
  payload_json: unknown
  timeline_json: unknown | null
}

type TimelineLikeItemEvent = {
  type: string
  timestamp?: number
  participantId?: number
  itemId?: number
  beforeId?: number
  afterId?: number
}

function normalizeRole(raw: unknown): string {
  const role = String(raw ?? '').trim().toUpperCase()
  if (role === 'MID') return 'MIDDLE'
  if (role === 'ADC') return 'BOTTOM'
  if (role === 'UTILITY') return 'SUPPORT'
  return role
}

function normalizeRankTier(raw: unknown): string {
  const tier = String(raw ?? 'UNRANKED').trim().toUpperCase()
  if (!tier) return 'UNRANKED'
  return tier.split('_')[0] || 'UNRANKED'
}

function normalizeGameVersion(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s) return 'unknown'
  const [major, minor] = s.split('.')
  if (!major || !minor) return s
  return `${major}.${minor}`
}

function extractTimelineItemEventsFromRaw(timelineRaw: unknown): TimelineLikeItemEvent[] {
  const timeline = timelineRaw as
    | {
        info?: {
          frames?: Array<{ events?: Array<Record<string, unknown>> }>
        }
      }
    | null
  const frames = timeline?.info?.frames
  if (!Array.isArray(frames)) return []
  const out: TimelineLikeItemEvent[] = []
  for (const frame of frames) {
    for (const ev of frame.events ?? []) {
      out.push({
        type: String(ev?.type ?? ''),
        timestamp: typeof ev?.timestamp === 'number' ? ev.timestamp : Number(ev?.timestamp ?? 0),
        participantId: typeof ev?.participantId === 'number' ? ev.participantId : Number(ev?.participantId ?? 0),
        itemId: typeof ev?.itemId === 'number' ? ev.itemId : Number(ev?.itemId ?? 0),
        beforeId: typeof ev?.beforeId === 'number' ? ev.beforeId : Number(ev?.beforeId ?? 0),
        afterId: typeof ev?.afterId === 'number' ? ev.afterId : Number(ev?.afterId ?? 0),
      })
    }
  }
  return out
}

export async function backfillItemStarterSetsFromRaw(): Promise<void> {
  console.log('[backfill-agg] rebuilding agg_champion_item_starter_set_stats from match_ingest_raw')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE agg_champion_item_starter_set_stats`)
  const batchSize = Math.max(100, Math.min(2000, Number(process.env.BACKFILL_AGG_STARTER_BATCH_SIZE ?? 500)))
  let lastId = 0n
  let scanned = 0
  const acc = new Map<string, { gameVersion: string; rankTier: string; role: string; championId: number; starterKey: string; games: number; wins: number }>()

  while (true) {
    const rows = await prisma.$queryRaw<RawStarterRow[]>`
      SELECT id, riot_match_id, payload_json, timeline_json
      FROM match_ingest_raw
      WHERE payload_json IS NOT NULL
        AND id > ${lastId}
      ORDER BY id ASC
      LIMIT ${batchSize}
    `
    if (rows.length === 0) break
    lastId = rows[rows.length - 1]!.id
    for (const row of rows) {
      scanned++
      const payload = row.payload_json as { info?: { participants?: Array<Record<string, unknown>>; gameVersion?: string } }
      const participants = payload?.info?.participants
      if (!Array.isArray(participants) || participants.length === 0) continue
    const puuids = participants
      .map((p) => String(p?.puuid ?? '').trim())
      .filter((v) => v.length > 0)
    const playerRanks = puuids.length
      ? await prisma.player.findMany({
          where: { puuid: { in: puuids } },
          select: { puuid: true, rankTier: true },
        })
      : []
    const rankByPuuid = new Map(
      playerRanks.map((r) => [String(r.puuid), normalizeRankTier(r.rankTier)])
    )
      const timelineEvents = extractTimelineItemEventsFromRaw(row.timeline_json)
      const gameVersion = normalizeGameVersion(payload?.info?.gameVersion)
      for (const p of participants) {
        const participantId = Number(p?.participantId ?? 0)
        if (!Number.isFinite(participantId) || participantId <= 0) continue
        const role = normalizeRole((p?.teamPosition as unknown) ?? (p?.individualPosition as unknown))
        if (!['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT'].includes(role)) continue
        const puuid = String(p?.puuid ?? '').trim()
        const rankTier = normalizeRankTier(
          (p?.tier as unknown) ?? (p?.rankTier as unknown) ?? rankByPuuid.get(puuid) ?? null
        )
        if (rankTier === 'UNRANKED') continue
        const championId = Number(p?.championId ?? 0)
        if (!Number.isFinite(championId) || championId <= 0) continue
        const win = p?.win === true ? 1 : 0
        const selected = await selectMatchPlayerItems({
          participant: p,
          participantId,
          events: timelineEvents,
        })
        const starterItems = selected
          .filter((it) => it.starter === true)
          .map((it) => Number(it.itemId))
          .filter((id) =>
            Number.isFinite(id) &&
            id > 0 &&
            ![3340, 3364, 3363, 2055, 2003, 2009, 2010, 2031, 2032, 2033, 2060, 2138, 2139, 2140].includes(id)
          )
        if (starterItems.length === 0) continue
        const starterKey = `[${starterItems.join(',')}]`
        const key = `${gameVersion}|${rankTier}|${role}|${championId}|${starterKey}`
        const prev = acc.get(key)
        if (prev) {
          prev.games += 1
          prev.wins += win
        } else {
          acc.set(key, {
            gameVersion,
            rankTier,
            role,
            championId,
            starterKey,
            games: 1,
            wins: win,
          })
        }
      }
      if (scanned % 500 === 0) {
        console.log(`[backfill-agg] starter_set scanned raw rows: ${scanned}`)
      }
    }
  }

  const values = Array.from(acc.values())
  for (const row of values) {
    await prisma.$executeRaw`
      INSERT INTO agg_champion_item_starter_set_stats (
        game_version, rank_tier, role_norm, champion_id, starter_key, count_game, count_win, updated_at
      )
      VALUES (
        ${row.gameVersion}, ${row.rankTier}, ${row.role}, ${row.championId}, ${row.starterKey}, ${row.games}, ${row.wins}, NOW()
      )
      ON CONFLICT (game_version, rank_tier, role_norm, champion_id, starter_key) DO UPDATE
      SET
        count_game = EXCLUDED.count_game,
        count_win = EXCLUDED.count_win,
        updated_at = NOW()
    `
  }
  console.log(`[backfill-agg] starter_set rebuild done: ${values.length} keys`)
}

export async function backfillObjectiveOutcomeFromAgg(): Promise<void> {
  console.log('[backfill-agg] rebuilding agg_objective_outcome_stats from agg_team_bucket/team_core')
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
        COALESCE(jsonb_object_agg(objective_bucket::text, count_win ORDER BY objective_bucket) FILTER (WHERE count_win > 0), '{}'::jsonb) AS win_json,
        COALESCE(jsonb_object_agg(objective_bucket::text, count_loss ORDER BY objective_bucket) FILTER (WHERE count_loss > 0), '{}'::jsonb) AS loss_json
      FROM objective_bucket_rows
      GROUP BY game_version, rank_tier, objective_key
    ),
    objective_bucket_json_drake_total AS (
      SELECT
        game_version,
        rank_tier,
        COALESCE(jsonb_object_agg(objective_bucket::text, count_win ORDER BY objective_bucket) FILTER (WHERE count_win > 0), '{}'::jsonb) AS win_json,
        COALESCE(jsonb_object_agg(objective_bucket::text, count_loss ORDER BY objective_bucket) FILTER (WHERE count_loss > 0), '{}'::jsonb) AS loss_json
      FROM (
        SELECT game_version, rank_tier, objective_bucket, SUM(count_win)::int AS count_win, SUM(count_loss)::int AS count_loss
        FROM objective_bucket_rows
        WHERE objective_key IN ('dragon', 'elder')
        GROUP BY game_version, rank_tier, objective_bucket
      ) x
      GROUP BY game_version, rank_tier
    )
    SELECT
      d.game_version,
      d.rank_tier,
      COALESCE(ob_baron.win_json, '{}'::jsonb),
      COALESCE(ob_baron.loss_json, '{}'::jsonb),
      COALESCE(ob_drake_total.win_json, '{}'::jsonb),
      COALESCE(ob_drake_total.loss_json, '{}'::jsonb),
      COALESCE(ob_horde.win_json, '{}'::jsonb),
      COALESCE(ob_horde.loss_json, '{}'::jsonb),
      COALESCE(ob_herald.win_json, '{}'::jsonb),
      COALESCE(ob_herald.loss_json, '{}'::jsonb),
      COALESCE(ob_inhibitor.win_json, '{}'::jsonb),
      COALESCE(ob_inhibitor.loss_json, '{}'::jsonb),
      COALESCE(ob_tower.win_json, '{}'::jsonb),
      COALESCE(ob_tower.loss_json, '{}'::jsonb),
      COALESCE(ob_first_blood.win_json, '{}'::jsonb),
      COALESCE(ob_first_blood.loss_json, '{}'::jsonb),
      COALESCE(ob_elder.win_json, '{}'::jsonb),
      COALESCE(ob_elder.loss_json, '{}'::jsonb),
      COALESCE(ob_earth.win_json, '{}'::jsonb),
      COALESCE(ob_earth.loss_json, '{}'::jsonb),
      COALESCE(ob_water.win_json, '{}'::jsonb),
      COALESCE(ob_water.loss_json, '{}'::jsonb),
      COALESCE(ob_wind.win_json, '{}'::jsonb),
      COALESCE(ob_wind.loss_json, '{}'::jsonb),
      COALESCE(ob_fire.win_json, '{}'::jsonb),
      COALESCE(ob_fire.loss_json, '{}'::jsonb),
      COALESCE(ob_hextec.win_json, '{}'::jsonb),
      COALESCE(ob_hextec.loss_json, '{}'::jsonb),
      COALESCE(ob_chem.win_json, '{}'::jsonb),
      COALESCE(ob_chem.loss_json, '{}'::jsonb),
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
    LEFT JOIN objective_bucket_json ob_baron ON ob_baron.game_version = d.game_version AND ob_baron.rank_tier = d.rank_tier AND ob_baron.objective_key = 'baron'
    LEFT JOIN objective_bucket_json_drake_total ob_drake_total ON ob_drake_total.game_version = d.game_version AND ob_drake_total.rank_tier = d.rank_tier
    LEFT JOIN objective_bucket_json ob_horde ON ob_horde.game_version = d.game_version AND ob_horde.rank_tier = d.rank_tier AND ob_horde.objective_key = 'horde'
    LEFT JOIN objective_bucket_json ob_herald ON ob_herald.game_version = d.game_version AND ob_herald.rank_tier = d.rank_tier AND ob_herald.objective_key = 'riftHerald'
    LEFT JOIN objective_bucket_json ob_inhibitor ON ob_inhibitor.game_version = d.game_version AND ob_inhibitor.rank_tier = d.rank_tier AND ob_inhibitor.objective_key = 'inhibitor'
    LEFT JOIN objective_bucket_json ob_tower ON ob_tower.game_version = d.game_version AND ob_tower.rank_tier = d.rank_tier AND ob_tower.objective_key = 'tower'
    LEFT JOIN objective_bucket_json ob_first_blood ON ob_first_blood.game_version = d.game_version AND ob_first_blood.rank_tier = d.rank_tier AND ob_first_blood.objective_key = 'first_blood'
    LEFT JOIN objective_bucket_json ob_elder ON ob_elder.game_version = d.game_version AND ob_elder.rank_tier = d.rank_tier AND ob_elder.objective_key = 'elder'
    LEFT JOIN objective_bucket_json ob_earth ON ob_earth.game_version = d.game_version AND ob_earth.rank_tier = d.rank_tier AND ob_earth.objective_key = 'earth_drake'
    LEFT JOIN objective_bucket_json ob_water ON ob_water.game_version = d.game_version AND ob_water.rank_tier = d.rank_tier AND ob_water.objective_key = 'water_drake'
    LEFT JOIN objective_bucket_json ob_wind ON ob_wind.game_version = d.game_version AND ob_wind.rank_tier = d.rank_tier AND ob_wind.objective_key = 'wind_drake'
    LEFT JOIN objective_bucket_json ob_fire ON ob_fire.game_version = d.game_version AND ob_fire.rank_tier = d.rank_tier AND ob_fire.objective_key = 'fire_drake'
    LEFT JOIN objective_bucket_json ob_hextec ON ob_hextec.game_version = d.game_version AND ob_hextec.rank_tier = d.rank_tier AND ob_hextec.objective_key = 'hextec_drake'
    LEFT JOIN objective_bucket_json ob_chem ON ob_chem.game_version = d.game_version AND ob_chem.rank_tier = d.rank_tier AND ob_chem.objective_key = 'chem_drake'
    LEFT JOIN objective_bucket_json ob_earth_soul ON ob_earth_soul.game_version = d.game_version AND ob_earth_soul.rank_tier = d.rank_tier AND ob_earth_soul.objective_key = 'earth_soul'
    LEFT JOIN objective_bucket_json ob_water_soul ON ob_water_soul.game_version = d.game_version AND ob_water_soul.rank_tier = d.rank_tier AND ob_water_soul.objective_key = 'water_soul'
    LEFT JOIN objective_bucket_json ob_wind_soul ON ob_wind_soul.game_version = d.game_version AND ob_wind_soul.rank_tier = d.rank_tier AND ob_wind_soul.objective_key = 'wind_soul'
    LEFT JOIN objective_bucket_json ob_fire_soul ON ob_fire_soul.game_version = d.game_version AND ob_fire_soul.rank_tier = d.rank_tier AND ob_fire_soul.objective_key = 'fire_soul'
    LEFT JOIN objective_bucket_json ob_hextec_soul ON ob_hextec_soul.game_version = d.game_version AND ob_hextec_soul.rank_tier = d.rank_tier AND ob_hextec_soul.objective_key = 'hextec_soul'
    LEFT JOIN objective_bucket_json ob_chem_soul ON ob_chem_soul.game_version = d.game_version AND ob_chem_soul.rank_tier = d.rank_tier AND ob_chem_soul.objective_key = 'chem_soul'
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
}

async function main(): Promise<void> {
  await createBackfillLockFile()
  const pollerWasPaused = shouldPausePoller()
  const maxAttemptsRaw = Number.parseInt(process.env.BACKFILL_AGG_MAX_RETRIES ?? '', 10)
  const maxAttempts = Number.isFinite(maxAttemptsRaw) && maxAttemptsRaw > 0 ? Math.min(maxAttemptsRaw, 10) : 6
  try {
    if (pollerWasPaused) {
      console.log('[backfill-agg] pausing poller (pm2 stop lelanation-poller)')
      await runPm2Command(['stop', 'lelanation-poller']).catch((err) => {
        console.warn(
          `[backfill-agg] unable to stop poller automatically: ${
            err instanceof Error ? err.message : String(err)
          }`
        )
      })
    }
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
    if (pollerWasPaused) {
      console.log('[backfill-agg] resuming poller (pm2 start lelanation-poller)')
      await runPm2Command(['start', 'lelanation-poller']).catch((err) => {
        console.warn(
          `[backfill-agg] unable to restart poller automatically: ${
            err instanceof Error ? err.message : String(err)
          }`
        )
      })
    }
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
