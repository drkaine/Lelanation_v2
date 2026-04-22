/**
 * Watchlist / recap: deltas between two UTC snapshot days from champion_tier_daily_snapshots (+ archive).
 * Winrate = sum(wins)/sum(games); pick/ban rates weighted by games when merging tiers.
 */
import { Prisma } from '../generated/prisma/index.js'
import { prisma, isDatabaseConfigured } from '../db.js'

/** Injected as Prisma.raw — must stay static (no user input). */
const WITH_SOURCE_ROWS = `
WITH source_rows AS (
  SELECT date_of_game, rank_tier, role, champion_id, games, wins, ban_rate_pct, pick_rate_pct
  FROM champion_tier_daily_snapshots
  UNION ALL
  SELECT date_of_game, rank_tier, role, champion_id, games, wins, ban_rate_pct, pick_rate_pct
  FROM champion_tier_daily_snapshots_archive
)`

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

function aggregateFromRows(
  rows: Array<{ games: bigint | number; wins: bigint | number; pick_rate_pct: number; ban_rate_pct: number }>
): Omit<WatchlistBucketStats, 'dateOfGame'> | null {
  let games = 0
  let wins = 0
  let sumPick = 0
  let sumBan = 0
  for (const r of rows) {
    const g = Number(r.games)
    if (g <= 0) continue
    games += g
    wins += Number(r.wins)
    sumPick += r.pick_rate_pct * g
    sumBan += r.ban_rate_pct * g
  }
  if (games <= 0) return null
  return {
    games,
    wins,
    winRate: (wins / games) * 100,
    pickRate: sumPick / games,
    banRate: sumBan / games,
  }
}

function addDaysUtc(dateStr: string, deltaDays: number): string {
  const [y, m, day] = dateStr.split('-').map(Number)
  const t = Date.UTC(y!, m! - 1, day! + deltaDays)
  return new Date(t).toISOString().slice(0, 10)
}

function filterChampionSql(championId: number | null): Prisma.Sql {
  if (championId != null && Number.isFinite(championId)) {
    return Prisma.sql`AND s.champion_id = ${championId}`
  }
  return Prisma.sql``
}

function filterRoleSql(role: string | null): Prisma.Sql {
  if (role) return Prisma.sql`AND s.role = ${role}`
  return Prisma.sql``
}

function filterRankSql(rankTier: string | null): Prisma.Sql {
  if (rankTier) {
    return Prisma.sql`AND split_part(upper(trim(s.rank_tier::text)), '_', 1) = ${rankTier}`
  }
  return Prisma.sql``
}

async function resolveLatestSnapshotDate(params: {
  championId: number | null
  role: string | null
  rankTier: string | null
}): Promise<string | null> {
  const rt = normRankTier(params.rankTier)
  const ro = normRole(params.role)
  const cid = params.championId

  const rows = await prisma.$queryRaw<Array<{ d: Date }>>`
    ${Prisma.raw(WITH_SOURCE_ROWS)}
    SELECT MAX(s.date_of_game) AS d
    FROM source_rows s
    WHERE 1=1
    ${filterChampionSql(cid)}
    ${filterRoleSql(ro)}
    ${filterRankSql(rt)}
  `
  const d = rows[0]?.d
  return d ? d.toISOString().slice(0, 10) : null
}

async function fetchBucketForDate(params: {
  dateStr: string
  championId: number | null
  role: string | null
  rankTier: string | null
}): Promise<WatchlistBucketStats | null> {
  const rt = normRankTier(params.rankTier)
  const ro = normRole(params.role)
  const cid = params.championId
  const d = new Date(`${params.dateStr}T00:00:00.000Z`)

  const rows = await prisma.$queryRaw<
    Array<{ games: bigint; wins: bigint; pick_rate_pct: number; ban_rate_pct: number }>
  >`
    ${Prisma.raw(WITH_SOURCE_ROWS)}
    SELECT
      s.games::bigint AS games,
      s.wins::bigint AS wins,
      s.pick_rate_pct::float8 AS pick_rate_pct,
      s.ban_rate_pct::float8 AS ban_rate_pct
    FROM source_rows s
    WHERE s.date_of_game = ${d}::date
    ${filterChampionSql(cid)}
    ${filterRoleSql(ro)}
    ${filterRankSql(rt)}
  `

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

  const deltaWinRate = current.winRate - past.winRate
  const deltaPickRate = current.pickRate - past.pickRate
  const deltaBanRate = current.banRate - past.banRate

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
    deltaWinRate,
    deltaPickRate,
    deltaBanRate,
  }
}

/**
 * Site-wide pool: all snapshot rows for a UTC day (optional rank tier), no champion/role filter.
 * WR = sum(wins)/sum(games); pick/ban weighted by games (same as aggregateFromRows).
 */
