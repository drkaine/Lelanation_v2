/**
 * Overview stats for the statistics page: total matches, last update, top winrate champions,
 * matches per division, distinct participant count (unique player_id in match_players).
 * Uses new aggregate tables (champion_core_stats, team_core_stats, champion_bucket, etc.)
 * and raw tables (matchs, match_players, teams, bans) with the new schema.
 */
import { Prisma } from '../generated/prisma/index.js'
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'
import {
  applyRankTierWhere,
  rankTierCacheKey,
  toQueryStringArrayParam,
} from '../utils/statsFilters.js'

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
  topPickrateChampions?: Array<{
    championId: number
    games: number
    wins: number
    winrate: number
    pickrate: number
  }>
  topBanrateChampions?: Array<{
    championId: number
    banCount: number
    banrate: number
  }>
  matchesByDivision: Array<{ rankTier: string; matchCount: number }>
  matchesByVersion: Array<{ version: string; matchCount: number }>
  playerCount: number
  _championPool?: Array<{ championId: number; pickrate: number }>
}

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

export const EMPTY_OVERVIEW_DETAIL: OverviewDetailStats = {
  totalParticipants: 0,
  runes: [],
  runeSets: [],
  items: [],
  itemSets: [],
  itemsByOrder: {},
  summonerSpells: [],
}

export interface OverviewTeamsStats {
  matchCount: number
  bans: {
    byWin: Array<{ championId: number; count: number; banRatePercent: string }>
    byLoss: Array<{ championId: number; count: number; banRatePercent: string }>
    top20Total: Array<{ championId: number; count: number; banRatePercent: string }>
  }
  objectives: {
    firstBlood: { firstByWin: number; firstByLoss: number }
    baron: ObjectiveWithDistribution
    dragon: ObjectiveWithDistribution
    elder: ObjectiveWithDistribution
    tower: ObjectiveWithDistribution
    inhibitor: ObjectiveWithDistribution
    riftHerald: ObjectiveWithDistribution
    horde: ObjectiveWithDistribution
  }
  drakes: {
    types: {
      elder: { byWin: number; byLoss: number }
      earth: { byWin: number; byLoss: number }
      water: { byWin: number; byLoss: number }
      wind: { byWin: number; byLoss: number }
      fire: { byWin: number; byLoss: number }
      hextec: { byWin: number; byLoss: number }
      chem: { byWin: number; byLoss: number }
    }
    souls: {
      earth: { byWin: number; byLoss: number }
      water: { byWin: number; byLoss: number }
      wind: { byWin: number; byLoss: number }
      fire: { byWin: number; byLoss: number }
      hextec: { byWin: number; byLoss: number }
      chem: { byWin: number; byLoss: number }
    }
  }
}

export interface ObjectiveWithDistribution {
  firstByWin: number
  firstByLoss: number
  killsByWin: number
  killsByLoss: number
  distributionByWin: Record<string, number>
  distributionByLoss: Record<string, number>
}

export interface OverviewDurationWinrateStats {
  buckets: Array<{
    durationMinutes: number
    matches: number
    winrate: number
  }>
}

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

export interface OverviewProgressionFullStats {
  oldestVersion: string | null
  champions: Array<{
    championId: number
    wrOldest: number
    wrSince: number
    deltaWr: number
    pickrateOldest: number
    pickrateSince: number
    deltaPick: number
    banrateOldest: number
    banrateSince: number
    deltaBan: number
  }>
}

export interface OverviewSidesStats {
  blue: { matches: number; wins: number; winrate: number }
  red: { matches: number; wins: number; winrate: number }
  totalMatches: number
  champsByBlue: Array<{ championId: number; games: number; wins: number; winrate: number }>
  champsByRed: Array<{ championId: number; games: number; wins: number; winrate: number }>
  topObjectivesBlue: ObjectiveSideWithDistribution
  topObjectivesRed: ObjectiveSideWithDistribution
  objectiveCountsBySide: ObjectiveCountsBySide
}

export interface ObjectiveSideWithDistribution {
  baron: { count: number }
  dragon: { count: number }
  tower: { count: number }
  riftHerald: { count: number }
  inhibitor: { count: number }
  horde: { count: number }
  firstBlood: { count: number }
}

export interface ObjectiveCountsBySide {
  blue: ObjectiveSideWithDistribution
  red: ObjectiveSideWithDistribution
}

// ── Cache ────────────────────────────────────────────────────────────────────

const OVERVIEW_CACHE_TTL_MS = 5 * 60 * 1000
const OVERVIEW_DETAIL_CACHE_TTL_MS = 10 * 60 * 1000
let hasWarnedMissingTeamBucket = false

const overviewStatsCache = new Map<string, { data: OverviewStats; expiresAt: number }>()
const overviewTeamsCache = new Map<string, { data: OverviewTeamsStats; expiresAt: number }>()
const overviewDurationWinrateCache = new Map<string, { data: OverviewDurationWinrateStats; expiresAt: number }>()
const overviewProgressionCache = new Map<string, { data: OverviewProgressionStats; expiresAt: number }>()
const overviewProgressionFullCache = new Map<string, { data: OverviewProgressionFullStats; expiresAt: number }>()
const overviewSidesCache = new Map<string, { data: OverviewSidesStats; expiresAt: number }>()
const overviewDetailCache = new Map<string, { data: OverviewDetailStats; expiresAt: number }>()

function overviewCacheKey(v: string | null, r: string | null): string {
  return `${v ?? ''}|${r ?? ''}`
}
function overviewDetailCacheKey(
  v: string | null,
  rankTier: string | string[] | null | undefined,
  role: string | null,
  s: boolean
): string {
  return `${v ?? ''}|${rankTierCacheKey(rankTier) ?? ''}|${role ?? ''}|${s}`
}
function sidesCacheKey(
  version: string | string[] | null | undefined,
  rankTier: string | string[] | null | undefined
): string {
  const v = Array.isArray(version) ? version.join(',') : version ?? ''
  const r = rankTierCacheKey(rankTier) ?? ''
  return `${v}|${r}`
}

// ── Param normalisation ──────────────────────────────────────────────────────

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

/** Build Prisma where for matchs table given version + rankTier filters. */
function buildMatchWhere(
  version?: string | string[] | null,
  rankTier?: string | string[] | null
): Record<string, unknown> {
  const where: Record<string, unknown> = {}
  const versions = toQueryStringArrayParam(version)
  const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
  if (versions.length === 1) where.gameVersion = { startsWith: versions[0] }
  else if (versions.length > 1) where.gameVersion = { in: versions.flatMap(v => [v]) }
  if (ranks.length === 1) where.rankTier = ranks[0]
  else if (ranks.length > 1) where.rankTier = { in: ranks }
  else where.rankTier = { not: 'UNRANKED' }
  return where
}

// ── getOverviewStats ─────────────────────────────────────────────────────────

