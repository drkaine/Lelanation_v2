/**
 * Overview stats for the statistics page: total matches, last update, top winrate champions,
 * matches per division, distinct participant count (unique player_id in ingest_match_players).
 * Uses incremental aggregate tables (`agg_*`) plus legacy MVs for metrics not yet migrated.
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'
import {
  rankTierCacheKey,
  toQueryStringArrayParam,
} from '../utils/statsFilters.js'
import { mergeLegacyStatShardAggregates } from '../utils/statShardLegacyMerge.js'
import { isBootsItem, loadItemMeta } from '../worker/itemBuildSelection.js'
import {
  invalidateAggArchivePartitionCache,
  matchVersionedAggFrom,
  normalizePatchMajorMinor,
  sqlAggUnionAllLiveAndArchives,
} from './statsAggArchive.js'

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
  /** Paires D→F (ordre Riot) depuis ingest_match_players. */
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
      elder: { byWin: number; byLoss: number; distributionByWin: Record<string, number>; distributionByLoss: Record<string, number> }
      earth: { byWin: number; byLoss: number; distributionByWin: Record<string, number>; distributionByLoss: Record<string, number> }
      water: { byWin: number; byLoss: number; distributionByWin: Record<string, number>; distributionByLoss: Record<string, number> }
      wind: { byWin: number; byLoss: number; distributionByWin: Record<string, number>; distributionByLoss: Record<string, number> }
      fire: { byWin: number; byLoss: number; distributionByWin: Record<string, number>; distributionByLoss: Record<string, number> }
      hextec: { byWin: number; byLoss: number; distributionByWin: Record<string, number>; distributionByLoss: Record<string, number> }
      chem: { byWin: number; byLoss: number; distributionByWin: Record<string, number>; distributionByLoss: Record<string, number> }
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
    durationMin: number
    matchCount: number
    wins: number
    winrate: number
    // Legacy keys kept for API backward compatibility.
    durationMinutes?: number
    matches?: number
  }>
}

