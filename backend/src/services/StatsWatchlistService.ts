/**
 * Watchlist / recap: deltas between UTC snapshot days from `champion_tier_daily_snapshots`.
 */
import { queryRawUnsafe, isDatabaseConfigured } from '../db/query.js'

export interface WatchlistBucketStats {
  dateOfGame: string
  games: number
  wins: number
  winRate: number
  pickRate: number
  banRate: number
}

export interface WatchlistDeltaResult {
  ok: boolean
  championId: number | null
  role: string | null
  rankTier: string | null
  days: number
  dLatest: string | null
  dPast: string | null
  current: WatchlistBucketStats | null
  past: WatchlistBucketStats | null
  deltaWinRate: number | null
  deltaPickRate: number | null
  deltaBanRate: number | null
  message?: string
}

export interface GlobalMoverRow {
  championId: number
  gamesLatest: number
  gamesPast: number
  winRateLatest: number
  winRatePast: number
  deltaWinRate: number
}

function normRankTier(t: string | null | undefined): string | null {
  if (!t || !t.trim()) return null
  return t.toUpperCase().split('_')[0] ?? null
}

function normRole(r: string | null | undefined): string | null {
  if (!r || !r.trim()) return null
  const u = r.toUpperCase().trim()
  if (u === 'MID') return 'MIDDLE'
  if (u === 'ADC') return 'BOTTOM'
  if (u === 'UTILITY') return 'SUPPORT'
  return u
}

function buildFilterSql(params: {
  championId: number | null
  role: string | null
  rankTier: string | null
  alias?: string
}): string {
  const a = params.alias ?? 's'
  const parts: string[] = ['1=1']
  if (params.championId != null && Number.isFinite(params.championId)) {
    parts.push(`${a}.champion_id = ${params.championId}`)
  }
  if (params.role) parts.push(`${a}.role = '${params.role.replace(/'/g, "''")}'`)
  if (params.rankTier) {
    parts.push(`split_part(upper(trim(${a}.rank_tier::text)), '_', 1) = '${params.rankTier.replace(/'/g, "''")}'`)
  }
  return parts.join(' AND ')
}

function aggregateFromRows(
  rows: Array<{ games: number; wins: number; count_ban: number }>,
): Omit<WatchlistBucketStats, 'dateOfGame'> | null {
  let games = 0
  let wins = 0
  let countBan = 0
  for (const r of rows) {
    const g = Number(r.games)
    if (g <= 0) continue
    games += g
    wins += Number(r.wins)
    countBan += Number(r.count_ban)
  }
  if (games <= 0) return null
  return {
    games,
    wins,
    winRate: (wins / games) * 100,
    pickRate: 0,
    banRate: (countBan / games) * 100,
  }
}

function addDaysUtc(dateStr: string, deltaDays: number): string {
  const [y, m, day] = dateStr.split('-').map(Number)
  const t = Date.UTC(y!, m! - 1, day! + deltaDays)
  return new Date(t).toISOString().slice(0, 10)
}

async function resolveLatestSnapshotDate(params: {
  championId: number | null
  role: string | null
  rankTier: string | null
}): Promise<string | null> {
  const where = buildFilterSql({
    championId: params.championId,
    role: normRole(params.role),
    rankTier: normRankTier(params.rankTier),
  })
  const rows = await queryRawUnsafe<Array<{ d: Date }>>(`
    SELECT MAX(s.date_of_game) AS d
    FROM champion_tier_daily_snapshots s
    WHERE ${where}
  `)
  const d = rows[0]?.d
  return d ? d.toISOString().slice(0, 10) : null
}