export async function getOverviewStats(
  version?: string | string[] | null,
  rankTier?: string | string[] | null,
  role?: string | null
): Promise<OverviewStats | null> {
  if (!isDatabaseConfigured()) return null
  const pVersion = normalizeOverviewParam(version)
  const pRole = role != null && role !== '' ? role : null
  const pRankTierKey = rankTierCacheKey(rankTier)
  const now = Date.now()
  const cacheKey = `${overviewCacheKey(pVersion, pRankTierKey)}|${pRole ?? ''}`
  const cached = overviewStatsCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.data

  try {
    const coreWhere: Record<string, unknown> = {}
    if (pVersion) coreWhere.gameVersion = { startsWith: pVersion }
    applyRankTierWhere(coreWhere, rankTier, { excludeUnrankedWhenEmpty: true })
    if (pRole) coreWhere.role = pRole

    const matchWhere = buildMatchWhere(version, rankTier)

    const [coreRows, matchCountRows, matchDivisionRows, matchVersionRows, playerCountResult] = await Promise.all([
      prisma.mvChampionCoreStat.findMany({
        where: coreWhere,
        select: { championId: true, countWin: true, countGame: true, countBan: true },
      }),
      prisma.match.count({ where: matchWhere }),
      prisma.match.groupBy({
        by: ['rankTier'],
        where: matchWhere,
        _count: { _all: true },
        orderBy: { _count: { rankTier: 'desc' } },
      }),
      prisma.match.groupBy({
        by: ['gameVersion'],
        where: matchWhere,
        _count: { _all: true },
        orderBy: { _count: { gameVersion: 'desc' } },
        take: 20,
      }),
      prisma.$queryRaw<[{ cnt: bigint }]>(
        Prisma.sql`SELECT COUNT(DISTINCT player_id) AS cnt FROM match_players`
      ),
    ])

    const totalMatches = matchCountRows

    // Aggregate champion stats
    const byChampion = new Map<number, { wins: number; games: number; bans: number }>()
    let totalParticipants = 0
    for (const row of coreRows) {
      let entry = byChampion.get(row.championId)
      if (!entry) {
        entry = { wins: 0, games: 0, bans: 0 }
        byChampion.set(row.championId, entry)
      }
      entry.wins += row.countWin
      entry.games += row.countGame
      entry.bans += row.countBan
      totalParticipants += row.countGame
    }

    const champList = Array.from(byChampion.entries())
      .filter(([, e]) => e.games >= 20)
      .map(([championId, e]) => ({
        championId,
        games: e.games,
        wins: e.wins,
        winrate: e.games > 0 ? (e.wins / e.games) * 100 : 0,
        pickrate: totalParticipants > 0 ? (e.games / totalParticipants) * 100 : 0,
        banrate:
          totalMatches > 0 ? Math.min(100, (e.bans / (2 * totalMatches)) * 100) : 0,
        bans: e.bans,
      }))

    const topWinrateChampions = [...champList]
      .sort((a, b) => b.winrate - a.winrate)
      .slice(0, 5)
      .map(({ championId, games, wins, winrate, pickrate }) => ({
        championId, games, wins,
        winrate: Math.round(winrate * 100) / 100,
        pickrate: Math.round(pickrate * 100) / 100,
      }))

    const topPickrateChampions = [...champList]
      .sort((a, b) => b.pickrate - a.pickrate)
      .slice(0, 5)
      .map(({ championId, games, wins, winrate, pickrate }) => ({
        championId, games, wins,
        winrate: Math.round(winrate * 100) / 100,
        pickrate: Math.round(pickrate * 100) / 100,
      }))

    const topBanrateChampions = [...champList]
      .filter(c => c.bans > 0)
      .sort((a, b) => b.bans - a.bans)
      .slice(0, 5)
      .map(({ championId, bans, banrate }) => ({
        championId,
        banCount: bans,
        banrate: Math.round(banrate * 100) / 100,
      }))

    const matchesByDivision = matchDivisionRows.map((r) => ({
      rankTier: r.rankTier,
      matchCount: r._count._all,
    }))

    const matchesByVersion = matchVersionRows.map((r) => ({
      version: r.gameVersion,
      matchCount: r._count._all,
    }))

    const playerCount = Number(playerCountResult[0]?.cnt ?? 0)

    const result: OverviewStats = {
      totalMatches,
      lastUpdate: null,
      topWinrateChampions,
      topPickrateChampions,
      topBanrateChampions,
      matchesByDivision,
      matchesByVersion,
      playerCount,
      _championPool: champList.map((c) => ({ championId: c.championId, pickrate: c.pickrate })),
    }

    overviewStatsCache.set(cacheKey, { data: result, expiresAt: now + OVERVIEW_CACHE_TTL_MS })
    return result
  } catch (err) {
    console.error('[getOverviewStats]', err instanceof Error ? err.message : err)
    return null
  }
}

// ── getOverviewDetailStats ───────────────────────────────────────────────────

const OVERVIEW_DETAIL_EXCLUDED_ITEM_IDS = new Set([3340, 3364, 3363])

