/**
 * Daily UTC snapshots of champion stats per rank tier and role.
 * One row per (date_of_game, rank_tier, role, champion): games, wins, ban_rate_pct, pick_rate_pct.
 * Winrate = wins/games côté consommateur (non persisté).
 *
 * Taux **par tier** (pas globaux à toute la base sur la fenêtre) :
 * - pick_rate_pct : part des *picks* (slots joueurs) du **même rank_tier + role** ce jour UTC que ce champion.
 * - ban_rate_pct : part des *bans* (slots ban) du **même rank_tier** (match) ce jour UTC pour ce champion.
 *
 * Window: calendar UTC day [D 00:00, D+1 00:00), keyed by matchs.game_date.
 */
import { prisma, isDatabaseConfigured } from '../db.js'
import { createRiotPollerLogger } from '../utils/riotPollerLogger.js'
import { refreshAllMaterializedViews } from './MaterializedViewService.js'

type Logger = ReturnType<typeof createRiotPollerLogger>
let lastActiveRefreshAtMs = 0
const SNAPSHOT_ALLOWED_ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'SUPPORT', 'BOTTOM'] as const

function parseUtcSchedule(): { hour: number; minute: number } {
  const hour = Math.min(23, Math.max(0, parseInt(process.env.CHAMPION_TIER_SNAPSHOT_UTC_HOUR ?? '0', 10) || 0))
  const minute = Math.min(59, Math.max(0, parseInt(process.env.CHAMPION_TIER_SNAPSHOT_UTC_MINUTE ?? '0', 10) || 0))
  return { hour, minute }
}

/** UTC calendar day window immediately before "today" 00:00 UTC (the day we summarize). */
export function getPreviousUtcCalendarDayWindow(now: Date = new Date()): {
  windowStart: Date
  windowEnd: Date
  dateOfGame: Date
} {
  const y = now.getUTCFullYear()
  const mon = now.getUTCMonth()
  const d = now.getUTCDate()
  const windowEnd = new Date(Date.UTC(y, mon, d, 0, 0, 0, 0))
  const windowStart = new Date(Date.UTC(y, mon, d - 1, 0, 0, 0, 0))
  const dateOfGame = new Date(Date.UTC(y, mon, d - 1, 0, 0, 0, 0))
  return { windowStart, windowEnd, dateOfGame }
}

/**
 * Insert snapshot rows for the given UTC window. Idempotent (ON CONFLICT DO NOTHING).
 */
