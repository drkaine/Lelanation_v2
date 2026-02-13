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
  rankTier?: string | null,
  includeSmite?: boolean
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

    const rawSpells = Array.isArray(raw.summonerSpells) ? raw.summonerSpells.map(mapSpell) : []
    const summonerSpells = includeSmite ? rawSpells : rawSpells.filter(s => s.spellId !== 11)
    return {
      totalParticipants: Number(raw.totalParticipants) ?? 0,
      runes: Array.isArray(raw.runes) ? raw.runes.map(mapRune) : [],
      runeSets: Array.isArray(raw.runeSets) ? raw.runeSets.map(mapRuneSet) : [],
      items: Array.isArray(raw.items) ? raw.items.map(mapItem) : [],
      itemSets: Array.isArray(raw.itemSets) ? raw.itemSets.map(mapItemSet) : [],
      itemsByOrder,
      summonerSpells,
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

/** Duration vs winrate by 5-min buckets for a specific champion. */
export async function getDurationWinrateByChampion(
  championId: number,
  version?: string | null,
  rankTier?: string | null
): Promise<OverviewDurationWinrateStats | null> {
  if (!isDatabaseConfigured()) return null
  try {
    const pVersion = version != null && version !== '' ? version : null
    const pRankTier = rankTier != null && rankTier !== '' ? rankTier : null
    const rows = await prisma.$queryRaw<OverviewDurationWinrateRow>(
      Prisma.sql`SELECT get_stats_duration_winrate_by_champion(${championId}, ${pVersion}, ${pRankTier}) AS get_stats_overview_duration_winrate`
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
    console.error('[getDurationWinrateByChampion]', err)
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

/** Normalize version/rankTier to non-empty string array (for multi-select). */
function toParamArray(value: string | string[] | null | undefined): string[] {
  if (value == null) return []
  if (Array.isArray(value)) {
    return value.filter((s): s is string => typeof s === 'string' && s !== '' && !s.startsWith('['))
  }
  if (typeof value === 'string' && value !== '' && !value.startsWith('[')) return [value]
  return []
}

/** Build SQL condition for version + rank; supports multiple versions and rank tiers (OR within each). */
function buildMatchCond(
  pVersion: string | string[] | null | undefined,
  pRankTier: string | string[] | null | undefined
): string {
  const esc = (s: string) => String(s).replace(/'/g, "''")
  const versions = toParamArray(pVersion)
  const rankTiers = toParamArray(pRankTier)
  const versionCond =
    versions.length === 0
      ? '1=1'
      : `(${versions.map((v) => `m.game_version IS NOT NULL AND m.game_version LIKE '${esc(v)}.%'`).join(' OR ')})`
  const rankCond =
    rankTiers.length === 0
      ? '1=1'
      : `(${rankTiers
          .map(
            (r) =>
              `m.rank IS NOT NULL AND m.rank != '' AND UPPER(TRIM(split_part(m.rank, '_', 1))) = UPPER(TRIM('${esc(r)}'))`
          )
          .join(' OR ')})`
  return `${versionCond} AND ${rankCond}`
}

/** Side = Blue (100) vs Red (200). */
export interface OverviewSidesStats {
  matchCount: number
  sideWinrate: {
    blue: { matches: number; wins: number; winrate: number }
    red: { matches: number; wins: number; winrate: number }
  }
  championWinrateBySide: {
    blue: Array<{ championId: number; games: number; wins: number; winrate: number }>
    red: Array<{ championId: number; games: number; wins: number; winrate: number }>
  }
  /** Top 20 by games (most played) per side. */
  championPickBySide: {
    blue: Array<{ championId: number; games: number; wins: number; winrate: number }>
    red: Array<{ championId: number; games: number; wins: number; winrate: number }>
  }
  objectivesBySide: {
    blue: ObjectiveCountsBySide
    red: ObjectiveCountsBySide
  }
  /** Same shape as overview teams objectives: first + distribution for table (Blue/Red columns). */
  objectivesBySideTable: {
    firstBlood: { firstByBlue: number; firstByRed: number }
    baron: ObjectiveSideWithDistribution
    dragon: ObjectiveSideWithDistribution
    tower: ObjectiveSideWithDistribution
    inhibitor: ObjectiveSideWithDistribution
    riftHerald: ObjectiveSideWithDistribution
    horde: ObjectiveSideWithDistribution
  }
  bansBySide: {
    blue: Array<{ championId: number; count: number }>
    red: Array<{ championId: number; count: number }>
  }
}

export interface ObjectiveSideWithDistribution {
  firstByBlue: number
  firstByRed: number
  killsByBlue: number
  killsByRed: number
  distributionByBlue: Record<string, number>
  distributionByRed: Record<string, number>
}

export interface ObjectiveCountsBySide {
  firstBlood: number
  baronFirst: number
  baronKills: number
  dragonFirst: number
  dragonKills: number
  towerFirst: number
  towerKills: number
  inhibitorFirst: number
  inhibitorKills: number
  riftHeraldFirst: number
  riftHeraldKills: number
  hordeFirst: number
  hordeKills: number
}

export async function getOverviewSidesStats(
  version?: string | string[] | null,
  rankTier?: string | string[] | null
): Promise<OverviewSidesStats | null> {
  if (!isDatabaseConfigured()) return null
  const matchCond = buildMatchCond(version, rankTier)

  try {
    // 1) Side winrate: from participants with team_id 100/200
    const sideWinrateSql = `
      SELECT p.team_id AS team_id,
             COUNT(DISTINCT p.match_id)::int AS matches,
             COUNT(DISTINCT CASE WHEN p.win THEN p.match_id END)::int AS wins
      FROM participants p
      INNER JOIN matches m ON m.id = p.match_id
      WHERE ${matchCond} AND p.team_id IN (100, 200)
      GROUP BY p.team_id
    `
    const sideRows = await prisma.$queryRawUnsafe<
      Array<{ team_id: number; matches: number; wins: number }>
    >(sideWinrateSql)
    const blueRow = sideRows.find((r) => r.team_id === 100)
    const redRow = sideRows.find((r) => r.team_id === 200)
    const toSide = (r: { matches: number; wins: number } | undefined) => {
      const matches = r ? Number(r.matches) : 0
      const wins = r ? Number(r.wins) : 0
      return {
        matches,
        wins,
        winrate: matches > 0 ? Math.round((wins / matches) * 1000) / 10 : 0,
      }
    }
    const totalMatchCount = (blueRow ? Number(blueRow.matches) : 0) + (redRow ? Number(redRow.matches) : 0)

    // 2) Champion winrate by side (top 20 each)
    const champBySideSql = `
      SELECT p.team_id AS team_id, p.champion_id AS champion_id,
             COUNT(*)::int AS games,
             SUM(CASE WHEN p.win THEN 1 ELSE 0 END)::int AS wins
      FROM participants p
      INNER JOIN matches m ON m.id = p.match_id
      WHERE ${matchCond} AND p.team_id IN (100, 200)
      GROUP BY p.team_id, p.champion_id
      HAVING COUNT(*) >= 10
    `
    const champRows = await prisma.$queryRawUnsafe<
      Array<{ team_id: number; champion_id: number; games: number; wins: number }>
    >(champBySideSql)
    const blueChamps = champRows
      .filter((r) => r.team_id === 100)
      .map((r) => ({
        championId: Number(r.champion_id),
        games: Number(r.games),
        wins: Number(r.wins),
        winrate: Number(r.games) > 0 ? Math.round((Number(r.wins) / Number(r.games)) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.winrate - a.winrate)
      .slice(0, 20)
    const redChamps = champRows
      .filter((r) => r.team_id === 200)
      .map((r) => ({
        championId: Number(r.champion_id),
        games: Number(r.games),
        wins: Number(r.wins),
        winrate: Number(r.games) > 0 ? Math.round((Number(r.wins) / Number(r.games)) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.winrate - a.winrate)
      .slice(0, 20)

    // 2b) Most played by side (top 20 by games)
    const bluePick = champRows
      .filter((r) => r.team_id === 100)
      .map((r) => ({
        championId: Number(r.champion_id),
        games: Number(r.games),
        wins: Number(r.wins),
        winrate: Number(r.games) > 0 ? Math.round((Number(r.wins) / Number(r.games)) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.games - a.games)
      .slice(0, 20)
    const redPick = champRows
      .filter((r) => r.team_id === 200)
      .map((r) => ({
        championId: Number(r.champion_id),
        games: Number(r.games),
        wins: Number(r.wins),
        winrate: Number(r.games) > 0 ? Math.round((Number(r.wins) / Number(r.games)) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.games - a.games)
      .slice(0, 20)

    // 3) Objectives by side from match.teams (100 / 200)
    const objBySideSql = `
      WITH match_teams AS (
        SELECT m.id AS match_id, (elem->>'teamId')::int AS team_id, elem->'objectives' AS objectives
        FROM matches m, jsonb_array_elements(COALESCE(m.teams, '[]'::jsonb)) AS elem
        WHERE m.teams IS NOT NULL AND jsonb_array_length(m.teams) > 0
          AND (elem->>'teamId')::int IN (100, 200) AND ${matchCond.replace(/^m\./g, 'm.')}
      ),
      base AS (SELECT match_id, team_id FROM match_teams),
      mt AS (SELECT match_id, team_id, objectives FROM match_teams WHERE objectives IS NOT NULL)
      SELECT
        mt.team_id,
        SUM(CASE WHEN (mt.objectives->'champion'->>'first')::boolean THEN 1 ELSE 0 END)::int AS first_blood,
        SUM(CASE WHEN (mt.objectives->'baron'->>'first')::boolean THEN 1 ELSE 0 END)::int AS baron_first,
        SUM(COALESCE((mt.objectives->'baron'->>'kills')::int, 0))::int AS baron_kills,
        SUM(CASE WHEN (mt.objectives->'dragon'->>'first')::boolean THEN 1 ELSE 0 END)::int AS dragon_first,
        SUM(COALESCE((mt.objectives->'dragon'->>'kills')::int, 0))::int AS dragon_kills,
        SUM(CASE WHEN (mt.objectives->'tower'->>'first')::boolean THEN 1 ELSE 0 END)::int AS tower_first,
        SUM(COALESCE((mt.objectives->'tower'->>'kills')::int, 0))::int AS tower_kills,
        SUM(CASE WHEN (mt.objectives->'inhibitor'->>'first')::boolean THEN 1 ELSE 0 END)::int AS inhibitor_first,
        SUM(COALESCE((mt.objectives->'inhibitor'->>'kills')::int, 0))::int AS inhibitor_kills,
        SUM(CASE WHEN (mt.objectives->'riftHerald'->>'first')::boolean THEN 1 ELSE 0 END)::int AS rift_herald_first,
        SUM(COALESCE((mt.objectives->'riftHerald'->>'kills')::int, 0))::int AS rift_herald_kills,
        SUM(CASE WHEN (mt.objectives->'horde'->>'first')::boolean THEN 1 ELSE 0 END)::int AS horde_first,
        SUM(COALESCE((mt.objectives->'horde'->>'kills')::int, 0))::int AS horde_kills
      FROM mt
      GROUP BY mt.team_id
    `
    const objRows = await prisma.$queryRawUnsafe<
      Array<{
        team_id: number
        first_blood: number
        baron_first: number
        baron_kills: number
        dragon_first: number
        dragon_kills: number
        tower_first: number
        tower_kills: number
        inhibitor_first: number
        inhibitor_kills: number
        rift_herald_first: number
        rift_herald_kills: number
        horde_first: number
        horde_kills: number
      }>
    >(objBySideSql)

    const toObj = (r: (typeof objRows)[0] | undefined): ObjectiveCountsBySide => ({
      firstBlood: r ? Number(r.first_blood) : 0,
      baronFirst: r ? Number(r.baron_first) : 0,
      baronKills: r ? Number(r.baron_kills) : 0,
      dragonFirst: r ? Number(r.dragon_first) : 0,
      dragonKills: r ? Number(r.dragon_kills) : 0,
      towerFirst: r ? Number(r.tower_first) : 0,
      towerKills: r ? Number(r.tower_kills) : 0,
      inhibitorFirst: r ? Number(r.inhibitor_first) : 0,
      inhibitorKills: r ? Number(r.inhibitor_kills) : 0,
      riftHeraldFirst: r ? Number(r.rift_herald_first) : 0,
      riftHeraldKills: r ? Number(r.rift_herald_kills) : 0,
      hordeFirst: r ? Number(r.horde_first) : 0,
      hordeKills: r ? Number(r.horde_kills) : 0,
    })
    const blueObj = toObj(objRows.find((r) => r.team_id === 100))
    const redObj = toObj(objRows.find((r) => r.team_id === 200))

    // 3b) Distribution per objective (per-team kill count -> match count) for table
    const distSql = `
      WITH match_teams AS (
        SELECT m.id AS match_id, (elem->>'teamId')::int AS team_id, elem->'objectives' AS objectives
        FROM matches m, jsonb_array_elements(COALESCE(m.teams, '[]'::jsonb)) AS elem
        WHERE m.teams IS NOT NULL AND jsonb_array_length(m.teams) > 0
          AND (elem->>'teamId')::int IN (100, 200) AND ${matchCond.replace(/^m\./g, 'm.')}
      ),
      mt AS (SELECT match_id, team_id, objectives FROM match_teams WHERE objectives IS NOT NULL)
      SELECT mt.team_id,
             COALESCE((mt.objectives->'baron'->>'kills')::int, 0) AS baron_kills,
             COALESCE((mt.objectives->'dragon'->>'kills')::int, 0) AS dragon_kills,
             COALESCE((mt.objectives->'tower'->>'kills')::int, 0) AS tower_kills,
             COALESCE((mt.objectives->'inhibitor'->>'kills')::int, 0) AS inhibitor_kills,
             COALESCE((mt.objectives->'riftHerald'->>'kills')::int, 0) AS rift_herald_kills,
             COALESCE((mt.objectives->'horde'->>'kills')::int, 0) AS horde_kills
      FROM mt
    `
    const distRows = await prisma.$queryRawUnsafe<
      Array<{
        team_id: number
        baron_kills: number
        dragon_kills: number
        tower_kills: number
        inhibitor_kills: number
        rift_herald_kills: number
        horde_kills: number
      }>
    >(distSql)
    const objKeys = ['baron', 'dragon', 'tower', 'inhibitor', 'riftHerald', 'horde'] as const
    const killKeys = [
      'baron_kills',
      'dragon_kills',
      'tower_kills',
      'inhibitor_kills',
      'rift_herald_kills',
      'horde_kills',
    ] as const
    const buildDist = (teamId: 100 | 200) => {
      const rows = distRows.filter((r) => r.team_id === teamId)
      const out: Record<string, Record<string, number>> = {}
      for (let i = 0; i < objKeys.length; i++) {
        const key = objKeys[i]
        const col = killKeys[i]
        const counts: Record<string, number> = {}
        for (const row of rows) {
          const k = String((row as Record<string, number>)[col] ?? 0)
          counts[k] = (counts[k] ?? 0) + 1
        }
        out[key] = counts
      }
      return out
    }
    const distBlue = buildDist(100)
    const distRed = buildDist(200)
    const objectivesBySideTable = {
      firstBlood: {
        firstByBlue: blueObj.firstBlood,
        firstByRed: redObj.firstBlood,
      },
      baron: {
        firstByBlue: blueObj.baronFirst,
        firstByRed: redObj.baronFirst,
        killsByBlue: blueObj.baronKills,
        killsByRed: redObj.baronKills,
        distributionByBlue: distBlue.baron ?? {},
        distributionByRed: distRed.baron ?? {},
      },
      dragon: {
        firstByBlue: blueObj.dragonFirst,
        firstByRed: redObj.dragonFirst,
        killsByBlue: blueObj.dragonKills,
        killsByRed: redObj.dragonKills,
        distributionByBlue: distBlue.dragon ?? {},
        distributionByRed: distRed.dragon ?? {},
      },
      tower: {
        firstByBlue: blueObj.towerFirst,
        firstByRed: redObj.towerFirst,
        killsByBlue: blueObj.towerKills,
        killsByRed: redObj.towerKills,
        distributionByBlue: distBlue.tower ?? {},
        distributionByRed: distRed.tower ?? {},
      },
      inhibitor: {
        firstByBlue: blueObj.inhibitorFirst,
        firstByRed: redObj.inhibitorFirst,
        killsByBlue: blueObj.inhibitorKills,
        killsByRed: redObj.inhibitorKills,
        distributionByBlue: distBlue.inhibitor ?? {},
        distributionByRed: distRed.inhibitor ?? {},
      },
      riftHerald: {
        firstByBlue: blueObj.riftHeraldFirst,
        firstByRed: redObj.riftHeraldFirst,
        killsByBlue: blueObj.riftHeraldKills,
        killsByRed: redObj.riftHeraldKills,
        distributionByBlue: distBlue.riftHerald ?? {},
        distributionByRed: distRed.riftHerald ?? {},
      },
      horde: {
        firstByBlue: blueObj.hordeFirst,
        firstByRed: redObj.hordeFirst,
        killsByBlue: blueObj.hordeKills,
        killsByRed: redObj.hordeKills,
        distributionByBlue: distBlue.horde ?? {},
        distributionByRed: distRed.horde ?? {},
      },
    }

    // 4) Bans by side from match.teams
    const bansBySideSql = `
      WITH match_teams AS (
        SELECT m.id AS match_id, (elem->>'teamId')::int AS team_id, elem->'bans' AS bans
        FROM matches m, jsonb_array_elements(COALESCE(m.teams, '[]'::jsonb)) AS elem
        WHERE m.teams IS NOT NULL AND jsonb_array_length(m.teams) > 0
          AND (elem->>'teamId') IS NOT NULL AND (elem->>'teamId') ~ '^(100|200)$'
          AND ${matchCond}
      ),
      ban_rows AS (
        SELECT mt.team_id, (b->>'championId')::int AS champion_id, COUNT(*)::int AS cnt
        FROM match_teams mt, jsonb_array_elements(COALESCE(mt.bans, '[]'::jsonb)) AS b
        WHERE mt.bans IS NOT NULL AND jsonb_typeof(mt.bans) = 'array'
          AND b->>'championId' IS NOT NULL AND (b->>'championId') ~ '^\\d+$'
        GROUP BY mt.team_id, (b->>'championId')::int
      )
      SELECT team_id, champion_id, cnt FROM ban_rows ORDER BY team_id, cnt DESC
    `
    const banRows = await prisma.$queryRawUnsafe<
      Array<{ team_id: number; champion_id: number; cnt: number }>
    >(bansBySideSql)
    const blueBans = banRows
      .filter((r) => r.team_id === 100)
      .map((r) => ({ championId: Number(r.champion_id), count: Number(r.cnt) }))
      .sort((a, b) => b.count - a.count)
    const redBans = banRows
      .filter((r) => r.team_id === 200)
      .map((r) => ({ championId: Number(r.champion_id), count: Number(r.cnt) }))
      .sort((a, b) => b.count - a.count)

    return {
      matchCount: totalMatchCount,
      sideWinrate: {
        blue: toSide(blueRow),
        red: toSide(redRow),
      },
      championWinrateBySide: { blue: blueChamps, red: redChamps },
      championPickBySide: { blue: bluePick, red: redPick },
      objectivesBySide: { blue: blueObj, red: redObj },
      objectivesBySideTable,
      bansBySide: { blue: blueBans, red: redBans },
    }
  } catch (err) {
    console.error('[getOverviewSidesStats]', err)
    return null
  }
}