export async function getOverviewDetailStats(
  version?: string | null,
  rankTier?: string | string[] | null,
  includeSmite?: boolean,
  role?: string | null
): Promise<OverviewDetailStats | null> {
  if (!isDatabaseConfigured()) return null
  const pVersion = version != null && version !== '' ? version : null
  const pRole = role != null && role !== '' ? role : null
  const key = overviewDetailCacheKey(pVersion, rankTier, pRole, includeSmite ?? false)
  const now = Date.now()
  const cached = overviewDetailCache.get(key)
  if (cached && cached.expiresAt > now) return cached.data

  try {
    const coreWhere: Record<string, unknown> = {}
    if (pVersion) coreWhere.gameVersion = { startsWith: pVersion }
    applyRankTierWhere(coreWhere, rankTier, { excludeUnrankedWhenEmpty: true })
    if (pRole) coreWhere.role = pRole

    const coreStats = await prisma.mvChampionCoreStat.findMany({
      where: coreWhere,
      select: { id: true, countGame: true },
    })
    const totalParticipants = coreStats.reduce((s, r) => s + r.countGame, 0)
    if (totalParticipants === 0) {
      overviewDetailCache.set(key, { data: EMPTY_OVERVIEW_DETAIL, expiresAt: now + OVERVIEW_DETAIL_CACHE_TTL_MS })
      return EMPTY_OVERVIEW_DETAIL
    }

    const statIds = coreStats.map((s) => s.id)

    const [soloRunes, soloItems, spells] = await Promise.all([
      prisma.mvChampionRunesSoloStat.findMany({
        where: { championStatId: { in: statIds } },
        select: { perkId: true, countWin: true, countGame: true },
      }),
      prisma.mvChampionItemSoloStat.findMany({
        where: { championStatId: { in: statIds } },
        select: { itemId: true, countWin: true, countGame: true, countStarter: true, countCore: true },
      }),
      prisma.mvChampionSummonerSpellAgg.findMany({
        where: {
          championStatId: { in: statIds },
          ...(!includeSmite ? { spellId: { not: 11 } } : {}),
        },
        select: { spellId: true, countWin: true, countGame: true },
      }),
    ])

    // Per-rune aggregation
    const runeMap = new Map<number, { wins: number; games: number }>()
    for (const r of soloRunes) {
      let e = runeMap.get(r.perkId)
      if (!e) { e = { wins: 0, games: 0 }; runeMap.set(r.perkId, e) }
      e.wins += r.countWin; e.games += r.countGame
    }
    const runes = Array.from(runeMap.entries())
      .map(([runeId, e]) => ({
        runeId,
        games: e.games,
        wins: e.wins,
        pickrate: totalParticipants > 0 ? Math.round((e.games / totalParticipants) * 10000) / 100 : 0,
        winrate: e.games > 0 ? Math.round((e.wins / e.games) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.games - a.games)

    // Per-item aggregation
    const itemMap = new Map<number, { wins: number; games: number }>()
    for (const r of soloItems) {
      if (OVERVIEW_DETAIL_EXCLUDED_ITEM_IDS.has(r.itemId)) continue
      let e = itemMap.get(r.itemId)
      if (!e) { e = { wins: 0, games: 0 }; itemMap.set(r.itemId, e) }
      e.wins += r.countWin; e.games += r.countGame
    }
    const items = Array.from(itemMap.entries())
      .map(([itemId, e]) => ({
        itemId,
        games: e.games,
        wins: e.wins,
        pickrate: totalParticipants > 0 ? Math.round((e.games / totalParticipants) * 10000) / 100 : 0,
        winrate: e.games > 0 ? Math.round((e.wins / e.games) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.games - a.games)

    // Summoner spells
    const spellMap = new Map<number, { wins: number; games: number }>()
    for (const r of spells) {
      let e = spellMap.get(r.spellId)
      if (!e) { e = { wins: 0, games: 0 }; spellMap.set(r.spellId, e) }
      e.wins += r.countWin; e.games += r.countGame
    }
    const summonerSpells = Array.from(spellMap.entries())
      .map(([spellId, e]) => ({
        spellId,
        games: e.games,
        wins: e.wins,
        pickrate: totalParticipants > 0 ? Math.round((e.games / totalParticipants) * 10000) / 100 : 0,
        winrate: e.games > 0 ? Math.round((e.wins / e.games) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.games - a.games)

    // Item sets (combinations) - from champion_item_stats
    const itemSetRows = await prisma.mvChampionItemStat.findMany({
      where: { championStatId: { in: statIds } },
      select: { itemList: true, countWin: true, countGame: true },
      take: 2000,
    })
    const itemSetMap = new Map<string, { wins: number; games: number }>()
    for (const r of itemSetRows) {
      let e = itemSetMap.get(r.itemList)
      if (!e) { e = { wins: 0, games: 0 }; itemSetMap.set(r.itemList, e) }
      e.wins += r.countWin; e.games += r.countGame
    }
    const itemSets = Array.from(itemSetMap.entries())
      .filter(([, e]) => e.games >= 5)
      .map(([listStr, e]) => {
        let parsedItems: number[]
        try { parsedItems = JSON.parse(listStr) as number[] } catch { parsedItems = [] }
        return {
          items: parsedItems.filter((id) => !OVERVIEW_DETAIL_EXCLUDED_ITEM_IDS.has(id)),
          games: e.games,
          wins: e.wins,
          pickrate: totalParticipants > 0 ? Math.round((e.games / totalParticipants) * 10000) / 100 : 0,
          winrate: e.games > 0 ? Math.round((e.wins / e.games) * 10000) / 100 : 0,
        }
      })
      .sort((a, b) => b.games - a.games)
      .slice(0, 50)

    // Rune sets (combinations) - from champion_runes_stats
    const runeSetRows = await prisma.mvChampionRunesStat.findMany({
      where: { championStatId: { in: statIds } },
      select: { runeList: true, countWin: true, countGame: true },
      take: 2000,
    })
    const runeSetMap = new Map<string, { wins: number; games: number }>()
    for (const r of runeSetRows) {
      let e = runeSetMap.get(r.runeList)
      if (!e) { e = { wins: 0, games: 0 }; runeSetMap.set(r.runeList, e) }
      e.wins += r.countWin; e.games += r.countGame
    }
    const runeSets = Array.from(runeSetMap.entries())
      .filter(([, e]) => e.games >= 5)
      .map(([listStr, e]) => {
        let parsedRunes: unknown
        try { parsedRunes = JSON.parse(listStr) } catch { parsedRunes = listStr }
        return {
          runes: parsedRunes,
          games: e.games,
          wins: e.wins,
          pickrate: totalParticipants > 0 ? Math.round((e.games / totalParticipants) * 10000) / 100 : 0,
          winrate: e.games > 0 ? Math.round((e.wins / e.games) * 10000) / 100 : 0,
        }
      })
      .sort((a, b) => b.games - a.games)
      .slice(0, 50)

    const result: OverviewDetailStats = {
      totalParticipants,
      runes,
      runeSets,
      items,
      itemSets,
      itemsByOrder: {},
      summonerSpells,
    }
    overviewDetailCache.set(key, { data: result, expiresAt: now + OVERVIEW_DETAIL_CACHE_TTL_MS })
    return result
  } catch (err) {
    console.error('[getOverviewDetailStats]', err instanceof Error ? err.message : err)
    return null
  }
}

export function invalidateOverviewDetailCache(): void {
  overviewDetailCache.clear()
}

export async function refreshStatsMaterializedViews(): Promise<{ ok: boolean; error?: string }> {
  overviewStatsCache.clear()
  overviewTeamsCache.clear()
  overviewDetailCache.clear()
  overviewDurationWinrateCache.clear()
  overviewProgressionCache.clear()
  overviewProgressionFullCache.clear()
  overviewSidesCache.clear()
  try {
    const { refreshAllMaterializedViews } = await import('./MaterializedViewService.js')
    await refreshAllMaterializedViews()
    return { ok: true }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return { ok: false, error }
  }
}

// ── getOverviewTeamsStats ────────────────────────────────────────────────────

export async function getOverviewTeamsStats(
  version?: string | null,
  rankTier?: string | string[] | null,
  role?: string | null
): Promise<OverviewTeamsStats | null> {
  if (!isDatabaseConfigured()) return null
  const pVersion = version != null && version !== '' ? version : null
  const pRole = role != null && role !== '' ? role : null
  const pRankKey = rankTierCacheKey(rankTier)
  const now = Date.now()
  const cacheKey = `${overviewCacheKey(pVersion, pRankKey)}|${pRole ?? ''}`
  const cached = overviewTeamsCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.data

  try {
    const matchWhere = buildMatchWhere(version, rankTier)
    const matchCount = await prisma.match.count({ where: matchWhere })
    const rawMatchCond = buildRawMatchCond(pVersion, rankTier)

    // Aggregate objectives by win/loss
    const winAgg = { baron: { first: 0, kills: 0 }, dragon: { first: 0, kills: 0 }, elder: { first: 0, kills: 0 }, tower: { first: 0, kills: 0 }, inhibitor: { first: 0, kills: 0 }, riftHerald: { first: 0, kills: 0 }, horde: { first: 0, kills: 0 }, firstBlood: { first: 0 } }
    const lossAgg = { baron: { first: 0, kills: 0 }, dragon: { first: 0, kills: 0 }, elder: { first: 0, kills: 0 }, tower: { first: 0, kills: 0 }, inhibitor: { first: 0, kills: 0 }, riftHerald: { first: 0, kills: 0 }, horde: { first: 0, kills: 0 }, firstBlood: { first: 0 } }
    const drakesWin = { earth: 0, water: 0, wind: 0, fire: 0, hextec: 0, chem: 0 }
    const drakesLoss = { earth: 0, water: 0, wind: 0, fire: 0, hextec: 0, chem: 0 }
    const soulsWin = { earth: 0, water: 0, wind: 0, fire: 0, hextec: 0, chem: 0 }
    const soulsLoss = { earth: 0, water: 0, wind: 0, fire: 0, hextec: 0, chem: 0 }
    const objectiveRows = await prisma.$queryRawUnsafe<
      Array<{
        team_win: boolean
        count_first_blood: number
        sum_baron_kills: number
        count_baron_first: number
        sum_dragon_kills: number
        count_dragon_first: number
        sum_tower_kills: number
        count_tower_first: number
        sum_horde_kills: number
        count_horde_first: number
        sum_rift_herald_kills: number
        count_rift_herald_first: number
        sum_inhibitor_kills: number
      }>
    >(`
      SELECT
        t.win AS team_win,
        SUM(CASE WHEN t.first_blood THEN 1 ELSE 0 END)::int AS count_first_blood,
        SUM(t.baron_kills)::int AS sum_baron_kills,
        SUM(CASE WHEN t.baron_first THEN 1 ELSE 0 END)::int AS count_baron_first,
        SUM(t.dragon_kills)::int AS sum_dragon_kills,
        SUM(CASE WHEN t.dragon_first THEN 1 ELSE 0 END)::int AS count_dragon_first,
        SUM(t.tower_kills)::int AS sum_tower_kills,
        SUM(CASE WHEN t.tower_first THEN 1 ELSE 0 END)::int AS count_tower_first,
        SUM(t.horde_kills)::int AS sum_horde_kills,
        SUM(CASE WHEN t.horde_first THEN 1 ELSE 0 END)::int AS count_horde_first,
        SUM(t.rift_herald_kills)::int AS sum_rift_herald_kills,
        SUM(CASE WHEN t.rift_herald_first THEN 1 ELSE 0 END)::int AS count_rift_herald_first,
        SUM(t.inhibitor_kills)::int AS sum_inhibitor_kills
      FROM teams t
      INNER JOIN matchs m ON m.id = t.match_id
      WHERE ${rawMatchCond}
      GROUP BY t.win
    `)
    for (const r of objectiveRows) {
      const agg = r.team_win ? winAgg : lossAgg
      agg.firstBlood.first += Number(r.count_first_blood ?? 0)
      agg.baron.first += Number(r.count_baron_first ?? 0)
      agg.baron.kills += Number(r.sum_baron_kills ?? 0)
      agg.dragon.first += Number(r.count_dragon_first ?? 0)
      agg.dragon.kills += Number(r.sum_dragon_kills ?? 0)
      agg.tower.first += Number(r.count_tower_first ?? 0)
      agg.tower.kills += Number(r.sum_tower_kills ?? 0)
      agg.horde.first += Number(r.count_horde_first ?? 0)
      agg.horde.kills += Number(r.sum_horde_kills ?? 0)
      agg.riftHerald.first += Number(r.count_rift_herald_first ?? 0)
      agg.riftHerald.kills += Number(r.sum_rift_herald_kills ?? 0)
      agg.inhibitor.kills += Number(r.sum_inhibitor_kills ?? 0)
    }

    const drakeRows = await prisma.$queryRawUnsafe<
      Array<{
        team_win: boolean
        count_earth_drake: number
        count_water_drake: number
        count_wind_drake: number
        count_fire_drake: number
        count_hextec_drake: number
        count_chem_drake: number
        count_earth_drake_soul: number
        count_water_drake_soul: number
        count_wind_drake_soul: number
        count_fire_drake_soul: number
        count_hextec_drake_soul: number
        count_chem_drake_soul: number
        sum_elder_kills: number
      }>
    >(`
      SELECT
        t.win AS team_win,
        SUM(CASE WHEN upper(d.drake_type) IN ('EARTH_DRAGON', 'MOUNTAIN_DRAGON') THEN 1 ELSE 0 END)::int AS count_earth_drake,
        SUM(CASE WHEN upper(d.drake_type) IN ('WATER_DRAGON', 'OCEAN_DRAGON') THEN 1 ELSE 0 END)::int AS count_water_drake,
        SUM(CASE WHEN upper(d.drake_type) IN ('AIR_DRAGON', 'CLOUD_DRAGON') THEN 1 ELSE 0 END)::int AS count_wind_drake,
        SUM(CASE WHEN upper(d.drake_type) = 'FIRE_DRAGON' THEN 1 ELSE 0 END)::int AS count_fire_drake,
        SUM(CASE WHEN upper(d.drake_type) = 'HEXTECH_DRAGON' THEN 1 ELSE 0 END)::int AS count_hextec_drake,
        SUM(CASE WHEN upper(d.drake_type) = 'CHEMTECH_DRAGON' THEN 1 ELSE 0 END)::int AS count_chem_drake,
        MAX(CASE WHEN upper(trim(d.soul)) IN ('MOUNTAIN', 'EARTH_DRAGON', 'MOUNTAIN_DRAGON', 'EARTH_DRAGON_SOUL', 'MOUNTAIN_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_earth_drake_soul,
        MAX(CASE WHEN upper(trim(d.soul)) IN ('OCEAN', 'WATER_DRAGON', 'OCEAN_DRAGON', 'WATER_DRAGON_SOUL', 'OCEAN_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_water_drake_soul,
        MAX(CASE WHEN upper(trim(d.soul)) IN ('CLOUD', 'AIR_DRAGON', 'CLOUD_DRAGON', 'AIR_DRAGON_SOUL', 'CLOUD_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_wind_drake_soul,
        MAX(CASE WHEN upper(trim(d.soul)) IN ('INFERNAL', 'FIRE_DRAGON', 'FIRE_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_fire_drake_soul,
        MAX(CASE WHEN upper(trim(d.soul)) IN ('HEXTECH', 'HEXTECH_DRAGON', 'HEXTECH_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_hextec_drake_soul,
        MAX(CASE WHEN upper(trim(d.soul)) IN ('CHEMTECH', 'CHEMTECH_DRAGON', 'CHEMTECH_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_chem_drake_soul,
        SUM(CASE WHEN upper(d.drake_type) = 'ELDER_DRAGON' OR lower(d.drake_type) = 'elder' THEN 1 ELSE 0 END)::int AS sum_elder_kills
      FROM drake_details d
      INNER JOIN teams t ON t.id = d.team_id
      INNER JOIN matchs m ON m.id = d.match_id
      WHERE ${rawMatchCond}
      GROUP BY t.win
    `)
    for (const r of drakeRows) {
      const drakeAgg = r.team_win ? drakesWin : drakesLoss
      drakeAgg.earth += Number(r.count_earth_drake ?? 0)
      drakeAgg.water += Number(r.count_water_drake ?? 0)
      drakeAgg.wind += Number(r.count_wind_drake ?? 0)
      drakeAgg.fire += Number(r.count_fire_drake ?? 0)
      drakeAgg.hextec += Number(r.count_hextec_drake ?? 0)
      drakeAgg.chem += Number(r.count_chem_drake ?? 0)

      const soulAgg = r.team_win ? soulsWin : soulsLoss
      soulAgg.earth += Number(r.count_earth_drake_soul ?? 0)
      soulAgg.water += Number(r.count_water_drake_soul ?? 0)
      soulAgg.wind += Number(r.count_wind_drake_soul ?? 0)
      soulAgg.fire += Number(r.count_fire_drake_soul ?? 0)
      soulAgg.hextec += Number(r.count_hextec_drake_soul ?? 0)
      soulAgg.chem += Number(r.count_chem_drake_soul ?? 0)

      const agg = r.team_win ? winAgg : lossAgg
      agg.elder.kills += Number(r.sum_elder_kills ?? 0)
    }

    // Bans from champion_core_stats - group by champion, filter by win/loss
    const coreStatsBan = await prisma.mvChampionCoreStat.findMany({
      where: {
        ...(pVersion ? { gameVersion: { startsWith: pVersion } } : {}),
        ...(() => {
          const w: Record<string, unknown> = {}
          applyRankTierWhere(w, rankTier, { excludeUnrankedWhenEmpty: true })
          if (pRole) w.role = pRole
          return w
        })(),
      },
      select: { championId: true, countBan: true, countWin: true, countGame: true },
    })

    const bansByChamp = new Map<number, { byWin: number; byLoss: number }>()
    for (const r of coreStatsBan) {
      if (r.countBan === 0) continue
      let e = bansByChamp.get(r.championId)
      if (!e) { e = { byWin: 0, byLoss: 0 }; bansByChamp.set(r.championId, e) }
      // Approximate: bans are evenly split, no win/loss info in aggregate
      e.byWin += Math.round(r.countBan / 2)
      e.byLoss += r.countBan - Math.round(r.countBan / 2)
    }

    const banList = Array.from(bansByChamp.entries())
      .map(([cid, e]) => ({ championId: cid, byWin: e.byWin, byLoss: e.byLoss, total: e.byWin + e.byLoss }))
      .sort((a, b) => b.total - a.total)

    const totalBansByWin = banList.reduce((s, b) => s + b.byWin, 0)
    const totalBansByLoss = banList.reduce((s, b) => s + b.byLoss, 0)
    const totalBansAll = banList.reduce((s, b) => s + b.total, 0)

    const addBanRate = (
      list: Array<{ championId: number; count: number }>,
      total: number
    ): Array<{ championId: number; count: number; banRatePercent: string }> =>
      list.map((b) => ({
        ...b,
        banRatePercent: total > 0 ? (Math.round((b.count / total) * 1000) / 10).toFixed(1) + '%' : '—',
      }))

    const byWinRaw = banList.slice(0, 20).map(b => ({ championId: b.championId, count: b.byWin }))
    const byLossRaw = banList.slice(0, 20).map(b => ({ championId: b.championId, count: b.byLoss }))
    const top20Total = banList.slice(0, 20).map(b => ({
      championId: b.championId,
      count: b.total,
      banRatePercent: totalBansAll > 0 ? (Math.round((b.total / totalBansAll) * 1000) / 10).toFixed(1) + '%' : '—',
    }))

    const objectiveKeyMap = new Map<string, string>([
      ['baronKills', 'baron'],
      ['dragonKills', 'dragon'],
      ['elderKills', 'elder'],
      ['towerKills', 'tower'],
      ['inhibitorKills', 'inhibitor'],
      ['riftHeraldKills', 'riftHerald'],
      ['hordeKills', 'horde'],
    ])
    type TeamObjectiveKey =
      | 'baronKills'
      | 'dragonKills'
      | 'elderKills'
      | 'towerKills'
      | 'inhibitorKills'
      | 'riftHeraldKills'
      | 'hordeKills'
    async function loadObjectiveDistribution(
      key: TeamObjectiveKey
    ): Promise<{ win: Record<string, number>; loss: Record<string, number> }> {
      const objectiveKey = objectiveKeyMap.get(key) ?? ''
      if (!objectiveKey) return { win: {}, loss: {} }
      const conditions = ['1=1']
      if (pVersion) conditions.push(`b.game_version LIKE '${pVersion}%'`)
      const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
      if (ranks.length === 1) conditions.push(`b.rank_tier = '${ranks[0]}'`)
      else if (ranks.length > 1) {
        conditions.push(`b.rank_tier IN (${ranks.map((r) => `'${r}'`).join(',')})`)
      } else {
        conditions.push(`b.rank_tier <> 'UNRANKED'`)
      }
      const whereSql = conditions.join(' AND ')
      let rows: Array<{ team: number; objective_bucket: number; count_win: number; count_game: number }> = []
      try {
        rows = await prisma.$queryRawUnsafe<
          Array<{ team: number; objective_bucket: number; count_win: number; count_game: number }>
        >(`
          SELECT
            b.team,
            tb.objective_bucket,
            SUM(tb.count_win)::int AS count_win,
            SUM(tb.count_game)::int AS count_game
          FROM mv_team_bucket tb
          JOIN mv_team_core_stats b ON b.id = tb.team_stat_id
          WHERE tb.objective_key = '${objectiveKey}'
            AND ${whereSql}
          GROUP BY b.team, tb.objective_bucket
        `)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (message.includes('42P01') || message.includes('mv_team_bucket')) {
          if (!hasWarnedMissingTeamBucket) {
            hasWarnedMissingTeamBucket = true
            console.warn('[getOverviewTeamsStats] mv_team_bucket missing; returning empty objective distributions')
          }
          return { win: {}, loss: {} }
        }
        throw err
      }
      const win: Record<string, number> = {}
      const loss: Record<string, number> = {}
      for (const r of rows) {
        const bucket = String(Number(r.objective_bucket ?? 0))
        const w = Number(r.count_win ?? 0)
        const g = Number(r.count_game ?? 0)
        win[bucket] = (win[bucket] ?? 0) + w
        loss[bucket] = (loss[bucket] ?? 0) + Math.max(0, g - w)
      }
      return { win, loss }
    }
    const [
      distBaron,
      distDragon,
      distElder,
      distTower,
      distInhibitor,
      distRiftHerald,
      distHorde,
    ] = await Promise.all([
      loadObjectiveDistribution('baronKills'),
      loadObjectiveDistribution('dragonKills'),
      loadObjectiveDistribution('elderKills'),
      loadObjectiveDistribution('towerKills'),
      loadObjectiveDistribution('inhibitorKills'),
      loadObjectiveDistribution('riftHeraldKills'),
      loadObjectiveDistribution('hordeKills'),
    ])

    const objData = (
      win: { first: number; kills: number },
      loss: { first: number; kills: number },
      dist: { win: Record<string, number>; loss: Record<string, number> }
    ): ObjectiveWithDistribution => ({
      firstByWin: win.first,
      firstByLoss: loss.first,
      killsByWin: win.kills,
      killsByLoss: loss.kills,
      distributionByWin: dist.win,
      distributionByLoss: dist.loss,
    })

    const result: OverviewTeamsStats = {
      matchCount: Math.round(matchCount),
      bans: {
        byWin: addBanRate(byWinRaw, totalBansByWin),
        byLoss: addBanRate(byLossRaw, totalBansByLoss),
        top20Total,
      },
  objectives: {
        firstBlood: { firstByWin: winAgg.firstBlood.first, firstByLoss: lossAgg.firstBlood.first },
        baron: objData(winAgg.baron, lossAgg.baron, distBaron),
        dragon: objData(winAgg.dragon, lossAgg.dragon, distDragon),
        elder: objData(winAgg.elder, lossAgg.elder, distElder),
        tower: objData(winAgg.tower, lossAgg.tower, distTower),
        inhibitor: objData(winAgg.inhibitor, lossAgg.inhibitor, distInhibitor),
        riftHerald: objData(winAgg.riftHerald, lossAgg.riftHerald, distRiftHerald),
        horde: objData(winAgg.horde, lossAgg.horde, distHorde),
      },
      drakes: {
        types: {
          elder: { byWin: winAgg.elder.kills, byLoss: lossAgg.elder.kills },
          earth: { byWin: drakesWin.earth, byLoss: drakesLoss.earth },
          water: { byWin: drakesWin.water, byLoss: drakesLoss.water },
          wind: { byWin: drakesWin.wind, byLoss: drakesLoss.wind },
          fire: { byWin: drakesWin.fire, byLoss: drakesLoss.fire },
          hextec: { byWin: drakesWin.hextec, byLoss: drakesLoss.hextec },
          chem: { byWin: drakesWin.chem, byLoss: drakesLoss.chem },
        },
        souls: {
          earth: { byWin: soulsWin.earth, byLoss: soulsLoss.earth },
          water: { byWin: soulsWin.water, byLoss: soulsLoss.water },
          wind: { byWin: soulsWin.wind, byLoss: soulsLoss.wind },
          fire: { byWin: soulsWin.fire, byLoss: soulsLoss.fire },
          hextec: { byWin: soulsWin.hextec, byLoss: soulsLoss.hextec },
          chem: { byWin: soulsWin.chem, byLoss: soulsLoss.chem },
        },
      },
    }

    overviewTeamsCache.set(cacheKey, { data: result, expiresAt: now + OVERVIEW_CACHE_TTL_MS })
    return result
  } catch (err) {
    console.error('[getOverviewTeamsStats]', err instanceof Error ? err.message : err)
    return null
  }
}

// ── getOverviewDurationWinrateStats ──────────────────────────────────────────

export async function getOverviewDurationWinrateStats(
  version?: string | null,
  rankTier?: string | string[] | null,
  role?: string | null
): Promise<OverviewDurationWinrateStats | null> {
  if (!isDatabaseConfigured()) return null
  const pVersion = version != null && version !== '' ? version : null
  const pRole = role != null && role !== '' ? role : null
  const pRankKey = rankTierCacheKey(rankTier)
  const now = Date.now()
  const cacheKey = `${overviewCacheKey(pVersion, pRankKey)}|${pRole ?? ''}`
  const cached = overviewDurationWinrateCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.data

  try {
    const coreWhere: Record<string, unknown> = {}
    if (pVersion) coreWhere.gameVersion = { startsWith: pVersion }
    applyRankTierWhere(coreWhere, rankTier, { excludeUnrankedWhenEmpty: true })
    if (pRole) coreWhere.role = pRole

    const coreStats = await prisma.mvChampionCoreStat.findMany({
      where: coreWhere,
      select: { id: true },
    })
    const statIds = coreStats.map((s) => s.id)

    if (statIds.length === 0) {
      return { buckets: [] }
    }

    const bucketRows = await prisma.mvChampionBucket.findMany({
      where: { championStatId: { in: statIds } },
      select: { durationBucket: true, countWin: true, countGame: true },
    })

    const bucketMap = new Map<number, { wins: number; games: number }>()
    for (const row of bucketRows) {
      let e = bucketMap.get(row.durationBucket)
      if (!e) { e = { wins: 0, games: 0 }; bucketMap.set(row.durationBucket, e) }
      e.wins += row.countWin
      e.games += row.countGame
    }

    const buckets = Array.from(bucketMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([durationBucket, e]) => ({
        durationMinutes: durationBucket,
        matches: e.games,
        winrate: e.games > 0 ? Math.round((e.wins / e.games) * 10000) / 100 : 0,
      }))

    const result: OverviewDurationWinrateStats = { buckets }
    overviewDurationWinrateCache.set(cacheKey, { data: result, expiresAt: now + OVERVIEW_CACHE_TTL_MS })
    return result
  } catch (err) {
    console.error('[getOverviewDurationWinrateStats]', err)
    return null
  }
}

export async function getDurationWinrateByChampion(
  championId: number,
  version?: string | null,
  rankTier?: string | string[] | null
): Promise<OverviewDurationWinrateStats | null> {
  if (!isDatabaseConfigured()) return null
  try {
    const coreWhere: Record<string, unknown> = { championId }
    if (version) coreWhere.gameVersion = { startsWith: version }
    applyRankTierWhere(coreWhere, rankTier, { excludeUnrankedWhenEmpty: true })

    const coreStats = await prisma.mvChampionCoreStat.findMany({
      where: coreWhere,
      select: { id: true },
    })
    const statIds = coreStats.map((s) => s.id)
    if (statIds.length === 0) return { buckets: [] }

    const bucketRows = await prisma.mvChampionBucket.findMany({
      where: { championStatId: { in: statIds } },
      select: { durationBucket: true, countWin: true, countGame: true },
    })

    const bucketMap = new Map<number, { wins: number; games: number }>()
    for (const row of bucketRows) {
      let e = bucketMap.get(row.durationBucket)
      if (!e) { e = { wins: 0, games: 0 }; bucketMap.set(row.durationBucket, e) }
      e.wins += row.countWin
      e.games += row.countGame
    }

    const buckets = Array.from(bucketMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([durationBucket, e]) => ({
        durationMinutes: durationBucket,
        matches: e.games,
        winrate: e.games > 0 ? Math.round((e.wins / e.games) * 10000) / 100 : 0,
      }))

    return { buckets }
  } catch {
    return null
  }
}

// ── Progression stats ────────────────────────────────────────────────────────

export async function getOverviewProgressionStats(
  versionOldest?: string | null,
  rankTier?: string | string[] | null,
  role?: string | null
): Promise<OverviewProgressionStats | null> {
  if (!isDatabaseConfigured()) return null
  if (!versionOldest || versionOldest === '') {
    return { oldestVersion: null, gainers: [], losers: [] }
  }
  const pRole = role != null && role !== '' ? role : null
  const pRankKey = rankTierCacheKey(rankTier)
  const now = Date.now()
  const cacheKey = `${overviewCacheKey(versionOldest, pRankKey)}|${pRole ?? ''}`
  const cached = overviewProgressionCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.data

  try {
    const oldestWhere: Record<string, unknown> = { gameVersion: { startsWith: versionOldest } }
    applyRankTierWhere(oldestWhere, rankTier, { excludeUnrankedWhenEmpty: true })
    if (pRole) oldestWhere.role = pRole

    const sinceWhere: Record<string, unknown> = { gameVersion: { not: { startsWith: versionOldest } } }
    applyRankTierWhere(sinceWhere, rankTier, { excludeUnrankedWhenEmpty: true })
    if (pRole) sinceWhere.role = pRole

    const [oldestRows, sinceRows] = await Promise.all([
      prisma.mvChampionCoreStat.findMany({
        where: oldestWhere,
        select: { championId: true, countWin: true, countGame: true },
      }),
      prisma.mvChampionCoreStat.findMany({
        where: sinceWhere,
        select: { championId: true, countWin: true, countGame: true },
      }),
    ])

    const aggByChamp = (rows: Array<{ championId: number; countWin: number; countGame: number }>) => {
      const m = new Map<number, { wins: number; games: number }>()
      for (const r of rows) {
        let e = m.get(r.championId)
        if (!e) { e = { wins: 0, games: 0 }; m.set(r.championId, e) }
        e.wins += r.countWin; e.games += r.countGame
      }
      return m
    }

    const oldestMap = aggByChamp(oldestRows)
    const sinceMap = aggByChamp(sinceRows)

    const progressionRows: Array<{ championId: number; wrOldest: number; wrSince: number; delta: number }> = []
    for (const [cid, oldEntry] of oldestMap.entries()) {
      if (oldEntry.games < 20) continue
      const sinceEntry = sinceMap.get(cid)
      if (!sinceEntry || sinceEntry.games < 20) continue
      const wrOldest = oldEntry.wins / oldEntry.games
      const wrSince = sinceEntry.wins / sinceEntry.games
      progressionRows.push({ championId: cid, wrOldest, wrSince, delta: wrSince - wrOldest })
    }

    progressionRows.sort((a, b) => b.delta - a.delta)
    const gainers = progressionRows.slice(0, 10)
    const losers = [...progressionRows].sort((a, b) => a.delta - b.delta).slice(0, 10)

    const result: OverviewProgressionStats = {
      oldestVersion: versionOldest,
      gainers: gainers.map(r => ({
        championId: r.championId,
        wrOldest: Math.round(r.wrOldest * 10000) / 100,
        wrSince: Math.round(r.wrSince * 10000) / 100,
        delta: Math.round(r.delta * 10000) / 100,
      })),
      losers: losers.map(r => ({
        championId: r.championId,
        wrOldest: Math.round(r.wrOldest * 10000) / 100,
        wrSince: Math.round(r.wrSince * 10000) / 100,
        delta: Math.round(r.delta * 10000) / 100,
      })),
    }
    overviewProgressionCache.set(cacheKey, { data: result, expiresAt: now + OVERVIEW_CACHE_TTL_MS })
    return result
  } catch (err) {
    console.error('[getOverviewProgressionStats]', err)
    return null
  }
}

export async function getOverviewProgressionFullStats(
  versionOldest?: string | null,
  rankTier?: string | string[] | null,
  role?: string | null
): Promise<OverviewProgressionFullStats | null> {
  if (!isDatabaseConfigured()) return null
  if (!versionOldest || versionOldest === '') {
    return { oldestVersion: null, champions: [] }
  }
  const pRole = role != null && role !== '' ? role : null
  const pRankKey = rankTierCacheKey(rankTier)
  const now = Date.now()
  const cacheKey = `${overviewCacheKey(versionOldest, pRankKey)}|${pRole ?? ''}`
  const cached = overviewProgressionFullCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.data

  try {
    const oldestWhere: Record<string, unknown> = { gameVersion: { startsWith: versionOldest } }
    applyRankTierWhere(oldestWhere, rankTier, { excludeUnrankedWhenEmpty: true })
    if (pRole) oldestWhere.role = pRole
    const sinceWhere: Record<string, unknown> = { gameVersion: { not: { startsWith: versionOldest } } }
    applyRankTierWhere(sinceWhere, rankTier, { excludeUnrankedWhenEmpty: true })
    if (pRole) sinceWhere.role = pRole

    const [oldestRows, sinceRows] = await Promise.all([
      prisma.mvChampionCoreStat.findMany({
        where: oldestWhere,
        select: { championId: true, countWin: true, countGame: true, countBan: true },
      }),
      prisma.mvChampionCoreStat.findMany({
        where: sinceWhere,
        select: { championId: true, countWin: true, countGame: true, countBan: true },
      }),
    ])

    const aggByChamp = (rows: typeof oldestRows) => {
      const m = new Map<number, { wins: number; games: number; bans: number }>()
      for (const r of rows) {
        let e = m.get(r.championId)
        if (!e) {
          e = { wins: 0, games: 0, bans: 0 }
          m.set(r.championId, e)
        }
        e.wins += r.countWin
        e.games += r.countGame
        e.bans += r.countBan
      }
      return m
    }

    const oldestMap = aggByChamp(oldestRows)
    const sinceMap = aggByChamp(sinceRows)
    const oldestTotalGames = Array.from(oldestMap.values()).reduce((s, e) => s + e.games, 0)
    const sinceTotalGames = Array.from(sinceMap.values()).reduce((s, e) => s + e.games, 0)

    const champions: OverviewProgressionFullStats['champions'] = []
    for (const [cid, oldEntry] of oldestMap.entries()) {
      if (oldEntry.games < 20) continue
      const sinceEntry = sinceMap.get(cid)
      if (!sinceEntry || sinceEntry.games < 20) continue
      const banrateOldest =
        oldestTotalGames > 0 ? Math.min(100, (oldEntry.bans / (2 * oldestTotalGames)) * 100) : 0
      const banrateSince =
        sinceTotalGames > 0 ? Math.min(100, (sinceEntry.bans / (2 * sinceTotalGames)) * 100) : 0
      champions.push({
        championId: cid,
        wrOldest: Math.round((oldEntry.wins / oldEntry.games) * 10000) / 100,
        wrSince: Math.round((sinceEntry.wins / sinceEntry.games) * 10000) / 100,
        deltaWr: Math.round(((sinceEntry.wins / sinceEntry.games) - (oldEntry.wins / oldEntry.games)) * 10000) / 100,
        pickrateOldest: oldestTotalGames > 0 ? Math.round((oldEntry.games / oldestTotalGames) * 10000) / 100 : 0,
        pickrateSince: sinceTotalGames > 0 ? Math.round((sinceEntry.games / sinceTotalGames) * 10000) / 100 : 0,
        deltaPick: sinceTotalGames > 0 && oldestTotalGames > 0
          ? Math.round(((sinceEntry.games / sinceTotalGames) - (oldEntry.games / oldestTotalGames)) * 10000) / 100
          : 0,
        banrateOldest: Math.round(banrateOldest * 100) / 100,
        banrateSince: Math.round(banrateSince * 100) / 100,
        deltaBan: Math.round((banrateSince - banrateOldest) * 100) / 100,
      })
    }

    const result: OverviewProgressionFullStats = { oldestVersion: versionOldest, champions }
    overviewProgressionFullCache.set(cacheKey, { data: result, expiresAt: now + OVERVIEW_CACHE_TTL_MS })
    return result
  } catch (err) {
    console.error('[getOverviewProgressionFullStats]', err)
    return null
  }
}

// ── getOverviewMeta ──────────────────────────────────────────────────────────

export async function getOverviewMeta(
  _version?: string | string[] | null,
  _rankTier?: string | string[] | null
): Promise<{ lastUpdate: string | null; playerCount: number } | null> {
  if (!isDatabaseConfigured()) return null
  try {
    const playerCountResult = await prisma.$queryRaw<[{ cnt: bigint }]>(
      Prisma.sql`SELECT COUNT(DISTINCT player_id) AS cnt FROM match_players`
    )
    const playerCount = Number(playerCountResult[0]?.cnt ?? 0)
    return { lastUpdate: null, playerCount }
  } catch (err) {
    console.error('[getOverviewMeta]', err)
    return null
  }
}

// ── getOverviewSidesStats ────────────────────────────────────────────────────

function buildRawMatchCond(
  version?: string | string[] | null,
  rankTier?: string | string[] | null
): string {
  const parts: string[] = []
  const versions = toQueryStringArrayParam(version)
  const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
  if (versions.length === 1) parts.push(`m.game_version LIKE '${versions[0]}%'`)
  else if (versions.length > 1) parts.push(`m.game_version IN (${versions.map(v => `'${v}'`).join(',')})`)
  if (ranks.length === 1) parts.push(`m.rank_tier = '${ranks[0]}'`)
  else if (ranks.length > 1) parts.push(`m.rank_tier IN (${ranks.map(r => `'${r}'`).join(',')})`)
  else parts.push(`m.rank_tier <> 'UNRANKED'`)
  return parts.length > 0 ? parts.join(' AND ') : '1=1'
}

export async function getOverviewSidesStats(
  version?: string | string[] | null,
  rankTier?: string | string[] | null
): Promise<OverviewSidesStats | null> {
  if (!isDatabaseConfigured()) return null
  const now = Date.now()
  const cacheKey = sidesCacheKey(version, rankTier)
  const cached = overviewSidesCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.data
  const matchCond = buildRawMatchCond(version, rankTier)

  try {
    // Side winrate: teams table uses team=100 or team=200
    const sideWinrateSql = `
      SELECT t.team AS team_id,
             COUNT(DISTINCT t.match_id)::int AS matches,
             COUNT(DISTINCT CASE WHEN t.win THEN t.match_id END)::int AS wins
      FROM teams t
      INNER JOIN matchs m ON m.id = t.match_id
      WHERE ${matchCond} AND t.team IN (100, 200)
      GROUP BY t.team
    `
    const sideRows = await prisma.$queryRawUnsafe<
      Array<{ team_id: number; matches: number; wins: number }>
    >(sideWinrateSql)
    const blueRow = sideRows.find((r) => Number(r.team_id) === 100)
    const redRow = sideRows.find((r) => Number(r.team_id) === 200)
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

    // Champion winrate by side
    const champBySideSql = `
      SELECT t.team AS team_id, mp.champion_id,
             COUNT(*)::int AS games,
             SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS wins
      FROM match_players mp
      INNER JOIN teams t ON t.id = mp.team_id
      INNER JOIN matchs m ON m.id = mp.match_id
      WHERE ${matchCond} AND t.team IN (100, 200)
      GROUP BY t.team, mp.champion_id
      HAVING COUNT(*) >= 10
    `
    const champRows = await prisma.$queryRawUnsafe<
      Array<{ team_id: number; champion_id: number; games: number; wins: number }>
    >(champBySideSql)
    const champsByBlue = champRows
      .filter((r) => Number(r.team_id) === 100)
      .map((r) => ({
        championId: Number(r.champion_id),
        games: Number(r.games),
        wins: Number(r.wins),
        winrate: Number(r.games) > 0 ? Math.round((Number(r.wins) / Number(r.games)) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.winrate - a.winrate)
      .slice(0, 20)
    const champsByRed = champRows
      .filter((r) => Number(r.team_id) === 200)
      .map((r) => ({
        championId: Number(r.champion_id),
        games: Number(r.games),
        wins: Number(r.wins),
        winrate: Number(r.games) > 0 ? Math.round((Number(r.wins) / Number(r.games)) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.winrate - a.winrate)
      .slice(0, 20)

    // Objectives by side from teams table
    const objBySideSql = `
      SELECT t.team AS team_id,
        SUM(t.baron_kills)::int AS baron, SUM(t.dragon_kills)::int AS dragon,
        SUM(t.tower_kills)::int AS tower, SUM(t.rift_herald_kills)::int AS rift_herald,
        SUM(t.inhibitor_kills)::int AS inhibitor, SUM(t.horde_kills)::int AS horde,
        SUM(CASE WHEN t.first_blood THEN 1 ELSE 0 END)::int AS first_blood
      FROM teams t
      INNER JOIN matchs m ON m.id = t.match_id
      WHERE ${matchCond} AND t.team IN (100, 200)
      GROUP BY t.team
    `
    const objRows = await prisma.$queryRawUnsafe<
      Array<{ team_id: number; baron: number; dragon: number; tower: number; rift_herald: number; inhibitor: number; horde: number; first_blood: number }>
    >(objBySideSql)
    const toObjSide = (r: typeof objRows[0] | undefined): ObjectiveSideWithDistribution => ({
      baron: { count: r ? Number(r.baron) : 0 },
      dragon: { count: r ? Number(r.dragon) : 0 },
      tower: { count: r ? Number(r.tower) : 0 },
      riftHerald: { count: r ? Number(r.rift_herald) : 0 },
      inhibitor: { count: r ? Number(r.inhibitor) : 0 },
      horde: { count: r ? Number(r.horde) : 0 },
      firstBlood: { count: r ? Number(r.first_blood) : 0 },
    })
    const blueObjRow = objRows.find((r) => Number(r.team_id) === 100)
    const redObjRow = objRows.find((r) => Number(r.team_id) === 200)

    const result: OverviewSidesStats = {
        blue: toSide(blueRow),
        red: toSide(redRow),
      totalMatches: Math.round(totalMatchCount / 2),
      champsByBlue,
      champsByRed,
      topObjectivesBlue: toObjSide(blueObjRow),
      topObjectivesRed: toObjSide(redObjRow),
      objectiveCountsBySide: {
        blue: toObjSide(blueObjRow),
        red: toObjSide(redObjRow),
      },
    }
    overviewSidesCache.set(cacheKey, { data: result, expiresAt: now + OVERVIEW_CACHE_TTL_MS })
    return result
  } catch (err) {
    console.error('[getOverviewSidesStats]', err)
    return null
  }
}
