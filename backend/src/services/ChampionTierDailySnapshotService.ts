/**
 * Daily UTC snapshots of champion stats per rank tier and role.
 * One row per (snapshot_for_date, rank_tier, role, champion): games, wins, WR, bans, pick rate.
 * Window: previous UTC calendar day [D 00:00, D+1 00:00), keyed by game_date on matchs.
 */
import { prisma, isDatabaseConfigured } from '../db.js'
import { createRiotPollerLogger } from '../utils/riotPollerLogger.js'
import { refreshAllMaterializedViews } from './MaterializedViewService.js'

type Logger = ReturnType<typeof createRiotPollerLogger>
let lastActiveRefreshAtMs = 0

function parseUtcSchedule(): { hour: number; minute: number } {
  const hour = Math.min(23, Math.max(0, parseInt(process.env.CHAMPION_TIER_SNAPSHOT_UTC_HOUR ?? '0', 10) || 0))
  const minute = Math.min(59, Math.max(0, parseInt(process.env.CHAMPION_TIER_SNAPSHOT_UTC_MINUTE ?? '0', 10) || 0))
  return { hour, minute }
}

/** UTC calendar day window immediately before "today" 00:00 UTC (the day we summarize). */
export function getPreviousUtcCalendarDayWindow(now: Date = new Date()): {
  windowStart: Date
  windowEnd: Date
  snapshotForDate: Date
} {
  const y = now.getUTCFullYear()
  const mon = now.getUTCMonth()
  const d = now.getUTCDate()
  const windowEnd = new Date(Date.UTC(y, mon, d, 0, 0, 0, 0))
  const windowStart = new Date(Date.UTC(y, mon, d - 1, 0, 0, 0, 0))
  const snapshotForDate = new Date(Date.UTC(y, mon, d - 1, 0, 0, 0, 0))
  return { windowStart, windowEnd, snapshotForDate }
}

/**
 * Insert snapshot rows for the given UTC window. Idempotent (ON CONFLICT DO NOTHING).
 */
export async function runChampionTierSnapshotForWindow(params: {
  windowStart: Date
  windowEnd: Date
  snapshotForDate: Date
  logger?: Logger
}): Promise<{ insertedEstimate: number }> {
  if (!isDatabaseConfigured()) return { insertedEstimate: 0 }

  const { windowStart, windowEnd, snapshotForDate, logger } = params
  const result = await prisma.$executeRaw`
    WITH window_params AS (
      SELECT ${windowStart}::timestamptz AS w_start,
             ${windowEnd}::timestamptz AS w_end,
             ${snapshotForDate}::date AS snap_date
    ),
    picks AS (
      SELECT
        split_part(UPPER(TRIM(COALESCE(NULLIF(TRIM(mp.rank_tier), ''), m.rank_tier, 'UNRANKED'))), '_', 1) AS rank_tier_norm,
        UPPER(TRIM(COALESCE(NULLIF(TRIM(mp.role), ''), 'UNKNOWN'))) AS role_norm,
        mp.champion_id,
        COUNT(*)::int AS games,
        SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS wins
      FROM match_players mp
      INNER JOIN matchs m ON m.id = mp.match_id
      INNER JOIN teams t ON t.id = mp.team_id
      CROSS JOIN window_params wp
      WHERE m.game_date >= wp.w_start
        AND m.game_date < wp.w_end
      GROUP BY 1, 2, 3
    ),
    bans AS (
      SELECT
        split_part(UPPER(TRIM(COALESCE(m.rank_tier, 'UNRANKED'))), '_', 1) AS rank_tier_norm,
        b.champion_id,
        COUNT(*)::int AS ban_count
      FROM bans b
      INNER JOIN matchs m ON m.id = b.match_id
      CROSS JOIN window_params wp
      WHERE m.game_date >= wp.w_start
        AND m.game_date < wp.w_end
      GROUP BY 1, 2
    ),
    merged AS (
      SELECT
        p.rank_tier_norm AS rank_tier,
        p.role_norm AS role,
        p.champion_id AS champion_id,
        p.games AS games,
        p.wins AS wins,
        COALESCE(b.ban_count, 0) AS bans
      FROM picks p
      LEFT JOIN bans b
        ON p.rank_tier_norm = b.rank_tier_norm AND p.champion_id = b.champion_id
    ),
    tier_totals AS (
      SELECT rank_tier, role, SUM(games)::bigint AS total_picks
      FROM merged
      GROUP BY rank_tier, role
    )
    INSERT INTO champion_tier_daily_snapshots (
      snapshot_for_date, window_start, window_end, rank_tier, role, champion_id,
      games, wins, bans, pick_rate_pct, win_rate_pct, created_at
    )
    SELECT
      wp.snap_date,
      wp.w_start,
      wp.w_end,
      m.rank_tier,
      m.role,
      m.champion_id,
      m.games,
      m.wins,
      m.bans,
      CASE WHEN tt.total_picks > 0
        THEN ROUND((100.0 * m.games::float8 / tt.total_picks::float8)::numeric, 4)::float8
        ELSE 0::float8
      END,
      CASE WHEN m.games > 0
        THEN ROUND((100.0 * m.wins::float8 / m.games::float8)::numeric, 4)::float8
        ELSE 0::float8
      END,
      NOW()
    FROM merged m
    INNER JOIN tier_totals tt ON tt.rank_tier = m.rank_tier AND tt.role = m.role
    CROSS JOIN window_params wp
    ON CONFLICT (snapshot_for_date, rank_tier, role, champion_id) DO UPDATE
    SET
      window_start = EXCLUDED.window_start,
      window_end = EXCLUDED.window_end,
      games = EXCLUDED.games,
      wins = EXCLUDED.wins,
      bans = EXCLUDED.bans,
      pick_rate_pct = EXCLUDED.pick_rate_pct,
      win_rate_pct = EXCLUDED.win_rate_pct,
      created_at = NOW()
  `

  const insertedEstimate = typeof result === 'number' ? result : 0
  if (logger && insertedEstimate > 0) {
    void logger.step('Champion tier daily snapshot', {
      snapshotForDate: snapshotForDate.toISOString().slice(0, 10),
      rowsTouched: insertedEstimate,
    })
  }
  return { insertedEstimate }
}