/** Winrate par tranches de durée, une série par ligue (rank tier de base). */
export interface ChampionDurationWinrateByTier {
  series: Array<{
    rankTier: string
    buckets: Array<{
      durationMin: number
      matchCount: number
      wins: number
      winrate: number
      durationMinutes?: number
      matches?: number
    }>
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
      { byBlue: number; byRed: number; distributionByBlue?: Record<string, number>; distributionByRed?: Record<string, number> }
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

export interface ObjectiveOutcomeAggRow {
  version: string
  rankTier: string
  objectiveKey: string
  objectiveCount: number
  games: number
  wins: number
  losses: number
  winrateWinner: number
  winrateOther: number
}

export interface ObjectiveOutcomeAggByPatchDivision {
  rows: ObjectiveOutcomeAggRow[]
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

function versionAtOrAfterSql(alias: string, referencePatch: string): string {
  const [majorRaw, minorRaw] = normalizePatchMajorMinor(referencePatch).split('.')
  const major = Number.parseInt(majorRaw ?? '0', 10) || 0
  const minor = Number.parseInt(minorRaw ?? '0', 10) || 0
  const majorSql = `COALESCE(NULLIF(split_part(${alias}.game_version, '.', 1), ''), '0')::int`
  const minorSql = `COALESCE(NULLIF(split_part(${alias}.game_version, '.', 2), ''), '0')::int`
  return `(${majorSql} > ${major} OR (${majorSql} = ${major} AND ${minorSql} >= ${minor}))`
}

type TeamCoreFallback = {
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
  sum_elder_kills: number
}

async function loadTeamCoreFallbackFromIngest(
  version: string | string[] | null | undefined,
  rankTier: string | string[] | null | undefined
): Promise<Map<number, TeamCoreFallback>> {
  const versions = toQueryStringArrayParam(version)
  const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
  const cond: string[] = ['1=1']
  if (versions.length === 1) {
    const patch = normalizePatchMajorMinor(versions[0]!).replace(/'/g, "''")
    cond.push(`im.game_version LIKE '${patch}%'`)
  } else if (versions.length > 1) {
    cond.push(`im.game_version IN (${versions.map((v) => `'${v.replace(/'/g, "''")}'`).join(',')})`)
  }
  if (ranks.length === 1) cond.push(`im.rank_tier = '${ranks[0]}'`)
  else if (ranks.length > 1) cond.push(`im.rank_tier IN (${ranks.map((r) => `'${r}'`).join(',')})`)
  else cond.push(`im.rank_tier <> 'UNRANKED'`)
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      team_num: number
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
    }>
  >(`
    SELECT
      it.team AS team_num,
      COALESCE(SUM(CASE WHEN it.first_blood THEN 1 ELSE 0 END), 0)::bigint AS count_first_blood,
      COALESCE(SUM(it.baron_kills), 0)::bigint AS sum_baron_kills,
      COALESCE(SUM(CASE WHEN it.baron_first THEN 1 ELSE 0 END), 0)::bigint AS count_baron_first,
      COALESCE(SUM(it.dragon_kills), 0)::bigint AS sum_dragon_kills,
      COALESCE(SUM(CASE WHEN it.dragon_first THEN 1 ELSE 0 END), 0)::bigint AS count_dragon_first,
      COALESCE(SUM(it.tower_kills), 0)::bigint AS sum_tower_kills,
      COALESCE(SUM(CASE WHEN it.tower_first THEN 1 ELSE 0 END), 0)::bigint AS count_tower_first,
      COALESCE(SUM(it.horde_kills), 0)::bigint AS sum_horde_kills,
      COALESCE(SUM(CASE WHEN it.horde_first THEN 1 ELSE 0 END), 0)::bigint AS count_horde_first,
      COALESCE(SUM(it.rift_herald_kills), 0)::bigint AS sum_rift_herald_kills,
      COALESCE(SUM(CASE WHEN it.rift_herald_first THEN 1 ELSE 0 END), 0)::bigint AS count_rift_herald_first,
      COALESCE(SUM(it.inhibitor_kills), 0)::bigint AS sum_inhibitor_kills,
      COALESCE(SUM(it.elder_kills), 0)::bigint AS sum_elder_kills
    FROM ingest_teams it
    INNER JOIN ingest_matchs im ON im.id = it.match_id
    WHERE ${cond.join(' AND ')}
    GROUP BY it.team
  `)
  const out = new Map<number, TeamCoreFallback>()
  for (const row of rows) {
    out.set(Number(row.team_num), {
      count_first_blood: Number(row.count_first_blood ?? 0),
      sum_baron_kills: Number(row.sum_baron_kills ?? 0),
      count_baron_first: Number(row.count_baron_first ?? 0),
      sum_dragon_kills: Number(row.sum_dragon_kills ?? 0),
      count_dragon_first: Number(row.count_dragon_first ?? 0),
      sum_tower_kills: Number(row.sum_tower_kills ?? 0),
      count_tower_first: Number(row.count_tower_first ?? 0),
      sum_horde_kills: Number(row.sum_horde_kills ?? 0),
      count_horde_first: Number(row.count_horde_first ?? 0),
      sum_rift_herald_kills: Number(row.sum_rift_herald_kills ?? 0),
      count_rift_herald_first: Number(row.count_rift_herald_first ?? 0),
      sum_inhibitor_kills: Number(row.sum_inhibitor_kills ?? 0),
      sum_elder_kills: Number(row.sum_elder_kills ?? 0),
    })
  }
  return out
}

async function loadSurrenderBySideCounts(
  version: string | string[] | null | undefined,
  rankTier: string | string[] | null | undefined,
  blueMatchTotal: number,
  redMatchTotal: number
): Promise<OverviewSurrenderBySide> {
  const cond = buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mv.')
  const mvFrom = await matchVersionedAggFrom('agg_team_core_stats', version, 'mv')
  const rows = await prisma.$queryRawUnsafe<
    Array<{ team_num: number; early_cnt: bigint; surrender_cnt: bigint }>
  >(`
      SELECT
        mv.team AS team_num,
        COALESCE(SUM(mv.count_team_early_surrendered), 0)::bigint AS early_cnt,
        COALESCE(SUM(mv.count_team_surrendered), 0)::bigint AS surrender_cnt
      FROM ${mvFrom}
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
  const hasAnyAggSurrender =
    (byTeam.get(100)?.early ?? 0) +
      (byTeam.get(100)?.surrender ?? 0) +
      (byTeam.get(200)?.early ?? 0) +
      (byTeam.get(200)?.surrender ?? 0) >
    0
  const hasMatches = blueMatchTotal + redMatchTotal > 0
  if (!hasAnyAggSurrender && hasMatches) {
    // Fallback for fresh patches where agg_team_core_stats surrender counters can lag behind match data.
    const versions = toQueryStringArrayParam(version)
    const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
    const condIngest: string[] = ['1=1']
    if (versions.length === 1) {
      const patch = normalizePatchMajorMinor(versions[0]!).replace(/'/g, "''")
      condIngest.push(`im.game_version LIKE '${patch}%'`)
    } else if (versions.length > 1) {
      condIngest.push(
        `im.game_version IN (${versions.map((v) => `'${v.replace(/'/g, "''")}'`).join(',')})`
      )
    }
    if (ranks.length === 1) condIngest.push(`im.rank_tier = '${ranks[0]}'`)
    else if (ranks.length > 1)
      condIngest.push(`im.rank_tier IN (${ranks.map((r) => `'${r}'`).join(',')})`)
    else condIngest.push(`im.rank_tier <> 'UNRANKED'`)
    const ingestRows = await prisma.$queryRawUnsafe<
      Array<{ team_num: number; early_cnt: bigint; surrender_cnt: bigint }>
    >(`
      SELECT
        it.team AS team_num,
        COALESCE(SUM(CASE WHEN it.team_early_surrendered THEN 1 ELSE 0 END), 0)::bigint AS early_cnt,
        COALESCE(SUM(CASE WHEN it.win = false AND im.game_ended_in_surrender THEN 1 ELSE 0 END), 0)::bigint AS surrender_cnt
      FROM ingest_teams it
      INNER JOIN ingest_matchs im ON im.id = it.match_id
      WHERE ${condIngest.join(' AND ')}
      GROUP BY it.team
    `)
    for (const row of ingestRows) {
      byTeam.set(Number(row.team_num), {
        early: Number(row.early_cnt ?? 0),
        surrender: Number(row.surrender_cnt ?? 0),
      })
    }
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
    const coreFrom = await matchVersionedAggFrom('agg_champion_core_stats', version, 'ac')
    const moFrom = await matchVersionedAggFrom('agg_match_outcome_stats', version, 'mo')
    const banFrom = await matchVersionedAggFrom('agg_champion_bans_by_banner', version, 'mv')
    const banRoleSql = pRole
      ? ` AND mv.banner_role_norm = '${String(pRole).trim().toUpperCase().replace(/'/g, "''")}'`
      : ''
    const [coreRows, matchOutcomeRows, matchDivisionRows, matchVersionRows, banAggRows] = await Promise.all([
      prisma.$queryRawUnsafe<
        Array<{
          champion_id: number
          count_win: bigint
          count_game: bigint
          count_ban: bigint
          rank_tier: string
          game_version: string
          region: string
        }>
      >(`
        SELECT
          ac.champion_id,
          ac.count_win,
          ac.count_game,
          ac.count_ban,
          ac.rank_tier,
          ac.game_version,
          ac.region
        FROM ${coreFrom}
        WHERE ${buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'ac.')}
        ${pRole ? `AND ac.role = '${String(pRole).replace(/'/g, "''")}'` : ''}
      `),
      prisma.$queryRawUnsafe<Array<{ game_version: string; rank_tier: string; count_match: bigint }>>(`
        SELECT mo.game_version, mo.rank_tier, mo.count_match
        FROM ${moFrom}
        WHERE ${buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mo.')}
      `),
      prisma.$queryRawUnsafe<Array<{ rank_tier: string; match_count: bigint }>>(`
        SELECT mo.rank_tier, COALESCE(SUM(mo.count_match), 0)::bigint AS match_count
        FROM ${moFrom}
        WHERE ${buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mo.')}
        GROUP BY mo.rank_tier
        ORDER BY match_count DESC
      `),
      prisma.$queryRawUnsafe<Array<{ game_version: string; match_count: bigint }>>(`
        SELECT mo.game_version, COALESCE(SUM(mo.count_match), 0)::bigint AS match_count
        FROM ${moFrom}
        WHERE ${buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mo.')}
        GROUP BY mo.game_version
        ORDER BY match_count DESC
        LIMIT 20
      `),
      prisma.$queryRawUnsafe<Array<{ champion_id: number; bans: bigint }>>(`
        SELECT mv.banned_champion_id AS champion_id, COALESCE(SUM(mv.ban_count), 0)::bigint AS bans
        FROM ${banFrom}
        WHERE ${buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mv.')}
        ${banRoleSql}
        GROUP BY mv.banned_champion_id
      `),
    ])

    const totalMatches = matchOutcomeRows.reduce((acc, row) => acc + Number(row.count_match ?? 0), 0)

    const banTotalsByChampion = new Map<number, number>()
    for (const row of banAggRows) {
      banTotalsByChampion.set(Number(row.champion_id), Number(row.bans ?? 0))
    }

    // Aggregate champion stats
    const byChampion = new Map<number, { wins: number; games: number; bans: number }>()
    let totalParticipants = 0
    for (const row of coreRows) {
      const championId = Number(row.champion_id)
      let entry = byChampion.get(championId)
      if (!entry) {
        entry = { wins: 0, games: 0, bans: 0 }
        byChampion.set(championId, entry)
      }
      entry.wins += Number(row.count_win ?? 0)
      entry.games += Number(row.count_game ?? 0)
      totalParticipants += Number(row.count_game ?? 0)
    }
    for (const [cid, entry] of byChampion) {
      entry.bans = banTotalsByChampion.get(cid) ?? 0
    }

    const buildOverviewChampList = (minGames: number) =>
      Array.from(byChampion.entries())
        .filter(([, e]) => e.games >= minGames)
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

    /** Évite cartes « sans donnée » sur patch/division/rôle fins : le seuil 20 était trop haut quand le volume par champion reste bas. */
    const minGamesPrimary = minGamesForOverviewChampionPool(totalParticipants)
    let champList = buildOverviewChampList(minGamesPrimary)
    if (champList.length === 0 && totalParticipants > 0 && byChampion.size > 0) {
      champList = buildOverviewChampList(1)
    }

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
    'ag.'
  )
  const roleNorm = role != null && role !== '' ? String(role).trim().toUpperCase() : null
  const roleSql = roleNorm ? ` AND ag.role_norm = '${roleNorm.replace(/'/g, "''")}'` : ''
  const smiteSql = includeSmite ? '' : ` AND ag.spell_d <> 11 AND ag.spell_f <> 11`
  const agFrom = await matchVersionedAggFrom('agg_champion_summoner_spell_pair_stats', version, 'ag')
  const sql = `
      SELECT
        ag.spell_d::int AS spell_d,
        ag.spell_f::int AS spell_f,
        SUM(ag.count_game)::int AS games,
        SUM(ag.count_win)::int AS wins
      FROM ${agFrom}
      WHERE ${matchCond}${roleSql}${smiteSql}
      GROUP BY ag.spell_d, ag.spell_f
      HAVING SUM(ag.count_game) >= 40
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
  const matchCond = buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'ag.')
  const roleNorm = role != null && role !== '' ? String(role).trim().toUpperCase() : null
  const roleSql = roleNorm ? ` AND ag.role_norm = '${roleNorm.replace(/'/g, "''")}'` : ''
  const agFrom = await matchVersionedAggFrom('agg_champion_item_starter_set_stats', version, 'ag')
  const sql = `
      SELECT
        ag.starter_key,
        SUM(ag.count_game)::int AS games,
        SUM(ag.count_win)::int AS wins
      FROM ${agFrom}
      WHERE ${matchCond}${roleSql}
      GROUP BY ag.starter_key
      HAVING SUM(ag.count_game) >= 5
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
    const roleSql = pRole ? ` AND ac.role = '${String(pRole).replace(/'/g, "''")}'` : ''
    const coreFrom = await matchVersionedAggFrom('agg_champion_core_stats', pVersion, 'ac')
    const rsFrom = await matchVersionedAggFrom('agg_champion_runes_solo_stats', pVersion, 'rs')
    const isoFrom = await matchVersionedAggFrom('agg_champion_item_solo_stats', pVersion, 'iso')
    const ssFrom = await matchVersionedAggFrom('agg_champion_summoner_spells', pVersion, 'ss')
    const shFrom = await matchVersionedAggFrom('agg_champion_shard_solo_stats', pVersion, 'sh')
    const istFrom = await matchVersionedAggFrom('agg_champion_item_stats', pVersion, 'ist')
    const crsFrom = await matchVersionedAggFrom('agg_champion_runes_stats', pVersion, 'crs')
    const coreStats = await prisma.$queryRawUnsafe<Array<{ id: bigint; count_game: bigint }>>(`
      SELECT ac.id, ac.count_game
      FROM ${coreFrom}
      WHERE ${buildRawMatchCond(pVersion, rankTier).replace(/\bm\./g, 'ac.')}
      ${roleSql}
    `)
    const totalParticipants = coreStats.reduce((s, r) => s + Number(r.count_game ?? 0), 0)
    if (totalParticipants === 0) {
      overviewDetailCache.set(key, { data: EMPTY_OVERVIEW_DETAIL, expiresAt: now + OVERVIEW_DETAIL_CACHE_TTL_MS })
      return EMPTY_OVERVIEW_DETAIL
    }

    const statIds = coreStats.map((s) => s.id)