export async function runChampionTierSnapshotForWindow(params: {
  windowStart: Date
  windowEnd: Date
  dateOfGame: Date
  logger?: Logger
}): Promise<{ insertedEstimate: number }> {
  if (!isDatabaseConfigured()) return { insertedEstimate: 0 }

  const { windowStart, windowEnd, dateOfGame, logger } = params
  const result = await prisma.$executeRaw`
    WITH window_params AS (
      SELECT ${windowStart}::timestamptz AS w_start,
             ${windowEnd}::timestamptz AS w_end,
             ${dateOfGame}::date AS game_date
    ),
    picks AS (
      SELECT
        split_part(UPPER(TRIM(COALESCE(NULLIF(TRIM(mp.rank_tier), ''), m.rank_tier, 'UNRANKED'))), '_', 1) AS rank_tier_norm,
        CASE
          WHEN UPPER(TRIM(COALESCE(NULLIF(TRIM(mp.role), ''), 'UNKNOWN'))) = 'MID' THEN 'MIDDLE'
          WHEN UPPER(TRIM(COALESCE(NULLIF(TRIM(mp.role), ''), 'UNKNOWN'))) = 'ADC' THEN 'BOTTOM'
          WHEN UPPER(TRIM(COALESCE(NULLIF(TRIM(mp.role), ''), 'UNKNOWN'))) IN ('SUPPORT', 'UTILITY') THEN 'SUPPORT'
          ELSE UPPER(TRIM(COALESCE(NULLIF(TRIM(mp.role), ''), 'UNKNOWN')))
        END AS role_norm,
        mp.champion_id,
        COUNT(*)::int AS games,
        SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS wins
      FROM match_players mp
      INNER JOIN matchs m ON m.id = mp.match_id
      INNER JOIN teams t ON t.id = mp.team_id
      CROSS JOIN window_params wp
      WHERE m.game_date >= wp.w_start
        AND m.game_date < wp.w_end
        AND (
          CASE
            WHEN UPPER(TRIM(COALESCE(NULLIF(TRIM(mp.role), ''), 'UNKNOWN'))) = 'MID' THEN 'MIDDLE'
            WHEN UPPER(TRIM(COALESCE(NULLIF(TRIM(mp.role), ''), 'UNKNOWN'))) = 'ADC' THEN 'BOTTOM'
            WHEN UPPER(TRIM(COALESCE(NULLIF(TRIM(mp.role), ''), 'UNKNOWN'))) IN ('SUPPORT', 'UTILITY') THEN 'SUPPORT'
            ELSE UPPER(TRIM(COALESCE(NULLIF(TRIM(mp.role), ''), 'UNKNOWN')))
          END
        ) IN ('TOP', 'JUNGLE', 'MIDDLE', 'SUPPORT', 'BOTTOM')
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
    ),
    tier_ban_totals AS (
      SELECT rank_tier, SUM(bans)::bigint AS total_bans
      FROM merged
      GROUP BY rank_tier
    )
    INSERT INTO champion_tier_daily_snapshots (
      date_of_game, rank_tier, role, champion_id,
      games, wins, ban_rate_pct, pick_rate_pct
    )
    SELECT
      wp.game_date,
      m.rank_tier,
      m.role,
      m.champion_id,
      m.games,
      m.wins,
      CASE WHEN tbt.total_bans > 0
        THEN ROUND((100.0 * m.bans::float8 / tbt.total_bans::float8)::numeric, 3)::float8
        ELSE 0::float8
      END,
      CASE WHEN tt.total_picks > 0
        THEN ROUND((100.0 * m.games::float8 / tt.total_picks::float8)::numeric, 3)::float8
        ELSE 0::float8
      END
    FROM merged m
    INNER JOIN tier_totals tt ON tt.rank_tier = m.rank_tier AND tt.role = m.role
    INNER JOIN tier_ban_totals tbt ON tbt.rank_tier = m.rank_tier
    CROSS JOIN window_params wp
    ON CONFLICT (date_of_game, rank_tier, role, champion_id) DO UPDATE
    SET
      games = EXCLUDED.games,
      wins = EXCLUDED.wins,
      ban_rate_pct = EXCLUDED.ban_rate_pct,
      pick_rate_pct = EXCLUDED.pick_rate_pct
  `

  const insertedEstimate = typeof result === 'number' ? result : 0
  if (logger && insertedEstimate > 0) {
    void logger.step('Champion tier daily snapshot', {
      dateOfGame: dateOfGame.toISOString().slice(0, 10),
      rowsTouched: insertedEstimate,
    })
  }
  return { insertedEstimate }
}

