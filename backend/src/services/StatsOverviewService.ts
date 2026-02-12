/**
 * Overview stats for the statistics page: total matches, last update, top winrate champions,
 * matches per division, distinct participant count (unique puuids in participants).
 * Uses PostgreSQL views and get_stats_overview() for a single round-trip.
 */
import { Prisma } from '../generated/prisma/index.js'
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'

export interface OverviewStats {
  totalMatches: number
  lastUpdate: string | null
  topWinrateChampions: Array<{
    championId: number
    games: number
    wins: number
    winrate: number
    pickrate: number
  }>
  /** Top 5 by pickrate (for Fast Stats encart). */
  topPickrateChampions?: Array<{
    championId: number
    games: number
    wins: number
    winrate: number
    pickrate: number
  }>
  /** Top 5 by banrate (for Fast Stats encart). */
  topBanrateChampions?: Array<{
    championId: number
    banCount: number
    banrate: number
  }>
  matchesByDivision: Array<{ rankTier: string; matchCount: number }>
  /** Match count per game version (16.x only, e.g. 16.1, 16.2, 16.3). */
  matchesByVersion: Array<{ version: string; matchCount: number }>
  /** Distinct puuids in participants (joueurs récupérés = participants uniques). */
  playerCount: number
}

type OverviewRow = Array<{ get_stats_overview: OverviewStats | null }>

/** Raw shape from DB (JSONB); may be string when driver does not parse. */
interface RawOverviewResult {
  totalMatches?: number | null
  lastUpdate?: string | null
  topWinrateChampions?: unknown
  topPickrateChampions?: unknown
  topBanrateChampions?: unknown
  matchesByDivision?: unknown
  matchesByVersion?: unknown
  playerCount?: number | null
}

/** Ensure overview query params are string | null (never array) to avoid Prisma/Postgres "syntax error at or near [" */
function normalizeOverviewParam(
  value: string | string[] | null | undefined
): string | null {
  if (value == null) return null
  let s: string
  if (Array.isArray(value)) {
    const first = value[0]
    s = typeof first === 'string' ? first : ''
  } else {
    s = typeof value === 'string' ? value : ''
  }
  if (s === '' || s === '[]' || s.startsWith('[')) return null
  return s
}

/**
 * Load overview stats for the statistics page. Returns null if DB not configured.
 * Single round-trip via get_stats_overview(p_version, p_rank_tier). Optional filters by version and rank tier (e.g. GOLD).
 */