    const statIdsSql = statIds.map((s) => s.toString()).join(',')
    const [soloRunes, soloItems, spells, soloShards] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ perkId: number; countWin: bigint; countGame: bigint }>>(`
        SELECT
          perk_id AS "perkId",
          count_win AS "countWin",
          count_game AS "countGame"
        FROM ${rsFrom}
        WHERE champion_stat_id IN (${statIdsSql})
      `),
      prisma.$queryRawUnsafe<
        Array<{
          itemId: number
          countWin: bigint
          countGame: bigint
          countStarter: bigint
          countCore: bigint
          countFinal: bigint
        }>
      >(`
        SELECT
          item_id AS "itemId",
          count_win AS "countWin",
          count_game AS "countGame",
          count_starter AS "countStarter",
          count_core AS "countCore",
          count_final AS "countFinal"
        FROM ${isoFrom}
        WHERE champion_stat_id IN (${statIdsSql})
      `),
      prisma.$queryRawUnsafe<
        Array<{ spellId: number; countWin: bigint; countGame: bigint; countSlot0: bigint; countSlot1: bigint }>
      >(`
        SELECT
          spell_id AS "spellId",
          count_win AS "countWin",
          count_game AS "countGame",
          count_slot0 AS "countSlot0",
          count_slot1 AS "countSlot1"
        FROM ${ssFrom}
        WHERE champion_stat_id IN (${statIdsSql})
        ${includeSmite ? '' : 'AND spell_id <> 11'}
      `),
      prisma.$queryRawUnsafe<Array<{ shardId: number; slot: number; countWin: bigint; countGame: bigint }>>(`
        SELECT
          shard_id AS "shardId",
          slot,
          count_win AS "countWin",
          count_game AS "countGame"
        FROM ${shFrom}
        WHERE champion_stat_id IN (${statIdsSql})
      `),
    ])

    // Per-rune aggregation
    const runeMap = new Map<number, { wins: number; games: number }>()
    for (const r of soloRunes) {
      let e = runeMap.get(r.perkId)
      if (!e) { e = { wins: 0, games: 0 }; runeMap.set(r.perkId, e) }
      e.wins += Number(r.countWin ?? 0); e.games += Number(r.countGame ?? 0)
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
      e.wins += Number(r.countWin ?? 0)
      e.games += Number(r.countGame ?? 0)
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
        b.wins += Number(r.countWin ?? 0)
        b.games += Number(r.countGame ?? 0)
        continue
      }
      let e = itemMap.get(r.itemId)
      if (!e) {
        e = { wins: 0, games: 0 }
        itemMap.set(r.itemId, e)
      }
      e.wins += Number(r.countWin ?? 0)
      e.games += Number(r.countGame ?? 0)
      mergeItemSlice(
        itemStarterMap,
        r.itemId,
        Number(r.countWin ?? 0),
        Number(r.countGame ?? 0),
        OVERVIEW_STARTER_SLICE_EXCLUDED_IDS.has(r.itemId) ? 0 : Number(r.countStarter ?? 0)
      )
      mergeItemSlice(
        itemCoreMap,
        r.itemId,
        Number(r.countWin ?? 0),
        Number(r.countGame ?? 0),
        Number(r.countCore ?? 0)
      )
      mergeItemSlice(
        itemFinalMap,
        r.itemId,
        Number(r.countWin ?? 0),
        Number(r.countGame ?? 0),
        Number(r.countFinal ?? 0)
      )
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
      e.wins += Number(r.countWin ?? 0)
      e.games += Number(r.countGame ?? 0)
      e.slot0 += Number(r.countSlot0 ?? 0)
      e.slot1 += Number(r.countSlot1 ?? 0)
    }

    const apexRoleSql = pRole ? ` AND ac.role = '${String(pRole).replace(/'/g, "''")}'` : ''
    const apexCoreStats = await prisma.$queryRawUnsafe<Array<{ id: bigint }>>(`
      SELECT ac.id
      FROM ${coreFrom}
      WHERE ${buildRawMatchCond(pVersion, [...APEX_LADDER_TIERS]).replace(/\bm\./g, 'ac.')}
      ${apexRoleSql}
    `)
    const apexStatIds = apexCoreStats.map((s) => s.id)
    const apexSpellRows =
      apexStatIds.length > 0
        ? await prisma.$queryRawUnsafe<Array<{ spellId: number; countWin: bigint; countGame: bigint }>>(`
            SELECT
              spell_id AS "spellId",
              count_win AS "countWin",
              count_game AS "countGame"
            FROM ${ssFrom}
            WHERE champion_stat_id IN (${apexStatIds.map((id) => id.toString()).join(',')})
            ${includeSmite ? '' : 'AND spell_id <> 11'}
          `)
        : []
    const apexSpellMap = new Map<number, { wins: number; games: number }>()
    for (const r of apexSpellRows) {
      let e = apexSpellMap.get(r.spellId)
      if (!e) {
        e = { wins: 0, games: 0 }
        apexSpellMap.set(r.spellId, e)
      }
      e.wins += Number(r.countWin ?? 0)
      e.games += Number(r.countGame ?? 0)
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
    const itemSetRows = await prisma.$queryRawUnsafe<
      Array<{ itemList: string; countWin: bigint; countGame: bigint }>
    >(`
      SELECT
        item_list AS "itemList",
        count_win AS "countWin",
        count_game AS "countGame"
      FROM ${istFrom}
      WHERE champion_stat_id IN (${statIdsSql})
      LIMIT 2000
    `)
    const itemSetMap = new Map<string, { wins: number; games: number }>()
    for (const r of itemSetRows) {
      let e = itemSetMap.get(r.itemList)
      if (!e) { e = { wins: 0, games: 0 }; itemSetMap.set(r.itemList, e) }
      e.wins += Number(r.countWin ?? 0); e.games += Number(r.countGame ?? 0)
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
    const runeSetRows = await prisma.$queryRawUnsafe<
      Array<{ runeList: string; shardList: string; countWin: bigint; countGame: bigint }>
    >(`
      SELECT
        rune_list AS "runeList",
        shard_list AS "shardList",
        count_win AS "countWin",
        count_game AS "countGame"
      FROM ${crsFrom}
      WHERE champion_stat_id IN (${statIdsSql})
      LIMIT 2000
    `)
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
      e.wins += Number(r.countWin ?? 0)
      e.games += Number(r.countGame ?? 0)
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
  invalidateAggArchivePartitionCache()
  return { ok: true }
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
    const moFromTeams = await matchVersionedAggFrom('agg_match_outcome_stats', pVersion, 'mo')
    const mvFromTeams = await matchVersionedAggFrom('agg_team_core_stats', pVersion, 'mv')
    const outcomeRows = await prisma.$queryRawUnsafe<Array<{ count_match: bigint }>>(`
      SELECT COALESCE(SUM(mo.count_match), 0)::bigint AS count_match
      FROM ${moFromTeams}
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
      FROM ${mvFromTeams}
      WHERE ${condTeam}
      GROUP BY mv.team
    `)
    const team100 = teamRows.find((r) => Number(r.team) === 100)
    const team200 = teamRows.find((r) => Number(r.team) === 200)
    const toN = (v: bigint | number | null | undefined) => Number(v ?? 0)
    const firstBloodCoverage =
      matchCount > 0
        ? (toN(team100?.count_first_blood) + toN(team200?.count_first_blood)) / matchCount
        : 0
    if (matchCount > 0 && firstBloodCoverage < 0.4) {
      const fallback = await loadTeamCoreFallbackFromIngest(pVersion, rankTier)
      const b = fallback.get(100)
      const r = fallback.get(200)
      if (b || r) {
        if (team100 && b) {
          team100.count_first_blood = BigInt(b.count_first_blood)
          team100.sum_baron_kills = BigInt(b.sum_baron_kills)
          team100.count_baron_first = BigInt(b.count_baron_first)
          team100.sum_dragon_kills = BigInt(b.sum_dragon_kills)
          team100.count_dragon_first = BigInt(b.count_dragon_first)
          team100.sum_tower_kills = BigInt(b.sum_tower_kills)
          team100.count_tower_first = BigInt(b.count_tower_first)
          team100.sum_horde_kills = BigInt(b.sum_horde_kills)
          team100.count_horde_first = BigInt(b.count_horde_first)
          team100.sum_rift_herald_kills = BigInt(b.sum_rift_herald_kills)
          team100.count_rift_herald_first = BigInt(b.count_rift_herald_first)
          team100.sum_inhibitor_kills = BigInt(b.sum_inhibitor_kills)
          team100.sum_elder_kills = BigInt(b.sum_elder_kills)
        }
        if (team200 && r) {
          team200.count_first_blood = BigInt(r.count_first_blood)
          team200.sum_baron_kills = BigInt(r.sum_baron_kills)
          team200.count_baron_first = BigInt(r.count_baron_first)
          team200.sum_dragon_kills = BigInt(r.sum_dragon_kills)
          team200.count_dragon_first = BigInt(r.count_dragon_first)
          team200.sum_tower_kills = BigInt(r.sum_tower_kills)
          team200.count_tower_first = BigInt(r.count_tower_first)
          team200.sum_horde_kills = BigInt(r.sum_horde_kills)
          team200.count_horde_first = BigInt(r.count_horde_first)
          team200.sum_rift_herald_kills = BigInt(r.sum_rift_herald_kills)
          team200.count_rift_herald_first = BigInt(r.count_rift_herald_first)
          team200.sum_inhibitor_kills = BigInt(r.sum_inhibitor_kills)
          team200.sum_elder_kills = BigInt(r.sum_elder_kills)
        }
      }
    }
    const aggWin = {
      firstBlood: { first: toN(team100?.count_first_blood) },
      baron: { first: toN(team100?.count_baron_first), kills: toN(team100?.sum_baron_kills) },
      dragon: { first: toN(team100?.count_dragon_first), kills: toN(team100?.sum_dragon_kills) },
      elder: { first: 0, kills: toN(team100?.sum_elder_kills) },
      tower: { first: toN(team100?.count_tower_first), kills: toN(team100?.sum_tower_kills) },
      inhibitor: { first: 0, kills: toN(team100?.sum_inhibitor_kills) },
      riftHerald: { first: toN(team100?.count_rift_herald_first), kills: toN(team100?.sum_rift_herald_kills) },
      horde: { first: toN(team100?.count_horde_first), kills: toN(team100?.sum_horde_kills) },
    }
    const aggLoss = {
      firstBlood: { first: toN(team200?.count_first_blood) },
      baron: { first: toN(team200?.count_baron_first), kills: toN(team200?.sum_baron_kills) },
      dragon: { first: toN(team200?.count_dragon_first), kills: toN(team200?.sum_dragon_kills) },
      elder: { first: 0, kills: toN(team200?.sum_elder_kills) },
      tower: { first: toN(team200?.count_tower_first), kills: toN(team200?.sum_tower_kills) },
      inhibitor: { first: 0, kills: toN(team200?.sum_inhibitor_kills) },
      riftHerald: { first: toN(team200?.count_rift_herald_first), kills: toN(team200?.sum_rift_herald_kills) },
      horde: { first: toN(team200?.count_horde_first), kills: toN(team200?.sum_horde_kills) },
    }

    const banFromTeams = await matchVersionedAggFrom('agg_champion_bans_by_banner', pVersion, 'mv')
    const banRows = await prisma.$queryRawUnsafe<
      Array<{ champion_id: number; total_bans: bigint }>
    >(`
      SELECT mv.banned_champion_id AS champion_id, SUM(mv.ban_count)::bigint AS total_bans
      FROM ${banFromTeams}
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

    const [
      distBaron,
      distDragon,
      distElder,
      distEarthDrake,
      distWaterDrake,
      distWindDrake,
      distFireDrake,
      distHextecDrake,
      distChemDrake,
      distTower,
      distInhibitor,
      distRiftHerald,
      distHorde,
      drakeByTeam,
    ] = await Promise.all([
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'baron'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'dragon'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'elder'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'earth_drake'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'water_drake'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'wind_drake'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'fire_drake'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'hextec_drake'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'chem_drake'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'tower'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'inhibitor'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'riftHerald'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'horde'),
      loadDrakeBreakdownByTeam(pVersion, rankTier),
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
      matchCount,
      bans: {
        byWin: top20Total,
        byLoss: top20Total,
        top20Total,
      },
      objectives: {
        firstBlood: { firstByWin: aggWin.firstBlood.first, firstByLoss: aggLoss.firstBlood.first },
        baron: objData(aggWin.baron, aggLoss.baron, distBaron),
        dragon: objData(aggWin.dragon, aggLoss.dragon, distDragon),
        elder: objData(aggWin.elder, aggLoss.elder, distElder),
        tower: objData(aggWin.tower, aggLoss.tower, distTower),
        inhibitor: objData(aggWin.inhibitor, aggLoss.inhibitor, distInhibitor),
        riftHerald: objData(aggWin.riftHerald, aggLoss.riftHerald, distRiftHerald),
        horde: objData(aggWin.horde, aggLoss.horde, distHorde),
      },
      drakes: {
        types: {
          elder: {
            byWin: drakeByTeam.blue.types.elder,
            byLoss: drakeByTeam.red.types.elder,
            distributionByWin: distElder.win,
            distributionByLoss: distElder.loss,
          },
          earth: {
            byWin: drakeByTeam.blue.types.earth,
            byLoss: drakeByTeam.red.types.earth,
            distributionByWin: distEarthDrake.win,
            distributionByLoss: distEarthDrake.loss,
          },
          water: {
            byWin: drakeByTeam.blue.types.water,
            byLoss: drakeByTeam.red.types.water,
            distributionByWin: distWaterDrake.win,
            distributionByLoss: distWaterDrake.loss,
          },
          wind: {
            byWin: drakeByTeam.blue.types.wind,
            byLoss: drakeByTeam.red.types.wind,
            distributionByWin: distWindDrake.win,
            distributionByLoss: distWindDrake.loss,
          },
          fire: {
            byWin: drakeByTeam.blue.types.fire,
            byLoss: drakeByTeam.red.types.fire,
            distributionByWin: distFireDrake.win,
            distributionByLoss: distFireDrake.loss,
          },
          hextec: {
            byWin: drakeByTeam.blue.types.hextec,
            byLoss: drakeByTeam.red.types.hextec,
            distributionByWin: distHextecDrake.win,
            distributionByLoss: distHextecDrake.loss,
          },
          chem: {
            byWin: drakeByTeam.blue.types.chem,
            byLoss: drakeByTeam.red.types.chem,
            distributionByWin: distChemDrake.win,
            distributionByLoss: distChemDrake.loss,
          },
        },
        souls: {
          earth: { byWin: drakeByTeam.blue.souls.earth, byLoss: drakeByTeam.red.souls.earth },
          water: { byWin: drakeByTeam.blue.souls.water, byLoss: drakeByTeam.red.souls.water },
          wind: { byWin: drakeByTeam.blue.souls.wind, byLoss: drakeByTeam.red.souls.wind },
          fire: { byWin: drakeByTeam.blue.souls.fire, byLoss: drakeByTeam.red.souls.fire },
          hextec: { byWin: drakeByTeam.blue.souls.hextec, byLoss: drakeByTeam.red.souls.hextec },
          chem: { byWin: drakeByTeam.blue.souls.chem, byLoss: drakeByTeam.red.souls.chem },
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
    const roleSql = pRole ? ` AND ac.role = '${String(pRole).replace(/'/g, "''")}'` : ''
    const acFromDur = await matchVersionedAggFrom('agg_champion_core_stats', pVersion, 'ac')
    const cbFromDur = await matchVersionedAggFrom('agg_champion_bucket', pVersion, 'cb')
    const bucketRows = await prisma.$queryRawUnsafe<
      Array<{ duration_bucket: number; count_win: bigint; count_game: bigint }>
    >(`
      SELECT
        cb.duration_bucket,
        SUM(cb.count_win)::bigint AS count_win,
        SUM(cb.count_game)::bigint AS count_game
      FROM ${cbFromDur}
      INNER JOIN ${acFromDur} ON ac.id = cb.champion_stat_id
      WHERE ${buildRawMatchCond(pVersion, rankTier).replace(/\bm\./g, 'ac.')}
      ${roleSql}
      GROUP BY cb.duration_bucket
    `)

    const bucketMap = new Map<number, { wins: number; games: number }>()
    for (const row of bucketRows) {
      let e = bucketMap.get(Number(row.duration_bucket))
      if (!e) { e = { wins: 0, games: 0 }; bucketMap.set(Number(row.duration_bucket), e) }
      e.wins += Number(row.count_win ?? 0)
      e.games += Number(row.count_game ?? 0)
    }

    const buckets = Array.from(bucketMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([durationBucket, e]) => ({
        durationMin: durationBucket,
        matchCount: e.games,
        wins: e.wins,
        winrate: e.games > 0 ? Math.round((e.wins / e.games) * 10000) / 100 : 0,
        durationMinutes: durationBucket,
        matches: e.games,
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
    const acFromCh = await matchVersionedAggFrom('agg_champion_core_stats', version ?? null, 'ac')
    const cbFromCh = await matchVersionedAggFrom('agg_champion_bucket', version ?? null, 'cb')
    const bucketRows = await prisma.$queryRawUnsafe<
      Array<{ duration_bucket: number; count_win: bigint; count_game: bigint }>
    >(`
      SELECT
        cb.duration_bucket,
        SUM(cb.count_win)::bigint AS count_win,
        SUM(cb.count_game)::bigint AS count_game
      FROM ${cbFromCh}
      INNER JOIN ${acFromCh} ON ac.id = cb.champion_stat_id
      WHERE ac.champion_id = ${championId}
        AND ${buildRawMatchCond(version ?? null, rankTier).replace(/\bm\./g, 'ac.')}
      GROUP BY cb.duration_bucket
    `)

    const bucketMap = new Map<number, { wins: number; games: number }>()
    for (const row of bucketRows) {
      let e = bucketMap.get(Number(row.duration_bucket))
      if (!e) { e = { wins: 0, games: 0 }; bucketMap.set(Number(row.duration_bucket), e) }
      e.wins += Number(row.count_win ?? 0)
      e.games += Number(row.count_game ?? 0)
    }

    const buckets = Array.from(bucketMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([durationBucket, e]) => ({
        durationMin: durationBucket,
        matchCount: e.games,
        wins: e.wins,
        winrate: e.games > 0 ? Math.round((e.wins / e.games) * 10000) / 100 : 0,
        durationMinutes: durationBucket,
        matches: e.games,
      }))

    return { buckets }
  } catch {
    return null
  }
}

const DURATION_TIER_ORDER = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'CHALLENGER',
] as const

function sortDurationTierKey(a: string, b: string): number {
  const ia = DURATION_TIER_ORDER.indexOf(a as (typeof DURATION_TIER_ORDER)[number])
  const ib = DURATION_TIER_ORDER.indexOf(b as (typeof DURATION_TIER_ORDER)[number])
  return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
}

/** Buckets de durée agrégés par ligue (tier de base), optionnellement filtrés par version / role / rankTier. */
export async function getDurationWinrateByChampionByTier(
  championId: number,
  version?: string | null,
  rankTier?: string | string[] | null,
  role?: string | null
): Promise<ChampionDurationWinrateByTier | null> {
  if (!isDatabaseConfigured()) return null
  try {
    let roleNorm = role != null && String(role).trim() !== '' ? String(role).trim().toUpperCase() : null
    if (roleNorm === 'UTILITY') roleNorm = 'SUPPORT'
    const roleSql = roleNorm ? ` AND ac.role = '${roleNorm.replace(/'/g, "''")}'` : ''

    const acFromTier = await matchVersionedAggFrom('agg_champion_core_stats', version ?? null, 'ac')
    const cbFromTier = await matchVersionedAggFrom('agg_champion_bucket', version ?? null, 'cb')
    const rows = await prisma.$queryRawUnsafe<
      Array<{ rank_tier: string; duration_bucket: number; count_win: bigint; count_game: bigint }>
    >(`
      SELECT
        ac.rank_tier,
        cb.duration_bucket,
        SUM(cb.count_win)::bigint AS count_win,
        SUM(cb.count_game)::bigint AS count_game
      FROM ${cbFromTier}
      INNER JOIN ${acFromTier} ON ac.id = cb.champion_stat_id
      WHERE ac.champion_id = ${championId}
        AND ${buildRawMatchCond(version ?? null, rankTier).replace(/\bm\./g, 'ac.')}
        ${roleSql}
      GROUP BY ac.rank_tier, cb.duration_bucket
    `)

    const cellMap = new Map<string, { wins: number; games: number }>()
    for (const row of rows) {
      const base = String(row.rank_tier ?? '').trim().toUpperCase().split('_')[0] ?? ''
      if (!base || base === 'UNRANKED') continue
      const key = `${base}\0${Number(row.duration_bucket)}`
      let e = cellMap.get(key)
      if (!e) {
        e = { wins: 0, games: 0 }
        cellMap.set(key, e)
      }
      e.wins += Number(row.count_win ?? 0)
      e.games += Number(row.count_game ?? 0)
    }

    const byTier = new Map<string, Map<number, { wins: number; games: number }>>()
    for (const [key, e] of cellMap) {
      const sep = key.indexOf('\0')
      const tier = key.slice(0, sep)
      const dur = Number(key.slice(sep + 1))
      if (!Number.isFinite(dur)) continue
      let m = byTier.get(tier)
      if (!m) {
        m = new Map()
        byTier.set(tier, m)
      }
      const prev = m.get(dur) ?? { wins: 0, games: 0 }
      m.set(dur, { wins: prev.wins + e.wins, games: prev.games + e.games })
    }

    const series = [...byTier.entries()]
      .sort(([a], [b]) => sortDurationTierKey(a, b))
      .map(([rankTierKey, durMap]) => ({
        rankTier: rankTierKey,
        buckets: [...durMap.entries()]
          .sort(([d1], [d2]) => d1 - d2)
          .map(([durationMin, agg]) => ({
            durationMin,
            matchCount: agg.games,
            wins: agg.wins,
            winrate: agg.games > 0 ? Math.round((agg.wins / agg.games) * 10000) / 100 : 0,
            durationMinutes: durationMin,
            matches: agg.games,
          })),
      }))

    return { series }
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
    const roleFilterSql = pRole
      ? ` AND ac.role = '${String(pRole).replace(/'/g, "''")}'`
      : ''
    const rawCond = buildRawMatchCond(undefined, rankTier).replace(/\bm\./g, 'ac.')
    const oldestPrefix = normalizePatchMajorMinor(String(versionOldest)).replace(/'/g, "''")
    const sinceOldestSql = versionAtOrAfterSql('ac', oldestPrefix)

    const oldestFrom = await matchVersionedAggFrom('agg_champion_core_stats', versionOldest, 'ac')
    const sinceFrom = await sqlAggUnionAllLiveAndArchives('agg_champion_core_stats', 'ac')

    const [oldestRows, sinceRows] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ champion_id: number; count_win: bigint; count_game: bigint }>>(`
        SELECT ac.champion_id, ac.count_win, ac.count_game
        FROM ${oldestFrom}
        WHERE ${rawCond}
          AND ac.game_version LIKE '${oldestPrefix}%'
          ${roleFilterSql}
      `),
      prisma.$queryRawUnsafe<Array<{ champion_id: number; count_win: bigint; count_game: bigint }>>(`
        SELECT ac.champion_id, ac.count_win, ac.count_game
        FROM ${sinceFrom}
        WHERE ${rawCond}
          AND ${sinceOldestSql}
          ${roleFilterSql}
      `),
    ])

    const aggByChamp = (rows: Array<{ champion_id: number; count_win: bigint; count_game: bigint }>) => {
      const m = new Map<number, { wins: number; games: number }>()
      for (const r of rows) {
        const championId = Number(r.champion_id)
        let e = m.get(championId)
        if (!e) { e = { wins: 0, games: 0 }; m.set(championId, e) }
        e.wins += Number(r.count_win ?? 0); e.games += Number(r.count_game ?? 0)
      }
      return m
    }

    const oldestMap = aggByChamp(oldestRows)
    const sinceMap = aggByChamp(sinceRows)
    const oldestTotalGamesProg = Array.from(oldestMap.values()).reduce((s, e) => s + e.games, 0)
    const sinceTotalGamesProg = Array.from(sinceMap.values()).reduce((s, e) => s + e.games, 0)
    const minOldProg = minGamesPerChampForProgressionSlice(oldestTotalGamesProg)
    const minSinceProg = minGamesPerChampForProgressionSlice(sinceTotalGamesProg)

    const progressionRows: Array<{ championId: number; wrOldest: number; wrSince: number; delta: number }> = []
    for (const [cid, oldEntry] of oldestMap.entries()) {
      if (oldEntry.games < minOldProg) continue
      const sinceEntry = sinceMap.get(cid)
      if (!sinceEntry || sinceEntry.games < minSinceProg) continue
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
    const roleFilterSql = pRole
      ? ` AND ac.role = '${String(pRole).replace(/'/g, "''")}'`
      : ''
    const roleFilterBannerSql = pRole
      ? ` AND mv.banner_role_norm = '${String(pRole).trim().toUpperCase().replace(/'/g, "''")}'`
      : ''
    const rawCond = buildRawMatchCond(undefined, rankTier).replace(/\bm\./g, 'ac.')
    const rawCondMv = buildRawMatchCond(undefined, rankTier).replace(/\bm\./g, 'mv.')
    const rawCondMo = buildRawMatchCond(undefined, rankTier).replace(/\bm\./g, 'mo.')
    const oldestPrefixFull = normalizePatchMajorMinor(String(versionOldest)).replace(/'/g, "''")
    const sinceAcSql = versionAtOrAfterSql('ac', oldestPrefixFull)
    const sinceMvSql = versionAtOrAfterSql('mv', oldestPrefixFull)
    const sinceMoSql = versionAtOrAfterSql('mo', oldestPrefixFull)

    const oldestFromFull = await matchVersionedAggFrom('agg_champion_core_stats', versionOldest, 'ac')
    const sinceFromFull = await sqlAggUnionAllLiveAndArchives('agg_champion_core_stats', 'ac')
    const oldestBanFrom = await matchVersionedAggFrom('agg_champion_bans_by_banner', versionOldest, 'mv')
    const sinceBanFrom = await sqlAggUnionAllLiveAndArchives('agg_champion_bans_by_banner', 'mv')
    const oldestMoFrom = await matchVersionedAggFrom('agg_match_outcome_stats', versionOldest, 'mo')
    const sinceMoFrom = await sqlAggUnionAllLiveAndArchives('agg_match_outcome_stats', 'mo')

    const [oldestRows, sinceRows, oldestBanRows, sinceBanRows, oldestMatchRows, sinceMatchRows] = await Promise.all([
      prisma.$queryRawUnsafe<
        Array<{ champion_id: number; count_win: bigint; count_game: bigint; count_ban: bigint }>
      >(`
        SELECT ac.champion_id, ac.count_win, ac.count_game, ac.count_ban
        FROM ${oldestFromFull}
        WHERE ${rawCond}
          AND ac.game_version LIKE '${oldestPrefixFull}%'
          ${roleFilterSql}
      `),
      prisma.$queryRawUnsafe<
        Array<{ champion_id: number; count_win: bigint; count_game: bigint; count_ban: bigint }>
      >(`
        SELECT ac.champion_id, ac.count_win, ac.count_game, ac.count_ban
        FROM ${sinceFromFull}
        WHERE ${rawCond}
          AND ${sinceAcSql}
          ${roleFilterSql}
      `),
      prisma.$queryRawUnsafe<Array<{ champion_id: number; bans: bigint }>>(`
        SELECT mv.banned_champion_id AS champion_id, COALESCE(SUM(mv.ban_count), 0)::bigint AS bans
        FROM ${oldestBanFrom}
        WHERE ${rawCondMv}
          AND mv.game_version LIKE '${oldestPrefixFull}%'
          ${roleFilterBannerSql}
        GROUP BY mv.banned_champion_id
      `),
      prisma.$queryRawUnsafe<Array<{ champion_id: number; bans: bigint }>>(`
        SELECT mv.banned_champion_id AS champion_id, COALESCE(SUM(mv.ban_count), 0)::bigint AS bans
        FROM ${sinceBanFrom}
        WHERE ${rawCondMv}
          AND ${sinceMvSql}
          ${roleFilterBannerSql}
        GROUP BY mv.banned_champion_id
      `),
      prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(`
        SELECT COALESCE(SUM(mo.count_match), 0)::bigint AS cnt
        FROM ${oldestMoFrom}
        WHERE ${rawCondMo}
          AND mo.game_version LIKE '${oldestPrefixFull}%'
      `),
      prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(`
        SELECT COALESCE(SUM(mo.count_match), 0)::bigint AS cnt
        FROM ${sinceMoFrom}
        WHERE ${rawCondMo}
          AND ${sinceMoSql}
      `),
    ])

    const aggByChamp = (rows: Array<{ champion_id: number; count_win: bigint; count_game: bigint; count_ban: bigint }>) => {
      const m = new Map<number, { wins: number; games: number; bans: number }>()
      for (const r of rows) {
        const championId = Number(r.champion_id)
        let e = m.get(championId)
        if (!e) {
          e = { wins: 0, games: 0, bans: 0 }
          m.set(championId, e)
        }
        e.wins += Number(r.count_win ?? 0)
        e.games += Number(r.count_game ?? 0)
        e.bans += Number(r.count_ban ?? 0)
      }
      return m
    }

    const oldestMap = aggByChamp(oldestRows)
    const sinceMap = aggByChamp(sinceRows)
    const oldestBansMap = new Map<number, number>()
    for (const row of oldestBanRows) oldestBansMap.set(Number(row.champion_id), Number(row.bans ?? 0))
    const sinceBansMap = new Map<number, number>()
    for (const row of sinceBanRows) sinceBansMap.set(Number(row.champion_id), Number(row.bans ?? 0))
    const oldestTotalGames = Array.from(oldestMap.values()).reduce((s, e) => s + e.games, 0)
    const sinceTotalGames = Array.from(sinceMap.values()).reduce((s, e) => s + e.games, 0)
    const oldestTotalMatches = Number(oldestMatchRows[0]?.cnt ?? 0)
    const sinceTotalMatches = Number(sinceMatchRows[0]?.cnt ?? 0)
    const minOldFull = minGamesPerChampForProgressionSlice(oldestTotalGames)
    const minSinceFull = minGamesPerChampForProgressionSlice(sinceTotalGames)

    const champions: OverviewProgressionFullStats['champions'] = []
    for (const [cid, oldEntry] of oldestMap.entries()) {
      if (oldEntry.games < minOldFull) continue
      const sinceEntry = sinceMap.get(cid)
      if (!sinceEntry || sinceEntry.games < minSinceFull) continue
      const oldestBans = oldestBansMap.get(cid) ?? 0
      const sinceBans = sinceBansMap.get(cid) ?? 0
      const banrateOldest =
        oldestTotalMatches > 0 ? Math.min(100, (oldestBans / (2 * oldestTotalMatches)) * 100) : 0
      const banrateSince =
        sinceTotalMatches > 0 ? Math.min(100, (sinceBans / (2 * sinceTotalMatches)) * 100) : 0
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
    const moFromMeta = await matchVersionedAggFrom('agg_match_outcome_stats', version, 'mo')
    const rows = await prisma.$queryRawUnsafe<Array<{ players: bigint }>>(`
      SELECT COALESCE(SUM(mo.count_match), 0)::bigint * 10 AS players
      FROM ${moFromMeta}
      WHERE ${buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mo.')}
    `)
    const playerCount = Number(rows[0]?.players ?? 0)
    return { lastUpdate: null, playerCount }
  } catch (err) {
    console.error('[getOverviewMeta]', err)
    return null
  }
}

export interface InfosMetaCounts {
  totalMatches: number
  totalPlayers: number
  /** DISTINCT player_id dans ingest pour les matchs du filtre patch / ligue / rôle (aligné overview). */
  playersWithIngestMatches: number
}

/**
 * WHERE pour `ingest_matchs im` + `ingest_match_players imp` (mêmes règles que buildRawMatchCond sur match).
 */
function buildIngestMatchPlayerWhereSql(
  version?: string | string[] | null,
  rankTier?: string | string[] | null,
  role?: string | null
): string {
  const parts: string[] = []
  const versions = toQueryStringArrayParam(version)
  const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
  if (versions.length === 1) {
    parts.push(
      `im.game_version LIKE '${normalizePatchMajorMinor(versions[0]!).replace(/'/g, "''")}%'`
    )
  } else if (versions.length > 1) {
    parts.push(
      `im.game_version IN (${versions.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(',')})`
    )
  }
  if (ranks.length === 1) parts.push(`im.rank_tier = '${ranks[0]!.replace(/'/g, "''")}'`)
  else if (ranks.length > 1)
    parts.push(`im.rank_tier IN (${ranks.map((r) => `'${r.replace(/'/g, "''")}'`).join(',')})`)
  else parts.push(`im.rank_tier <> 'UNRANKED'`)
  const roleNorm = role != null && role !== '' ? String(role).trim().toUpperCase() : null
  if (roleNorm) parts.push(`imp.role = '${roleNorm.replace(/'/g, "''")}'`)
  return parts.join(' AND ')
}

async function countDistinctPlayersInIngest(
  version?: string | string[] | null,
  rankTier?: string | string[] | null,
  role?: string | null
): Promise<number> {
  const whereSql = buildIngestMatchPlayerWhereSql(version, rankTier, role)
  const rows = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(`
    SELECT COUNT(DISTINCT imp.player_id)::bigint AS c
    FROM ingest_match_players imp
    INNER JOIN ingest_matchs im ON im.id = imp.match_id
    WHERE ${whereSql}
  `)
  return Number(rows[0]?.c ?? 0)
}

/**
 * Compteurs Infos :
 * - total matches / total players : globaux (tous patches)
 * - playersWithIngestMatches : joueurs distincts ayant au moins une ligne ingest sur le filtre patch / ligue / rôle
 */
export async function getInfosMetaCounts(
  version?: string | string[] | null,
  rankTier?: string | string[] | null,
  role?: string | null
): Promise<InfosMetaCounts | null> {
  if (!isDatabaseConfigured()) return null
  try {
    const moUnion = await sqlAggUnionAllLiveAndArchives('agg_match_outcome_stats', 'mo')
    const matchRows = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
      `SELECT COALESCE(SUM(mo.count_match), 0)::bigint AS c FROM ${moUnion}`
    )
    const totalMatches = Number(matchRows[0]?.c ?? 0)
    const totalPlayers = await prisma.player.count()
    const playersWithIngestMatches = await countDistinctPlayersInIngest(version, rankTier, role)
    return {
      totalMatches,
      totalPlayers,
      playersWithIngestMatches,
    }
  } catch (err) {
    console.error('[getInfosMetaCounts]', err)
    return null
  }
}