async function fetchBucketForDate(params: {
  dateStr: string
  championId: number | null
  role: string | null
  rankTier: string | null
}): Promise<WatchlistBucketStats | null> {
  const where = buildFilterSql({
    championId: params.championId,
    role: normRole(params.role),
    rankTier: normRankTier(params.rankTier),
  })
  const rows = await queryRawUnsafe<Array<{ games: number; wins: number; count_ban: number }>>(`
    SELECT
      SUM(s.games)::int AS games,
      SUM(s.wins)::int AS wins,
      SUM(s.count_ban)::int AS count_ban
    FROM champion_tier_daily_snapshots s
    WHERE s.date_of_game = '${params.dateStr.replace(/'/g, "''")}'::date
      AND ${where}
  `)
  const agg = aggregateFromRows(rows)
  if (!agg) return null
  return { dateOfGame: params.dateStr, ...agg }
}

export async function getWatchlistDelta(params: {
  championId: number | null
  role?: string | null
  rankTier?: string | null
  days: number
}): Promise<WatchlistDeltaResult> {
  if (!isDatabaseConfigured()) {
    return {
      ok: false,
      championId: params.championId,
      role: normRole(params.role),
      rankTier: normRankTier(params.rankTier),
      days: params.days,
      dLatest: null,
      dPast: null,
      current: null,
      past: null,
      deltaWinRate: null,
      deltaPickRate: null,
      deltaBanRate: null,
      message: 'Database not configured.',
    }
  }

  const days = Math.min(30, Math.max(1, Math.floor(Number(params.days) || 1)))
  const role = normRole(params.role)
  const rankTier = normRankTier(params.rankTier)
  const championId = params.championId != null && Number.isFinite(params.championId) ? params.championId : null

  if (championId == null && role == null) {
    return {
      ok: false,
      championId: null,
      role: null,
      rankTier,
      days,
      dLatest: null,
      dPast: null,
      current: null,
      past: null,
      deltaWinRate: null,
      deltaPickRate: null,
      deltaBanRate: null,
      message: 'championId or role is required.',
    }
  }

  const dLatest = await resolveLatestSnapshotDate({ championId, role, rankTier })
  if (!dLatest) {
    return {
      ok: false,
      championId,
      role,
      rankTier,
      days,
      dLatest: null,
      dPast: null,
      current: null,
      past: null,
      deltaWinRate: null,
      deltaPickRate: null,
      deltaBanRate: null,
      message: 'No snapshot data for filters.',
    }
  }

  const dPast = addDaysUtc(dLatest, -days)
  const [current, past] = await Promise.all([
    fetchBucketForDate({ dateStr: dLatest, championId, role, rankTier }),
    fetchBucketForDate({ dateStr: dPast, championId, role, rankTier }),
  ])

  if (!current || !past) {
    return {
      ok: false,
      championId,
      role,
      rankTier,
      days,
      dLatest,
      dPast,
      current,
      past,
      deltaWinRate: null,
      deltaPickRate: null,
      deltaBanRate: null,
      message: !current ? 'Missing stats for latest day.' : 'Missing stats for past day.',
    }
  }

  return {
    ok: true,
    championId,
    role,
    rankTier,
    days,
    dLatest,
    dPast,
    current,
    past,
    deltaWinRate: current.winRate - past.winRate,
    deltaPickRate: current.pickRate - past.pickRate,
    deltaBanRate: current.banRate - past.banRate,
  }
}

export async function getWatchlistGlobalPoolDelta(params: {
  rankTier?: string | null
  days: number
}): Promise<WatchlistDeltaResult> {
  return getWatchlistDelta({
    championId: null,
    role: null,
    rankTier: params.rankTier,
    days: params.days,
  })
}

export type BatchWatchlistQuery = {
  id: string
  championId?: number | null
  role?: string | null
  rankTier?: string | null
  days: number
  global?: boolean
}

const BATCH_CONCURRENCY = Math.max(
  1,
  Math.min(12, parseInt(process.env.WATCHLIST_BATCH_CONCURRENCY ?? '6', 10) || 6),
)

async function mapInChunksWithConcurrency<T, R>(
  items: T[],
  chunkSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    out.push(...(await Promise.all(chunk.map((item) => fn(item)))))
  }
  return out
}