function getUtcDateWindowForDay(snapshotForDate: Date): { windowStart: Date; windowEnd: Date } {
  const y = snapshotForDate.getUTCFullYear()
  const mon = snapshotForDate.getUTCMonth()
  const d = snapshotForDate.getUTCDate()
  const windowStart = new Date(Date.UTC(y, mon, d, 0, 0, 0, 0))
  const windowEnd = new Date(Date.UTC(y, mon, d + 1, 0, 0, 0, 0))
  return { windowStart, windowEnd }
}

async function getActiveSnapshotDates(): Promise<Date[]> {
  const limit = Math.max(1, Number.parseInt(process.env.CHAMPION_TIER_SNAPSHOT_ACTIVE_DAYS_LIMIT ?? '60', 10) || 60)
  const dates = await prisma.$queryRaw<Array<{ d: Date }>>`
    SELECT DISTINCT (m.game_date AT TIME ZONE 'UTC')::date AS d
    FROM matchs m
    JOIN active_patches ap
      ON ap.game_version = (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2))
    WHERE m.game_date IS NOT NULL
    ORDER BY d DESC
    LIMIT ${limit}
  `
  return dates.map((r) => new Date(`${r.d.toISOString().slice(0, 10)}T00:00:00.000Z`))
}

async function archiveSnapshotsForCompletedPatches(logger?: Logger): Promise<void> {
  // Archive daily snapshots whose date belongs to a completed patch.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS champion_tier_daily_snapshots_archive
    (LIKE champion_tier_daily_snapshots INCLUDING ALL)
  `)
  await prisma.$executeRawUnsafe(`
    ALTER TABLE champion_tier_daily_snapshots_archive
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'ALL'
  `)
  await prisma.$executeRawUnsafe(`
    DROP INDEX IF EXISTS champion_tier_daily_snapshots_archive_snapshot_for_date_rank_tier_champion_id_key
  `)
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS champion_tier_daily_snapshots_archive_snapshot_for_date_rank_tier_role_champion_id_key
    ON champion_tier_daily_snapshots_archive (snapshot_for_date, rank_tier, role, champion_id)
  `)
  const rows = await prisma.$queryRaw<Array<{ d: Date }>>`
    SELECT DISTINCT c.snapshot_for_date::date AS d
    FROM champion_tier_daily_snapshots c
    JOIN matchs m
      ON m.game_date >= c.snapshot_for_date
     AND m.game_date < (c.snapshot_for_date + INTERVAL '1 day')
    JOIN active_patches ap
      ON ap.game_version = (split_part(m.game_version, '.', 1) || '.' || split_part(m.game_version, '.', 2))
    WHERE ap.game_number_max > 0
      AND ap.games_number >= ap.game_number_max
  `
  if (rows.length === 0) return
  for (const r of rows) {
    const date = r.d
    await prisma.$executeRaw`
      INSERT INTO champion_tier_daily_snapshots_archive
      SELECT *
      FROM champion_tier_daily_snapshots
      WHERE snapshot_for_date = ${date}::date
      ON CONFLICT DO NOTHING
    `
    await prisma.$executeRaw`
      DELETE FROM champion_tier_daily_snapshots
      WHERE snapshot_for_date = ${date}::date
    `
  }
  if (logger) void logger.step('Champion tier snapshot archive completed', { daysArchived: rows.length })
}

