/**
 * Overview stats for the statistics page: total matches, last update, top winrate champions,
 * matches per division, distinct participant count (unique player_id in match_players).
 * Uses new aggregate tables (champion_core_stats, team_core_stats, champion_bucket, etc.)
 * and raw tables (matchs, match_players, teams, bans) with the new schema.
 */
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

export interface InfosPatchDivisionMatrix {
  divisions: string[]
  rows: Array<{
    version: string
    all: number
    byDivision: Record<string, number>
  }>
}

export interface OverviewDetailStats {
  totalParticipants: number
  runes: Array<{ runeId: number; games: number; wins: number; pickrate: number; winrate: number }>
  runeSets: Array<{
    runes: unknown
    /** Fragments (StatMods), ordre slot Riot ; renvoyés depuis mp.shards via la MV. */
    shards: number[]
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

async function loadSurrenderBySideCounts(
  version: string | string[] | null | undefined,
  rankTier: string | string[] | null | undefined,
  blueMatchTotal: number,
  redMatchTotal: number
): Promise<OverviewSurrenderBySide> {
  const cond = buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mv.')
  const rows = await prisma.$queryRawUnsafe<
    Array<{ team_num: number; early_cnt: bigint; surrender_cnt: bigint }>
  >(`
      SELECT
        mv.team AS team_num,
        COALESCE(SUM(mv.count_team_early_surrendered), 0)::bigint AS early_cnt,
        COALESCE(SUM(mv.count_team_surrendered), 0)::bigint AS surrender_cnt
      FROM mv_team_core_stats mv
      WHERE ${cond}
      GROUP BY mv.team
  `)
  const byTeam = new Map<number, { early: number; surrender: number }>()
  for (const row of rows) {
    byTeam.set(Number(row.team_num), {
      early: Number(row.early_cnt ?? 0),
      surrender: Number(row.surrender_cnt ?? 0),
    })
  }
  return {
    blue: {
      total: blueMatchTotal,
      earlySurrenderCount: byTeam.get(100)?.early ?? 0,
      surrenderCount: byTeam.get(100)?.surrender ?? 0,
    },
    red: {
      total: redMatchTotal,
      earlySurrenderCount: byTeam.get(200)?.early ?? 0,
      surrenderCount: byTeam.get(200)?.surrender ?? 0,
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

    const [coreRows, matchOutcomeRows, matchDivisionRows, matchVersionRows] = await Promise.all([
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
      prisma.$queryRawUnsafe<Array<{ game_version: string; rank_tier: string; count_match: bigint }>>(`
        SELECT mo.game_version, mo.rank_tier, mo.count_match
        FROM mv_match_outcome_stats mo
        WHERE ${buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mo.')}
      `),
      prisma.$queryRawUnsafe<Array<{ rank_tier: string; match_count: bigint }>>(`
        SELECT mo.rank_tier, COALESCE(SUM(mo.count_match), 0)::bigint AS match_count
        FROM mv_match_outcome_stats mo
        WHERE ${buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mo.')}
        GROUP BY mo.rank_tier
        ORDER BY match_count DESC
      `),
      prisma.$queryRawUnsafe<Array<{ game_version: string; match_count: bigint }>>(`
        SELECT mo.game_version, COALESCE(SUM(mo.count_match), 0)::bigint AS match_count
        FROM mv_match_outcome_stats mo
        WHERE ${buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mo.')}
        GROUP BY mo.game_version
        ORDER BY match_count DESC
        LIMIT 20
      `),
    ])

    const totalMatches = matchOutcomeRows.reduce((acc, row) => acc + Number(row.count_match ?? 0), 0)

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
      .slice(0, 120)
      .map(({ championId, games, wins, winrate, pickrate }) => ({
        championId, games, wins,
        winrate: Math.round(winrate * 100) / 100,
        pickrate: Math.round(pickrate * 100) / 100,
      }))

    const topPickrateChampions = [...champList]
      .sort((a, b) => b.pickrate - a.pickrate)
      .slice(0, 120)
      .map(({ championId, games, wins, winrate, pickrate }) => ({
        championId, games, wins,
        winrate: Math.round(winrate * 100) / 100,
        pickrate: Math.round(pickrate * 100) / 100,
      }))

    const topBanrateChampions = [...champList]
      .filter(c => c.bans > 0)
      .sort((a, b) => b.bans - a.bans)
      .slice(0, 120)
      .map(({ championId, bans, banrate }) => ({
        championId,
        banCount: bans,
        banrate: Math.round(banrate * 100) / 100,
      }))

    const matchesByDivision = matchDivisionRows.map((r) => ({
      rankTier: r.rank_tier,
      matchCount: Number(r.match_count ?? 0),
    }))

    const matchesByVersion = matchVersionRows.map((r) => ({
      version: r.game_version,
      matchCount: Number(r.match_count ?? 0),
    }))

    const playerCount = Math.round(totalParticipants)
    const blueMatchTotal = totalMatches
    const redMatchTotal = totalMatches
    const surrenderBySide = await loadSurrenderBySideCounts(
      version,
      rankTier,
      blueMatchTotal,
      redMatchTotal
    )

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

/** Potions / consommables : exclus du slice starter et des combinaisons starter (pas du solo global). */
const OVERVIEW_STARTER_SLICE_EXCLUDED_IDS = new Set([
  2003, 2009, 2010, 2031, 2032, 2033, 2060, 2138, 2139, 2140,
])

const APEX_LADDER_TIERS = ['MASTER', 'GRANDMASTER', 'CHALLENGER'] as const

type SpellPairSqlRow = { spell_d: number; spell_f: number; games: number; wins: number }

async function loadSummonerSpellPairsFromMatches(
  version: string | null,
  rankTier: string | string[] | null,
  role: string | null,
  includeSmite: boolean,
  useApexRanksOnly: boolean
): Promise<SpellPairSqlRow[]> {
  const matchCond = buildRawMatchCond(version, useApexRanksOnly ? [...APEX_LADDER_TIERS] : rankTier).replace(
    /\bm\./g,
    'mv.'
  )
  const roleNorm = role != null && role !== '' ? String(role).trim().toUpperCase() : null
  const roleSql = roleNorm ? ` AND mv.role_norm = '${roleNorm.replace(/'/g, "''")}'` : ''
  const smiteSql = includeSmite ? '' : ` AND mv.spell_d <> 11 AND mv.spell_f <> 11`
  const sql = `
      SELECT
        mv.spell_d::int AS spell_d,
        mv.spell_f::int AS spell_f,
        SUM(mv.count_game)::int AS games,
        SUM(mv.count_win)::int AS wins
      FROM mv_champion_summoner_spell_pair_stats mv
      WHERE ${matchCond}${roleSql}${smiteSql}
      GROUP BY mv.spell_d, mv.spell_f
      HAVING SUM(mv.count_game) >= 40
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
  const matchCond = buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mv.')
  const roleNorm = role != null && role !== '' ? String(role).trim().toUpperCase() : null
  const roleSql = roleNorm ? ` AND mv.role_norm = '${roleNorm.replace(/'/g, "''")}'` : ''
  const sql = `
      SELECT
        mv.starter_key,
        SUM(mv.count_game)::int AS games,
        SUM(mv.count_win)::int AS wins
      FROM mv_champion_item_starter_set_stats mv
      WHERE ${matchCond}${roleSql}
      GROUP BY mv.starter_key
      HAVING SUM(mv.count_game) >= 5
      ORDER BY games DESC
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
        select: {
          itemId: true,
          countWin: true,
          countGame: true,
          countStarter: true,
          countCore: true,
          countFinal: true,
        },
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
      mergeItemSlice(
        itemStarterMap,
        r.itemId,
        r.countWin,
        r.countGame,
        OVERVIEW_STARTER_SLICE_EXCLUDED_IDS.has(r.itemId) ? 0 : r.countStarter
      )
      mergeItemSlice(itemCoreMap, r.itemId, r.countWin, r.countGame, r.countCore)
      mergeItemSlice(itemFinalMap, r.itemId, r.countWin, r.countGame, r.countFinal)
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
      select: { runeList: true, shardList: true, countWin: true, countGame: true },
      take: 2000,
    })
    const runeSetAggKeySep = '\u001e'
    const parseShardListCsv = (csv: string | null | undefined): number[] => {
      if (csv == null || csv === '') return []
      return csv
        .split(',')
        .map((x) => Number(String(x).trim()))
        .filter((n) => Number.isFinite(n) && n > 0)
    }
    const runeSetMap = new Map<string, { wins: number; games: number; shardList: string }>()
    for (const r of runeSetRows) {
      const shard = r.shardList ?? ''
      const aggKey = `${r.runeList}${runeSetAggKeySep}${shard}`
      let e = runeSetMap.get(aggKey)
      if (!e) {
        e = { wins: 0, games: 0, shardList: shard }
        runeSetMap.set(aggKey, e)
      }
      e.wins += r.countWin
      e.games += r.countGame
    }
    const runeSets = Array.from(runeSetMap.entries())
      .filter(([, e]) => e.games >= 5)
      .map(([aggKey, e]) => {
        const sepIdx = aggKey.indexOf(runeSetAggKeySep)
        const runeListPart = sepIdx >= 0 ? aggKey.slice(0, sepIdx) : aggKey
        let parsedRunes: unknown
        try {
          parsedRunes = JSON.parse(runeListPart)
        } catch {
          parsedRunes = runeListPart
        }
        return {
          runes: parsedRunes,
          shards: parseShardListCsv(e.shardList),
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
    const condTeam = buildRawMatchCond(pVersion, rankTier).replace(/\bm\./g, 'mv.')
    const outcomeRows = await prisma.$queryRawUnsafe<Array<{ count_match: bigint }>>(`
      SELECT COALESCE(SUM(mo.count_match), 0)::bigint AS count_match
      FROM mv_match_outcome_stats mo
      WHERE ${buildRawMatchCond(pVersion, rankTier).replace(/\bm\./g, 'mo.')}
    `)
    const matchCount = Number(outcomeRows[0]?.count_match ?? 0)

    const teamRows = await prisma.$queryRawUnsafe<
      Array<{
        team: number
        count_win: bigint
        count_game: bigint
        count_first_blood: bigint
        sum_baron_kills: bigint
        count_baron_first: bigint
        sum_dragon_kills: bigint
        count_dragon_first: bigint
        sum_tower_kills: bigint
        count_tower_first: bigint
        sum_horde_kills: bigint
        count_horde_first: bigint
        sum_rift_herald_kills: bigint
        count_rift_herald_first: bigint
        sum_inhibitor_kills: bigint
        sum_elder_kills: bigint
        count_earth_drake: bigint
        count_water_drake: bigint
        count_wind_drake: bigint
        count_fire_drake: bigint
        count_hextec_drake: bigint
        count_chem_drake: bigint
        count_earth_drake_soul: bigint
        count_water_drake_soul: bigint
        count_wind_drake_soul: bigint
        count_fire_drake_soul: bigint
        count_hextec_drake_soul: bigint
        count_chem_drake_soul: bigint
      }>
    >(`
      SELECT
        mv.team,
        SUM(mv.count_win)::bigint AS count_win,
        SUM(mv.count_game)::bigint AS count_game,
        SUM(mv.count_first_blood)::bigint AS count_first_blood,
        SUM(mv.sum_baron_kills)::bigint AS sum_baron_kills,
        SUM(mv.count_baron_first)::bigint AS count_baron_first,
        SUM(mv.sum_dragon_kills)::bigint AS sum_dragon_kills,
        SUM(mv.count_dragon_first)::bigint AS count_dragon_first,
        SUM(mv.sum_tower_kills)::bigint AS sum_tower_kills,
        SUM(mv.count_tower_first)::bigint AS count_tower_first,
        SUM(mv.sum_horde_kills)::bigint AS sum_horde_kills,
        SUM(mv.count_horde_first)::bigint AS count_horde_first,
        SUM(mv.sum_rift_herald_kills)::bigint AS sum_rift_herald_kills,
        SUM(mv.count_rift_herald_first)::bigint AS count_rift_herald_first,
        SUM(mv.sum_inhibitor_kills)::bigint AS sum_inhibitor_kills,
        SUM(mv.sum_elder_kills)::bigint AS sum_elder_kills,
        SUM(mv.count_earth_drake)::bigint AS count_earth_drake,
        SUM(mv.count_water_drake)::bigint AS count_water_drake,
        SUM(mv.count_wind_drake)::bigint AS count_wind_drake,
        SUM(mv.count_fire_drake)::bigint AS count_fire_drake,
        SUM(mv.count_hextec_drake)::bigint AS count_hextec_drake,
        SUM(mv.count_chem_drake)::bigint AS count_chem_drake,
        SUM(mv.count_earth_drake_soul)::bigint AS count_earth_drake_soul,
        SUM(mv.count_water_drake_soul)::bigint AS count_water_drake_soul,
        SUM(mv.count_wind_drake_soul)::bigint AS count_wind_drake_soul,
        SUM(mv.count_fire_drake_soul)::bigint AS count_fire_drake_soul,
        SUM(mv.count_hextec_drake_soul)::bigint AS count_hextec_drake_soul,
        SUM(mv.count_chem_drake_soul)::bigint AS count_chem_drake_soul
      FROM mv_team_core_stats mv
      WHERE ${condTeam}
      GROUP BY mv.team
    `)
    const team100 = teamRows.find((r) => Number(r.team) === 100)
    const team200 = teamRows.find((r) => Number(r.team) === 200)
    const toN = (v: bigint | number | null | undefined) => Number(v ?? 0)
    const aggWin = {
      firstBlood: { first: toN(team100?.count_first_blood) + toN(team200?.count_first_blood) },
      baron: { first: toN(team100?.count_baron_first), kills: toN(team100?.sum_baron_kills) },
      dragon: { first: toN(team100?.count_dragon_first), kills: toN(team100?.sum_dragon_kills) },
      elder: { first: 0, kills: toN(team100?.sum_elder_kills) },
      tower: { first: toN(team100?.count_tower_first), kills: toN(team100?.sum_tower_kills) },
      inhibitor: { first: 0, kills: toN(team100?.sum_inhibitor_kills) },
      riftHerald: { first: toN(team100?.count_rift_herald_first), kills: toN(team100?.sum_rift_herald_kills) },
      horde: { first: toN(team100?.count_horde_first), kills: toN(team100?.sum_horde_kills) },
    }
    const aggLoss = {
      firstBlood: { first: 0 },
      baron: { first: toN(team200?.count_baron_first), kills: toN(team200?.sum_baron_kills) },
      dragon: { first: toN(team200?.count_dragon_first), kills: toN(team200?.sum_dragon_kills) },
      elder: { first: 0, kills: toN(team200?.sum_elder_kills) },
      tower: { first: toN(team200?.count_tower_first), kills: toN(team200?.sum_tower_kills) },
      inhibitor: { first: 0, kills: toN(team200?.sum_inhibitor_kills) },
      riftHerald: { first: toN(team200?.count_rift_herald_first), kills: toN(team200?.sum_rift_herald_kills) },
      horde: { first: toN(team200?.count_horde_first), kills: toN(team200?.sum_horde_kills) },
    }

    const banRows = await prisma.$queryRawUnsafe<
      Array<{ champion_id: number; total_bans: bigint }>
    >(`
      SELECT mv.banned_champion_id AS champion_id, SUM(mv.ban_count)::bigint AS total_bans
      FROM mv_champion_bans_by_banner mv
      WHERE ${buildRawMatchCond(pVersion, rankTier).replace(/\bm\./g, 'mv.')}
      ${pRole ? `AND mv.banner_role_norm = '${String(pRole).toUpperCase().replace(/'/g, "''")}'` : ''}
      GROUP BY mv.banned_champion_id
      ORDER BY total_bans DESC
      LIMIT 20
    `)
    const totalBans = banRows.reduce((a, r) => a + Number(r.total_bans ?? 0), 0)
    const top20Total = banRows.map((r) => {
      const count = Number(r.total_bans ?? 0)
      return {
        championId: Number(r.champion_id),
        count,
        banRatePercent: totalBans > 0 ? (Math.round((count / totalBans) * 1000) / 10).toFixed(1) + '%' : '—',
      }
    })

    const emptyDist = { win: {}, loss: {} }
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
      matchCount,
      bans: {
        byWin: top20Total,
        byLoss: top20Total,
        top20Total,
      },
      objectives: {
        firstBlood: { firstByWin: aggWin.firstBlood.first, firstByLoss: aggLoss.firstBlood.first },
        baron: objData(aggWin.baron, aggLoss.baron, emptyDist),
        dragon: objData(aggWin.dragon, aggLoss.dragon, emptyDist),
        elder: objData(aggWin.elder, aggLoss.elder, emptyDist),
        tower: objData(aggWin.tower, aggLoss.tower, emptyDist),
        inhibitor: objData(aggWin.inhibitor, aggLoss.inhibitor, emptyDist),
        riftHerald: objData(aggWin.riftHerald, aggLoss.riftHerald, emptyDist),
        horde: objData(aggWin.horde, aggLoss.horde, emptyDist),
      },
      drakes: {
        types: {
          elder: { byWin: toN(team100?.sum_elder_kills), byLoss: toN(team200?.sum_elder_kills) },
          earth: { byWin: toN(team100?.count_earth_drake), byLoss: toN(team200?.count_earth_drake) },
          water: { byWin: toN(team100?.count_water_drake), byLoss: toN(team200?.count_water_drake) },
          wind: { byWin: toN(team100?.count_wind_drake), byLoss: toN(team200?.count_wind_drake) },
          fire: { byWin: toN(team100?.count_fire_drake), byLoss: toN(team200?.count_fire_drake) },
          hextec: { byWin: toN(team100?.count_hextec_drake), byLoss: toN(team200?.count_hextec_drake) },
          chem: { byWin: toN(team100?.count_chem_drake), byLoss: toN(team200?.count_chem_drake) },
        },
        souls: {
          earth: { byWin: toN(team100?.count_earth_drake_soul), byLoss: toN(team200?.count_earth_drake_soul) },
          water: { byWin: toN(team100?.count_water_drake_soul), byLoss: toN(team200?.count_water_drake_soul) },
          wind: { byWin: toN(team100?.count_wind_drake_soul), byLoss: toN(team200?.count_wind_drake_soul) },
          fire: { byWin: toN(team100?.count_fire_drake_soul), byLoss: toN(team200?.count_fire_drake_soul) },
          hextec: { byWin: toN(team100?.count_hextec_drake_soul), byLoss: toN(team200?.count_hextec_drake_soul) },
          chem: { byWin: toN(team100?.count_chem_drake_soul), byLoss: toN(team200?.count_chem_drake_soul) },
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
  version?: string | string[] | null,
  rankTier?: string | string[] | null
): Promise<{ lastUpdate: string | null; playerCount: number } | null> {
  if (!isDatabaseConfigured()) return null
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ players: bigint }>>(`
      SELECT COALESCE(SUM(mo.count_match), 0)::bigint * 10 AS players
      FROM mv_match_outcome_stats mo
      WHERE ${buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mo.')}
    `)
    const playerCount = Number(rows[0]?.players ?? 0)
    return { lastUpdate: null, playerCount }
  } catch (err) {
    console.error('[getOverviewMeta]', err)
    return null
  }
}

export async function getInfosPatchDivisionMatrix(): Promise<InfosPatchDivisionMatrix | null> {
  if (!isDatabaseConfigured()) return null
  type RawRow = { version: string; rank_tier: string; match_count: bigint }
  try {
    const raw = await prisma.$queryRawUnsafe<RawRow[]>(`
      SELECT
        mo.game_version::text AS version,
        mo.rank_tier::text AS rank_tier,
        COALESCE(SUM(mo.count_match), 0)::bigint AS match_count
      FROM mv_match_outcome_stats mo
      WHERE mo.rank_tier <> 'UNRANKED'
      GROUP BY mo.game_version, mo.rank_tier
    `)
    const divisionSet = new Set<string>()
    const byVersion = new Map<string, { all: number; byDivision: Record<string, number> }>()
    for (const r of raw) {
      const version = String(r.version ?? '').trim()
      const tier = String(r.rank_tier ?? '').trim().toUpperCase()
      const mc = Math.max(0, Number(r.match_count ?? 0))
      if (!version || !tier) continue
      divisionSet.add(tier)
      const entry = byVersion.get(version) ?? { all: 0, byDivision: {} }
      entry.byDivision[tier] = (entry.byDivision[tier] ?? 0) + mc
      entry.all += mc
      byVersion.set(version, entry)
    }
    const rows = [...byVersion.entries()].map(([version, data]) => ({
      version,
      all: data.all,
      byDivision: data.byDivision,
    }))
    return { divisions: [...divisionSet], rows }
  } catch (err) {
    console.error('[getInfosPatchDivisionMatrix]', err)
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
  const pVersion = toQueryStringArrayParam(version).length === 1 ? toQueryStringArrayParam(version)[0] : null
  try {
    const condTeam = buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mv.')
    const sideRows = await prisma.$queryRawUnsafe<Array<{ team_id: number; matches: bigint; wins: bigint }>>(`
      SELECT mv.team AS team_id, SUM(mv.count_game)::bigint AS matches, SUM(mv.count_win)::bigint AS wins
      FROM mv_team_core_stats mv
      WHERE ${condTeam}
      GROUP BY mv.team
    `)
    const blueRow = sideRows.find((r) => Number(r.team_id) === 100)
    const redRow = sideRows.find((r) => Number(r.team_id) === 200)
    const toSide = (r: { matches: bigint; wins: bigint } | undefined) => {
      const matches = Number(r?.matches ?? 0)
      const wins = Number(r?.wins ?? 0)
      return { matches, wins, winrate: matches > 0 ? Math.round((wins / matches) * 1000) / 10 : 0 }
    }
    const blueSide = toSide(blueRow)
    const redSide = toSide(redRow)
    const matchCount = Math.round((blueSide.matches + redSide.matches) / 2)

    const champRows = await prisma.$queryRawUnsafe<
      Array<{ team_id: number; champion_id: number; games: bigint; wins: bigint }>
    >(`
      SELECT
        mv.team_num AS team_id,
        mv.champion_id,
        SUM(mv.count_game)::bigint AS games,
        SUM(mv.count_win)::bigint AS wins
      FROM mv_champion_side_stats mv
      WHERE ${buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mv.')}
      GROUP BY mv.team_num, mv.champion_id
      HAVING SUM(mv.count_game) >= 5
    `)
    const toChampRow = (r: { champion_id: number; games: bigint; wins: bigint }) => {
      const games = Number(r.games ?? 0)
      const wins = Number(r.wins ?? 0)
      return { championId: Number(r.champion_id), games, wins, winrate: games > 0 ? Math.round((wins / games) * 1000) / 10 : 0 }
    }
    const champBlueAll = champRows.filter((r) => Number(r.team_id) === 100).map(toChampRow)
    const champRedAll = champRows.filter((r) => Number(r.team_id) === 200).map(toChampRow)
    const championWinrateBySide = {
      blue: [...champBlueAll].sort((a, b) => b.winrate - a.winrate).slice(0, 120),
      red: [...champRedAll].sort((a, b) => b.winrate - a.winrate).slice(0, 120),
    }
    const championPickBySide = {
      blue: [...champBlueAll].sort((a, b) => b.games - a.games).slice(0, 120),
      red: [...champRedAll].sort((a, b) => b.games - a.games).slice(0, 120),
    }

    const banRows = await prisma.$queryRawUnsafe<Array<{ team_id: number; champion_id: number; cnt: bigint }>>(`
      SELECT
        mv.team_num AS team_id,
        mv.banned_champion_id AS champion_id,
        SUM(mv.ban_count)::bigint AS cnt
      FROM mv_champion_bans_by_banner mv
      WHERE ${buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mv.')}
      GROUP BY mv.team_num, mv.banned_champion_id
    `)
    const bansBlue = banRows
      .filter((r) => Number(r.team_id) === 100)
      .map((r) => ({ championId: Number(r.champion_id), count: Number(r.cnt ?? 0) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 120)
    const bansRed = banRows
      .filter((r) => Number(r.team_id) === 200)
      .map((r) => ({ championId: Number(r.champion_id), count: Number(r.cnt ?? 0) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 120)
    const bansBySide = { blue: bansBlue, red: bansRed }

    const surrenderBySide = await loadSurrenderBySideCounts(version, rankTier, blueSide.matches, redSide.matches)
    const teamAggRows = await prisma.$queryRawUnsafe<
      Array<{
        team: number
        count_first_blood: bigint
        count_baron_first: bigint
        sum_baron_kills: bigint
        count_dragon_first: bigint
        sum_dragon_kills: bigint
        sum_elder_kills: bigint
        count_tower_first: bigint
        sum_tower_kills: bigint
        count_horde_first: bigint
        sum_horde_kills: bigint
        count_rift_herald_first: bigint
        sum_rift_herald_kills: bigint
        sum_inhibitor_kills: bigint
        count_earth_drake: bigint
        count_water_drake: bigint
        count_wind_drake: bigint
        count_fire_drake: bigint
        count_hextec_drake: bigint
        count_chem_drake: bigint
        count_earth_drake_soul: bigint
        count_water_drake_soul: bigint
        count_wind_drake_soul: bigint
        count_fire_drake_soul: bigint
        count_hextec_drake_soul: bigint
        count_chem_drake_soul: bigint
      }>
    >(`
      SELECT
        mv.team,
        SUM(mv.count_first_blood)::bigint AS count_first_blood,
        SUM(mv.count_baron_first)::bigint AS count_baron_first,
        SUM(mv.sum_baron_kills)::bigint AS sum_baron_kills,
        SUM(mv.count_dragon_first)::bigint AS count_dragon_first,
        SUM(mv.sum_dragon_kills)::bigint AS sum_dragon_kills,
        SUM(mv.sum_elder_kills)::bigint AS sum_elder_kills,
        SUM(mv.count_tower_first)::bigint AS count_tower_first,
        SUM(mv.sum_tower_kills)::bigint AS sum_tower_kills,
        SUM(mv.count_horde_first)::bigint AS count_horde_first,
        SUM(mv.sum_horde_kills)::bigint AS sum_horde_kills,
        SUM(mv.count_rift_herald_first)::bigint AS count_rift_herald_first,
        SUM(mv.sum_rift_herald_kills)::bigint AS sum_rift_herald_kills,
        SUM(mv.sum_inhibitor_kills)::bigint AS sum_inhibitor_kills,
        SUM(mv.count_earth_drake)::bigint AS count_earth_drake,
        SUM(mv.count_water_drake)::bigint AS count_water_drake,
        SUM(mv.count_wind_drake)::bigint AS count_wind_drake,
        SUM(mv.count_fire_drake)::bigint AS count_fire_drake,
        SUM(mv.count_hextec_drake)::bigint AS count_hextec_drake,
        SUM(mv.count_chem_drake)::bigint AS count_chem_drake,
        SUM(mv.count_earth_drake_soul)::bigint AS count_earth_drake_soul,
        SUM(mv.count_water_drake_soul)::bigint AS count_water_drake_soul,
        SUM(mv.count_wind_drake_soul)::bigint AS count_wind_drake_soul,
        SUM(mv.count_fire_drake_soul)::bigint AS count_fire_drake_soul,
        SUM(mv.count_hextec_drake_soul)::bigint AS count_hextec_drake_soul,
        SUM(mv.count_chem_drake_soul)::bigint AS count_chem_drake_soul
      FROM mv_team_core_stats mv
      WHERE ${condTeam}
      GROUP BY mv.team
    `)
    const blue = teamAggRows.find((r) => Number(r.team) === 100)
    const red = teamAggRows.find((r) => Number(r.team) === 200)
    const n = (v: bigint | undefined) => Number(v ?? 0)
    const drakesBySide = {
      types: {
        elder: { byBlue: n(blue?.sum_elder_kills), byRed: n(red?.sum_elder_kills) },
        earth: { byBlue: n(blue?.count_earth_drake), byRed: n(red?.count_earth_drake) },
        water: { byBlue: n(blue?.count_water_drake), byRed: n(red?.count_water_drake) },
        wind: { byBlue: n(blue?.count_wind_drake), byRed: n(red?.count_wind_drake) },
        fire: { byBlue: n(blue?.count_fire_drake), byRed: n(red?.count_fire_drake) },
        hextec: { byBlue: n(blue?.count_hextec_drake), byRed: n(red?.count_hextec_drake) },
        chem: { byBlue: n(blue?.count_chem_drake), byRed: n(red?.count_chem_drake) },
      },
      souls: {
        earth: { byBlue: n(blue?.count_earth_drake_soul), byRed: n(red?.count_earth_drake_soul) },
        water: { byBlue: n(blue?.count_water_drake_soul), byRed: n(red?.count_water_drake_soul) },
        wind: { byBlue: n(blue?.count_wind_drake_soul), byRed: n(red?.count_wind_drake_soul) },
        fire: { byBlue: n(blue?.count_fire_drake_soul), byRed: n(red?.count_fire_drake_soul) },
        hextec: { byBlue: n(blue?.count_hextec_drake_soul), byRed: n(red?.count_hextec_drake_soul) },
        chem: { byBlue: n(blue?.count_chem_drake_soul), byRed: n(red?.count_chem_drake_soul) },
      },
    }
    const objectivesBySide = {
      blue: {
        firstBlood: n(blue?.count_first_blood),
        baronFirst: n(blue?.count_baron_first),
        baronKills: n(blue?.sum_baron_kills),
        dragonFirst: n(blue?.count_dragon_first),
        dragonKills: n(blue?.sum_dragon_kills),
        elderFirst: 0,
        elderKills: n(blue?.sum_elder_kills),
        towerFirst: n(blue?.count_tower_first),
        towerKills: n(blue?.sum_tower_kills),
        inhibitorFirst: 0,
        inhibitorKills: n(blue?.sum_inhibitor_kills),
        riftHeraldFirst: n(blue?.count_rift_herald_first),
        riftHeraldKills: n(blue?.sum_rift_herald_kills),
        hordeFirst: n(blue?.count_horde_first),
        hordeKills: n(blue?.sum_horde_kills),
      },
      red: {
        firstBlood: n(red?.count_first_blood),
        baronFirst: n(red?.count_baron_first),
        baronKills: n(red?.sum_baron_kills),
        dragonFirst: n(red?.count_dragon_first),
        dragonKills: n(red?.sum_dragon_kills),
        elderFirst: 0,
        elderKills: n(red?.sum_elder_kills),
        towerFirst: n(red?.count_tower_first),
        towerKills: n(red?.sum_tower_kills),
        inhibitorFirst: 0,
        inhibitorKills: n(red?.sum_inhibitor_kills),
        riftHeraldFirst: n(red?.count_rift_herald_first),
        riftHeraldKills: n(red?.sum_rift_herald_kills),
        hordeFirst: n(red?.count_horde_first),
        hordeKills: n(red?.sum_horde_kills),
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
    const objectivesBySideTable: OverviewSidesApiStats['objectivesBySideTable'] = {
      firstBlood: { firstByBlue: n(blue?.count_first_blood), firstByRed: n(red?.count_first_blood) },
      baron: { firstByBlue: n(blue?.count_baron_first), firstByRed: n(red?.count_baron_first), killsByBlue: n(blue?.sum_baron_kills), killsByRed: n(red?.sum_baron_kills), distributionByBlue: distBaron.blue, distributionByRed: distBaron.red },
      dragon: { firstByBlue: n(blue?.count_dragon_first), firstByRed: n(red?.count_dragon_first), killsByBlue: n(blue?.sum_dragon_kills), killsByRed: n(red?.sum_dragon_kills), distributionByBlue: distDragon.blue, distributionByRed: distDragon.red },
      elder: { firstByBlue: 0, firstByRed: 0, killsByBlue: n(blue?.sum_elder_kills), killsByRed: n(red?.sum_elder_kills), distributionByBlue: distElder.blue, distributionByRed: distElder.red },
      tower: { firstByBlue: n(blue?.count_tower_first), firstByRed: n(red?.count_tower_first), killsByBlue: n(blue?.sum_tower_kills), killsByRed: n(red?.sum_tower_kills), distributionByBlue: distTower.blue, distributionByRed: distTower.red },
      inhibitor: { firstByBlue: 0, firstByRed: 0, killsByBlue: n(blue?.sum_inhibitor_kills), killsByRed: n(red?.sum_inhibitor_kills), distributionByBlue: distInhibitor.blue, distributionByRed: distInhibitor.red },
      riftHerald: { firstByBlue: n(blue?.count_rift_herald_first), firstByRed: n(red?.count_rift_herald_first), killsByBlue: n(blue?.sum_rift_herald_kills), killsByRed: n(red?.sum_rift_herald_kills), distributionByBlue: distRiftHerald.blue, distributionByRed: distRiftHerald.red },
      horde: { firstByBlue: n(blue?.count_horde_first), firstByRed: n(red?.count_horde_first), killsByBlue: n(blue?.sum_horde_kills), killsByRed: n(red?.sum_horde_kills), distributionByBlue: distHorde.blue, distributionByRed: distHorde.red },
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
  return ` AND upper(mv.role_norm::text) = '${r}'`
}

async function sideChampionMap(
  rawMatchCond: string,
  teamId: 100 | 200,
  versionClauseSql: string,
  roleSql: string
): Promise<Map<number, { games: number; wins: number }>> {
  const sql = `
    SELECT
      mv.champion_id,
      SUM(mv.count_game)::int AS games,
      SUM(mv.count_win)::int AS wins
    FROM mv_champion_side_stats mv
    WHERE ${rawMatchCond} AND mv.team_num = ${teamId} AND ${versionClauseSql}${roleSql}
    GROUP BY mv.champion_id
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
    SELECT
      mv.banned_champion_id AS champion_id,
      SUM(mv.ban_count)::int AS bans
    FROM mv_champion_bans_by_banner mv
    WHERE ${rawMatchCond} AND mv.team_num = ${teamId} AND ${versionClauseSql}
    GROUP BY mv.banned_champion_id
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
    const rawMatchCond = buildRawMatchCond(null, rankTier).replace(/\bm\./g, 'mv.')
    const oldestClause = `mv.game_version LIKE '${vo}%'`
    const sinceClause =
      sinceEsc != null && sinceEsc !== ''
        ? `mv.game_version LIKE '${sinceEsc}%'`
        : `mv.game_version NOT LIKE '${vo}%'`
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