export async function getWatchlistGlobalPoolDelta(params: {
  rankTier?: string | null
  days: number
}): Promise<WatchlistDeltaResult> {
  if (!isDatabaseConfigured()) {
    return {
      ok: false,
      championId: null,
      role: null,
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
  const rankTier = normRankTier(params.rankTier)
  const championId = null as number | null
  const role = null as string | null

  const dLatest = await resolveLatestSnapshotDate({ championId, role, rankTier })
  if (!dLatest) {
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
      championId: null,
      role: null,
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

  const deltaWinRate = current.winRate - past.winRate
  const deltaPickRate = current.pickRate - past.pickRate
  const deltaBanRate = current.banRate - past.banRate

  return {
    ok: true,
    championId: null,
    role: null,
    rankTier,
    days,
    dLatest,
    dPast,
    current,
    past,
    deltaWinRate,
    deltaPickRate,
    deltaBanRate,
  }
}

export type BatchWatchlistQuery = {
  id: string
  championId?: number | null
  role?: string | null
  rankTier?: string | null
  days: number
  /** When true, ignore championId/role and return whole-pool delta for rankTier (optional). */
  global?: boolean
}

const BATCH_CONCURRENCY = Math.max(
  1,
  Math.min(12, parseInt(process.env.WATCHLIST_BATCH_CONCURRENCY ?? '6', 10) || 6)
)

async function mapInChunksWithConcurrency<T, R>(
  items: T[],
  chunkSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    out.push(...(await Promise.all(chunk.map((item) => fn(item)))))
  }
  return out
}

export async function batchWatchlistDeltas(
  queries: BatchWatchlistQuery[]
): Promise<Array<WatchlistDeltaResult & { queryId: string }>> {
  return mapInChunksWithConcurrency(queries, BATCH_CONCURRENCY, async (q) => {
    if (q.global === true) {
      const r = await getWatchlistGlobalPoolDelta({
        rankTier: q.rankTier,
        days: q.days,
      })
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

/** Top champions by absolute winrate change between latest snapshot day and `days` before (aggregated all tiers/roles). */
export async function getGlobalWinrateMovers(params: {
  days: number
  limit: number
  minGamesLatest: number
  minGamesPast: number
}): Promise<{ dLatest: string | null; dPast: string | null; movers: GlobalMoverRow[] }> {
  if (!isDatabaseConfigured()) {
    return { dLatest: null, dPast: null, movers: [] }
  }
  const days = Math.min(30, Math.max(1, Math.floor(params.days)))
  const limit = Math.min(50, Math.max(1, Math.floor(params.limit)))
  const minGamesLatest = Math.max(0, Math.floor(params.minGamesLatest))
  const minGamesPast = Math.max(0, Math.floor(params.minGamesPast))

  const meta = await prisma.$queryRaw<Array<{ d: Date }>>`
    ${Prisma.raw(WITH_SOURCE_ROWS)}
    SELECT MAX(s.date_of_game) AS d FROM source_rows s
  `
  const dLatestDate = meta[0]?.d
  if (!dLatestDate) return { dLatest: null, dPast: null, movers: [] }
  const dLatest = dLatestDate.toISOString().slice(0, 10)
  const dPastStr = addDaysUtc(dLatest, -days)
  const dLatestD = new Date(`${dLatest}T00:00:00.000Z`)
  const dPastD = new Date(`${dPastStr}T00:00:00.000Z`)

  const rows = await prisma.$queryRaw<
    Array<{
      champion_id: number
      games_latest: bigint
      wins_latest: bigint
      games_past: bigint
      wins_past: bigint
    }>
  >`
    ${Prisma.raw(WITH_SOURCE_ROWS)}
    , per_day AS (
      SELECT
        s.champion_id,
        s.date_of_game,
        SUM(s.games)::bigint AS games,
        SUM(s.wins)::bigint AS wins
      FROM source_rows s
      WHERE s.date_of_game IN (${dLatestD}::date, ${dPastD}::date)
      GROUP BY s.champion_id, s.date_of_game
    )
    SELECT
      p.champion_id,
      COALESCE(MAX(CASE WHEN p.date_of_game = ${dLatestD}::date THEN p.games END), 0::bigint) AS games_latest,
      COALESCE(MAX(CASE WHEN p.date_of_game = ${dLatestD}::date THEN p.wins END), 0::bigint) AS wins_latest,
      COALESCE(MAX(CASE WHEN p.date_of_game = ${dPastD}::date THEN p.games END), 0::bigint) AS games_past,
      COALESCE(MAX(CASE WHEN p.date_of_game = ${dPastD}::date THEN p.wins END), 0::bigint) AS wins_past
    FROM per_day p
    GROUP BY p.champion_id
    HAVING COALESCE(MAX(CASE WHEN p.date_of_game = ${dLatestD}::date THEN p.games END), 0::bigint) >= ${minGamesLatest}
       AND COALESCE(MAX(CASE WHEN p.date_of_game = ${dPastD}::date THEN p.games END), 0::bigint) >= ${minGamesPast}
  `

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