/**
 * Regularly refresh daily champion-tier snapshots for dates that still belong to active patches.
 * Old dates become naturally frozen once their patch is closed/removed from active_patches.
 */
export async function tryRunChampionTierDailySnapshot(logger?: Logger): Promise<void> {
  if (!isDatabaseConfigured()) return
  if (process.env.CHAMPION_TIER_SNAPSHOT_DISABLED === '1') return

  const now = new Date()
  const refreshMinutes = Math.max(
    1,
    Number.parseInt(process.env.CHAMPION_TIER_SNAPSHOT_REFRESH_MINUTES ?? '30', 10) || 30,
  )
  if (lastActiveRefreshAtMs > 0 && now.getTime() - lastActiveRefreshAtMs < refreshMinutes * 60_000) return

  const { hour, minute } = parseUtcSchedule()
  const utcH = now.getUTCHours()
  const utcM = now.getUTCMinutes()
  const pastSlot = utcH > hour || (utcH === hour && utcM >= minute)
  if (!pastSlot) return

  try {
    const snapshotDates = await getActiveSnapshotDates()
    if (snapshotDates.length === 0) return
    let totalRowsTouched = 0
    for (const snapshotForDate of snapshotDates) {
      const { windowStart, windowEnd } = getUtcDateWindowForDay(snapshotForDate)
      const { insertedEstimate } = await runChampionTierSnapshotForWindow({
        windowStart,
        windowEnd,
        snapshotForDate,
        logger,
      })
      totalRowsTouched += insertedEstimate
      await prisma.championTierSnapshotRun.upsert({
        where: { snapshotForDate },
        create: { snapshotForDate, rowsInserted: insertedEstimate },
        update: { rowsInserted: insertedEstimate },
      })
    }

    await refreshAllMaterializedViews().catch(() => undefined)
    await archiveSnapshotsForCompletedPatches(logger)
    lastActiveRefreshAtMs = Date.now()
    if (logger) {
      void logger.step('Champion tier snapshots refreshed for active patch dates', {
        days: snapshotDates.length,
        rowsTouched: totalRowsTouched,
      })
    }
  } catch (err) {
    if (logger) void logger.alerte('Champion tier daily snapshot failed', { error: String(err) })
  }
}

export interface ChampionTierSnapshotRow {
  snapshotForDate: string
  rankTier: string
  role: string
  championId: number
  games: number
  wins: number
  bans: number
  pickRatePct: number
  winRatePct: number
}

/** For charts: time series for one champion, optional tier filter. Dates as YYYY-MM-DD. */
export async function getChampionTierSnapshotsForCharts(options: {
  championId: number
  rankTier?: string | null
  role?: string | null
  fromDate?: string | null
  toDate?: string | null
  limit?: number
}): Promise<ChampionTierSnapshotRow[]> {
  if (!isDatabaseConfigured()) return []
  const { championId, rankTier, role, fromDate, toDate, limit = 365 } = options
  const rows = await prisma.$queryRaw<Array<{
    snapshot_for_date: Date
    rank_tier: string
    role: string
    champion_id: number
    games: number
    wins: number
    bans: number
    pick_rate_pct: number
    win_rate_pct: number
  }>>`
    SELECT
      snapshot_for_date,
      rank_tier,
      role,
      champion_id,
      games,
      wins,
      bans,
      pick_rate_pct,
      win_rate_pct
    FROM champion_tier_daily_snapshots
    WHERE champion_id = ${championId}
      AND (${rankTier ? rankTier.toUpperCase().split('_')[0] : null}::text IS NULL OR rank_tier = ${rankTier ? rankTier.toUpperCase().split('_')[0] : null}::text)
      AND (${role ? role.toUpperCase() : null}::text IS NULL OR role = ${role ? role.toUpperCase() : null}::text)
      AND (${fromDate ? new Date(`${fromDate}T00:00:00.000Z`) : null}::timestamptz IS NULL OR snapshot_for_date >= ${fromDate ? new Date(`${fromDate}T00:00:00.000Z`) : null}::timestamptz)
      AND (${toDate ? new Date(`${toDate}T23:59:59.999Z`) : null}::timestamptz IS NULL OR snapshot_for_date <= ${toDate ? new Date(`${toDate}T23:59:59.999Z`) : null}::timestamptz)
    ORDER BY snapshot_for_date DESC
    LIMIT ${limit}
  `

  const chronological = [...rows].reverse()

  return chronological.map((r) => ({
    snapshotForDate: r.snapshot_for_date.toISOString().slice(0, 10),
    rankTier: r.rank_tier,
    role: r.role,
    championId: r.champion_id,
    games: r.games,
    wins: r.wins,
    bans: r.bans,
    pickRatePct: r.pick_rate_pct,
    winRatePct: r.win_rate_pct,
  }))
}