export async function batchWatchlistDeltas(
  queries: BatchWatchlistQuery[],
): Promise<Array<WatchlistDeltaResult & { queryId: string }>> {
  return mapInChunksWithConcurrency(queries, BATCH_CONCURRENCY, async (q) => {
    if (q.global === true) {
      const r = await getWatchlistGlobalPoolDelta({ rankTier: q.rankTier, days: q.days })
      return { ...r, queryId: q.id }
    }
    const r = await getWatchlistDelta({
      championId: q.championId ?? null,
      role: q.role,
      rankTier: q.rankTier,
      days: q.days,
    })
    return { ...r, queryId: q.id }
  })
}

export async function getGlobalWinrateMovers(params: {
  days: number
  limit: number
  minGamesLatest: number
  minGamesPast: number
}): Promise<{ dLatest: string | null; dPast: string | null; movers: GlobalMoverRow[] }> {
  if (!isDatabaseConfigured()) return { dLatest: null, dPast: null, movers: [] }

  const days = Math.min(30, Math.max(1, Math.floor(params.days)))
  const limit = Math.min(50, Math.max(1, Math.floor(params.limit)))
  const minGamesLatest = Math.max(0, Math.floor(params.minGamesLatest))
  const minGamesPast = Math.max(0, Math.floor(params.minGamesPast))

  const meta = await queryRawUnsafe<Array<{ d: Date }>>(`
    SELECT MAX(date_of_game) AS d FROM champion_tier_daily_snapshots
  `)
  const dLatestDate = meta[0]?.d
  if (!dLatestDate) return { dLatest: null, dPast: null, movers: [] }
  const dLatest = dLatestDate.toISOString().slice(0, 10)
  const dPastStr = addDaysUtc(dLatest, -days)

  const rows = await queryRawUnsafe<
    Array<{
      champion_id: number
      games_latest: string | number
      wins_latest: string | number
      games_past: string | number
      wins_past: string | number
    }>
  >(`
    WITH per_day AS (
      SELECT champion_id, date_of_game, SUM(games)::bigint AS games, SUM(wins)::bigint AS wins
      FROM champion_tier_daily_snapshots
      WHERE date_of_game IN ('${dLatest}'::date, '${dPastStr}'::date)
      GROUP BY champion_id, date_of_game
    )
    SELECT
      p.champion_id,
      COALESCE(MAX(CASE WHEN p.date_of_game = '${dLatest}'::date THEN p.games END), 0) AS games_latest,
      COALESCE(MAX(CASE WHEN p.date_of_game = '${dLatest}'::date THEN p.wins END), 0) AS wins_latest,
      COALESCE(MAX(CASE WHEN p.date_of_game = '${dPastStr}'::date THEN p.games END), 0) AS games_past,
      COALESCE(MAX(CASE WHEN p.date_of_game = '${dPastStr}'::date THEN p.wins END), 0) AS wins_past
    FROM per_day p
    GROUP BY p.champion_id
    HAVING COALESCE(MAX(CASE WHEN p.date_of_game = '${dLatest}'::date THEN p.games END), 0) >= ${minGamesLatest}
       AND COALESCE(MAX(CASE WHEN p.date_of_game = '${dPastStr}'::date THEN p.games END), 0) >= ${minGamesPast}
  `)

  const movers: GlobalMoverRow[] = []
  for (const r of rows) {
    const gl = Number(r.games_latest)
    const wl = Number(r.wins_latest)
    const gp = Number(r.games_past)
    const wp = Number(r.wins_past)
    if (gl <= 0 || gp <= 0) continue
    const winRateLatest = (wl / gl) * 100
    const winRatePast = (wp / gp) * 100
    movers.push({
      championId: r.champion_id,
      gamesLatest: gl,
      gamesPast: gp,
      winRateLatest,
      winRatePast,
      deltaWinRate: winRateLatest - winRatePast,
    })
  }

  movers.sort((a, b) => Math.abs(b.deltaWinRate) - Math.abs(a.deltaWinRate))
  return { dLatest, dPast: dPastStr, movers: movers.slice(0, limit) }
}