export async function getOverviewStats(
  version?: string | string[] | null,
  rankTier?: string | string[] | null
): Promise<OverviewStats | null> {
  if (!isDatabaseConfigured()) return null
  try {
    const pVersion = normalizeOverviewParam(version)
    const pRankTier = normalizeOverviewParam(rankTier)
    const arg1 = pVersion == null ? 'NULL' : `'${String(pVersion).replace(/'/g, "''")}'`
    const arg2 = pRankTier == null ? 'NULL' : `'${String(pRankTier).replace(/'/g, "''")}'`
    const sql = `SELECT get_stats_overview(${arg1}, ${arg2}) AS get_stats_overview`
    const rows = await prisma.$queryRawUnsafe<OverviewRow>(sql)
    const row0 = rows[0] as Record<string, unknown> | undefined
    let raw: unknown =
      row0?.get_stats_overview ??
      row0?.['get_stats_overview'] ??
      (row0 && Object.keys(row0).length > 0 ? Object.values(row0)[0] : null)
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw) as RawOverviewResult
      } catch {
        console.warn('[getOverviewStats] raw is string but not valid JSON')
        return null
      }
    }
    if (!raw || typeof raw !== 'object') {
      console.warn('[getOverviewStats] no raw result, keys:', rows[0] ? Object.keys(rows[0]) : 'no row', 'type:', typeof raw)
      return null
    }
    const r = raw as RawOverviewResult

    const lastUpdate =
      r.lastUpdate == null ? null : typeof r.lastUpdate === 'string' ? r.lastUpdate : String(r.lastUpdate)

    return {
      totalMatches: Number(r.totalMatches) ?? 0,
      lastUpdate,
      topWinrateChampions: Array.isArray(r.topWinrateChampions)
        ? (r.topWinrateChampions as Array<{ championId: number; games: number; wins: number; winrate: number; pickrate: number }>).map((c) => ({
            championId: Number(c.championId),
            games: Number(c.games),
            wins: Number(c.wins),
            winrate: Number(c.winrate),
            pickrate: Number(c.pickrate),
          }))
        : [],
      topPickrateChampions: Array.isArray(r.topPickrateChampions)
        ? (r.topPickrateChampions as Array<{ championId: number; games: number; wins: number; winrate: number; pickrate: number }>).map((c) => ({
            championId: Number(c.championId),
            games: Number(c.games),
            wins: Number(c.wins),
            winrate: Number(c.winrate),
            pickrate: Number(c.pickrate),
          }))
        : [],
      topBanrateChampions: Array.isArray(r.topBanrateChampions)
        ? (r.topBanrateChampions as Array<{ championId: number; banCount: number; banrate: number }>).map((c) => ({
            championId: Number(c.championId),
            banCount: Number(c.banCount ?? 0),
            banrate: Number(c.banrate ?? 0),
          }))
        : [],
      matchesByDivision: Array.isArray(r.matchesByDivision)
        ? (r.matchesByDivision as Array<{ rankTier: string; matchCount: number }>).map((d) => ({
            rankTier: String(d.rankTier ?? '').trim(),
            matchCount: Number(d.matchCount) ?? 0,
          }))
        : [],
      matchesByVersion: Array.isArray(r.matchesByVersion)
        ? (r.matchesByVersion as Array<{ version: string; matchCount: number }>).map((v) => ({
            version: String(v.version ?? '').trim(),
            matchCount: Number(v.matchCount) ?? 0,
          }))
        : [],
      playerCount: Number(r.playerCount) ?? 0,
    }
  } catch (err) {
    console.error('[getOverviewStats]', err instanceof Error ? err.message : err)
    if (err instanceof Error && err.cause) {
      console.error('[getOverviewStats] cause:', err.cause)
    }
    return null
  }
}