async function cleanupInvalidSnapshotRoles(logger?: Logger): Promise<void> {
  const deletedActive = await prisma.$executeRaw`
    DELETE FROM champion_tier_daily_snapshots
    WHERE role NOT IN ('TOP', 'JUNGLE', 'MIDDLE', 'SUPPORT', 'BOTTOM')
  `
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS champion_tier_daily_snapshots_archive
    (LIKE champion_tier_daily_snapshots INCLUDING ALL)
  `)
  const deletedArchive = await prisma.$executeRaw`
    DELETE FROM champion_tier_daily_snapshots_archive
    WHERE role NOT IN ('TOP', 'JUNGLE', 'MIDDLE', 'SUPPORT', 'BOTTOM')
  `
  if (logger && (deletedActive > 0 || deletedArchive > 0)) {
    void logger.step('Champion tier snapshot role cleanup', {
      deletedActiveRows: deletedActive,
      deletedArchiveRows: deletedArchive,
      allowedRoles: SNAPSHOT_ALLOWED_ROLES.join(','),
    })
  }
}

function getUtcDateWindowForDay(dateOfGame: Date): { windowStart: Date; windowEnd: Date } {
  const y = dateOfGame.getUTCFullYear()
  const mon = dateOfGame.getUTCMonth()
  const d = dateOfGame.getUTCDate()
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
    CREATE UNIQUE INDEX IF NOT EXISTS champion_tier_daily_snapshots_archive_date_of_game_rank_tier_role_champion_id_key
    ON champion_tier_daily_snapshots_archive (date_of_game, rank_tier, role, champion_id)
  `)
  const rows = await prisma.$queryRaw<Array<{ d: Date }>>`
    SELECT DISTINCT c.date_of_game::date AS d
    FROM champion_tier_daily_snapshots c
    JOIN matchs m
      ON m.game_date >= c.date_of_game
     AND m.game_date < (c.date_of_game + INTERVAL '1 day')
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
      WHERE date_of_game = ${date}::date
      ON CONFLICT DO NOTHING
    `
    await prisma.$executeRaw`
      DELETE FROM champion_tier_daily_snapshots
      WHERE date_of_game = ${date}::date
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
    await cleanupInvalidSnapshotRoles(logger)
    const snapshotDates = await getActiveSnapshotDates()
    if (snapshotDates.length === 0) return
    let totalRowsTouched = 0
    for (const dateOfGame of snapshotDates) {
      const { windowStart, windowEnd } = getUtcDateWindowForDay(dateOfGame)
      const { insertedEstimate } = await runChampionTierSnapshotForWindow({
        windowStart,
        windowEnd,
        dateOfGame,
        logger,
      })
      totalRowsTouched += insertedEstimate
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
  dateOfGame: string
  rankTier: string
  role: string
  championId: number
  games: number
  wins: number
  banRatePct: number
  pickRatePct: number
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
  const { championId, rankTier, fromDate, toDate, limit = 365 } = options
  let role = options.role
  if (role && role.toUpperCase() === 'UTILITY') role = 'SUPPORT'

  const rows = await prisma.$queryRaw<Array<{
    date_of_game: Date
    rank_tier: string
    role: string
    champion_id: number
    games: number
    wins: number
    ban_rate_pct: number
    pick_rate_pct: number
  }>>`
    SELECT
      date_of_game,
      rank_tier,
      role,
      champion_id,
      games,
      wins,
      ban_rate_pct,
      pick_rate_pct
    FROM champion_tier_daily_snapshots
    WHERE champion_id = ${championId}
      AND (${rankTier ? rankTier.toUpperCase().split('_')[0] : null}::text IS NULL OR rank_tier = ${rankTier ? rankTier.toUpperCase().split('_')[0] : null}::text)
      AND (${role ? role.toUpperCase() : null}::text IS NULL OR role = ${role ? role.toUpperCase() : null}::text)
      AND (${fromDate ? new Date(`${fromDate}T00:00:00.000Z`) : null}::timestamptz IS NULL OR date_of_game >= ${fromDate ? new Date(`${fromDate}T00:00:00.000Z`) : null}::timestamptz)
      AND (${toDate ? new Date(`${toDate}T23:59:59.999Z`) : null}::timestamptz IS NULL OR date_of_game <= ${toDate ? new Date(`${toDate}T23:59:59.999Z`) : null}::timestamptz)
    ORDER BY date_of_game DESC
    LIMIT ${limit}
  `

  const chronological = [...rows].reverse()

  return chronological.map((r) => ({
    dateOfGame: r.date_of_game.toISOString().slice(0, 10),
    rankTier: r.rank_tier,
    role: r.role,
    championId: r.champion_id,
    games: r.games,
    wins: r.wins,
    banRatePct: r.ban_rate_pct,
    pickRatePct: r.pick_rate_pct,
  }))
}
