/**
 * Daily tier snapshots — filled incrementally by poller-v2 (`ingestion.worker` → `champion_tier_daily_snapshots`).
 * Cron here only refreshes archive housekeeping (no ingest replay).
 */
import { queryRawUnsafe, isDatabaseConfigured } from '../db/query.js'
import { toQueryStringArrayParam } from '../utils/statsFilters.js'
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

function buildSnapshotFilterSql(options: {
  championId?: number | null
  rankTiers?: string[] | null
  role?: string | null
  fromDate?: string | null
  toDate?: string | null
  alias?: string
}): string {
  const a = options.alias ?? 's'
  const parts: string[] = ['1=1']
  if (options.championId != null && Number.isFinite(options.championId)) {
    parts.push(`${a}.champion_id = ${options.championId}`)
  }
  const tiers = (options.rankTiers ?? [])
    .map((t) => t.trim().toUpperCase().split('_')[0]!)
    .filter(Boolean)
  if (tiers.length === 1) {
    parts.push(
      `split_part(upper(trim(${a}.rank_tier::text)), '_', 1) = '${tiers[0]!.replace(/'/g, "''")}'`,
    )
  } else if (tiers.length > 1) {
    parts.push(
      `split_part(upper(trim(${a}.rank_tier::text)), '_', 1) IN (${tiers.map((t) => `'${t.replace(/'/g, "''")}'`).join(', ')})`,
    )
  } else {
    parts.push(`split_part(upper(trim(${a}.rank_tier::text)), '_', 1) <> 'UNRANKED'`)
  }
  if (options.role) {
    parts.push(`${a}.role = '${options.role.toUpperCase().replace(/'/g, "''")}'`)
  }
  if (options.fromDate) parts.push(`${a}.date_of_game >= '${options.fromDate.replace(/'/g, "''")}'::date`)
  if (options.toDate) parts.push(`${a}.date_of_game <= '${options.toDate.replace(/'/g, "''")}'::date`)
  return parts.join(' AND ')
}

export async function getChampionTierSnapshotsForCharts(options: {
  championId: number
  rankTier?: string | string[] | null
  role?: string | null
  fromDate?: string | null
  toDate?: string | null
  limit?: number
}): Promise<ChampionTierSnapshotRow[]> {
  if (!isDatabaseConfigured()) return []
  const { championId, fromDate, toDate, limit = 365 } = options
  const rankTiers = toQueryStringArrayParam(options.rankTier)
    .map((t) => t.trim().toUpperCase().split('_')[0]!)
    .filter(Boolean)
  let role = options.role
  if (role && role.toUpperCase() === 'UTILITY') role = 'SUPPORT'
  if (role && role.toUpperCase() === 'MID') role = 'MIDDLE'
  if (role && role.toUpperCase() === 'ADC') role = 'BOTTOM'

  const normRole = role ? role.toUpperCase().replace(/'/g, "''") : null

  const cohortWhere = buildSnapshotFilterSql({
    championId: null,
    rankTiers,
    role: normRole,
    fromDate,
    toDate,
    alias: 'cohort',
  })
  const champWhere = buildSnapshotFilterSql({
    championId,
    rankTiers,
    role: normRole,
    fromDate,
    toDate,
    alias: 'champ',
  })

  const rows = await queryRawUnsafe<
    Array<{
      date_of_game: Date
      rank_tier: string
      role: string
      champion_id: number
      games: number
      wins: number
      count_ban: number
      cohort_picks: number
    }>
  >(`
    WITH cohort AS (
      SELECT
        date_of_game,
        rank_tier,
        role,
        SUM(games)::int AS cohort_picks
      FROM champion_tier_daily_snapshots cohort
      WHERE ${cohortWhere}
      GROUP BY date_of_game, rank_tier, role
    ),
    champ AS (
      SELECT
        date_of_game,
        rank_tier,
        role,
        champion_id,
        SUM(games)::int AS games,
        SUM(wins)::int AS wins,
        SUM(count_ban)::int AS count_ban
      FROM champion_tier_daily_snapshots champ
      WHERE ${champWhere}
      GROUP BY date_of_game, rank_tier, role, champion_id
    )
    SELECT
      c.date_of_game,
      c.rank_tier,
      c.role,
      c.champion_id,
      c.games,
      c.wins,
      c.count_ban,
      COALESCE(co.cohort_picks, 0)::int AS cohort_picks
    FROM champ c
    LEFT JOIN cohort co
      ON co.date_of_game = c.date_of_game
      AND co.rank_tier = c.rank_tier
      AND co.role = c.role
    ORDER BY c.date_of_game DESC
    LIMIT ${limit}
  `)

  return [...rows].reverse().map((r) => {
    const games = Number(r.games ?? 0)
    const cohortPicks = Number(r.cohort_picks ?? 0)
    const countBan = Number(r.count_ban ?? 0)
    const pickRatePct = cohortPicks > 0 ? (games / cohortPicks) * 100 : 0
    const banRatePct = cohortPicks > 0 ? (countBan / cohortPicks) * 100 : 0
    return {
      dateOfGame: r.date_of_game.toISOString().slice(0, 10),
      rankTier: r.rank_tier,
      role: r.role,
      championId: r.champion_id,
      games,
      wins: r.wins,
      banRatePct,
      pickRatePct,
    }
  })
}

export async function getChampionTierDailySnapshotDateBounds(): Promise<{
  minDate: string | null
  maxDate: string | null
}> {
  if (!isDatabaseConfigured()) return { minDate: null, maxDate: null }
  const rows = await queryRawUnsafe<Array<{ min_date: Date | null; max_date: Date | null }>>(`
    SELECT
      MIN(date_of_game)::date AS min_date,
      MAX(date_of_game)::date AS max_date
    FROM champion_tier_daily_snapshots
    WHERE date_of_game IS NOT NULL
  `)
  const row = rows[0]
  if (!row?.min_date || !row?.max_date) return { minDate: null, maxDate: null }
  return {
    minDate: row.min_date.toISOString().slice(0, 10),
    maxDate: row.max_date.toISOString().slice(0, 10),
  }
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