/** Overview detail: runes (per perk), rune sets, items, item sets, items by order, summoner spells. */
export interface OverviewDetailStats {
  totalParticipants: number
  runes: Array<{ runeId: number; games: number; wins: number; pickrate: number; winrate: number }>
  runeSets: Array<{
    runes: unknown
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  items: Array<{ itemId: number; games: number; wins: number; pickrate: number; winrate: number }>
  itemSets: Array<{
    items: number[]
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  itemsByOrder: Record<
    string,
    Array<{ itemId: number; games: number; wins: number; winrate: number }>
  >
  summonerSpells: Array<{
    spellId: number
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
}

type OverviewDetailRow = Array<{ get_stats_overview_detail: OverviewDetailStats | null }>

export async function getOverviewDetailStats(
  version?: string | null,
  rankTier?: string | null
): Promise<OverviewDetailStats | null> {
  if (!isDatabaseConfigured()) return null
  try {
    const pVersion = version != null && version !== '' ? version : null
    const pRankTier = rankTier != null && rankTier !== '' ? rankTier : null
    const rows = await prisma.$queryRaw<OverviewDetailRow>(
      Prisma.sql`SELECT get_stats_overview_detail(${pVersion}, ${pRankTier}) AS get_stats_overview_detail`
    )
    const raw = rows[0]?.get_stats_overview_detail
    if (!raw) return null

    const mapRune = (r: { runeId: number; games: number; wins: number; pickrate: number; winrate: number }) => ({
      runeId: Number(r.runeId),
      games: Number(r.games),
      wins: Number(r.wins),
      pickrate: Number(r.pickrate),
      winrate: Number(r.winrate),
    })
    const mapRuneSet = (rs: { runes: unknown; games: number; wins: number; pickrate: number; winrate: number }) => ({
      runes: rs.runes,
      games: Number(rs.games),
      wins: Number(rs.wins),
      pickrate: Number(rs.pickrate),
      winrate: Number(rs.winrate),
    })
    const mapItem = (i: { itemId: number; games: number; wins: number; pickrate: number; winrate: number }) => ({
      itemId: Number(i.itemId),
      games: Number(i.games),
      wins: Number(i.wins),
      pickrate: Number(i.pickrate),
      winrate: Number(i.winrate),
    })
    const mapItemSet = (is: { items: number[]; games: number; wins: number; pickrate: number; winrate: number }) => ({
      items: Array.isArray(is.items) ? is.items.map(Number) : [],
      games: Number(is.games),
      wins: Number(is.wins),
      pickrate: Number(is.pickrate),
      winrate: Number(is.winrate),
    })
    const mapSpell = (s: { spellId: number; games: number; wins: number; pickrate: number; winrate: number }) => ({
      spellId: Number(s.spellId),
      games: Number(s.games),
      wins: Number(s.wins),
      pickrate: Number(s.pickrate),
      winrate: Number(s.winrate),
    })

    const itemsByOrder: Record<string, Array<{ itemId: number; games: number; wins: number; winrate: number }>> = {}
    if (raw.itemsByOrder && typeof raw.itemsByOrder === 'object') {
      for (const [slot, arr] of Object.entries(raw.itemsByOrder)) {
        itemsByOrder[slot] = Array.isArray(arr)
          ? arr.map((x: { itemId: number; games: number; wins: number; winrate: number }) => ({
              itemId: Number(x.itemId),
              games: Number(x.games),
              wins: Number(x.wins),
              winrate: Number(x.winrate),
            }))
          : []
      }
    }

    return {
      totalParticipants: Number(raw.totalParticipants) ?? 0,
      runes: Array.isArray(raw.runes) ? raw.runes.map(mapRune) : [],
      runeSets: Array.isArray(raw.runeSets) ? raw.runeSets.map(mapRuneSet) : [],
      items: Array.isArray(raw.items) ? raw.items.map(mapItem) : [],
      itemSets: Array.isArray(raw.itemSets) ? raw.itemSets.map(mapItemSet) : [],
      itemsByOrder,
      summonerSpells: Array.isArray(raw.summonerSpells) ? raw.summonerSpells.map(mapSpell) : [],
    }
  } catch (err) {
    console.error('[getOverviewDetailStats]', err)
    return null
  }
}

/** Stats from matches.teams: bans and objectives (first + kills + distribution for %). */
export interface OverviewTeamsStats {
  matchCount: number
  bans: {
    byWin: Array<{ championId: number; count: number; banRatePercent: string }>
    byLoss: Array<{ championId: number; count: number; banRatePercent: string }>
    /** Top 20 champions by total ban count (byWin + byLoss), with ban rate % over all bans. */
    top20Total: Array<{ championId: number; count: number; banRatePercent: string }>
  }
  objectives: {
    firstBlood: { firstByWin: number; firstByLoss: number }
    baron: ObjectiveWithDistribution
    dragon: ObjectiveWithDistribution
    tower: ObjectiveWithDistribution
    inhibitor: ObjectiveWithDistribution
    riftHerald: ObjectiveWithDistribution
    horde: ObjectiveWithDistribution
  }
}

export interface ObjectiveWithDistribution {
  firstByWin: number
  firstByLoss: number
  killsByWin: number
  killsByLoss: number
  /** Count of matches (by winning team) per kill count: { "0": n, "1": m, ... } */
  distributionByWin: Record<string, number>
  /** Count of matches (by losing team) per kill count */
  distributionByLoss: Record<string, number>
}

type OverviewTeamsRow = Array<{ get_stats_overview_teams: OverviewTeamsStats | null }>

/** Duration vs winrate by 5-min buckets (uses version and rank_tier filters). */
export interface OverviewDurationWinrateStats {
  buckets: Array<{
    durationMin: number
    matchCount: number
    wins: number
    winrate: number
  }>
}

type OverviewDurationWinrateRow = Array<{ get_stats_overview_duration_winrate: OverviewDurationWinrateStats | null }>

export async function getOverviewDurationWinrateStats(
  version?: string | null,
  rankTier?: string | null
): Promise<OverviewDurationWinrateStats | null> {
  if (!isDatabaseConfigured()) return null
  try {
    const pVersion = version != null && version !== '' ? version : null
    const pRankTier = rankTier != null && rankTier !== '' ? rankTier : null
    const rows = await prisma.$queryRaw<OverviewDurationWinrateRow>(
      Prisma.sql`SELECT get_stats_overview_duration_winrate(${pVersion}, ${pRankTier}) AS get_stats_overview_duration_winrate`
    )
    const raw = rows[0]?.get_stats_overview_duration_winrate
    if (!raw || !raw.buckets || !Array.isArray(raw.buckets)) {
      return { buckets: [] }
    }
    return {
      buckets: raw.buckets.map((b: { durationMin: number; matchCount: number; wins: number; winrate: number }) => ({
        durationMin: Number(b.durationMin),
        matchCount: Number(b.matchCount),
        wins: Number(b.wins),
        winrate: Number(b.winrate),
      })),
    }
  } catch (err) {
    console.error('[getOverviewDurationWinrateStats]', err)
    return null
  }
}

/** Progression: delta WR from oldest version to all since. For "Winrate depuis X" encart. */
export interface OverviewProgressionStats {
  oldestVersion: string | null
  gainers: Array<{
    championId: number
    wrOldest: number
    wrSince: number
    delta: number
  }>
  losers: Array<{
    championId: number
    wrOldest: number
    wrSince: number
    delta: number
  }>
}

type OverviewProgressionRow = Array<{ get_stats_overview_progression: OverviewProgressionStats | null }>

export async function getOverviewProgressionStats(
  versionOldest?: string | null,
  rankTier?: string | null
): Promise<OverviewProgressionStats | null> {
  if (!isDatabaseConfigured()) return null
  if (!versionOldest || versionOldest === '') {
    return { oldestVersion: null, gainers: [], losers: [] }
  }
  try {
    const pVersion = versionOldest
    const pRankTier = rankTier != null && rankTier !== '' ? rankTier : null
    const rows = await prisma.$queryRaw<OverviewProgressionRow>(
      Prisma.sql`SELECT get_stats_overview_progression(${pVersion}, ${pRankTier}) AS get_stats_overview_progression`
    )
    const raw = rows[0]?.get_stats_overview_progression
    if (!raw) return { oldestVersion: versionOldest, gainers: [], losers: [] }
    const mapEntry = (e: { championId: number; wrOldest: number; wrSince: number; delta: number }) => ({
      championId: Number(e.championId),
      wrOldest: Number(e.wrOldest),
      wrSince: Number(e.wrSince),
      delta: Number(e.delta),
    })
    return {
      oldestVersion: raw.oldestVersion ?? versionOldest,
      gainers: Array.isArray(raw.gainers) ? raw.gainers.map(mapEntry) : [],
      losers: Array.isArray(raw.losers) ? raw.losers.map(mapEntry) : [],
    }
  } catch (err) {
    console.error('[getOverviewProgressionStats]', err)
    return null
  }
}

export async function getOverviewTeamsStats(
  version?: string | null,
  rankTier?: string | null
): Promise<OverviewTeamsStats | null> {
  if (!isDatabaseConfigured()) return null
  try {
    const pVersion = version != null && version !== '' ? version : null
    const pRankTier = rankTier != null && rankTier !== '' ? rankTier : null
    const rows = await prisma.$queryRaw<OverviewTeamsRow>(
      Prisma.sql`SELECT get_stats_overview_teams(${pVersion}, ${pRankTier}) AS get_stats_overview_teams`
    )
    const raw = rows[0]?.get_stats_overview_teams
    if (!raw) return null

    const mapBan = (b: { championId: number; count: number }) => ({
      championId: Number(b.championId),
      count: Number(b.count),
    })
    const addBanRate = (
      list: Array<{ championId: number; count: number }>,
      total: number
    ): Array<{ championId: number; count: number; banRatePercent: string }> =>
      list.map((b) => ({
        ...b,
        banRatePercent:
          total > 0 ? (Math.round((b.count / total) * 1000) / 10).toFixed(1) + '%' : '—',
      }))
    const byWinRaw = Array.isArray(raw.bans?.byWin) ? raw.bans.byWin.map(mapBan) : []
    const byLossRaw = Array.isArray(raw.bans?.byLoss) ? raw.bans.byLoss.map(mapBan) : []
    const totalBansByWin = byWinRaw.reduce((acc, b) => acc + b.count, 0)
    const totalBansByLoss = byLossRaw.reduce((acc, b) => acc + b.count, 0)
    const byChamp = new Map<number, number>()
    for (const b of byWinRaw) byChamp.set(b.championId, (byChamp.get(b.championId) ?? 0) + b.count)
    for (const b of byLossRaw) byChamp.set(b.championId, (byChamp.get(b.championId) ?? 0) + b.count)
    const totalBansAll = Array.from(byChamp.values()).reduce((a, n) => a + n, 0)
    const top20Total = Array.from(byChamp.entries())
      .map(([championId, count]) => ({
        championId,
        count,
        banRatePercent:
          totalBansAll > 0 ? (Math.round((count / totalBansAll) * 1000) / 10).toFixed(1) + '%' : '—',
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
    const objWithKills = (o: Record<string, unknown>): ObjectiveWithDistribution => {
      const distWin = (o?.distributionByWin as Record<string, number>) ?? {}
      const distLoss = (o?.distributionByLoss as Record<string, number>) ?? {}
      const distWinNum: Record<string, number> = {}
      const distLossNum: Record<string, number> = {}
      for (const k of Object.keys(distWin)) distWinNum[k] = Number(distWin[k])
      for (const k of Object.keys(distLoss)) distLossNum[k] = Number(distLoss[k])
      return {
        firstByWin: Number(o?.firstByWin ?? 0),
        firstByLoss: Number(o?.firstByLoss ?? 0),
        killsByWin: Number(o?.killsByWin ?? 0),
        killsByLoss: Number(o?.killsByLoss ?? 0),
        distributionByWin: distWinNum,
        distributionByLoss: distLossNum,
      }
    }
    const objFirstOnly = (o: Record<string, number>) => ({
      firstByWin: Number(o?.firstByWin ?? 0),
      firstByLoss: Number(o?.firstByLoss ?? 0),
    })

    return {
      matchCount: Number(raw.matchCount) ?? 0,
      bans: {
        byWin: addBanRate(byWinRaw, totalBansByWin),
        byLoss: addBanRate(byLossRaw, totalBansByLoss),
        top20Total,
      },
      objectives: {
        firstBlood: objFirstOnly((raw.objectives?.firstBlood as Record<string, number>) ?? {}),
        baron: objWithKills((raw.objectives?.baron ?? {}) as unknown as Record<string, unknown>),
        dragon: objWithKills((raw.objectives?.dragon ?? {}) as unknown as Record<string, unknown>),
        tower: objWithKills((raw.objectives?.tower ?? {}) as unknown as Record<string, unknown>),
        inhibitor: objWithKills((raw.objectives?.inhibitor ?? {}) as unknown as Record<string, unknown>),
        riftHerald: objWithKills((raw.objectives?.riftHerald ?? {}) as unknown as Record<string, unknown>),
        horde: objWithKills((raw.objectives?.horde ?? {}) as unknown as Record<string, unknown>),
      },
    }
  } catch (err) {
    console.error('[getOverviewTeamsStats]', err)
    return null
  }
}