export async function getInfosPatchDivisionMatrix(): Promise<InfosPatchDivisionMatrix | null> {
  if (!isDatabaseConfigured()) return null
  type RawRow = { version: string; rank_tier: string; match_count: bigint }
  try {
    const moUnionPatch = await sqlAggUnionAllLiveAndArchives('agg_match_outcome_stats', 'mo')
    const raw = await prisma.$queryRawUnsafe<RawRow[]>(`
      SELECT
        mo.game_version::text AS version,
        mo.rank_tier::text AS rank_tier,
        COALESCE(SUM(mo.count_match), 0)::bigint AS match_count
      FROM ${moUnionPatch}
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

/** Seuil min. parties / champion pour les tops overview (pick/WR/ban). */
function minGamesForOverviewChampionPool(totalParticipants: number): number {
  const n = Number(totalParticipants) || 0
  if (n >= 80_000) return 20
  if (n >= 25_000) return 15
  if (n >= 8_000) return 10
  if (n >= 2_000) return 5
  return 1
}

/** Seuil côté « oldest » ou « since » pour les progressions (comparaison inter-patch). */
function minGamesPerChampForProgressionSlice(totalGamesInSlice: number): number {
  const n = Number(totalGamesInSlice) || 0
  if (n >= 200_000) return 20
  if (n >= 60_000) return 15
  if (n >= 15_000) return 10
  if (n >= 3_000) return 5
  return 2
}

function buildRawMatchCond(
  version?: string | string[] | null,
  rankTier?: string | string[] | null
): string {
  const parts: string[] = []
  const versions = toQueryStringArrayParam(version)
  const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
  if (versions.length === 1)
    parts.push(`m.game_version LIKE '${normalizePatchMajorMinor(versions[0]).replace(/'/g, "''")}%'`)
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
    const tbFrom = await matchVersionedAggFrom('agg_team_bucket', pVersion, 'tb')
    const bFrom = await matchVersionedAggFrom('agg_team_core_stats', pVersion, 'b')
    const rows = await prisma.$queryRawUnsafe<
      Array<{ team: number; objective_bucket: number; count_win: number; count_game: number }>
    >(`
          SELECT
            b.team,
            tb.objective_bucket,
            SUM(tb.count_win)::int AS count_win,
            SUM(tb.count_game)::int AS count_game
          FROM ${tbFrom}
          JOIN ${bFrom} ON b.id = tb.team_stat_id
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
    if (message.includes('42P01') || message.includes('agg_team_bucket')) {
      if (!hasWarnedMissingTeamBucket) {
        hasWarnedMissingTeamBucket = true
        console.warn('[loadObjectiveDistributionBySides] agg_team_bucket missing; empty distributions')
      }
      return { blue: {}, red: {} }
    }
    throw err
  }
}

async function loadObjectiveDistributionByOutcome(
  pVersion: string | null,
  rankTier: string | string[] | null | undefined,
  objectiveKey: string
): Promise<{ win: Record<string, number>; loss: Record<string, number> }> {
  const bySide = await loadObjectiveDistributionBySides(pVersion, rankTier, objectiveKey)
  return { win: bySide.blue, loss: bySide.red }
}

type DrakeBreakdown = {
  types: {
    elder: number
    earth: number
    water: number
    wind: number
    fire: number
    hextec: number
    chem: number
  }
  souls: {
    earth: number
    water: number
    wind: number
    fire: number
    hextec: number
    chem: number
  }
}

function emptyDrakeBreakdown(): DrakeBreakdown {
  return {
    types: { elder: 0, earth: 0, water: 0, wind: 0, fire: 0, hextec: 0, chem: 0 },
    souls: { earth: 0, water: 0, wind: 0, fire: 0, hextec: 0, chem: 0 },
  }
}

function normalizeDrakeType(raw: string): keyof DrakeBreakdown['types'] | null {
  const v = String(raw || '').trim().toUpperCase()
  if (!v) return null
  if (v.includes('ELDER')) return 'elder'
  if (v.includes('MOUNTAIN') || v.includes('EARTH')) return 'earth'
  if (v.includes('OCEAN') || v.includes('WATER')) return 'water'
  if (v.includes('CLOUD') || v.includes('WIND') || v.includes('AIR')) return 'wind'
  if (v.includes('INFERNAL') || v.includes('FIRE')) return 'fire'
  if (v.includes('HEXTECH') || v.includes('HEXTEC')) return 'hextec'
  if (v.includes('CHEMTECH') || v.includes('CHEM')) return 'chem'
  return null
}

function normalizeSoulType(rawSoul: string): keyof DrakeBreakdown['souls'] | null {
  const v = String(rawSoul || '').trim().toLowerCase()
  if (!v || v === 'none' || v === 'null' || v === 'false' || v === '0') return null
  if (v.includes('mountain') || v.includes('earth')) return 'earth'
  if (v.includes('ocean') || v.includes('water')) return 'water'
  if (v.includes('cloud') || v.includes('wind') || v.includes('air')) return 'wind'
  if (v.includes('infernal') || v.includes('fire')) return 'fire'
  if (v.includes('hextech') || v.includes('hextec')) return 'hextec'
  if (v.includes('chemtech') || v.includes('chem')) return 'chem'
  return null
}

function isSoulFlagEnabled(rawSoul: string): boolean {
  const v = String(rawSoul || '').trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes'
}

async function loadDrakeBreakdownByTeam(
  version?: string | string[] | null,
  rankTier?: string | string[] | null
): Promise<{ blue: DrakeBreakdown; red: DrakeBreakdown }> {
  const cond = buildRawMatchCond(version, rankTier)
  const rows = await prisma.$queryRawUnsafe<Array<{ team: number; drake_type: string; soul_raw: string }>>(`
      SELECT
        it.team,
        UPPER(COALESCE(d.elem->>'drakeType', '')) AS drake_type,
        LOWER(COALESCE(d.elem->>'soul', '')) AS soul_raw
      FROM ingest_teams it
      INNER JOIN ingest_matchs m ON m.id = it.match_id
      LEFT JOIN LATERAL jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(it.drakes_json::jsonb) = 'array' THEN it.drakes_json::jsonb
          ELSE '[]'::jsonb
        END
      ) AS d(elem) ON TRUE
      WHERE ${cond}
  `)
  const blue = emptyDrakeBreakdown()
  const red = emptyDrakeBreakdown()
  for (const row of rows) {
    const team = Number(row.team)
    const target = team === 100 ? blue : team === 200 ? red : null
    if (!target) continue
    const drakeType = normalizeDrakeType(row.drake_type)
    if (!drakeType) continue
    target.types[drakeType] += 1

    const soulType =
      normalizeSoulType(row.soul_raw) ??
      (isSoulFlagEnabled(row.soul_raw) && drakeType !== 'elder' ? drakeType : null)
    if (soulType) target.souls[soulType] += 1
  }
  return { blue, red }
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
    const mvSidesA = await matchVersionedAggFrom('agg_team_core_stats', version, 'mv')
    const sideRows = await prisma.$queryRawUnsafe<Array<{ team_id: number; matches: bigint; wins: bigint }>>(`
      SELECT mv.team AS team_id, SUM(mv.count_game)::bigint AS matches, SUM(mv.count_win)::bigint AS wins
      FROM ${mvSidesA}
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

    const sideChampFrom = await matchVersionedAggFrom('agg_champion_side_stats', version, 'mv')
    const champRows = await prisma.$queryRawUnsafe<
      Array<{ team_id: number; champion_id: number; games: bigint; wins: bigint }>
    >(`
      SELECT
        mv.team_num AS team_id,
        mv.champion_id,
        SUM(mv.count_game)::bigint AS games,
        SUM(mv.count_win)::bigint AS wins
      FROM ${sideChampFrom}
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

    const banSidesFrom = await matchVersionedAggFrom('agg_champion_bans_by_banner', version, 'mv')
    const banRows = await prisma.$queryRawUnsafe<Array<{ team_id: number; champion_id: number; cnt: bigint }>>(`
      SELECT
        mv.team_num AS team_id,
        mv.banned_champion_id AS champion_id,
        SUM(mv.ban_count)::bigint AS cnt
      FROM ${banSidesFrom}
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
    const mvSidesB = await matchVersionedAggFrom('agg_team_core_stats', version, 'mv')
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
      FROM ${mvSidesB}
      WHERE ${condTeam}
      GROUP BY mv.team
    `)
    const firstBloodCoverage =
      matchCount > 0
        ? teamAggRows.reduce((s, r) => s + Number(r.count_first_blood ?? 0), 0) / matchCount
        : 0
    if (matchCount > 0 && firstBloodCoverage < 0.4) {
      const fallback = await loadTeamCoreFallbackFromIngest(version, rankTier)
      for (const row of teamAggRows) {
        const f = fallback.get(Number(row.team))
        if (!f) continue
        row.count_first_blood = BigInt(f.count_first_blood)
        row.sum_baron_kills = BigInt(f.sum_baron_kills)
        row.count_baron_first = BigInt(f.count_baron_first)
        row.sum_dragon_kills = BigInt(f.sum_dragon_kills)
        row.count_dragon_first = BigInt(f.count_dragon_first)
        row.sum_tower_kills = BigInt(f.sum_tower_kills)
        row.count_tower_first = BigInt(f.count_tower_first)
        row.sum_horde_kills = BigInt(f.sum_horde_kills)
        row.count_horde_first = BigInt(f.count_horde_first)
        row.sum_rift_herald_kills = BigInt(f.sum_rift_herald_kills)
        row.count_rift_herald_first = BigInt(f.count_rift_herald_first)
        row.sum_inhibitor_kills = BigInt(f.sum_inhibitor_kills)
        row.sum_elder_kills = BigInt(f.sum_elder_kills)
      }
    }
    const blue = teamAggRows.find((r) => Number(r.team) === 100)
    const red = teamAggRows.find((r) => Number(r.team) === 200)
    const n = (v: bigint | undefined) => Number(v ?? 0)
    const drakeByTeam = await loadDrakeBreakdownByTeam(version, rankTier)
    const drakesBySide: NonNullable<OverviewSidesApiStats['drakesBySide']> = {
      types: {
        elder: { byBlue: drakeByTeam.blue.types.elder, byRed: drakeByTeam.red.types.elder },
        earth: { byBlue: drakeByTeam.blue.types.earth, byRed: drakeByTeam.red.types.earth },
        water: { byBlue: drakeByTeam.blue.types.water, byRed: drakeByTeam.red.types.water },
        wind: { byBlue: drakeByTeam.blue.types.wind, byRed: drakeByTeam.red.types.wind },
        fire: { byBlue: drakeByTeam.blue.types.fire, byRed: drakeByTeam.red.types.fire },
        hextec: { byBlue: drakeByTeam.blue.types.hextec, byRed: drakeByTeam.red.types.hextec },
        chem: { byBlue: drakeByTeam.blue.types.chem, byRed: drakeByTeam.red.types.chem },
      },
      souls: {
        earth: { byBlue: drakeByTeam.blue.souls.earth, byRed: drakeByTeam.red.souls.earth },
        water: { byBlue: drakeByTeam.blue.souls.water, byRed: drakeByTeam.red.souls.water },
        wind: { byBlue: drakeByTeam.blue.souls.wind, byRed: drakeByTeam.red.souls.wind },
        fire: { byBlue: drakeByTeam.blue.souls.fire, byRed: drakeByTeam.red.souls.fire },
        hextec: { byBlue: drakeByTeam.blue.souls.hextec, byRed: drakeByTeam.red.souls.hextec },
        chem: { byBlue: drakeByTeam.blue.souls.chem, byRed: drakeByTeam.red.souls.chem },
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
      distEarthDrake,
      distWaterDrake,
      distWindDrake,
      distFireDrake,
      distHextecDrake,
      distChemDrake,
      distTower,
      distInhibitor,
      distRiftHerald,
      distHorde,
    ] = await Promise.all([
      loadObjectiveDistributionBySides(pVersion, rankTier, 'baron'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'dragon'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'elder'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'earth_drake'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'water_drake'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'wind_drake'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'fire_drake'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'hextec_drake'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'chem_drake'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'tower'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'inhibitor'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'riftHerald'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'horde'),
    ])
    drakesBySide.types.elder.distributionByBlue = distElder.blue
    drakesBySide.types.elder.distributionByRed = distElder.red
    drakesBySide.types.earth.distributionByBlue = distEarthDrake.blue
    drakesBySide.types.earth.distributionByRed = distEarthDrake.red
    drakesBySide.types.water.distributionByBlue = distWaterDrake.blue
    drakesBySide.types.water.distributionByRed = distWaterDrake.red
    drakesBySide.types.wind.distributionByBlue = distWindDrake.blue
    drakesBySide.types.wind.distributionByRed = distWindDrake.red
    drakesBySide.types.fire.distributionByBlue = distFireDrake.blue
    drakesBySide.types.fire.distributionByRed = distFireDrake.red
    drakesBySide.types.hextec.distributionByBlue = distHextecDrake.blue
    drakesBySide.types.hextec.distributionByRed = distHextecDrake.red
    drakesBySide.types.chem.distributionByBlue = distChemDrake.blue
    drakesBySide.types.chem.distributionByRed = distChemDrake.red
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
  roleSql: string,
  fromMv: string
): Promise<Map<number, { games: number; wins: number }>> {
  const sql = `
    SELECT
      mv.champion_id,
      SUM(mv.count_game)::int AS games,
      SUM(mv.count_win)::int AS wins
    FROM ${fromMv}
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
  versionClauseSql: string,
  fromMv: string
): Promise<Map<number, number>> {
  const sql = `
    SELECT
      mv.banned_champion_id AS champion_id,
      SUM(mv.ban_count)::int AS bans
    FROM ${fromMv}
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

    const oldestSideFrom = await matchVersionedAggFrom('agg_champion_side_stats', voRaw, 'mv')
    const sinceSideFrom = await sqlAggUnionAllLiveAndArchives('agg_champion_side_stats', 'mv')
    const oldestBanFrom = await matchVersionedAggFrom('agg_champion_bans_by_banner', voRaw, 'mv')
    const sinceBanFrom = await sqlAggUnionAllLiveAndArchives('agg_champion_bans_by_banner', 'mv')

    const buildSide = async (teamId: 100 | 200): Promise<OverviewProgressionFullStats['champions']> => {
      const [oldestMap, sinceMap, banOldest, banSince] = await Promise.all([
        sideChampionMap(rawMatchCond, teamId, oldestClause, rSql, oldestSideFrom),
        sideChampionMap(rawMatchCond, teamId, sinceClause, rSql, sinceSideFrom),
        sideBanMap(rawMatchCond, teamId, oldestClause, oldestBanFrom),
        sideBanMap(rawMatchCond, teamId, sinceClause, sinceBanFrom),
      ])
      let oldestTotalGames = 0
      for (const e of oldestMap.values()) oldestTotalGames += e.games
      let sinceTotalGames = 0
      for (const e of sinceMap.values()) sinceTotalGames += e.games
      const minOldSide = minGamesPerChampForProgressionSlice(oldestTotalGames)
      const minSinceSide = minGamesPerChampForProgressionSlice(sinceTotalGames)
      const champions: OverviewProgressionFullStats['champions'] = []
      for (const [cid, oldEntry] of oldestMap.entries()) {
        if (oldEntry.games < minOldSide) continue
        const sinceEntry = sinceMap.get(cid)
        if (!sinceEntry || sinceEntry.games < minSinceSide) continue
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

export async function getObjectiveOutcomeAggByPatchDivision(
  version?: string | string[] | null,
  rankTier?: string | string[] | null,
  objectiveKey?: string | null
): Promise<ObjectiveOutcomeAggByPatchDivision> {
  if (!isDatabaseConfigured()) return { rows: [] }
  const versions = toQueryStringArrayParam(version)
  const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
  const conditions: string[] = ['1=1']
  if (versions.length === 1) {
    conditions.push(`tc.game_version LIKE '${normalizePatchMajorMinor(versions[0]).replace(/'/g, "''")}%'`)
  } else if (versions.length > 1) {
    conditions.push(
      `tc.game_version IN (${versions.map((v) => `'${normalizePatchMajorMinor(v).replace(/'/g, "''")}'`).join(',')})`
    )
  }
  if (ranks.length === 1) {
    conditions.push(`tc.rank_tier = '${ranks[0]}'`)
  } else if (ranks.length > 1) {
    conditions.push(`tc.rank_tier IN (${ranks.map((r) => `'${r}'`).join(',')})`)
  } else {
    conditions.push(`tc.rank_tier <> 'UNRANKED'`)
  }
  const objective = (objectiveKey ?? '').trim()
  if (objective) {
    conditions.push(`tb.objective_key = '${objective.replace(/'/g, "''")}'`)
  }

  const whereSql = conditions.join(' AND ')
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        game_version: string
        rank_tier: string
        objective_key: string
        objective_bucket: number
        games: bigint
        wins: bigint
      }>
    >(`
      SELECT
        tc.game_version,
        tc.rank_tier,
        tb.objective_key,
        tb.objective_bucket,
        SUM(tb.count_game)::bigint AS games,
        SUM(tb.count_win)::bigint AS wins
      FROM agg_team_bucket tb
      INNER JOIN agg_team_core_stats tc ON tc.id = tb.team_stat_id
      WHERE ${whereSql}
      GROUP BY tc.game_version, tc.rank_tier, tb.objective_key, tb.objective_bucket
      ORDER BY tc.game_version DESC, tc.rank_tier ASC, tb.objective_key ASC, tb.objective_bucket ASC
    `)
    return {
      rows: rows.map((r) => {
        const games = Number(r.games ?? 0)
        const wins = Number(r.wins ?? 0)
        const losses = Math.max(0, games - wins)
        const winrateWinner = games > 0 ? Math.round((wins / games) * 10000) / 100 : 0
        const winrateOther = games > 0 ? Math.round((losses / games) * 10000) / 100 : 0
        return {
          version: String(r.game_version ?? ''),
          rankTier: String(r.rank_tier ?? ''),
          objectiveKey: String(r.objective_key ?? ''),
          objectiveCount: Number(r.objective_bucket ?? 0),
          games,
          wins,
          losses,
          winrateWinner,
          winrateOther,
        }
      }),
    }
  } catch (err) {
    console.error('[getObjectiveOutcomeAggByPatchDivision]', err)
    return { rows: [] }
  }
}
