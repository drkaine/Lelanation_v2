/**
 * Daily tier snapshots — filled incrementally by poller-v2 (`ingestion.worker` → `champion_tier_daily_snapshots`).
 * Cron here only refreshes archive housekeeping (no ingest replay).
 */
import { queryRawUnsafe, isDatabaseConfigured } from '../db/query.js'
import { createRiotPollerLogger } from '../utils/riotPollerLogger.js'

type Logger = ReturnType<typeof createRiotPollerLogger>
let lastActiveRefreshAtMs = 0
const SNAPSHOT_ALLOWED_ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'SUPPORT', 'BOTTOM'] as const

function parseUtcSchedule(): { hour: number; minute: number } {
  const hour = Math.min(23, Math.max(0, parseInt(process.env.CHAMPION_TIER_SNAPSHOT_UTC_HOUR ?? '0', 10) || 0))
  const minute = Math.min(59, Math.max(0, parseInt(process.env.CHAMPION_TIER_SNAPSHOT_UTC_MINUTE ?? '0', 10) || 0))
  return { hour, minute }
}

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

/** Poller writes snapshots incrementally; batch replay from ingest is removed. */
export async function runChampionTierSnapshotForWindow(_params: {
  windowStart: Date
  windowEnd: Date
  dateOfGame: Date
  logger?: Logger
}): Promise<{ insertedEstimate: number }> {
  return { insertedEstimate: 0 }
}

async function cleanupInvalidSnapshotRoles(logger?: Logger): Promise<void> {
  const deletedActive = await queryRawUnsafe<number>(`
    WITH d AS (
      DELETE FROM champion_tier_daily_snapshots
      WHERE role NOT IN ('TOP', 'JUNGLE', 'MIDDLE', 'SUPPORT', 'BOTTOM')
      RETURNING 1
    ) SELECT COUNT(*)::int FROM d
  `)
  if (logger && deletedActive > 0) {
    void logger.step('Champion tier snapshot role cleanup', {
      deletedActiveRows: deletedActive,
      allowedRoles: SNAPSHOT_ALLOWED_ROLES.join(','),
    })
  }
}

async function getActiveSnapshotDates(): Promise<Date[]> {
  const limit = Math.max(1, Number.parseInt(process.env.CHAMPION_TIER_SNAPSHOT_ACTIVE_DAYS_LIMIT ?? '60', 10) || 60)
  const dates = await queryRawUnsafe<Array<{ d: Date }>>(`
    SELECT DISTINCT date_of_game::date AS d
    FROM champion_tier_daily_snapshots
    WHERE date_of_game IS NOT NULL
    ORDER BY d DESC
    LIMIT ${limit}
  `)
  return dates.map((r) => new Date(`${r.d.toISOString().slice(0, 10)}T00:00:00.000Z`))
}

export async function archiveChampionTierDailySnapshotsInDateRange(
  startInclusive: string,
  endExclusive: string,
): Promise<{ archivedRowCount: number }> {
  if (!isDatabaseConfigured()) return { archivedRowCount: 0 }
  const ymd = /^\d{4}-\d{2}-\d{2}$/
  if (!ymd.test(startInclusive) || !ymd.test(endExclusive)) {
    throw new Error('Invalid date range (expected YYYY-MM-DD)')
  }
  if (endExclusive <= startInclusive) return { archivedRowCount: 0 }
  return { archivedRowCount: 0 }
}

async function archiveSnapshotsForCompletedPatches(_logger?: Logger): Promise<number> {
  return 0
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

  const conds: string[] = [`champion_id = ${championId}`]
  if (rankTier) conds.push(`rank_tier = '${rankTier.toUpperCase().split('_')[0]!.replace(/'/g, "''")}'`)
  if (role) conds.push(`role = '${role.toUpperCase().replace(/'/g, "''")}'`)
  if (fromDate) conds.push(`date_of_game >= '${fromDate.replace(/'/g, "''")}'::date`)
  if (toDate) conds.push(`date_of_game <= '${toDate.replace(/'/g, "''")}'::date`)

  const rows = await queryRawUnsafe<
    Array<{
      date_of_game: Date
      rank_tier: string
      role: string
      champion_id: number
      games: number
      wins: number
      count_ban: number
    }>
  >(`
    SELECT
      date_of_game,
      rank_tier,
      role,
      champion_id,
      SUM(games)::int AS games,
      SUM(wins)::int AS wins,
      SUM(count_ban)::int AS count_ban
    FROM champion_tier_daily_snapshots
    WHERE ${conds.join(' AND ')}
    GROUP BY date_of_game, rank_tier, role, champion_id
    ORDER BY date_of_game DESC
    LIMIT ${limit}
  `)

  return [...rows].reverse().map((r) => {
    const games = r.games
    const tierPickDenom = games
    return {
      dateOfGame: r.date_of_game.toISOString().slice(0, 10),
      rankTier: r.rank_tier,
      role: r.role,
      championId: r.champion_id,
      games,
      wins: r.wins,
      banRatePct: games > 0 ? (r.count_ban / games) * 100 : 0,
      pickRatePct: tierPickDenom > 0 ? (games / tierPickDenom) * 100 : 0,
    }
  })
}

export async function refreshActiveChampionTierSnapshotsIfDue(logger?: Logger): Promise<void> {
  if (process.env.CHAMPION_TIER_SNAPSHOT_DISABLED === '1') return
  const { hour, minute } = parseUtcSchedule()
  const now = new Date()
  if (now.getUTCHours() !== hour || now.getUTCMinutes() !== minute) return
  const throttleMs = 60 * 60 * 1000
  if (Date.now() - lastActiveRefreshAtMs < throttleMs) return
  lastActiveRefreshAtMs = Date.now()
  await cleanupInvalidSnapshotRoles(logger)
  const dates = await getActiveSnapshotDates()
  void dates
  await archiveSnapshotsForCompletedPatches(logger)
}
