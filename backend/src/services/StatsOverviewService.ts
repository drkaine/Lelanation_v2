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
import { bansPerChampionFromMvRows } from '../utils/statsMvBanAggregate.js'
import { mergeLegacyStatShardAggregates } from '../utils/statShardLegacyMerge.js'
import { isBootsItem, loadItemMeta } from '../worker/itemBuildSelection.js'

/** Surrenders imputés par côté (équipe) — mêmes agrégats que overview-sides. */
export interface OverviewSurrenderBySide {
  blue: { total: number; earlySurrenderCount: number; surrenderCount: number }
  red: { total: number; earlySurrenderCount: number; surrenderCount: number }
}

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
  surrenderBySide?: OverviewSurrenderBySide
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
  /** Achats marqués starter (agrégés, wins au prorata par ligne MV). */
  itemsStarters: Array<{ itemId: number; games: number; wins: number; pickrate: number; winrate: number }>
  /** Achats marqués core. */
  itemsCores: Array<{ itemId: number; games: number; wins: number; pickrate: number; winrate: number }>
  /** Autres slots (hors starter/core) sur les 6 premiers emplacements. */
  itemsFinals: Array<{ itemId: number; games: number; wins: number; pickrate: number; winrate: number }>
  /** Bottes seules (même métrique que `items`) — exclues des autres listes objets. */
  itemsBoots: Array<{ itemId: number; games: number; wins: number; pickrate: number; winrate: number }>
  itemSets: Array<{
    items: number[]
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  /** Combinaisons d’objets starter (ordre d’achat, hors balise / trinkets exclus). */
  itemStarterSets: Array<{
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
  /** Sorts solo agrégés (slot D = 0, F = 1 dans la MV). */
  summonerSpells: Array<{
    spellId: number
    games: number
    wins: number
    pickrate: number
    winrate: number
    countSlot0: number
    countSlot1: number
    /** % des présences du sort en slot D (touche D). */
    pctSlotD: number
    /** % des présences du sort en slot F. */
    pctSlotF: number
    highEloGames?: number
    highEloWinrate?: number
    highEloRank?: number
  }>
  /** Paires D→F (ordre Riot) depuis match_players. */
  summonerSpellSets: Array<{
    spellIdD: number
    spellIdF: number
    games: number
    wins: number
    pickrate: number
    winrate: number
    highEloGames?: number
    highEloWinrate?: number
    highEloRank?: number
  }>
  /** Fragments (stat shards) par slot 0–2 ; même dénominateur que les runes (totalParticipants). */
  shards: Array<{
    shardId: number
    slot: number
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
  itemsStarters: [],
  itemsCores: [],
  itemsFinals: [],
  itemsBoots: [],
  itemSets: [],
  itemStarterSets: [],
  itemsByOrder: {},
  summonerSpells: [],
  summonerSpellSets: [],
  shards: [],
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

/** Réponse HTTP /api/stats/overview-sides (alignée front statistics). */
export interface OverviewSidesApiStats {
  matchCount: number
  sideWinrate: {
    blue: { matches: number; wins: number; winrate: number }
    red: { matches: number; wins: number; winrate: number }
  }
  championWinrateBySide: {
    blue: Array<{ championId: number; games: number; wins: number; winrate: number }>
    red: Array<{ championId: number; games: number; wins: number; winrate: number }>
  }
  championPickBySide: {
    blue: Array<{ championId: number; games: number; wins: number; winrate: number }>
    red: Array<{ championId: number; games: number; wins: number; winrate: number }>
  }
  bansBySide: {
    blue: Array<{ championId: number; count: number }>
    red: Array<{ championId: number; count: number }>
  }
  drakesBySide?: {
    types: Record<
      string,
      { byBlue: number; byRed: number }
    >
    souls: Record<string, { byBlue: number; byRed: number }>
  }
  surrenderBySide?: OverviewSurrenderBySide
  objectivesBySide: {
    blue: Record<string, number>
    red: Record<string, number>
  }
  objectivesBySideTable: {
    firstBlood: { firstByBlue: number; firstByRed: number }
    [key: string]:
      | {
          firstByBlue?: number
          firstByRed?: number
          killsByBlue?: number
          killsByRed?: number
          distributionByBlue?: Record<string, number>
          distributionByRed?: Record<string, number>
        }
      | undefined
  }
}

/** @internal Ancien format (cache legacy) — conservé pour typage interne si besoin. */
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

export interface OverviewSidesProgressionFull {
  oldestVersion: string | null
  blue: OverviewProgressionFullStats['champions']
  red: OverviewProgressionFullStats['champions']
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
const overviewSidesCache = new Map<string, { data: OverviewSidesApiStats; expiresAt: number }>()
const overviewSidesProgressionCache = new Map<
  string,
  { data: OverviewSidesProgressionFull; expiresAt: number }
>()
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

async function loadSurrenderBySideCounts(
  matchWhere: Record<string, unknown>,
  blueMatchTotal: number,
  redMatchTotal: number
): Promise<OverviewSurrenderBySide> {
  const teamMatchWhere = { match: matchWhere }
  const [blueEarlySurrenderCount, redEarlySurrenderCount, blueSurrenderCount, redSurrenderCount] =
    await Promise.all([
      prisma.team.count({
        where: {
          ...teamMatchWhere,
          team: 100,
          teamEarlySurrendered: true,
        },
      }),
      prisma.team.count({
        where: {
          ...teamMatchWhere,
          team: 200,
          teamEarlySurrendered: true,
        },
      }),
      prisma.team.count({
        where: {
          ...teamMatchWhere,
          team: 100,
          win: false,
          match: { ...matchWhere, gameEndedInSurrender: true },
        },
      }),
      prisma.team.count({
        where: {
          ...teamMatchWhere,
          team: 200,
          win: false,
          match: { ...matchWhere, gameEndedInSurrender: true },
        },
      }),
    ])
  return {
    blue: {
      total: blueMatchTotal,
      earlySurrenderCount: blueEarlySurrenderCount,
      surrenderCount: blueSurrenderCount,
    },
    red: {
      total: redMatchTotal,
      earlySurrenderCount: redEarlySurrenderCount,
      surrenderCount: redSurrenderCount,
    },
  }
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
        select: {
          championId: true,
          countWin: true,
          countGame: true,
          countBan: true,
          rankTier: true,
          gameVersion: true,
          region: true,
        },
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

    const banTotalsByChampion = bansPerChampionFromMvRows(coreRows)

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
      totalParticipants += row.countGame
    }
    for (const [cid, entry] of byChampion) {
      entry.bans = banTotalsByChampion.get(cid) ?? 0
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

    const [blueMatchTotal, redMatchTotal] = await Promise.all([
      prisma.team.count({ where: { match: matchWhere, team: 100 } }),
      prisma.team.count({ where: { match: matchWhere, team: 200 } }),
    ])
    const surrenderBySide = await loadSurrenderBySideCounts(matchWhere, blueMatchTotal, redMatchTotal)

    const result: OverviewStats = {
      totalMatches,
      lastUpdate: null,
      topWinrateChampions,
      topPickrateChampions,
      topBanrateChampions,
      matchesByDivision,
      matchesByVersion,
      playerCount,
      surrenderBySide,
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

/** Trinkets + balise de contrôle (2055) : exclus des stats objets agrégées. */
const OVERVIEW_DETAIL_EXCLUDED_ITEM_IDS = new Set([3340, 3364, 3363, 2055])

const APEX_LADDER_TIERS = ['MASTER', 'GRANDMASTER', 'CHALLENGER'] as const

type SpellPairSqlRow = { spell_d: number; spell_f: number; games: number; wins: number }

async function loadSummonerSpellPairsFromMatches(
  version: string | null,
  rankTier: string | string[] | null,
  role: string | null,
  includeSmite: boolean,
  useApexRanksOnly: boolean
): Promise<SpellPairSqlRow[]> {
  const matchCond = buildRawMatchCond(
    version,
    useApexRanksOnly ? [...APEX_LADDER_TIERS] : rankTier
  )
  const roleSql =
    role != null && role !== ''
      ? ` AND mp.role = '${String(role).replace(/'/g, "''")}'`
      : ''
  const smiteSql = includeSmite ? '' : ` AND NOT (11 = ANY(mp.summoner_spells))`
  const sql = `
      SELECT mp.summoner_spells[1]::int AS spell_d,
             mp.summoner_spells[2]::int AS spell_f,
             COUNT(*)::int AS games,
             SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS wins
      FROM match_players mp
      INNER JOIN teams t ON t.id = mp.team_id
      INNER JOIN matchs m ON m.id = mp.match_id
      WHERE ${matchCond}
        AND cardinality(mp.summoner_spells) >= 2
        ${roleSql}${smiteSql}
      GROUP BY 1, 2
      HAVING COUNT(*) >= 40
      ORDER BY games DESC
      LIMIT 150
    `
  try {
    const rows = await prisma.$queryRawUnsafe<SpellPairSqlRow[]>(sql)
    return rows ?? []
  } catch (err) {
    console.warn(
      '[loadSummonerSpellPairsFromMatches]',
      useApexRanksOnly ? 'apex' : 'main',
      err instanceof Error ? err.message : err
    )
    return []
  }
}

type ItemStarterSetSqlRow = { starter_key: string; games: number; wins: number }

async function loadItemStarterSetsFromMatches(
  version: string | null,
  rankTier: string | string[] | null,
  role: string | null
): Promise<ItemStarterSetSqlRow[]> {
  const matchCond = buildRawMatchCond(version, rankTier)
  const roleSql =
    role != null && role !== ''
      ? ` AND mp.role = '${String(role).replace(/'/g, "''")}'`
      : ''
  const excludeSql = Array.from(OVERVIEW_DETAIL_EXCLUDED_ITEM_IDS).join(', ')
  const sql = `
      WITH per_player AS (
        SELECT
          t.win,
          COALESCE(
            (
              SELECT '[' || string_agg((e->>'itemId')::text, ',' ORDER BY (e->>'order')::int, (e->>'timestampMs')::bigint)
              FROM jsonb_array_elements(mp.items) AS e
              WHERE COALESCE((e->>'starter')::boolean, false)
                AND (e->>'itemId')::int NOT IN (${excludeSql})
            ),
            '[]'
          ) AS starter_key
        FROM match_players mp
        INNER JOIN teams t ON t.id = mp.team_id
        INNER JOIN matchs m ON m.id = mp.match_id
        WHERE ${matchCond}
          AND jsonb_typeof(mp.items) = 'array'
          AND jsonb_array_length(mp.items) > 0
          ${roleSql}
      )
      SELECT starter_key,
             COUNT(*)::int AS games,
             SUM(CASE WHEN win THEN 1 ELSE 0 END)::int AS wins
      FROM per_player
      WHERE starter_key <> '[]'
      GROUP BY starter_key
      HAVING COUNT(*) >= 5
      ORDER BY COUNT(*) DESC
      LIMIT 50
    `
  try {
    const rows = await prisma.$queryRawUnsafe<ItemStarterSetSqlRow[]>(sql)
    return rows ?? []
  } catch (err) {
    console.warn(
      '[loadItemStarterSetsFromMatches]',
      err instanceof Error ? err.message : err
    )
    return []
  }
}

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

    const [soloRunes, soloItems, spells, soloShards] = await Promise.all([
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
        select: {
          spellId: true,
          countWin: true,
          countGame: true,
          countSlot0: true,
          countSlot1: true,
        },
      }),
      prisma.mvChampionShardSoloStat.findMany({
        where: { championStatId: { in: statIds } },
        select: { shardId: true, slot: true, countWin: true, countGame: true },
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

    const shardMap = new Map<string, { wins: number; games: number }>()
    for (const r of soloShards) {
      const k = `${r.shardId}:${r.slot}`
      let e = shardMap.get(k)
      if (!e) {
        e = { wins: 0, games: 0 }
        shardMap.set(k, e)
      }
      e.wins += r.countWin
      e.games += r.countGame
    }
    mergeLegacyStatShardAggregates(shardMap)
    const shards = Array.from(shardMap.entries())
      .map(([key, e]) => {
        const [shardIdStr, slotStr] = key.split(':')
        const shardId = Number(shardIdStr)
        const slot = Number(slotStr)
        return {
          shardId,
          slot,
          games: e.games,
          wins: e.wins,
          pickrate: totalParticipants > 0 ? Math.round((e.games / totalParticipants) * 10000) / 100 : 0,
          winrate: e.games > 0 ? Math.round((e.wins / e.games) * 10000) / 100 : 0,
        }
      })
      .sort((a, b) => b.games - a.games)

    // Per-item aggregation (tous achats + découpes starter / core / reste des 6 slots)
    const itemMeta = await loadItemMeta()
    const isBootItemId = (itemId: number) => isBootsItem(itemMeta.get(itemId), itemId)

    type ItemSliceAgg = { w: number; g: number }
    const mergeItemSlice = (
      map: Map<number, ItemSliceAgg>,
      itemId: number,
      countWin: number,
      countGame: number,
      sliceGames: number
    ): void => {
      if (sliceGames <= 0) return
      let e = map.get(itemId)
      if (!e) {
        e = { w: 0, g: 0 }
        map.set(itemId, e)
      }
      e.g += sliceGames
      if (countGame > 0) e.w += (countWin * sliceGames) / countGame
    }
    const sliceRows = (
      map: Map<number, ItemSliceAgg>
    ): Array<{ itemId: number; games: number; wins: number; pickrate: number; winrate: number }> =>
      Array.from(map.entries())
        .map(([itemId, e]) => {
          const games = Math.max(0, Math.round(e.g))
          const wins = Math.round(e.w)
          return {
            itemId,
            games,
            wins,
            pickrate:
              totalParticipants > 0 ? Math.round((games / totalParticipants) * 10000) / 100 : 0,
            winrate: games > 0 ? Math.round((wins / games) * 10000) / 100 : 0,
          }
        })
        .filter((r) => r.games > 0)
        .sort((a, b) => b.games - a.games)

    const itemMap = new Map<number, { wins: number; games: number }>()
    const itemBootMap = new Map<number, { wins: number; games: number }>()
    const itemStarterMap = new Map<number, ItemSliceAgg>()
    const itemCoreMap = new Map<number, ItemSliceAgg>()
    const itemFinalMap = new Map<number, ItemSliceAgg>()
    for (const r of soloItems) {
      if (OVERVIEW_DETAIL_EXCLUDED_ITEM_IDS.has(r.itemId)) continue
      if (isBootItemId(r.itemId)) {
        let b = itemBootMap.get(r.itemId)
        if (!b) {
          b = { wins: 0, games: 0 }
          itemBootMap.set(r.itemId, b)
        }
        b.wins += r.countWin
        b.games += r.countGame
        continue
      }
      let e = itemMap.get(r.itemId)
      if (!e) {
        e = { wins: 0, games: 0 }
        itemMap.set(r.itemId, e)
      }
      e.wins += r.countWin
      e.games += r.countGame
      mergeItemSlice(itemStarterMap, r.itemId, r.countWin, r.countGame, r.countStarter)
      mergeItemSlice(itemCoreMap, r.itemId, r.countWin, r.countGame, r.countCore)
      const otherSlots = Math.max(0, r.countGame - r.countStarter - r.countCore)
      mergeItemSlice(itemFinalMap, r.itemId, r.countWin, r.countGame, otherSlots)
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
    const itemsBoots = Array.from(itemBootMap.entries())
      .map(([itemId, e]) => ({
        itemId,
        games: e.games,
        wins: e.wins,
        pickrate: totalParticipants > 0 ? Math.round((e.games / totalParticipants) * 10000) / 100 : 0,
        winrate: e.games > 0 ? Math.round((e.wins / e.games) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.games - a.games)
    const itemsStarters = sliceRows(itemStarterMap)
    const itemsCores = sliceRows(itemCoreMap)
    const itemsFinals = sliceRows(itemFinalMap)

    // Summoner spells (solo + slots D/F + apex ladder)
    const spellMap = new Map<number, { wins: number; games: number; slot0: number; slot1: number }>()
    for (const r of spells) {
      let e = spellMap.get(r.spellId)
      if (!e) {
        e = { wins: 0, games: 0, slot0: 0, slot1: 0 }
        spellMap.set(r.spellId, e)
      }
      e.wins += r.countWin
      e.games += r.countGame
      e.slot0 += r.countSlot0
      e.slot1 += r.countSlot1
    }

    const apexCoreWhere: Record<string, unknown> = {}
    if (pVersion) apexCoreWhere.gameVersion = { startsWith: pVersion }
    apexCoreWhere.rankTier = { in: [...APEX_LADDER_TIERS] }
    if (pRole) apexCoreWhere.role = pRole
    const apexCoreStats = await prisma.mvChampionCoreStat.findMany({
      where: apexCoreWhere,
      select: { id: true },
    })
    const apexStatIds = apexCoreStats.map((s) => s.id)
    const apexSpellRows =
      apexStatIds.length > 0
        ? await prisma.mvChampionSummonerSpellAgg.findMany({
            where: {
              championStatId: { in: apexStatIds },
              ...(!includeSmite ? { spellId: { not: 11 } } : {}),
            },
            select: { spellId: true, countWin: true, countGame: true },
          })
        : []
    const apexSpellMap = new Map<number, { wins: number; games: number }>()
    for (const r of apexSpellRows) {
      let e = apexSpellMap.get(r.spellId)
      if (!e) {
        e = { wins: 0, games: 0 }
        apexSpellMap.set(r.spellId, e)
      }
      e.wins += r.countWin
      e.games += r.countGame
    }

    let summonerSpells = Array.from(spellMap.entries())
      .map(([spellId, e]) => {
        const g = e.games
        const ax = apexSpellMap.get(spellId)
        const heG = ax?.games
        const heW = ax?.wins
        return {
          spellId,
          games: g,
          wins: e.wins,
          pickrate: totalParticipants > 0 ? Math.round((g / totalParticipants) * 10000) / 100 : 0,
          winrate: g > 0 ? Math.round((e.wins / g) * 10000) / 100 : 0,
          countSlot0: e.slot0,
          countSlot1: e.slot1,
          pctSlotD: g > 0 ? Math.round((e.slot0 / g) * 10000) / 100 : 0,
          pctSlotF: g > 0 ? Math.round((e.slot1 / g) * 10000) / 100 : 0,
          highEloGames: heG,
          highEloWinrate:
            heG != null && heG > 0 && heW != null
              ? Math.round((heW / heG) * 10000) / 100
              : undefined,
        }
      })
      .sort((a, b) => b.games - a.games)

    const soloHeRanked = [...summonerSpells]
      .filter((s) => (s.highEloGames ?? 0) > 0)
      .sort((a, b) => (b.highEloGames ?? 0) - (a.highEloGames ?? 0))
    const soloHeRankMap = new Map<number, number>()
    soloHeRanked.forEach((s, i) => soloHeRankMap.set(s.spellId, i + 1))
    summonerSpells = summonerSpells.map((s) => ({
      ...s,
      highEloRank: soloHeRankMap.get(s.spellId),
    }))

    const [pairRowsMain, pairRowsApex, itemStarterSetRows] = await Promise.all([
      loadSummonerSpellPairsFromMatches(pVersion, rankTier ?? null, pRole, includeSmite ?? false, false),
      loadSummonerSpellPairsFromMatches(pVersion, rankTier ?? null, pRole, includeSmite ?? false, true),
      loadItemStarterSetsFromMatches(pVersion, rankTier ?? null, pRole),
    ])
    const apexPairMap = new Map<string, { games: number; wins: number }>()
    for (const r of pairRowsApex) {
      const key = `${Number(r.spell_d)}:${Number(r.spell_f)}`
      apexPairMap.set(key, { games: Number(r.games), wins: Number(r.wins) })
    }
    let summonerSpellSets = pairRowsMain.map((r) => {
      const spellIdD = Number(r.spell_d)
      const spellIdF = Number(r.spell_f)
      const games = Number(r.games)
      const wins = Number(r.wins)
      const key = `${spellIdD}:${spellIdF}`
      const ax = apexPairMap.get(key)
      const heG = ax?.games
      const heW = ax?.wins
      return {
        spellIdD,
        spellIdF,
        games,
        wins,
        pickrate:
          totalParticipants > 0 ? Math.round((games / totalParticipants) * 10000) / 100 : 0,
        winrate: games > 0 ? Math.round((wins / games) * 10000) / 100 : 0,
        highEloGames: heG,
        highEloWinrate:
          heG != null && heG > 0 && heW != null
            ? Math.round((heW / heG) * 10000) / 100
            : undefined,
      }
    })
    const setHeRanked = [...summonerSpellSets]
      .filter((s) => (s.highEloGames ?? 0) > 0)
      .sort((a, b) => (b.highEloGames ?? 0) - (a.highEloGames ?? 0))
    const setHeRankMap = new Map<string, number>()
    setHeRanked.forEach((s, i) => setHeRankMap.set(`${s.spellIdD}:${s.spellIdF}`, i + 1))
    summonerSpellSets = summonerSpellSets.map((s) => ({
      ...s,
      highEloRank: setHeRankMap.get(`${s.spellIdD}:${s.spellIdF}`),
    }))

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
          items: parsedItems.filter(
            (id) => !OVERVIEW_DETAIL_EXCLUDED_ITEM_IDS.has(id) && !isBootItemId(id)
          ),
          games: e.games,
          wins: e.wins,
          pickrate: totalParticipants > 0 ? Math.round((e.games / totalParticipants) * 10000) / 100 : 0,
          winrate: e.games > 0 ? Math.round((e.wins / e.games) * 10000) / 100 : 0,
        }
      })
      .filter((row) => row.items.length > 0)
      .sort((a, b) => b.games - a.games)
      .slice(0, 50)

    const itemStarterSets = itemStarterSetRows
      .map((r) => {
        let parsedItems: number[]
        try {
          parsedItems = JSON.parse(r.starter_key) as number[]
        } catch {
          parsedItems = []
        }
        const games = Number(r.games)
        const wins = Number(r.wins)
        return {
          items: parsedItems.filter(
            (id) =>
              Number.isFinite(id) &&
              !OVERVIEW_DETAIL_EXCLUDED_ITEM_IDS.has(id) &&
              !isBootItemId(id)
          ),
          games,
          wins,
          pickrate:
            totalParticipants > 0 ? Math.round((games / totalParticipants) * 10000) / 100 : 0,
          winrate: games > 0 ? Math.round((wins / games) * 10000) / 100 : 0,
        }
      })
      .filter((row) => row.items.length > 0)

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
      itemsStarters,
      itemsCores,
      itemsFinals,
      itemsBoots,
      itemSets,
      itemStarterSets,
      itemsByOrder: {},
      summonerSpells,
      summonerSpellSets,
      shards,
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
  overviewSidesProgressionCache.clear()
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
        SUM(CASE WHEN upper(trim(d.soul)) IN ('MOUNTAIN', 'EARTH_DRAGON', 'MOUNTAIN_DRAGON', 'EARTH_DRAGON_SOUL', 'MOUNTAIN_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_earth_drake_soul,
        SUM(CASE WHEN upper(trim(d.soul)) IN ('OCEAN', 'WATER_DRAGON', 'OCEAN_DRAGON', 'WATER_DRAGON_SOUL', 'OCEAN_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_water_drake_soul,
        SUM(CASE WHEN upper(trim(d.soul)) IN ('CLOUD', 'AIR_DRAGON', 'CLOUD_DRAGON', 'AIR_DRAGON_SOUL', 'CLOUD_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_wind_drake_soul,
        SUM(CASE WHEN upper(trim(d.soul)) IN ('INFERNAL', 'FIRE_DRAGON', 'FIRE_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_fire_drake_soul,
        SUM(CASE WHEN upper(trim(d.soul)) IN ('HEXTECH', 'HEXTECH_DRAGON', 'HEXTECH_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_hextec_drake_soul,
        SUM(CASE WHEN upper(trim(d.soul)) IN ('CHEMTECH', 'CHEMTECH_DRAGON', 'CHEMTECH_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_chem_drake_soul,
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
      select: {
        championId: true,
        countBan: true,
        countWin: true,
        countGame: true,
        rankTier: true,
        gameVersion: true,
        region: true,
      },
    })

    const bansByChamp = new Map<number, { byWin: number; byLoss: number }>()
    for (const [cid, totalBans] of bansPerChampionFromMvRows(coreStatsBan)) {
      if (totalBans === 0) continue
      // Approximate: bans are evenly split, no win/loss info in aggregate
      bansByChamp.set(cid, {
        byWin: Math.round(totalBans / 2),
        byLoss: totalBans - Math.round(totalBans / 2),
      })
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
        select: {
          championId: true,
          countWin: true,
          countGame: true,
          countBan: true,
          rankTier: true,
          gameVersion: true,
          region: true,
        },
      }),
      prisma.mvChampionCoreStat.findMany({
        where: sinceWhere,
        select: {
          championId: true,
          countWin: true,
          countGame: true,
          countBan: true,
          rankTier: true,
          gameVersion: true,
          region: true,
        },
      }),
    ])

    const aggByChamp = (rows: typeof oldestRows) => {
      const banTotals = bansPerChampionFromMvRows(rows)
      const m = new Map<number, { wins: number; games: number; bans: number }>()
      for (const r of rows) {
        let e = m.get(r.championId)
        if (!e) {
          e = { wins: 0, games: 0, bans: 0 }
          m.set(r.championId, e)
        }
        e.wins += r.countWin
        e.games += r.countGame
      }
      for (const [cid, e] of m) {
        e.bans = banTotals.get(cid) ?? 0
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
  if (versions.length === 1) parts.push(`m.game_version LIKE '${versions[0].replace(/'/g, "''")}%'`)
  else if (versions.length > 1) parts.push(`m.game_version IN (${versions.map(v => `'${v.replace(/'/g, "''")}'`).join(',')})`)
  if (ranks.length === 1) parts.push(`m.rank_tier = '${ranks[0]}'`)
  else if (ranks.length > 1) parts.push(`m.rank_tier IN (${ranks.map(r => `'${r}'`).join(',')})`)
  else parts.push(`m.rank_tier <> 'UNRANKED'`)
  return parts.length > 0 ? parts.join(' AND ') : '1=1'
}

function escapeSqlLikePrefix(v: string): string {
  return v.replace(/'/g, "''")
}

async function loadObjectiveDistributionBySides(
  pVersion: string | null,
  rankTier: string | string[] | null | undefined,
  objectiveKey: string
): Promise<{ blue: Record<string, number>; red: Record<string, number> }> {
  const conditions = ['1=1']
  if (pVersion) conditions.push(`b.game_version LIKE '${escapeSqlLikePrefix(pVersion)}%'`)
  const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
  if (ranks.length === 1) conditions.push(`b.rank_tier = '${ranks[0]}'`)
  else if (ranks.length > 1) {
    conditions.push(`b.rank_tier IN (${ranks.map((r) => `'${r}'`).join(',')})`)
  } else {
    conditions.push(`b.rank_tier <> 'UNRANKED'`)
  }
  const whereSql = conditions.join(' AND ')
  const safeKey = objectiveKey.replace(/'/g, "''")
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ team: number; objective_bucket: number; count_win: number; count_game: number }>
    >(`
          SELECT
            b.team,
            tb.objective_bucket,
            SUM(tb.count_win)::int AS count_win,
            SUM(tb.count_game)::int AS count_game
          FROM mv_team_bucket tb
          JOIN mv_team_core_stats b ON b.id = tb.team_stat_id
          WHERE tb.objective_key = '${safeKey}'
            AND ${whereSql}
          GROUP BY b.team, tb.objective_bucket
        `)
    const blue: Record<string, number> = {}
    const red: Record<string, number> = {}
    for (const r of rows) {
      const bucket = String(Number(r.objective_bucket ?? 0))
      const g = Number(r.count_game ?? 0)
      const tid = Number(r.team)
      if (tid === 100) blue[bucket] = (blue[bucket] ?? 0) + g
      else if (tid === 200) red[bucket] = (red[bucket] ?? 0) + g
    }
    return { blue, red }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('42P01') || message.includes('mv_team_bucket')) {
      if (!hasWarnedMissingTeamBucket) {
        hasWarnedMissingTeamBucket = true
        console.warn('[loadObjectiveDistributionBySides] mv_team_bucket missing; empty distributions')
      }
      return { blue: {}, red: {} }
    }
    throw err
  }
}

export async function getOverviewSidesStats(
  version?: string | string[] | null,
  rankTier?: string | string[] | null
): Promise<OverviewSidesApiStats | null> {
  if (!isDatabaseConfigured()) return null
  const now = Date.now()
  const cacheKey = sidesCacheKey(version, rankTier)
  const cached = overviewSidesCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.data
  const matchCond = buildRawMatchCond(version, rankTier)
  const versions = toQueryStringArrayParam(version)
  const pVersion = versions.length === 1 ? versions[0] : null

  try {
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
    const blueSide = toSide(blueRow)
    const redSide = toSide(redRow)
    const totalMatchCount = (blueRow ? Number(blueRow.matches) : 0) + (redRow ? Number(redRow.matches) : 0)
    const matchCount = Math.round(totalMatchCount / 2)

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

    const toChampRow = (r: (typeof champRows)[0]) => ({
      championId: Number(r.champion_id),
      games: Number(r.games),
      wins: Number(r.wins),
      winrate: Number(r.games) > 0 ? Math.round((Number(r.wins) / Number(r.games)) * 1000) / 10 : 0,
    })
    const champBlueAll = champRows.filter((r) => Number(r.team_id) === 100).map(toChampRow)
    const champRedAll = champRows.filter((r) => Number(r.team_id) === 200).map(toChampRow)
    const championWinrateBySide = {
      blue: [...champBlueAll].sort((a, b) => b.winrate - a.winrate).slice(0, 20),
      red: [...champRedAll].sort((a, b) => b.winrate - a.winrate).slice(0, 20),
    }
    const championPickBySide = {
      blue: [...champBlueAll].sort((a, b) => b.games - a.games).slice(0, 20),
      red: [...champRedAll].sort((a, b) => b.games - a.games).slice(0, 20),
    }

    const banRows = await prisma.$queryRawUnsafe<
      Array<{ team_id: number; champion_id: number; cnt: number }>
    >(`
      SELECT t.team AS team_id, b.champion_id,
             COUNT(*)::int AS cnt
      FROM bans b
      INNER JOIN teams t ON t.id = b.team_id
      INNER JOIN matchs m ON m.id = b.match_id
      WHERE ${matchCond} AND t.team IN (100, 200)
      GROUP BY t.team, b.champion_id
    `)
    const bansBlue = banRows
      .filter((r) => Number(r.team_id) === 100)
      .map((r) => ({ championId: Number(r.champion_id), count: Number(r.cnt) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
    const bansRed = banRows
      .filter((r) => Number(r.team_id) === 200)
      .map((r) => ({ championId: Number(r.champion_id), count: Number(r.cnt) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
    const bansBySide = { blue: bansBlue, red: bansRed }

    const matchWhere = buildMatchWhere(version, rankTier)
    const surrenderBySide = await loadSurrenderBySideCounts(matchWhere, blueSide.matches, redSide.matches)

    const objBySideSql = `
      SELECT t.team AS team_id,
        SUM(CASE WHEN t.first_blood THEN 1 ELSE 0 END)::int AS first_blood,
        SUM(CASE WHEN t.baron_first THEN 1 ELSE 0 END)::int AS baron_first,
        SUM(t.baron_kills)::int AS baron_kills,
        SUM(CASE WHEN t.dragon_first THEN 1 ELSE 0 END)::int AS dragon_first,
        SUM(t.dragon_kills)::int AS dragon_kills,
        SUM(t.elder_kills)::int AS elder_kills,
        SUM(CASE WHEN t.tower_first THEN 1 ELSE 0 END)::int AS tower_first,
        SUM(t.tower_kills)::int AS tower_kills,
        SUM(CASE WHEN t.horde_first THEN 1 ELSE 0 END)::int AS horde_first,
        SUM(t.horde_kills)::int AS horde_kills,
        SUM(CASE WHEN t.rift_herald_first THEN 1 ELSE 0 END)::int AS rift_herald_first,
        SUM(t.rift_herald_kills)::int AS rift_herald_kills,
        SUM(t.inhibitor_kills)::int AS inhibitor_kills
      FROM teams t
      INNER JOIN matchs m ON m.id = t.match_id
      WHERE ${matchCond} AND t.team IN (100, 200)
      GROUP BY t.team
    `
    const objRows = await prisma.$queryRawUnsafe<
      Array<{
        team_id: number
        first_blood: number
        baron_first: number
        baron_kills: number
        dragon_first: number
        dragon_kills: number
        elder_kills: number
        tower_first: number
        tower_kills: number
        horde_first: number
        horde_kills: number
        rift_herald_first: number
        rift_herald_kills: number
        inhibitor_kills: number
      }>
    >(objBySideSql)
    const blueO = objRows.find((r) => Number(r.team_id) === 100)
    const redO = objRows.find((r) => Number(r.team_id) === 200)
    const fbB = blueO ? Number(blueO.first_blood) : 0
    const fbR = redO ? Number(redO.first_blood) : 0

    const drakeSideRows = await prisma.$queryRawUnsafe<
      Array<{
        team_id: number
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
        t.team AS team_id,
        SUM(CASE WHEN upper(d.drake_type) IN ('EARTH_DRAGON', 'MOUNTAIN_DRAGON') THEN 1 ELSE 0 END)::int AS count_earth_drake,
        SUM(CASE WHEN upper(d.drake_type) IN ('WATER_DRAGON', 'OCEAN_DRAGON') THEN 1 ELSE 0 END)::int AS count_water_drake,
        SUM(CASE WHEN upper(d.drake_type) IN ('AIR_DRAGON', 'CLOUD_DRAGON') THEN 1 ELSE 0 END)::int AS count_wind_drake,
        SUM(CASE WHEN upper(d.drake_type) = 'FIRE_DRAGON' THEN 1 ELSE 0 END)::int AS count_fire_drake,
        SUM(CASE WHEN upper(d.drake_type) = 'HEXTECH_DRAGON' THEN 1 ELSE 0 END)::int AS count_hextec_drake,
        SUM(CASE WHEN upper(d.drake_type) = 'CHEMTECH_DRAGON' THEN 1 ELSE 0 END)::int AS count_chem_drake,
        SUM(CASE WHEN upper(trim(d.soul)) IN ('MOUNTAIN', 'EARTH_DRAGON', 'MOUNTAIN_DRAGON', 'EARTH_DRAGON_SOUL', 'MOUNTAIN_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_earth_drake_soul,
        SUM(CASE WHEN upper(trim(d.soul)) IN ('OCEAN', 'WATER_DRAGON', 'OCEAN_DRAGON', 'WATER_DRAGON_SOUL', 'OCEAN_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_water_drake_soul,
        SUM(CASE WHEN upper(trim(d.soul)) IN ('CLOUD', 'AIR_DRAGON', 'CLOUD_DRAGON', 'AIR_DRAGON_SOUL', 'CLOUD_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_wind_drake_soul,
        SUM(CASE WHEN upper(trim(d.soul)) IN ('INFERNAL', 'FIRE_DRAGON', 'FIRE_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_fire_drake_soul,
        SUM(CASE WHEN upper(trim(d.soul)) IN ('HEXTECH', 'HEXTECH_DRAGON', 'HEXTECH_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_hextec_drake_soul,
        SUM(CASE WHEN upper(trim(d.soul)) IN ('CHEMTECH', 'CHEMTECH_DRAGON', 'CHEMTECH_DRAGON_SOUL') THEN 1 ELSE 0 END)::int AS count_chem_drake_soul,
        SUM(CASE WHEN upper(d.drake_type) = 'ELDER_DRAGON' OR lower(d.drake_type) = 'elder' THEN 1 ELSE 0 END)::int AS sum_elder_kills
      FROM drake_details d
      INNER JOIN teams t ON t.id = d.team_id
      INNER JOIN matchs m ON m.id = d.match_id
      WHERE ${matchCond}
      GROUP BY t.team
    `)
    const blueD = drakeSideRows.find((r) => Number(r.team_id) === 100)
    const redD = drakeSideRows.find((r) => Number(r.team_id) === 200)
    const drakesBySide = {
      types: {
        elder: { byBlue: blueD ? Number(blueD.sum_elder_kills) : 0, byRed: redD ? Number(redD.sum_elder_kills) : 0 },
        earth: { byBlue: blueD ? Number(blueD.count_earth_drake) : 0, byRed: redD ? Number(redD.count_earth_drake) : 0 },
        water: { byBlue: blueD ? Number(blueD.count_water_drake) : 0, byRed: redD ? Number(redD.count_water_drake) : 0 },
        wind: { byBlue: blueD ? Number(blueD.count_wind_drake) : 0, byRed: redD ? Number(redD.count_wind_drake) : 0 },
        fire: { byBlue: blueD ? Number(blueD.count_fire_drake) : 0, byRed: redD ? Number(redD.count_fire_drake) : 0 },
        hextec: { byBlue: blueD ? Number(blueD.count_hextec_drake) : 0, byRed: redD ? Number(redD.count_hextec_drake) : 0 },
        chem: { byBlue: blueD ? Number(blueD.count_chem_drake) : 0, byRed: redD ? Number(redD.count_chem_drake) : 0 },
      },
      souls: {
        earth: { byBlue: blueD ? Number(blueD.count_earth_drake_soul) : 0, byRed: redD ? Number(redD.count_earth_drake_soul) : 0 },
        water: { byBlue: blueD ? Number(blueD.count_water_drake_soul) : 0, byRed: redD ? Number(redD.count_water_drake_soul) : 0 },
        wind: { byBlue: blueD ? Number(blueD.count_wind_drake_soul) : 0, byRed: redD ? Number(redD.count_wind_drake_soul) : 0 },
        fire: { byBlue: blueD ? Number(blueD.count_fire_drake_soul) : 0, byRed: redD ? Number(redD.count_fire_drake_soul) : 0 },
        hextec: { byBlue: blueD ? Number(blueD.count_hextec_drake_soul) : 0, byRed: redD ? Number(redD.count_hextec_drake_soul) : 0 },
        chem: { byBlue: blueD ? Number(blueD.count_chem_drake_soul) : 0, byRed: redD ? Number(redD.count_chem_drake_soul) : 0 },
      },
    }

    const objectivesBySide = {
      blue: {
        firstBlood: blueO ? Number(blueO.first_blood) : 0,
        baronFirst: blueO ? Number(blueO.baron_first) : 0,
        baronKills: blueO ? Number(blueO.baron_kills) : 0,
        dragonFirst: blueO ? Number(blueO.dragon_first) : 0,
        dragonKills: blueO ? Number(blueO.dragon_kills) : 0,
        elderFirst: 0,
        elderKills: blueD ? Number(blueD.sum_elder_kills) : 0,
        towerFirst: blueO ? Number(blueO.tower_first) : 0,
        towerKills: blueO ? Number(blueO.tower_kills) : 0,
        inhibitorFirst: 0,
        inhibitorKills: blueO ? Number(blueO.inhibitor_kills) : 0,
        riftHeraldFirst: blueO ? Number(blueO.rift_herald_first) : 0,
        riftHeraldKills: blueO ? Number(blueO.rift_herald_kills) : 0,
        hordeFirst: blueO ? Number(blueO.horde_first) : 0,
        hordeKills: blueO ? Number(blueO.horde_kills) : 0,
      },
      red: {
        firstBlood: redO ? Number(redO.first_blood) : 0,
        baronFirst: redO ? Number(redO.baron_first) : 0,
        baronKills: redO ? Number(redO.baron_kills) : 0,
        dragonFirst: redO ? Number(redO.dragon_first) : 0,
        dragonKills: redO ? Number(redO.dragon_kills) : 0,
        elderFirst: 0,
        elderKills: redD ? Number(redD.sum_elder_kills) : 0,
        towerFirst: redO ? Number(redO.tower_first) : 0,
        towerKills: redO ? Number(redO.tower_kills) : 0,
        inhibitorFirst: 0,
        inhibitorKills: redO ? Number(redO.inhibitor_kills) : 0,
        riftHeraldFirst: redO ? Number(redO.rift_herald_first) : 0,
        riftHeraldKills: redO ? Number(redO.rift_herald_kills) : 0,
        hordeFirst: redO ? Number(redO.horde_first) : 0,
        hordeKills: redO ? Number(redO.horde_kills) : 0,
      },
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
      loadObjectiveDistributionBySides(pVersion, rankTier, 'baron'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'dragon'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'elder'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'tower'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'inhibitor'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'riftHerald'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'horde'),
    ])

    const killsB = (o: typeof blueO | undefined, k: keyof NonNullable<typeof blueO>): number =>
      o ? Number(o[k] ?? 0) : 0
    const objectivesBySideTable: OverviewSidesApiStats['objectivesBySideTable'] = {
      firstBlood: { firstByBlue: fbB, firstByRed: fbR },
      baron: {
        firstByBlue: killsB(blueO, 'baron_first'),
        firstByRed: killsB(redO, 'baron_first'),
        killsByBlue: killsB(blueO, 'baron_kills'),
        killsByRed: killsB(redO, 'baron_kills'),
        distributionByBlue: distBaron.blue,
        distributionByRed: distBaron.red,
      },
      dragon: {
        firstByBlue: killsB(blueO, 'dragon_first'),
        firstByRed: killsB(redO, 'dragon_first'),
        killsByBlue: killsB(blueO, 'dragon_kills'),
        killsByRed: killsB(redO, 'dragon_kills'),
        distributionByBlue: distDragon.blue,
        distributionByRed: distDragon.red,
      },
      elder: {
        firstByBlue: 0,
        firstByRed: 0,
        killsByBlue: blueD ? Number(blueD.sum_elder_kills) : 0,
        killsByRed: redD ? Number(redD.sum_elder_kills) : 0,
        distributionByBlue: distElder.blue,
        distributionByRed: distElder.red,
      },
      tower: {
        firstByBlue: killsB(blueO, 'tower_first'),
        firstByRed: killsB(redO, 'tower_first'),
        killsByBlue: killsB(blueO, 'tower_kills'),
        killsByRed: killsB(redO, 'tower_kills'),
        distributionByBlue: distTower.blue,
        distributionByRed: distTower.red,
      },
      inhibitor: {
        firstByBlue: 0,
        firstByRed: 0,
        killsByBlue: killsB(blueO, 'inhibitor_kills'),
        killsByRed: killsB(redO, 'inhibitor_kills'),
        distributionByBlue: distInhibitor.blue,
        distributionByRed: distInhibitor.red,
      },
      riftHerald: {
        firstByBlue: killsB(blueO, 'rift_herald_first'),
        firstByRed: killsB(redO, 'rift_herald_first'),
        killsByBlue: killsB(blueO, 'rift_herald_kills'),
        killsByRed: killsB(redO, 'rift_herald_kills'),
        distributionByBlue: distRiftHerald.blue,
        distributionByRed: distRiftHerald.red,
      },
      horde: {
        firstByBlue: killsB(blueO, 'horde_first'),
        firstByRed: killsB(redO, 'horde_first'),
        killsByBlue: killsB(blueO, 'horde_kills'),
        killsByRed: killsB(redO, 'horde_kills'),
        distributionByBlue: distHorde.blue,
        distributionByRed: distHorde.red,
      },
    }

    const result: OverviewSidesApiStats = {
      matchCount,
      sideWinrate: { blue: blueSide, red: redSide },
      championWinrateBySide,
      championPickBySide,
      bansBySide,
      surrenderBySide,
      drakesBySide,
      objectivesBySide,
      objectivesBySideTable,
    }
    overviewSidesCache.set(cacheKey, { data: result, expiresAt: now + OVERVIEW_CACHE_TTL_MS })
    return result
  } catch (err) {
    console.error('[getOverviewSidesStats]', err)
    return null
  }
}

function roleSqlClause(role: string | null | undefined): string {
  if (role == null || role === '') return ''
  const r = role.replace(/'/g, "''").toUpperCase()
  return ` AND upper(mp.role::text) = '${r}'`
}

async function sideChampionMap(
  rawMatchCond: string,
  teamId: 100 | 200,
  versionClauseSql: string,
  roleSql: string
): Promise<Map<number, { games: number; wins: number }>> {
  const sql = `
    SELECT mp.champion_id,
           COUNT(*)::int AS games,
           SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS wins
    FROM match_players mp
    INNER JOIN teams t ON t.id = mp.team_id
    INNER JOIN matchs m ON m.id = mp.match_id
    WHERE ${rawMatchCond} AND t.team = ${teamId} AND ${versionClauseSql}${roleSql}
    GROUP BY mp.champion_id
  `
  const rows = await prisma.$queryRawUnsafe<Array<{ champion_id: number; games: number; wins: number }>>(sql)
  const m = new Map<number, { games: number; wins: number }>()
  for (const r of rows) {
    m.set(Number(r.champion_id), { games: Number(r.games), wins: Number(r.wins) })
  }
  return m
}

async function sideBanMap(
  rawMatchCond: string,
  teamId: 100 | 200,
  versionClauseSql: string
): Promise<Map<number, number>> {
  const sql = `
    SELECT b.champion_id, COUNT(*)::int AS bans
    FROM bans b
    INNER JOIN teams t ON t.id = b.team_id
    INNER JOIN matchs m ON m.id = b.match_id
    WHERE ${rawMatchCond} AND t.team = ${teamId} AND ${versionClauseSql}
    GROUP BY b.champion_id
  `
  const rows = await prisma.$queryRawUnsafe<Array<{ champion_id: number; bans: number }>>(sql)
  const m = new Map<number, number>()
  for (const r of rows) m.set(Number(r.champion_id), Number(r.bans))
  return m
}

/** Progression WR / pick / ban (delta patch) par côté bleu/rouge. */
export async function getOverviewSidesProgressionFullStats(
  versionOldest: string | null | undefined,
  rankTier?: string | string[] | null,
  role?: string | null,
  sinceVersionPrefix?: string | null | undefined
): Promise<OverviewSidesProgressionFull | null> {
  if (!isDatabaseConfigured()) return null
  if (!versionOldest || versionOldest === '') {
    return { oldestVersion: null, blue: [], red: [] }
  }
  const voRaw = String(versionOldest).trim()
  const vo = escapeSqlLikePrefix(voRaw)
  const pRankKey = rankTierCacheKey(rankTier)
  const pRole = role != null && role !== '' ? role : null
  const sinceRaw =
    sinceVersionPrefix != null && String(sinceVersionPrefix).trim() !== ''
      ? String(sinceVersionPrefix).trim()
      : ''
  /** If filtres « patch courant » = même préfixe que la progression, LIKE serait identique → deltas 0. On retrouve alors le mode « tout sauf le patch de référence ». */
  const sinceEsc =
    sinceRaw !== '' && sinceRaw !== voRaw ? escapeSqlLikePrefix(sinceRaw) : null
  const now = Date.now()
  // Cache key v2: base match condition must not include versionOldest — oldest/since filters are
  // oldestClause / sinceClause only; including both produced contradictory WHERE (no rows).
  const cacheKey = `sidesprog3|${vo}|${pRankKey ?? ''}|${pRole ?? ''}|${sinceEsc ?? 'all'}`
  const cached = overviewSidesProgressionCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.data

  try {
    const rawMatchCond = buildRawMatchCond(null, rankTier)
    const oldestClause = `m.game_version LIKE '${vo}%'`
    const sinceClause =
      sinceEsc != null && sinceEsc !== ''
        ? `m.game_version LIKE '${sinceEsc}%'`
        : `m.game_version NOT LIKE '${vo}%'`
    const rSql = roleSqlClause(pRole)

    const buildSide = async (teamId: 100 | 200): Promise<OverviewProgressionFullStats['champions']> => {
      const [oldestMap, sinceMap, banOldest, banSince] = await Promise.all([
        sideChampionMap(rawMatchCond, teamId, oldestClause, rSql),
        sideChampionMap(rawMatchCond, teamId, sinceClause, rSql),
        sideBanMap(rawMatchCond, teamId, oldestClause),
        sideBanMap(rawMatchCond, teamId, sinceClause),
      ])
      let oldestTotalGames = 0
      for (const e of oldestMap.values()) oldestTotalGames += e.games
      let sinceTotalGames = 0
      for (const e of sinceMap.values()) sinceTotalGames += e.games
      const champions: OverviewProgressionFullStats['champions'] = []
      for (const [cid, oldEntry] of oldestMap.entries()) {
        if (oldEntry.games < 20) continue
        const sinceEntry = sinceMap.get(cid)
        if (!sinceEntry || sinceEntry.games < 20) continue
        const bansO = banOldest.get(cid) ?? 0
        const bansS = banSince.get(cid) ?? 0
        const banrateOldest =
          oldestTotalGames > 0 ? Math.min(100, (bansO / (2 * oldestTotalGames)) * 100) : 0
        const banrateSince =
          sinceTotalGames > 0 ? Math.min(100, (bansS / (2 * sinceTotalGames)) * 100) : 0
        champions.push({
          championId: cid,
          wrOldest: Math.round((oldEntry.wins / oldEntry.games) * 10000) / 100,
          wrSince: Math.round((sinceEntry.wins / sinceEntry.games) * 10000) / 100,
          deltaWr:
            Math.round(
              (sinceEntry.wins / sinceEntry.games - oldEntry.wins / oldEntry.games) * 10000
            ) / 100,
          pickrateOldest:
            oldestTotalGames > 0 ? Math.round((oldEntry.games / oldestTotalGames) * 10000) / 100 : 0,
          pickrateSince:
            sinceTotalGames > 0 ? Math.round((sinceEntry.games / sinceTotalGames) * 10000) / 100 : 0,
          deltaPick:
            sinceTotalGames > 0 && oldestTotalGames > 0
              ? Math.round(
                (sinceEntry.games / sinceTotalGames - oldEntry.games / oldestTotalGames) * 10000
              ) / 100
              : 0,
          banrateOldest: Math.round(banrateOldest * 100) / 100,
          banrateSince: Math.round(banrateSince * 100) / 100,
          deltaBan: Math.round((banrateSince - banrateOldest) * 100) / 100,
        })
      }
      return champions
    }

    const [blue, red] = await Promise.all([buildSide(100), buildSide(200)])
    const out: OverviewSidesProgressionFull = {
      oldestVersion: versionOldest,
      blue,
      red,
    }
    overviewSidesProgressionCache.set(cacheKey, { data: out, expiresAt: now + OVERVIEW_CACHE_TTL_MS })
    return out
  } catch (err) {
    console.error('[getOverviewSidesProgressionFullStats]', err)
    return null
  }
}
