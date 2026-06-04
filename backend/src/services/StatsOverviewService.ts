/**
 * Overview stats for the statistics page: total matches, last update, top winrate champions,
 * matches per division, distinct participant count (unique player_id in match_players).
 * Uses incremental aggregate tables (`agg_*`) plus legacy MVs for metrics not yet migrated.
 */
import { queryRawUnsafe, isDatabaseConfigured } from '../db/query.js'
import { sql } from '../db/client.js'
import {
  buildRankTierSqlConditions,
  normalizeStatsRoleForBanner,
  normalizeStatsRoleForChampion,
  normalizedRankTiers,
  rankTierCacheKey,
  statsRoleCacheKey,
  statsRoleSqlLiteral,
  toQueryStringArrayParam,
} from '../utils/statsFilters.js'
import { buildRawMatchCond } from './ChampionGlobalTableService.js'
import { mergeLegacyStatShardAggregates } from '../utils/statShardLegacyMerge.js'
import { parseShardList } from '../utils/parseShardList.js'
import { isBootsTier2Or3ItemId } from '../parsers/bootItemClassification.js'
import { loadItemMeta } from '../worker/itemBuildSelection.js'
import {
  invalidateAggArchivePartitionCache,
  buildProgressionOldestOnlySql,
  buildProgressionSinceSql,
  listDistinctPatchVersions,
  matchVersionedAggFrom,
  normalizePatchMajorMinor,
  progressionHasComparableSinceRange,
  sqlAggUnionAllLiveAndArchives,
} from './statsAggArchive.js'
import { normalizeGameVersionToMajorMinor } from '../utils/gameVersion.js'
import { getTeamSurrenderTotalsBySide } from './StatsAbandonsService.js'

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
    casts: number
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
    spell1Casts: number
    spell2Casts: number
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

/** Winrate (%) quand l'équipe a le « first » (bucket 1 dans agg_team_bucket). */
export type ObjectiveFirstWinrateGlobal = {
  firstBlood: number | null
  baron: number | null
  dragon: number | null
  tower: number | null
  inhibitor: number | null
  riftHerald: number | null
  horde: number | null
}

export type ObjectiveFirstWinrateBySide = {
  firstBlood: { blue: number | null; red: number | null }
  baron: { blue: number | null; red: number | null }
  dragon: { blue: number | null; red: number | null }
  tower: { blue: number | null; red: number | null }
  inhibitor: { blue: number | null; red: number | null }
  riftHerald: { blue: number | null; red: number | null }
  horde: { blue: number | null; red: number | null }
}

export type ObjectiveFirstWinrateGames = {
  firstBlood: number
  baron: number
  dragon: number
  tower: number
  inhibitor: number
  riftHerald: number
  horde: number
}

export type ObjectiveFirstWinrateGamesBySide = {
  firstBlood: { blue: number; red: number }
  baron: { blue: number; red: number }
  dragon: { blue: number; red: number }
  tower: { blue: number; red: number }
  inhibitor: { blue: number; red: number }
  riftHerald: { blue: number; red: number }
  horde: { blue: number; red: number }
}

export interface GameFirstObjectiveStats {
  distributionByWin: Record<string, number>
  distributionByLoss: Record<string, number>
  distributionByBlue?: Record<string, number>
  distributionByRed?: Record<string, number>
}

export interface OverviewTeamsStats {
  matchCount: number
  objectiveFirstWinrateGlobal?: ObjectiveFirstWinrateGlobal
  objectiveFirstWinrateGames?: ObjectiveFirstWinrateGames
  gameFirstObjective?: GameFirstObjectiveStats
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
      elder: DrakeTypeTeamRow
      earth: DrakeTypeTeamRow
      water: DrakeTypeTeamRow
      wind: DrakeTypeTeamRow
      fire: DrakeTypeTeamRow
      hextec: DrakeTypeTeamRow
      chem: DrakeTypeTeamRow
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

export interface DrakeTypeTeamRow {
  byWin: number
  byLoss: number
  securedWinrateGlobal?: number | null
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
      {
        byBlue: number
        byRed: number
        winrateBlue?: number | null
        winrateRed?: number | null
        distributionByBlue?: Record<string, number>
        distributionByRed?: Record<string, number>
        distributionWinsByBlue?: Record<string, number>
        distributionWinsByRed?: Record<string, number>
      }
    >
    souls: Record<string, { byBlue: number; byRed: number; winrateBlue?: number | null; winrateRed?: number | null }>
  }
  surrenderBySide?: OverviewSurrenderBySide
  objectiveFirstWinrateBySide?: ObjectiveFirstWinrateBySide
  objectiveFirstWinrateGames?: ObjectiveFirstWinrateGames
  objectiveFirstWinrateGamesBySide?: ObjectiveFirstWinrateGamesBySide
  gameFirstObjective?: GameFirstObjectiveStats
  objectivesBySide: {
    blue: Record<string, number>
    red: Record<string, number>
  }
  objectivesBySideTable: {
    firstBlood: {
      firstByBlue: number
      firstByRed: number
      distributionByBlue?: Record<string, number>
      distributionByRed?: Record<string, number>
    }
    [key: string]:
      | {
          firstByBlue?: number
          firstByRed?: number
          killsByBlue?: number
          killsByRed?: number
          distributionByBlue?: Record<string, number>
          distributionByRed?: Record<string, number>
          distributionWinsByBlue?: Record<string, number>
          distributionWinsByRed?: Record<string, number>
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
  return `${v ?? ''}|${rankTierCacheKey(rankTier) ?? ''}|${role ?? ''}|${s}|itemPickV2`
}
function sidesCacheKey(
  version: string | string[] | null | undefined,
  rankTier: string | string[] | null | undefined,
  role: string | null | undefined
): string {
  const v = Array.isArray(version) ? version.join(',') : version ?? ''
  const r = rankTierCacheKey(rankTier) ?? ''
  const ro = (role ?? '').toUpperCase()
  return `${v}|${r}|${ro}`
}

// ── Param normalisation ──────────────────────────────────────────────────────

function resolveOverviewRoleFilters(role: string | null | undefined): {
  champion: string | null
  banner: string | null
  cacheKey: string
} {
  return {
    champion: normalizeStatsRoleForChampion(role),
    banner: normalizeStatsRoleForBanner(role),
    cacheKey: statsRoleCacheKey(role),
  }
}

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
  count_inhibitor_first: number
  sum_elder_kills: number
}

async function ingestTeamLeanTablesExist(): Promise<boolean> {
  return false
}

async function loadTeamCoreFallbackFromIngest(
  version: string | string[] | null | undefined,
  rankTier: string | string[] | null | undefined
): Promise<Map<number, TeamCoreFallback>> {
  if (!(await ingestTeamLeanTablesExist())) return new Map()
  const versions = toQueryStringArrayParam(version)
  const cond: string[] = ['1=1']
  if (versions.length === 1) {
    const patch = normalizePatchMajorMinor(versions[0]!).replace(/'/g, "''")
    cond.push(`im.game_version LIKE '${patch}%'`)
  } else if (versions.length > 1) {
    cond.push(`im.game_version IN (${versions.map((v) => `'${v.replace(/'/g, "''")}'`).join(',')})`)
  }
  cond.push(...buildRankTierSqlConditions('im', rankTier))
  const rows = await queryRawUnsafe<
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
      count_inhibitor_first: bigint
      sum_elder_kills: bigint
    }>
  >(`
    WITH first_inhibitor_by_match AS (
      SELECT
        it.match_id,
        CASE
          WHEN SUM(CASE WHEN it.inhibitor_first THEN 1 ELSE 0 END) = 1
          THEN MAX(CASE WHEN it.inhibitor_first THEN it.team END)
          WHEN SUM(CASE WHEN it.inhibitor_kills > 0 THEN 1 ELSE 0 END) = 1
          THEN MAX(CASE WHEN it.inhibitor_kills > 0 THEN it.team END)
          ELSE NULL
        END AS first_inhibitor_team
      FROM ingest_teams it
      GROUP BY it.match_id
    )
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
      COALESCE(
        SUM(
          CASE
            WHEN it.inhibitor_first OR fibm.first_inhibitor_team = it.team THEN 1
            ELSE 0
          END
        ),
        0
      )::bigint AS count_inhibitor_first,
      COALESCE(SUM(it.elder_kills), 0)::bigint AS sum_elder_kills
    FROM ingest_teams it
    INNER JOIN ingest_matchs im ON im.id = it.match_id
    LEFT JOIN first_inhibitor_by_match fibm ON fibm.match_id = im.id
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
      count_inhibitor_first: Number(row.count_inhibitor_first ?? 0),
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
  const byTeam = new Map<number, { early: number; surrender: number }>()
  try {
    const corrected = await getTeamSurrenderTotalsBySide(version, rankTier)
    for (const team of [100, 200] as const) {
      const c = corrected.get(team)
      if (c) byTeam.set(team, { early: c.early, surrender: c.surrender })
    }
  } catch (err) {
    console.warn('[loadSurrenderBySideCounts] corrected agg', err)
  }
  const hasAnyAggSurrender =
    (byTeam.get(100)?.early ?? 0) +
      (byTeam.get(100)?.surrender ?? 0) +
      (byTeam.get(200)?.early ?? 0) +
      (byTeam.get(200)?.surrender ?? 0) >
    0
  const hasMatches = blueMatchTotal + redMatchTotal > 0
  const aggLooksInvalid =
    (byTeam.get(100)?.surrender ?? 0) > blueMatchTotal ||
    (byTeam.get(200)?.surrender ?? 0) > redMatchTotal ||
    (byTeam.get(100)?.early ?? 0) > (byTeam.get(100)?.surrender ?? 0) ||
    (byTeam.get(200)?.early ?? 0) > (byTeam.get(200)?.surrender ?? 0)
  if ((!hasAnyAggSurrender || aggLooksInvalid) && hasMatches) {
    // Fallback for fresh patches where agg_team_core_stats surrender counters can lag behind match data.
    if (await ingestTeamLeanTablesExist()) {
      try {
        const versions = toQueryStringArrayParam(version)
        const condIngest: string[] = ['1=1']
        if (versions.length === 1) {
          const patch = normalizePatchMajorMinor(versions[0]!).replace(/'/g, "''")
          condIngest.push(`im.game_version LIKE '${patch}%'`)
        } else if (versions.length > 1) {
          condIngest.push(
            `im.game_version IN (${versions.map((v) => `'${v.replace(/'/g, "''")}'`).join(',')})`
          )
        }
        condIngest.push(...buildRankTierSqlConditions('im', rankTier))
        const ingestRows = await queryRawUnsafe<
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
      } catch (err) {
        console.warn('[loadSurrenderBySideCounts] ingest fallback', err instanceof Error ? err.message : err)
      }
    }
  }
  return {
    blue: {
      total: blueMatchTotal,
      earlySurrenderCount: Math.min(
        blueMatchTotal,
        Math.max(0, byTeam.get(100)?.early ?? 0)
      ),
      surrenderCount: Math.min(
        blueMatchTotal,
        Math.max(0, byTeam.get(100)?.surrender ?? 0)
      ),
    },
    red: {
      total: redMatchTotal,
      earlySurrenderCount: Math.min(
        redMatchTotal,
        Math.max(0, byTeam.get(200)?.early ?? 0)
      ),
      surrenderCount: Math.min(
        redMatchTotal,
        Math.max(0, byTeam.get(200)?.surrender ?? 0)
      ),
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
  const roleFilters = resolveOverviewRoleFilters(role)
  const pRankTierKey = rankTierCacheKey(rankTier)
  const now = Date.now()
  const cacheKey = `${overviewCacheKey(pVersion, pRankTierKey)}|${roleFilters.cacheKey}`
  const cached = overviewStatsCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.data

  try {
    const coreFrom = await matchVersionedAggFrom('agg_champion_core_stats', version, 'ac')
    const moFrom = await matchVersionedAggFrom('agg_match_outcome_stats', version, 'mo')
    const banFrom = await matchVersionedAggFrom('agg_champion_bans_by_banner', version, 'mv')
    const banRoleSql = roleFilters.banner
      ? ` AND mv.banner_role_norm = '${statsRoleSqlLiteral(roleFilters.banner)}'`
      : ''
    const [coreRows, matchOutcomeRows, matchDivisionRows, matchVersionRows, banAggRows] = await Promise.all([
      queryRawUnsafe<
        Array<{
          champion_id: number
          count_win: bigint
          count_game: bigint
        }>
      >(`
        SELECT
          ac.champion_id,
          COALESCE(SUM(ac.count_win), 0)::bigint AS count_win,
          COALESCE(SUM(ac.count_game), 0)::bigint AS count_game
        FROM ${coreFrom}
        WHERE ${buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'ac.')}
        ${roleFilters.champion ? `AND ac.role = '${statsRoleSqlLiteral(roleFilters.champion)}'` : ''}
        GROUP BY ac.champion_id
      `),
      queryRawUnsafe<Array<{ game_version: string; rank_tier: string; count_match: bigint }>>(`
        SELECT mo.game_version, mo.rank_tier, mo.count_match
        FROM ${moFrom}
        WHERE ${buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mo.')}
      `),
      queryRawUnsafe<Array<{ rank_tier: string; match_count: bigint }>>(`
        SELECT mo.rank_tier, COALESCE(SUM(mo.count_match), 0)::bigint AS match_count
        FROM ${moFrom}
        WHERE ${buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mo.')}
        GROUP BY mo.rank_tier
        ORDER BY match_count DESC
      `),
      queryRawUnsafe<Array<{ game_version: string; match_count: bigint }>>(`
        SELECT mo.game_version, COALESCE(SUM(mo.count_match), 0)::bigint AS match_count
        FROM ${moFrom}
        WHERE ${buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mo.')}
        GROUP BY mo.game_version
        ORDER BY match_count DESC
        LIMIT 20
      `),
      queryRawUnsafe<Array<{ champion_id: number; bans: bigint }>>(`
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
    for (const row of coreRows) {
      const championId = Number(row.champion_id)
      byChampion.set(championId, {
        wins: Number(row.count_win ?? 0),
        games: Number(row.count_game ?? 0),
        bans: 0,
      })
    }
    const totalParticipants = coreRows.reduce((acc, row) => acc + Number(row.count_game ?? 0), 0)
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

    const matchesByVersion = matchVersionRows
      .map((r) => ({
        version: r.game_version,
        matchCount: Number(r.match_count ?? 0),
      }))
      .filter((r) => r.matchCount > 0)

    const playerCount = Math.round(totalParticipants)
    const blueMatchTotal = totalMatches
    const redMatchTotal = totalMatches
    let surrenderBySide: OverviewSurrenderBySide | undefined
    try {
      surrenderBySide = await loadSurrenderBySideCounts(
        version,
        rankTier,
        blueMatchTotal,
        redMatchTotal
      )
    } catch (err) {
      console.warn(
        '[getOverviewStats] surrenderBySide',
        err instanceof Error ? err.message : err
      )
    }

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

/** Patches présents dans `match_outcome_stats` (au moins un match), pour filtres version / référence. */
export async function getMatchesByVersionStats(
  rankTier?: string | string[] | null
): Promise<Array<{ version: string; matchCount: number }>> {
  if (!isDatabaseConfigured()) return []
  try {
    const moFrom = await matchVersionedAggFrom('agg_match_outcome_stats', null, 'mo')
    const rows = await queryRawUnsafe<Array<{ game_version: string; match_count: bigint }>>(`
      SELECT
        mo.game_version,
        COALESCE(SUM(mo.count_match), 0)::bigint AS match_count
      FROM ${moFrom}
      WHERE ${buildRawMatchCond(null, rankTier).replace(/\bm\./g, 'mo.')}
      GROUP BY mo.game_version
      HAVING COALESCE(SUM(mo.count_match), 0) > 0
      ORDER BY match_count DESC
    `)
    return rows.map((r) => ({
      version: String(r.game_version ?? '').trim(),
      matchCount: Number(r.match_count ?? 0),
    })).filter((r) => r.version && r.matchCount > 0)
  } catch (err) {
    console.warn('[getMatchesByVersionStats]', err instanceof Error ? err.message : err)
    return []
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

type SpellPairSqlRow = {
  spell_d: number
  spell_f: number
  games: number
  wins: number
  spell1_casts: bigint
  spell2_casts: bigint
}

async function loadSummonerSpellPairsFromMatches(
  version: string | null,
  rankTier: string | string[] | null,
  includeSmite: boolean,
  useApexRanksOnly: boolean
): Promise<SpellPairSqlRow[]> {
  const matchCond = buildRawMatchCond(version, useApexRanksOnly ? [...APEX_LADDER_TIERS] : rankTier).replace(
    /\bm\./g,
    'ag.'
  )
  const smiteSql = includeSmite ? '' : ` AND ag.spell_d <> 11 AND ag.spell_f <> 11`
  const agFrom = await matchVersionedAggFrom('agg_champion_summoner_spell_pair_stats', version, 'ag')
  const sql = `
      SELECT
        ag.spell_d::int AS spell_d,
        ag.spell_f::int AS spell_f,
        SUM(ag.count_game)::int AS games,
        SUM(ag.count_win)::int AS wins,
        COALESCE(SUM(ag.spell_d_casts), 0)::bigint AS spell1_casts,
        COALESCE(SUM(ag.spell_f_casts), 0)::bigint AS spell2_casts
      FROM ${agFrom}
      WHERE ${matchCond}${smiteSql}
      GROUP BY ag.spell_d, ag.spell_f
      HAVING SUM(ag.count_game) >= 40
      ORDER BY games DESC
      LIMIT 150
    `
  try {
    const rows = await queryRawUnsafe<SpellPairSqlRow[]>(sql)
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

function buildOverviewDetailWhere(
  alias: string,
  pVersion: string | null,
  rankTier: string | string[] | null | undefined,
  roleNorm: string | null
): string {
  const parts = [buildRawMatchCond(pVersion, rankTier).replace(/\bm\./g, `${alias}.`)]
  if (roleNorm) parts.push(`upper(${alias}.role::text) = '${statsRoleSqlLiteral(roleNorm)}'`)
  return parts.join(' AND ')
}

function parseItemSetKeyString(key: string): number[] {
  if (!key) return []
  const trimmed = key.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        return parsed.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
      }
    } catch {
      /* legacy JSON parse failed */
    }
  }
  return trimmed
    .split('_')
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
}

function securedGamesFromOutcome(dist: Record<string, number>): number {
  let total = 0
  for (const [bucketRaw, countRaw] of Object.entries(dist)) {
    const bucket = Number(bucketRaw)
    if (!Number.isFinite(bucket) || bucket < 1) continue
    total += Number(countRaw ?? 0)
  }
  return total
}

/** Parties où l'équipe a le « first » sur l'objectif (histogramme dédié, bucket 1). */
function firstGamesFromOutcome(dist: Record<string, number>): number {
  return Number(dist['1'] ?? 0)
}

function firstGamesFromSideDistribution(dist: Record<string, number>): number {
  return Number(dist['1'] ?? 0)
}

/** Expression SQL du nombre de bans (filtrable par rôle du banneur). */
function bannerRoleBanCountSqlExpr(bannerRole: string | null, alias: string): string {
  const r = bannerRole ? statsRoleSqlLiteral(bannerRole) : null
  if (r === 'TOP') return `${alias}.count_banner_top`
  if (r === 'JUNGLE') return `${alias}.count_banner_jungle`
  if (r === 'MIDDLE') return `${alias}.count_banner_mid`
  if (r === 'BOTTOM') return `${alias}.count_banner_adc`
  if (r === 'SUPPORT') return `${alias}.count_banner_support`
  return `${alias}.ban_count`
}

function enrichTeamObjectiveAggFromHistogram(
  aggWin: Record<string, { first: number; kills?: number }>,
  aggLoss: Record<string, { first: number; kills?: number }>,
  key: string,
  dist: { win: Record<string, number>; loss: Record<string, number> }
): void {
  const w = aggWin[key]
  const l = aggLoss[key]
  if (!w || !l) return
  if ('kills' in w && 'kills' in l) {
    w.kills = sumObjectiveCountFromDistribution(dist.win)
    l.kills = sumObjectiveCountFromDistribution(dist.loss)
  }
}

function enrichTeamObjectiveFirstFromHistogram(
  aggWin: Record<string, { first: number; kills?: number }>,
  aggLoss: Record<string, { first: number; kills?: number }>,
  key: string,
  dist: { win: Record<string, number>; loss: Record<string, number> }
): void {
  const w = aggWin[key]
  const l = aggLoss[key]
  if (!w || !l) return
  w.first = firstGamesFromOutcome(dist.win)
  l.first = firstGamesFromOutcome(dist.loss)
}

async function loadItemStarterSetsFromMatches(
  version: string | null,
  rankTier: string | string[] | null,
  role: string | null
): Promise<ItemStarterSetSqlRow[]> {
  const matchCond = buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'ag.')
  const roleNorm = normalizeStatsRoleForChampion(role)
  const roleSql = roleNorm ? ` AND upper(ag.role::text) = '${statsRoleSqlLiteral(roleNorm)}'` : ''
  const agFrom = await matchVersionedAggFrom('agg_champion_item_stats', version, 'ag')
  const sql = `
      SELECT
        ag.item_set_key AS starter_key,
        SUM(ag.count_game)::int AS games,
        SUM(ag.count_win)::int AS wins
      FROM ${agFrom}
      WHERE ${matchCond}${roleSql}
        AND ag.phase = 'starter'
        AND ag.item_set_key <> ''
      GROUP BY ag.item_set_key
      HAVING SUM(ag.count_game) >= 5
      ORDER BY games DESC
      LIMIT 50
    `
  try {
    const rows = await queryRawUnsafe<ItemStarterSetSqlRow[]>(sql)
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
  const roleFilters = resolveOverviewRoleFilters(role)
  const key = overviewDetailCacheKey(pVersion, rankTier, roleFilters.cacheKey || null, includeSmite ?? false)
  const now = Date.now()
  const cached = overviewDetailCache.get(key)
  if (cached && cached.expiresAt > now) return cached.data

  try {
    const detailWhere = buildOverviewDetailWhere('ac', pVersion, rankTier, roleFilters.champion)
    const coreFrom = await matchVersionedAggFrom('agg_champion_core_stats', pVersion, 'ac')
    const rsFrom = await matchVersionedAggFrom('agg_champion_runes_solo_stats', pVersion, 'rs')
    const isoFrom = await matchVersionedAggFrom('agg_champion_item_solo_stats', pVersion, 'iso')
    const ssFrom = await matchVersionedAggFrom('agg_champion_summoner_spells', pVersion, 'ss')
    const shFrom = await matchVersionedAggFrom('agg_champion_shard_solo_stats', pVersion, 'sh')
    const istFrom = await matchVersionedAggFrom('agg_champion_item_stats', pVersion, 'ist')
    const crsFrom = await matchVersionedAggFrom('agg_champion_runes_stats', pVersion, 'crs')
    const totalRows = await queryRawUnsafe<Array<{ total: bigint }>>(`
      SELECT COALESCE(SUM(ac.count_game), 0)::bigint AS total
      FROM ${coreFrom}
      WHERE ${detailWhere}
    `)
    const totalParticipants = Number(totalRows[0]?.total ?? 0)
    if (totalParticipants === 0) {
      overviewDetailCache.set(key, { data: EMPTY_OVERVIEW_DETAIL, expiresAt: now + OVERVIEW_DETAIL_CACHE_TTL_MS })
      return EMPTY_OVERVIEW_DETAIL
    }

    const rsWhere = buildOverviewDetailWhere('rs', pVersion, rankTier, roleFilters.champion)
    const isoWhere = buildOverviewDetailWhere('iso', pVersion, rankTier, roleFilters.champion)
    const ssWhere = buildOverviewDetailWhere('ss', pVersion, rankTier, roleFilters.champion)
    const shWhere = buildOverviewDetailWhere('sh', pVersion, rankTier, roleFilters.champion)
    const istWhere = buildOverviewDetailWhere('ist', pVersion, rankTier, roleFilters.champion)
    const crsWhere = buildOverviewDetailWhere('crs', pVersion, rankTier, roleFilters.champion)
    const smiteSpellSql = includeSmite ? '' : 'AND ss.spell_id <> 11'

    const [soloRunes, soloItems, spells, soloShards] = await Promise.all([
      queryRawUnsafe<Array<{ perkId: number; countWin: bigint; countGame: bigint }>>(`
        SELECT
          rs.perk_id AS "perkId",
          SUM(rs.count_win)::bigint AS "countWin",
          SUM(rs.count_game)::bigint AS "countGame"
        FROM ${rsFrom}
        WHERE ${rsWhere}
        GROUP BY rs.perk_id
      `),
      queryRawUnsafe<
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
          iso.item_id AS "itemId",
          SUM(iso.count_win)::bigint AS "countWin",
          SUM(iso.count_game)::bigint AS "countGame",
          SUM(iso.count_starter)::bigint AS "countStarter",
          SUM(iso.count_core)::bigint AS "countCore",
          SUM(iso.count_final)::bigint AS "countFinal"
        FROM ${isoFrom}
        WHERE ${isoWhere}
        GROUP BY iso.item_id
      `),
      queryRawUnsafe<
        Array<{ spellId: number; countWin: bigint; countGame: bigint; countSlot0: bigint; countSlot1: bigint }>
      >(`
        SELECT
          ss.spell_id AS "spellId",
          SUM(ss.count_win)::bigint AS "countWin",
          SUM(ss.count_game)::bigint AS "countGame",
          SUM(ss.count_slot0)::bigint AS "countSlot0",
          SUM(ss.count_slot1)::bigint AS "countSlot1"
        FROM ${ssFrom}
        WHERE ${ssWhere} ${smiteSpellSql}
        GROUP BY ss.spell_id
      `),
      queryRawUnsafe<Array<{ shardId: number; slot: number; countWin: bigint; countGame: bigint }>>(`
        SELECT
          sh.shard_id AS "shardId",
          sh.slot,
          SUM(sh.count_win)::bigint AS "countWin",
          SUM(sh.count_game)::bigint AS "countGame"
        FROM ${shFrom}
        WHERE ${shWhere}
        GROUP BY sh.shard_id, sh.slot
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
    await loadItemMeta()
    const isBootItemId = (itemId: number) => isBootsTier2Or3ItemId(itemId)

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
    /** Pickrate / WR : achats joueur (`count_game`), comme runes / sorts — pas les occurrences de slot (starter/core/final). */
    const sliceRows = (
      map: Map<number, ItemSliceAgg>,
      purchaseByItem: Map<number, { wins: number; games: number }>
    ): Array<{ itemId: number; games: number; wins: number; pickrate: number; winrate: number }> =>
      Array.from(map.entries())
        .map(([itemId, e]) => {
          const purchase = purchaseByItem.get(itemId)
          const purchaseGames = Math.max(0, Number(purchase?.games ?? 0))
          const purchaseWins = Math.max(0, Number(purchase?.wins ?? 0))
          const slotGames = Math.max(0, Math.round(e.g))
          return {
            itemId,
            games: slotGames,
            wins: purchaseWins,
            pickrate:
              totalParticipants > 0
                ? Math.round((purchaseGames / totalParticipants) * 10000) / 100
                : 0,
            winrate:
              purchaseGames > 0
                ? Math.round((purchaseWins / purchaseGames) * 10000) / 100
                : 0,
          }
        })
        .filter((r) => r.games > 0 || (purchaseByItem.get(r.itemId)?.games ?? 0) > 0)
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
    const itemsStarters = sliceRows(itemStarterMap, itemMap)
    const itemsCores = sliceRows(itemCoreMap, itemMap)
    const itemsFinals = sliceRows(itemFinalMap, itemMap)

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

    const apexSsWhere = buildOverviewDetailWhere('ss', pVersion, [...APEX_LADDER_TIERS], roleFilters.champion)
    const apexSpellRows = await queryRawUnsafe<Array<{ spellId: number; countWin: bigint; countGame: bigint }>>(`
      SELECT
        ss.spell_id AS "spellId",
        SUM(ss.count_win)::bigint AS "countWin",
        SUM(ss.count_game)::bigint AS "countGame"
      FROM ${ssFrom}
      WHERE ${apexSsWhere} ${smiteSpellSql}
      GROUP BY ss.spell_id
    `)
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
          casts: 0,
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
      loadSummonerSpellPairsFromMatches(pVersion, rankTier ?? null, includeSmite ?? false, false),
      loadSummonerSpellPairsFromMatches(pVersion, rankTier ?? null, includeSmite ?? false, true),
      loadItemStarterSetsFromMatches(pVersion, rankTier ?? null, roleFilters.champion),
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
      const spell1Casts = Number(r.spell1_casts ?? 0)
      const spell2Casts = Number(r.spell2_casts ?? 0)
      const key = `${spellIdD}:${spellIdF}`
      const ax = apexPairMap.get(key)
      const heG = ax?.games
      const heW = ax?.wins
      return {
        spellIdD,
        spellIdF,
        games,
        wins,
        spell1Casts,
        spell2Casts,
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
    const spellCastMap = new Map<number, number>()
    for (const s of summonerSpellSets) {
      spellCastMap.set(s.spellIdD, (spellCastMap.get(s.spellIdD) ?? 0) + Number(s.spell1Casts ?? 0))
      spellCastMap.set(s.spellIdF, (spellCastMap.get(s.spellIdF) ?? 0) + Number(s.spell2Casts ?? 0))
    }
    summonerSpells = summonerSpells.map((s) => ({
      ...s,
      casts: spellCastMap.get(s.spellId) ?? 0,
    }))

    // Item sets (combinations) - from champion_item_stats
    const itemSetRows = await queryRawUnsafe<
      Array<{ itemList: string; countWin: bigint; countGame: bigint }>
    >(`
      SELECT
        ist.item_set_key AS "itemList",
        SUM(ist.count_win)::bigint AS "countWin",
        SUM(ist.count_game)::bigint AS "countGame"
      FROM ${istFrom}
      WHERE ${istWhere}
        AND ist.phase = 'final'
        AND ist.item_set_key <> ''
      GROUP BY ist.item_set_key
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
        const parsedItems = parseItemSetKeyString(listStr)
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
        const parsedItems = parseItemSetKeyString(r.starter_key)
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
    const runeSetRows = await queryRawUnsafe<
      Array<{ runeList: string; shardList: string; countWin: bigint; countGame: bigint }>
    >(`
      SELECT
        crs.rune_list AS "runeList",
        crs.shard_list AS "shardList",
        SUM(crs.count_win)::bigint AS "countWin",
        SUM(crs.count_game)::bigint AS "countGame"
      FROM ${crsFrom}
      WHERE ${crsWhere}
      GROUP BY crs.rune_list, crs.shard_list
      LIMIT 2000
    `)
    const runeSetAggKeySep = '\u001e'
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
          shards: parseShardList(e.shardList),
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
  const roleFilters = resolveOverviewRoleFilters(role)
  const pRankKey = rankTierCacheKey(rankTier)
  const now = Date.now()
  const cacheKey = `${overviewCacheKey(pVersion, pRankKey)}|${roleFilters.cacheKey}`
  const cached = overviewTeamsCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.data

  try {
    const condTeam = buildRawMatchCond(pVersion, rankTier).replace(/\bm\./g, 'mv.')
    const moFromTeams = await matchVersionedAggFrom('agg_match_outcome_stats', pVersion, 'mo')
    const mvFromTeams = await matchVersionedAggFrom('agg_team_core_stats', pVersion, 'mv')
    const outcomeRows = await queryRawUnsafe<Array<{ count_match: bigint }>>(`
      SELECT COALESCE(SUM(mo.count_match), 0)::bigint AS count_match
      FROM ${moFromTeams}
      WHERE ${buildRawMatchCond(pVersion, rankTier).replace(/\bm\./g, 'mo.')}
    `)
    const matchCount = Number(outcomeRows[0]?.count_match ?? 0)

    const teamRows = await queryRawUnsafe<
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
        count_inhibitor_first: bigint
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
        SUM(mv.count_inhibitor_first)::bigint AS count_inhibitor_first,
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
          team100.count_inhibitor_first = BigInt(b.count_inhibitor_first)
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
          team200.count_inhibitor_first = BigInt(r.count_inhibitor_first)
          team200.sum_elder_kills = BigInt(r.sum_elder_kills)
        }
      }
    }
    const aggWin = {
      firstBlood: { first: 0 },
      baron: { first: 0, kills: toN(team100?.sum_baron_kills) },
      dragon: { first: 0, kills: toN(team100?.sum_dragon_kills) },
      elder: { first: 0, kills: toN(team100?.sum_elder_kills) },
      tower: { first: 0, kills: toN(team100?.sum_tower_kills) },
      inhibitor: { first: 0, kills: toN(team100?.sum_inhibitor_kills) },
      riftHerald: { first: 0, kills: toN(team100?.sum_rift_herald_kills) },
      horde: { first: 0, kills: toN(team100?.sum_horde_kills) },
    }
    const aggLoss = {
      firstBlood: { first: 0 },
      baron: { first: 0, kills: toN(team200?.sum_baron_kills) },
      dragon: { first: 0, kills: toN(team200?.sum_dragon_kills) },
      elder: { first: 0, kills: toN(team200?.sum_elder_kills) },
      tower: { first: 0, kills: toN(team200?.sum_tower_kills) },
      inhibitor: { first: 0, kills: toN(team200?.sum_inhibitor_kills) },
      riftHerald: { first: 0, kills: toN(team200?.sum_rift_herald_kills) },
      horde: { first: 0, kills: toN(team200?.sum_horde_kills) },
    }

    const banCoreFrom = await matchVersionedAggFrom('agg_champion_bans_by_banner_core', pVersion, 'bb')
    const banWhere = buildRawMatchCond(pVersion, rankTier).replace(/\bm\./g, 'bb.')
    const banCountExpr = bannerRoleBanCountSqlExpr(roleFilters.banner, 'bb')
    const banRows = await queryRawUnsafe<
      Array<{ champion_id: number; total_bans: bigint }>
    >(`
      SELECT bb.banned_champion_id AS champion_id, SUM(${banCountExpr})::bigint AS total_bans
      FROM ${banCoreFrom}
      WHERE ${banWhere}
      GROUP BY bb.banned_champion_id
      ORDER BY total_bans DESC
      LIMIT 20
    `)
    const totalBans = banRows.reduce((a, r) => a + Number(r.total_bans ?? 0), 0)
    const toBanRow = (r: { champion_id: number; total_bans: bigint }) => {
      const count = Number(r.total_bans ?? 0)
      return {
        championId: Number(r.champion_id),
        count,
        banRatePercent: totalBans > 0 ? (Math.round((count / totalBans) * 1000) / 10).toFixed(1) + '%' : '—',
      }
    }
    const top20Total = banRows.map(toBanRow)

    const [banByWinRows, banByLossRows] = await Promise.all([
      queryRawUnsafe<Array<{ champion_id: number; total_bans: bigint }>>(`
        SELECT bb.banned_champion_id AS champion_id, SUM(bb.count_ban_when_team_won)::bigint AS total_bans
        FROM ${banCoreFrom}
        WHERE ${banWhere}
        GROUP BY bb.banned_champion_id
        HAVING SUM(bb.count_ban_when_team_won) > 0
        ORDER BY total_bans DESC
        LIMIT 20
      `),
      queryRawUnsafe<Array<{ champion_id: number; total_bans: bigint }>>(`
        SELECT bb.banned_champion_id AS champion_id, SUM(bb.count_ban_when_team_lost)::bigint AS total_bans
        FROM ${banCoreFrom}
        WHERE ${banWhere}
        GROUP BY bb.banned_champion_id
        HAVING SUM(bb.count_ban_when_team_lost) > 0
        ORDER BY total_bans DESC
        LIMIT 20
      `),
    ])
    const byWin = banByWinRows.map(toBanRow)
    const byLoss = banByLossRows.map(toBanRow)

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
      distEarthSoul,
      distWaterSoul,
      distWindSoul,
      distFireSoul,
      distHextecSoul,
      distChemSoul,
      distTower,
      distInhibitor,
      distRiftHerald,
      distHorde,
      distFirstBlood,
      distBaronFirst,
      distDragonFirst,
      distTowerFirst,
      distInhibitorFirst,
      distRiftHeraldFirst,
      distHordeFirst,
      distGameFirst,
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
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'earth_soul'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'water_soul'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'wind_soul'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'fire_soul'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'hextec_soul'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'chem_soul'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'tower'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'inhibitor'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'riftHerald'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'horde'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'first_blood'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'baron_first'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'dragon_first'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'tower_first'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'inhibitor_first'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'rift_herald_first'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'horde_first'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'game_first'),
    ])
    enrichTeamObjectiveAggFromHistogram(aggWin, aggLoss, 'baron', distBaron)
    enrichTeamObjectiveAggFromHistogram(aggWin, aggLoss, 'dragon', distDragon)
    enrichTeamObjectiveAggFromHistogram(aggWin, aggLoss, 'tower', distTower)
    enrichTeamObjectiveAggFromHistogram(aggWin, aggLoss, 'inhibitor', distInhibitor)
    enrichTeamObjectiveAggFromHistogram(aggWin, aggLoss, 'riftHerald', distRiftHerald)
    enrichTeamObjectiveAggFromHistogram(aggWin, aggLoss, 'horde', distHorde)
    enrichTeamObjectiveAggFromHistogram(aggWin, aggLoss, 'elder', distElder)
    enrichTeamObjectiveFirstFromHistogram(aggWin, aggLoss, 'firstBlood', distFirstBlood)
    enrichTeamObjectiveFirstFromHistogram(aggWin, aggLoss, 'baron', distBaronFirst)
    enrichTeamObjectiveFirstFromHistogram(aggWin, aggLoss, 'dragon', distDragonFirst)
    enrichTeamObjectiveFirstFromHistogram(aggWin, aggLoss, 'tower', distTowerFirst)
    enrichTeamObjectiveFirstFromHistogram(aggWin, aggLoss, 'inhibitor', distInhibitorFirst)
    enrichTeamObjectiveFirstFromHistogram(aggWin, aggLoss, 'riftHerald', distRiftHeraldFirst)
    enrichTeamObjectiveFirstFromHistogram(aggWin, aggLoss, 'horde', distHordeFirst)
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

    const objectiveFirstWinrateGames: ObjectiveFirstWinrateGames = {
      firstBlood:
        firstGamesFromOutcome(distFirstBlood.win) + firstGamesFromOutcome(distFirstBlood.loss),
      baron:
        firstGamesFromOutcome(distBaronFirst.win) + firstGamesFromOutcome(distBaronFirst.loss),
      dragon:
        firstGamesFromOutcome(distDragonFirst.win) +
        firstGamesFromOutcome(distDragonFirst.loss),
      tower:
        firstGamesFromOutcome(distTowerFirst.win) + firstGamesFromOutcome(distTowerFirst.loss),
      inhibitor:
        firstGamesFromOutcome(distInhibitorFirst.win) +
        firstGamesFromOutcome(distInhibitorFirst.loss),
      riftHerald:
        firstGamesFromOutcome(distRiftHeraldFirst.win) +
        firstGamesFromOutcome(distRiftHeraldFirst.loss),
      horde:
        firstGamesFromOutcome(distHordeFirst.win) + firstGamesFromOutcome(distHordeFirst.loss),
    }

    const result: OverviewTeamsStats = {
      matchCount,
      objectiveFirstWinrateGlobal: {
        firstBlood: firstBucketWinrateFromOutcome(distFirstBlood),
        baron: firstBucketWinrateFromOutcome(distBaronFirst),
        dragon: firstBucketWinrateFromOutcome(distDragonFirst),
        tower: firstBucketWinrateFromOutcome(distTowerFirst),
        inhibitor: firstBucketWinrateFromOutcome(distInhibitorFirst),
        riftHerald: firstBucketWinrateFromOutcome(distRiftHeraldFirst),
        horde: firstBucketWinrateFromOutcome(distHordeFirst),
      },
      objectiveFirstWinrateGames,
      gameFirstObjective: {
        distributionByWin: distGameFirst.win,
        distributionByLoss: distGameFirst.loss,
      },
      bans: {
        byWin,
        byLoss,
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
            byWin: securedGamesFromOutcome(distElder.win),
            byLoss: securedGamesFromOutcome(distElder.loss),
            securedWinrateGlobal: securedWinrateFromOutcome(distElder),
            distributionByWin: distElder.win,
            distributionByLoss: distElder.loss,
          },
          earth: {
            byWin: securedGamesFromOutcome(distEarthDrake.win),
            byLoss: securedGamesFromOutcome(distEarthDrake.loss),
            securedWinrateGlobal: securedWinrateFromOutcome(distEarthDrake),
            distributionByWin: distEarthDrake.win,
            distributionByLoss: distEarthDrake.loss,
          },
          water: {
            byWin: securedGamesFromOutcome(distWaterDrake.win),
            byLoss: securedGamesFromOutcome(distWaterDrake.loss),
            securedWinrateGlobal: securedWinrateFromOutcome(distWaterDrake),
            distributionByWin: distWaterDrake.win,
            distributionByLoss: distWaterDrake.loss,
          },
          wind: {
            byWin: securedGamesFromOutcome(distWindDrake.win),
            byLoss: securedGamesFromOutcome(distWindDrake.loss),
            securedWinrateGlobal: securedWinrateFromOutcome(distWindDrake),
            distributionByWin: distWindDrake.win,
            distributionByLoss: distWindDrake.loss,
          },
          fire: {
            byWin: securedGamesFromOutcome(distFireDrake.win),
            byLoss: securedGamesFromOutcome(distFireDrake.loss),
            securedWinrateGlobal: securedWinrateFromOutcome(distFireDrake),
            distributionByWin: distFireDrake.win,
            distributionByLoss: distFireDrake.loss,
          },
          hextec: {
            byWin: securedGamesFromOutcome(distHextecDrake.win),
            byLoss: securedGamesFromOutcome(distHextecDrake.loss),
            securedWinrateGlobal: securedWinrateFromOutcome(distHextecDrake),
            distributionByWin: distHextecDrake.win,
            distributionByLoss: distHextecDrake.loss,
          },
          chem: {
            byWin: securedGamesFromOutcome(distChemDrake.win),
            byLoss: securedGamesFromOutcome(distChemDrake.loss),
            securedWinrateGlobal: securedWinrateFromOutcome(distChemDrake),
            distributionByWin: distChemDrake.win,
            distributionByLoss: distChemDrake.loss,
          },
        },
        souls: {
          earth: {
            byWin: firstGamesFromOutcome(distEarthSoul.win),
            byLoss: firstGamesFromOutcome(distEarthSoul.loss),
          },
          water: {
            byWin: firstGamesFromOutcome(distWaterSoul.win),
            byLoss: firstGamesFromOutcome(distWaterSoul.loss),
          },
          wind: {
            byWin: firstGamesFromOutcome(distWindSoul.win),
            byLoss: firstGamesFromOutcome(distWindSoul.loss),
          },
          fire: {
            byWin: firstGamesFromOutcome(distFireSoul.win),
            byLoss: firstGamesFromOutcome(distFireSoul.loss),
          },
          hextec: {
            byWin: firstGamesFromOutcome(distHextecSoul.win),
            byLoss: firstGamesFromOutcome(distHextecSoul.loss),
          },
          chem: {
            byWin: firstGamesFromOutcome(distChemSoul.win),
            byLoss: firstGamesFromOutcome(distChemSoul.loss),
          },
        },
      },
    }
    const csObjectives = await loadChampionStatsTeamObjectives(
      pVersion,
      rankTier,
      roleFilters.champion
    )
    if (csObjectives) {
      applyChampionStatsObtentionToOverviewTeams(result, csObjectives)
      applyChampionStatsWinratesToOverviewTeams(result, csObjectives)
    }
    capOverviewTeamsObtentionCounts(result)
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
  const roleFilters = resolveOverviewRoleFilters(role)
  const pRankKey = rankTierCacheKey(rankTier)
  const now = Date.now()
  const cacheKey = `${overviewCacheKey(pVersion, pRankKey)}|${roleFilters.cacheKey}`
  const cached = overviewDurationWinrateCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.data

  try {
    const roleSql = roleFilters.champion
      ? ` AND cb.role = '${statsRoleSqlLiteral(roleFilters.champion)}'`
      : ''
    const cbFromDur = await matchVersionedAggFrom('agg_champion_bucket', pVersion, 'cb')
    const bucketRows = await queryRawUnsafe<
      Array<{ duration_bucket: number; count_win: bigint; count_game: bigint }>
    >(`
      SELECT
        cb.duration_bucket,
        SUM(cb.count_win)::bigint AS count_win,
        SUM(cb.count_game)::bigint AS count_game
      FROM ${cbFromDur}
      WHERE ${buildRawMatchCond(pVersion, rankTier).replace(/\bm\./g, 'cb.')}
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
    const cbFromCh = await matchVersionedAggFrom('agg_champion_bucket', version ?? null, 'cb')
    const bucketRows = await queryRawUnsafe<
      Array<{ duration_bucket: number; count_win: bigint; count_game: bigint }>
    >(`
      SELECT
        cb.duration_bucket,
        SUM(cb.count_win)::bigint AS count_win,
        SUM(cb.count_game)::bigint AS count_game
      FROM ${cbFromCh}
      WHERE cb.champion_id = ${championId}
        AND ${buildRawMatchCond(version ?? null, rankTier).replace(/\bm\./g, 'cb.')}
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
    const roleNorm = normalizeStatsRoleForChampion(role)
    const roleSql = roleNorm ? ` AND cb.role = '${statsRoleSqlLiteral(roleNorm)}'` : ''

    const cbFromTier = await matchVersionedAggFrom('agg_champion_bucket', version ?? null, 'cb')
    const rows = await queryRawUnsafe<
      Array<{ rank_tier: string; duration_bucket: number; count_win: bigint; count_game: bigint }>
    >(`
      SELECT
        cb.rank_tier,
        cb.duration_bucket,
        SUM(cb.count_win)::bigint AS count_win,
        SUM(cb.count_game)::bigint AS count_game
      FROM ${cbFromTier}
      WHERE cb.champion_id = ${championId}
        AND ${buildRawMatchCond(version ?? null, rankTier).replace(/\bm\./g, 'cb.')}
        ${roleSql}
      GROUP BY cb.rank_tier, cb.duration_bucket
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
  role?: string | null,
  sinceVersionPrefix?: string | null | undefined
): Promise<OverviewProgressionStats | null> {
  if (!isDatabaseConfigured()) return null
  if (!versionOldest || versionOldest === '') {
    return { oldestVersion: null, gainers: [], losers: [] }
  }
  const roleFilters = resolveOverviewRoleFilters(role)
  const pRankKey = rankTierCacheKey(rankTier)
  const voRaw = String(versionOldest).trim()
  const sinceCap = progressionSinceCap(sinceVersionPrefix)
  const now = Date.now()
  const cacheKey = `progwr4|${voRaw}|${pRankKey ?? ''}|${roleFilters.cacheKey}|${sinceCap ?? 'open'}`
  const cached = overviewProgressionCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.data

  try {
    const availablePatches = await listDistinctPatchVersions()
    if (!progressionHasComparableSinceRange(voRaw, sinceCap, availablePatches)) {
      return { oldestVersion: versionOldest, gainers: [], losers: [] }
    }
    const roleFilterSql = roleFilters.champion
      ? ` AND ac.role = '${statsRoleSqlLiteral(roleFilters.champion)}'`
      : ''
    const rawCond = buildRawMatchCond(undefined, rankTier).replace(/\bm\./g, 'ac.')
    const oldestClause = buildProgressionOldestOnlySql('ac', voRaw)
    const sinceClause = buildProgressionSinceSql('ac', voRaw, sinceCap, availablePatches)

    const oldestFrom = await matchVersionedAggFrom('agg_champion_core_stats', versionOldest, 'ac')
    const sinceFrom = await sqlAggUnionAllLiveAndArchives('agg_champion_core_stats', 'ac')

    const [oldestRows, sinceRows] = await Promise.all([
      queryRawUnsafe<Array<{ champion_id: number; count_win: bigint; count_game: bigint }>>(`
        SELECT ac.champion_id, ac.count_win, ac.count_game
        FROM ${oldestFrom}
        WHERE ${rawCond}
          AND ${oldestClause}
          ${roleFilterSql}
      `),
      queryRawUnsafe<Array<{ champion_id: number; count_win: bigint; count_game: bigint }>>(`
        SELECT ac.champion_id, ac.count_win, ac.count_game
        FROM ${sinceFrom}
        WHERE ${rawCond}
          AND ${sinceClause}
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
  role?: string | null,
  sinceVersionPrefix?: string | null | undefined
): Promise<OverviewProgressionFullStats | null> {
  if (!isDatabaseConfigured()) return null
  if (!versionOldest || versionOldest === '') {
    return { oldestVersion: null, champions: [] }
  }
  const roleFilters = resolveOverviewRoleFilters(role)
  const pRankKey = rankTierCacheKey(rankTier)
  const voRaw = String(versionOldest).trim()
  const sinceCap = progressionSinceCap(sinceVersionPrefix)
  const now = Date.now()
  const cacheKey = `progfull4|${voRaw}|${pRankKey ?? ''}|${roleFilters.cacheKey}|${sinceCap ?? 'open'}`
  const cached = overviewProgressionFullCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.data

  try {
    const availablePatches = await listDistinctPatchVersions()
    if (!progressionHasComparableSinceRange(voRaw, sinceCap, availablePatches)) {
      return { oldestVersion: versionOldest, champions: [] }
    }
    const roleFilterSql = roleFilters.champion
      ? ` AND ac.role = '${statsRoleSqlLiteral(roleFilters.champion)}'`
      : ''
    const roleFilterBannerSql = roleFilters.banner
      ? ` AND mv.banner_role_norm = '${statsRoleSqlLiteral(roleFilters.banner)}'`
      : ''
    const rawCond = buildRawMatchCond(undefined, rankTier).replace(/\bm\./g, 'ac.')
    const rawCondMv = buildRawMatchCond(undefined, rankTier).replace(/\bm\./g, 'mv.')
    const rawCondMo = buildRawMatchCond(undefined, rankTier).replace(/\bm\./g, 'mo.')
    const oldestClauseAc = buildProgressionOldestOnlySql('ac', voRaw)
    const sinceClauseAc = buildProgressionSinceSql('ac', voRaw, sinceCap, availablePatches)
    const oldestClauseMv = buildProgressionOldestOnlySql('mv', voRaw)
    const sinceClauseMv = buildProgressionSinceSql('mv', voRaw, sinceCap, availablePatches)
    const oldestClauseMo = buildProgressionOldestOnlySql('mo', voRaw)
    const sinceClauseMo = buildProgressionSinceSql('mo', voRaw, sinceCap, availablePatches)

    const oldestFromFull = await matchVersionedAggFrom('agg_champion_core_stats', versionOldest, 'ac')
    const sinceFromFull = await sqlAggUnionAllLiveAndArchives('agg_champion_core_stats', 'ac')
    const oldestBanFrom = await matchVersionedAggFrom('agg_champion_bans_by_banner', versionOldest, 'mv')
    const sinceBanFrom = await sqlAggUnionAllLiveAndArchives('agg_champion_bans_by_banner', 'mv')
    const oldestMoFrom = await matchVersionedAggFrom('agg_match_outcome_stats', versionOldest, 'mo')
    const sinceMoFrom = await sqlAggUnionAllLiveAndArchives('agg_match_outcome_stats', 'mo')

    const [oldestRows, sinceRows, oldestBanRows, sinceBanRows, oldestMatchRows, sinceMatchRows] = await Promise.all([
      queryRawUnsafe<
        Array<{ champion_id: number; count_win: bigint; count_game: bigint; count_ban: bigint }>
      >(`
        SELECT ac.champion_id, ac.count_win, ac.count_game, ac.count_ban
        FROM ${oldestFromFull}
        WHERE ${rawCond}
          AND ${oldestClauseAc}
          ${roleFilterSql}
      `),
      queryRawUnsafe<
        Array<{ champion_id: number; count_win: bigint; count_game: bigint; count_ban: bigint }>
      >(`
        SELECT ac.champion_id, ac.count_win, ac.count_game, ac.count_ban
        FROM ${sinceFromFull}
        WHERE ${rawCond}
          AND ${sinceClauseAc}
          ${roleFilterSql}
      `),
      queryRawUnsafe<Array<{ champion_id: number; bans: bigint }>>(`
        SELECT mv.banned_champion_id AS champion_id, COALESCE(SUM(mv.ban_count), 0)::bigint AS bans
        FROM ${oldestBanFrom}
        WHERE ${rawCondMv}
          AND ${oldestClauseMv}
          ${roleFilterBannerSql}
        GROUP BY mv.banned_champion_id
      `),
      queryRawUnsafe<Array<{ champion_id: number; bans: bigint }>>(`
        SELECT mv.banned_champion_id AS champion_id, COALESCE(SUM(mv.ban_count), 0)::bigint AS bans
        FROM ${sinceBanFrom}
        WHERE ${rawCondMv}
          AND ${sinceClauseMv}
          ${roleFilterBannerSql}
        GROUP BY mv.banned_champion_id
      `),
      queryRawUnsafe<Array<{ cnt: bigint }>>(`
        SELECT COALESCE(SUM(mo.count_match), 0)::bigint AS cnt
        FROM ${oldestMoFrom}
        WHERE ${rawCondMo}
          AND ${oldestClauseMo}
      `),
      queryRawUnsafe<Array<{ cnt: bigint }>>(`
        SELECT COALESCE(SUM(mo.count_match), 0)::bigint AS cnt
        FROM ${sinceMoFrom}
        WHERE ${rawCondMo}
          AND ${sinceClauseMo}
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
    const rows = await queryRawUnsafe<Array<{ players: bigint }>>(`
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
  /** DISTINCT player_id dans match_players pour les matchs du filtre patch / ligue / rôle (aligné overview). */
  playersWithIngestMatches: number
}

/**
 * WHERE pour `matchs im` + `match_players imp` (mêmes règles que buildRawMatchCond sur match).
 */
function buildIngestMatchPlayerWhereSql(
  version?: string | string[] | null,
  rankTier?: string | string[] | null,
  role?: string | null
): string {
  const parts: string[] = []
  const versions = toQueryStringArrayParam(version)
  if (versions.length === 1) {
    parts.push(
      `im.game_version LIKE '${normalizePatchMajorMinor(versions[0]!).replace(/'/g, "''")}%'`
    )
  } else if (versions.length > 1) {
    parts.push(
      `im.game_version IN (${versions.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(',')})`
    )
  }
  parts.push(...buildRankTierSqlConditions('im', rankTier))
  const roleNorm = role != null && role !== '' ? String(role).trim().toUpperCase() : null
  if (roleNorm) parts.push(`imp.role = '${roleNorm.replace(/'/g, "''")}'`)
  return parts.join(' AND ')
}

async function ingestMatchLeanTablesExist(): Promise<boolean> {
  return false
}

/** Raw-only / post-decommission: distinct puuids from `match_ingest_raw` + `players.rank_tier` (snapshot). */
function buildRawMirPlayerWhereSql(
  version?: string | string[] | null,
  rankTier?: string | string[] | null,
  role?: string | null
): string {
  const parts: string[] = []
  const versions = toQueryStringArrayParam(version)
  const ranks = normalizedRankTiers(rankTier)
  if (versions.length === 1) {
    parts.push(
      `(mir.payload_json->'info'->>'gameVersion') LIKE '${normalizePatchMajorMinor(versions[0]!).replace(/'/g, "''")}%'`
    )
  } else if (versions.length > 1) {
    parts.push(
      `(mir.payload_json->'info'->>'gameVersion') IN (${versions.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(',')})`
    )
  }
  if (ranks.length === 1) {
    parts.push(`UPPER(COALESCE(pl.rank_tier,'')) = '${ranks[0]!.replace(/'/g, "''")}'`)
  } else if (ranks.length > 1) {
    parts.push(
      `UPPER(COALESCE(pl.rank_tier,'')) IN (${ranks.map((r) => `'${r.replace(/'/g, "''")}'`).join(',')})`
    )
  }
  const roleNorm = role != null && role !== '' ? String(role).trim().toUpperCase() : null
  if (roleNorm) {
    parts.push(
      `UPPER(TRIM(COALESCE(NULLIF(participant->>'teamPosition',''), NULLIF(participant->>'individualPosition','')))) = '${roleNorm.replace(/'/g, "''")}'`
    )
  }
  return parts.join(' AND ')
}

async function countDistinctPlayersInMatchesFromRaw(
  version?: string | string[] | null,
  rankTier?: string | string[] | null,
  role?: string | null
): Promise<number> {
  const whereSql = buildRawMirPlayerWhereSql(version, rankTier, role)
  const rows = await queryRawUnsafe<Array<{ c: bigint }>>(`
    SELECT COUNT(DISTINCT (participant->>'puuid'))::bigint AS c
    FROM match_ingest_raw mir
    CROSS JOIN LATERAL jsonb_array_elements(
      COALESCE(mir.payload_json->'info'->'participants', '[]'::jsonb)
    ) AS x(participant)
    INNER JOIN players pl ON pl.puuid = (participant->>'puuid')
    WHERE (participant->>'puuid') IS NOT NULL
      AND length(trim(participant->>'puuid')) > 0
      AND ${whereSql}
  `)
  return Number(rows[0]?.c ?? 0)
}

async function countDistinctPlayersInMatches(
  version?: string | string[] | null,
  rankTier?: string | string[] | null,
  role?: string | null
): Promise<number> {
  const whereSql = buildIngestMatchPlayerWhereSql(version, rankTier, role)
  const rows = await queryRawUnsafe<Array<{ c: bigint }>>(`
    SELECT COUNT(DISTINCT imp.player_id)::bigint AS c
    FROM ingest_match_players imp
    INNER JOIN ingest_matchs im ON im.id = imp.match_id
    WHERE ${whereSql}
  `)
  return Number(rows[0]?.c ?? 0)
}

function isMissingRelationIngestError(err: unknown): boolean {
  const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : ''
  const metaCode =
    err && typeof err === 'object' && 'meta' in err
      ? String((err as { meta?: { code?: string } }).meta?.code ?? '')
      : ''
  if (code === 'P2010' && metaCode === '42P01') return true
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes('42P01') && msg.includes('ingest_match')
}

async function countDistinctPlayersInMatchesAdaptive(
  version?: string | string[] | null,
  rankTier?: string | string[] | null,
  role?: string | null
): Promise<number> {
  if (await ingestMatchLeanTablesExist()) {
    try {
      return await countDistinctPlayersInMatches(version, rankTier, role)
    } catch (err) {
      if (isMissingRelationIngestError(err)) {
        return countDistinctPlayersInMatchesFromRaw(version, rankTier, role)
      }
      throw err
    }
  }
  return countDistinctPlayersInMatchesFromRaw(version, rankTier, role)
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timeout after ${timeoutMs}ms`))
    }, Math.max(1, timeoutMs))
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

/**
 * Compteurs Infos :
 * - total matches / total players : globaux (tous patches)
 * - playersWithIngestMatches : joueurs distincts sur le filtre patch / ligue / rôle (ingest_match_players si présent, sinon match_ingest_raw + players.rank_tier)
 */
export async function getInfosMetaCounts(
  version?: string | string[] | null,
  rankTier?: string | string[] | null,
  role?: string | null
): Promise<InfosMetaCounts | null> {
  if (!isDatabaseConfigured()) return null
  try {
    const moUnion = await sqlAggUnionAllLiveAndArchives('agg_match_outcome_stats', 'mo')
    const [matchRows, totalPlayers] = await Promise.all([
      queryRawUnsafe<Array<{ c: bigint }>>(
        `SELECT COALESCE(SUM(mo.count_match), 0)::bigint AS c FROM ${moUnion}`
      ),
      sql<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM players`.then((r) => r[0]?.count ?? 0),
    ])
    const totalMatches = Number(matchRows[0]?.c ?? 0)
    let playersWithIngestMatches = totalPlayers
    const ingestLeanExists = await ingestMatchLeanTablesExist().catch(() => false)
    if (ingestLeanExists) {
      try {
        playersWithIngestMatches = await withTimeout(
          countDistinctPlayersInMatchesAdaptive(version, rankTier, role),
          1500,
          'countDistinctPlayersInMatchesAdaptive'
        )
      } catch (err) {
        console.warn(
          '[getInfosMetaCounts] slow playersWithIngestMatches fallback',
          err instanceof Error ? err.message : err
        )
      }
    }
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
    const raw = await queryRawUnsafe<RawRow[]>(`
      SELECT
        mo.game_version::text AS version,
        mo.rank_tier::text AS rank_tier,
        COALESCE(SUM(mo.count_match), 0)::bigint AS match_count
      FROM ${moUnionPatch}
      GROUP BY mo.game_version, mo.rank_tier
    `)
    const divisionSet = new Set<string>()
    const byVersion = new Map<string, { all: number; byDivision: Record<string, number> }>()
    for (const r of raw) {
      const rawVersion = String(r.version ?? '').trim()
      const version =
        normalizeGameVersionToMajorMinor(rawVersion).trim() || rawVersion
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

function escapeSqlLikePrefix(v: string): string {
  return v.replace(/'/g, "''")
}

function progressionSinceCap(
  sinceVersionPrefix: string | null | undefined,
): string | null {
  const raw =
    sinceVersionPrefix != null && String(sinceVersionPrefix).trim() !== ''
      ? String(sinceVersionPrefix).trim()
      : ''
  return raw !== '' ? normalizePatchMajorMinor(raw) : null
}

const CHAMPION_STATS_FIRST_BLOOD =
  '(cs.count_first_blood_kill_true + cs.count_first_blood_assist_true)'
const CHAMPION_STATS_FIRST_TOWER =
  '(cs.count_first_tower_kill_true + cs.count_first_tower_assist_true)'
const CHAMPION_STATS_ELDER_DRAKE = '(cs.count_elder_kill + cs.count_elder_assist)'

const CHAMPION_STATS_DRAKE_METRICS: Record<
  string,
  { killAssist: string; soul?: string }
> = {
  earth: {
    killAssist: '(cs.count_earth_drake_kill + cs.count_earth_drake_assist)',
    soul: 'cs.count_earth_soul',
  },
  water: {
    killAssist: '(cs.count_water_drake_kill + cs.count_water_drake_assist)',
    soul: 'cs.count_water_soul',
  },
  wind: {
    killAssist: '(cs.count_wind_drake_kill + cs.count_wind_drake_assist)',
    soul: 'cs.count_wind_soul',
  },
  fire: {
    killAssist: '(cs.count_fire_drake_kill + cs.count_fire_drake_assist)',
    soul: 'cs.count_fire_soul',
  },
  hextec: {
    killAssist: '(cs.count_hextec_drake_kill + cs.count_hextec_drake_assist)',
    soul: 'cs.count_hextec_soul',
  },
  chem: {
    killAssist: '(cs.count_chem_drake_kill + cs.count_chem_drake_assist)',
    soul: 'cs.count_chem_soul',
  },
}

type ChampionStatsTeamObjectiveRow = {
  team_num: number
  first_blood_total: bigint
  first_blood_by_win: bigint
  first_blood_by_loss: bigint
  first_blood_involved_wins: bigint
  first_blood_involved_games: bigint
  elder_total: bigint
  elder_by_win: bigint
  elder_by_loss: bigint
  elder_involved_wins: bigint
  elder_involved_games: bigint
} & Record<string, bigint>

type ChampionStatsTeamObjectives = {
  totals: {
    firstByWin: number
    firstByLoss: number
    firstBloodWrGlobal: number | null
    towerFirstByWin: number
    towerFirstByLoss: number
    elderByWin: number
    elderByLoss: number
    drakeTypes: Record<string, { byWin: number; byLoss: number }>
    souls: Record<string, { byWin: number; byLoss: number }>
  }
  byTeam: Map<
    number,
    {
      firstBlood: number
      firstBloodWr: number | null
      elderTotal: number
      elderWr: number | null
      drakeTypes: Record<string, number>
      souls: Record<string, number>
      drakeSecured: Record<string, { byWin: number; byLoss: number }>
      soulSecured: Record<string, { byWin: number; byLoss: number }>
      elderSecured: { byWin: number; byLoss: number }
      drakeWinrate: Record<string, number | null>
      soulWinrate: Record<string, number | null>
    }
  >
}

function winrateFromInvolved(wins: number, games: number): number | null {
  if (games <= 0) return null
  const wr = (Math.min(wins, games) / games) * 100
  return Math.min(100, Math.max(0, wr))
}

function capCountToMatchCount(count: number, matchCount: number): number {
  const n = Number(count) || 0
  const mc = Number(matchCount) || 0
  if (mc <= 0 || n <= 0) return 0
  return Math.min(n, mc)
}

/** Borne les comptages « first » d'obtention (agrégats parfois > nombre de matchs). */
function capOverviewTeamsObtentionCounts(result: OverviewTeamsStats): void {
  const mc = result.matchCount
  if (mc <= 0) return
  for (const key of Object.keys(result.objectives) as Array<keyof typeof result.objectives>) {
    const o = result.objectives[key]
    if (!o || typeof o !== 'object') continue
    if ('firstByWin' in o && 'firstByLoss' in o) {
      o.firstByWin = capCountToMatchCount(o.firstByWin, mc)
      o.firstByLoss = capCountToMatchCount(o.firstByLoss, mc)
    }
  }
  for (const key of Object.keys(result.drakes.souls) as Array<keyof typeof result.drakes.souls>) {
    const s = result.drakes.souls[key]
    if (!s) continue
    s.byWin = capCountToMatchCount(s.byWin, mc)
    s.byLoss = capCountToMatchCount(s.byLoss, mc)
  }
  for (const key of Object.keys(result.drakes.types) as Array<keyof typeof result.drakes.types>) {
    const t = result.drakes.types[key]
    if (!t) continue
    t.byWin = capCountToMatchCount(t.byWin, mc)
    t.byLoss = capCountToMatchCount(t.byLoss, mc)
  }
}

function capOverviewSidesObtentionCounts(result: OverviewSidesApiStats): void {
  const mc = result.matchCount
  if (mc <= 0 || !result.objectivesBySideTable) return
  for (const row of Object.values(result.objectivesBySideTable)) {
    if (!row) continue
    row.firstByBlue = capCountToMatchCount(row.firstByBlue ?? 0, mc)
    row.firstByRed = capCountToMatchCount(row.firstByRed ?? 0, mc)
  }
  if (result.drakesBySide?.types) {
    for (const row of Object.values(result.drakesBySide.types)) {
      if (!row) continue
      row.byBlue = capCountToMatchCount(row.byBlue, mc)
      row.byRed = capCountToMatchCount(row.byRed, mc)
    }
  }
  if (result.drakesBySide?.souls) {
    for (const row of Object.values(result.drakesBySide.souls)) {
      if (!row) continue
      row.byBlue = capCountToMatchCount(row.byBlue, mc)
      row.byRed = capCountToMatchCount(row.byRed, mc)
    }
  }
}

async function loadChampionStatsTeamObjectives(
  pVersion: string | null,
  rankTier: string | string[] | null | undefined,
  championRole: string | null
): Promise<ChampionStatsTeamObjectives | null> {
  try {
    const csFrom = await matchVersionedAggFrom('agg_champion_team_objective_stats', pVersion, 'cs')
    const cond = buildRawMatchCond(pVersion, rankTier).replace(/\bm\./g, 'cs.')
    const roleSql = championRole ? ` AND cs.role = '${statsRoleSqlLiteral(championRole)}'` : ''
    const drakeSelects: string[] = []
    for (const [key, metric] of Object.entries(CHAMPION_STATS_DRAKE_METRICS)) {
      const involved = `(${metric.killAssist}) > 0`
      drakeSelects.push(
        `COALESCE(SUM(${metric.killAssist}), 0)::bigint AS ${key}_total`,
        `COALESCE(MAX(CASE WHEN ${involved} AND cs.count_win > 0 THEN cs.count_game ELSE 0 END), 0)::bigint AS ${key}_secured_win_games`,
        `COALESCE(MAX(CASE WHEN ${involved} AND cs.count_win = 0 THEN cs.count_game ELSE 0 END), 0)::bigint AS ${key}_secured_loss_games`,
        `COALESCE(SUM(CASE WHEN ${involved} THEN cs.count_win ELSE 0 END), 0)::bigint AS ${key}_involved_wins`,
        `COALESCE(SUM(CASE WHEN ${involved} THEN cs.count_game ELSE 0 END), 0)::bigint AS ${key}_involved_games`
      )
      if (metric.soul) {
        const soulInvolved = `(${metric.soul}) > 0`
        drakeSelects.push(
          `COALESCE(SUM(${metric.soul}), 0)::bigint AS ${key}_soul_total`,
          `COALESCE(MAX(CASE WHEN ${soulInvolved} AND cs.count_win > 0 THEN cs.count_game ELSE 0 END), 0)::bigint AS ${key}_soul_secured_win_games`,
          `COALESCE(MAX(CASE WHEN ${soulInvolved} AND cs.count_win = 0 THEN cs.count_game ELSE 0 END), 0)::bigint AS ${key}_soul_secured_loss_games`,
          `COALESCE(SUM(CASE WHEN ${soulInvolved} THEN cs.count_win ELSE 0 END), 0)::bigint AS ${key}_soul_involved_wins`,
          `COALESCE(SUM(CASE WHEN ${soulInvolved} THEN cs.count_game ELSE 0 END), 0)::bigint AS ${key}_soul_involved_games`
        )
      }
    }
    const rows = await queryRawUnsafe<ChampionStatsTeamObjectiveRow[]>(`
      SELECT
        cs.team AS team_num,
        COALESCE(SUM(${CHAMPION_STATS_FIRST_BLOOD}), 0)::bigint AS first_blood_total,
        COALESCE(MAX(CASE WHEN ${CHAMPION_STATS_FIRST_BLOOD} > 0 AND cs.count_win > 0 THEN cs.count_game ELSE 0 END), 0)::bigint AS first_blood_secured_win_games,
        COALESCE(MAX(CASE WHEN ${CHAMPION_STATS_FIRST_BLOOD} > 0 AND cs.count_win = 0 THEN cs.count_game ELSE 0 END), 0)::bigint AS first_blood_secured_loss_games,
        COALESCE(SUM(CASE WHEN ${CHAMPION_STATS_FIRST_BLOOD} > 0 THEN cs.count_win ELSE 0 END), 0)::bigint AS first_blood_involved_wins,
        COALESCE(SUM(CASE WHEN ${CHAMPION_STATS_FIRST_BLOOD} > 0 THEN cs.count_game ELSE 0 END), 0)::bigint AS first_blood_involved_games,
        COALESCE(MAX(CASE WHEN ${CHAMPION_STATS_FIRST_TOWER} > 0 AND cs.count_win > 0 THEN cs.count_game ELSE 0 END), 0)::bigint AS first_tower_secured_win_games,
        COALESCE(MAX(CASE WHEN ${CHAMPION_STATS_FIRST_TOWER} > 0 AND cs.count_win = 0 THEN cs.count_game ELSE 0 END), 0)::bigint AS first_tower_secured_loss_games,
        COALESCE(SUM(${CHAMPION_STATS_ELDER_DRAKE}), 0)::bigint AS elder_total,
        COALESCE(MAX(CASE WHEN (${CHAMPION_STATS_ELDER_DRAKE}) > 0 AND cs.count_win > 0 THEN cs.count_game ELSE 0 END), 0)::bigint AS elder_secured_win_games,
        COALESCE(MAX(CASE WHEN (${CHAMPION_STATS_ELDER_DRAKE}) > 0 AND cs.count_win = 0 THEN cs.count_game ELSE 0 END), 0)::bigint AS elder_secured_loss_games,
        COALESCE(SUM(CASE WHEN (${CHAMPION_STATS_ELDER_DRAKE}) > 0 THEN cs.count_win ELSE 0 END), 0)::bigint AS elder_involved_wins,
        COALESCE(SUM(CASE WHEN (${CHAMPION_STATS_ELDER_DRAKE}) > 0 THEN cs.count_game ELSE 0 END), 0)::bigint AS elder_involved_games,
        ${drakeSelects.join(',\n        ')}
      FROM ${csFrom}
      WHERE ${cond}${roleSql}
      GROUP BY cs.team
    `)
    if (!rows.length) return null

    const byTeam = new Map<
      number,
      ChampionStatsTeamObjectives['byTeam'] extends Map<number, infer V> ? V : never
    >()
    const totals = {
      firstByWin: 0,
      firstByLoss: 0,
      firstBloodWrGlobal: null as number | null,
      towerFirstByWin: 0,
      towerFirstByLoss: 0,
      elderByWin: 0,
      elderByLoss: 0,
      drakeTypes: {} as Record<string, { byWin: number; byLoss: number }>,
      souls: {} as Record<string, { byWin: number; byLoss: number }>,
    }
    let fbInvolvedWins = 0
    let fbInvolvedGames = 0

    for (const key of Object.keys(CHAMPION_STATS_DRAKE_METRICS)) {
      totals.drakeTypes[key] = { byWin: 0, byLoss: 0 }
      totals.souls[key] = { byWin: 0, byLoss: 0 }
    }

    for (const row of rows) {
      const team = Number(row.team_num)
      const drakeTypes: Record<string, number> = {}
      const souls: Record<string, number> = {}
      const drakeSecured: Record<string, { byWin: number; byLoss: number }> = {}
      const soulSecured: Record<string, { byWin: number; byLoss: number }> = {}
      const drakeWinrate: Record<string, number | null> = {}
      const soulWinrate: Record<string, number | null> = {}

      for (const key of Object.keys(CHAMPION_STATS_DRAKE_METRICS)) {
        drakeTypes[key] = Number(row[`${key}_total`] ?? 0)
        souls[key] = Number(row[`${key}_soul_total`] ?? 0)
        drakeSecured[key] = {
          byWin: Number(row[`${key}_secured_win_games`] ?? 0),
          byLoss: Number(row[`${key}_secured_loss_games`] ?? 0),
        }
        soulSecured[key] = {
          byWin: Number(row[`${key}_soul_secured_win_games`] ?? 0),
          byLoss: Number(row[`${key}_soul_secured_loss_games`] ?? 0),
        }
        drakeWinrate[key] = winrateFromInvolved(
          Number(row[`${key}_involved_wins`] ?? 0),
          Number(row[`${key}_involved_games`] ?? 0)
        )
        soulWinrate[key] = winrateFromInvolved(
          Number(row[`${key}_soul_involved_wins`] ?? 0),
          Number(row[`${key}_soul_involved_games`] ?? 0)
        )
        totals.drakeTypes[key]!.byWin += Number(row[`${key}_secured_win_games`] ?? 0)
        totals.drakeTypes[key]!.byLoss += Number(row[`${key}_secured_loss_games`] ?? 0)
        totals.souls[key]!.byWin += Number(row[`${key}_soul_secured_win_games`] ?? 0)
        totals.souls[key]!.byLoss += Number(row[`${key}_soul_secured_loss_games`] ?? 0)
      }

      totals.firstByWin += Number(row.first_blood_secured_win_games ?? 0)
      totals.firstByLoss += Number(row.first_blood_secured_loss_games ?? 0)
      totals.towerFirstByWin += Number(row.first_tower_secured_win_games ?? 0)
      totals.towerFirstByLoss += Number(row.first_tower_secured_loss_games ?? 0)
      totals.elderByWin += Number(row.elder_secured_win_games ?? 0)
      totals.elderByLoss += Number(row.elder_secured_loss_games ?? 0)
      fbInvolvedWins += Number(row.first_blood_involved_wins ?? 0)
      fbInvolvedGames += Number(row.first_blood_involved_games ?? 0)

      byTeam.set(team, {
        firstBlood: Number(row.first_blood_total ?? 0),
        firstBloodWr: winrateFromInvolved(
          Number(row.first_blood_involved_wins ?? 0),
          Number(row.first_blood_involved_games ?? 0)
        ),
        elderTotal: Number(row.elder_total ?? 0),
        elderWr: winrateFromInvolved(
          Number(row.elder_involved_wins ?? 0),
          Number(row.elder_involved_games ?? 0)
        ),
        drakeTypes,
        souls,
        drakeSecured,
        soulSecured,
        elderSecured: {
          byWin: Number(row.elder_secured_win_games ?? 0),
          byLoss: Number(row.elder_secured_loss_games ?? 0),
        },
        drakeWinrate,
        soulWinrate,
      })
    }

    totals.firstBloodWrGlobal = winrateFromInvolved(fbInvolvedWins, fbInvolvedGames)
    return { totals, byTeam }
  } catch (err) {
    console.error(
      '[loadChampionStatsTeamObjectives]',
      err instanceof Error ? err.message : err
    )
    return null
  }
}

function applyChampionStatsObtentionToOverviewTeams(
  result: OverviewTeamsStats,
  cs: ChampionStatsTeamObjectives
): void {
  const fb = result.objectives.firstBlood
  if ((fb.firstByWin ?? 0) + (fb.firstByLoss ?? 0) <= 0) {
    fb.firstByWin = cs.totals.firstByWin
    fb.firstByLoss = cs.totals.firstByLoss
    if (result.objectiveFirstWinrateGames) {
      result.objectiveFirstWinrateGames.firstBlood = cs.totals.firstByWin + cs.totals.firstByLoss
    }
  }
  const tower = result.objectives.tower
  if ((tower.firstByWin ?? 0) + (tower.firstByLoss ?? 0) <= 0) {
    tower.firstByWin = cs.totals.towerFirstByWin
    tower.firstByLoss = cs.totals.towerFirstByLoss
  }
  const elderRow = result.drakes.types.elder
  if ((elderRow.byWin ?? 0) + (elderRow.byLoss ?? 0) <= 0) {
    elderRow.byWin = cs.totals.elderByWin
    elderRow.byLoss = cs.totals.elderByLoss
  }
  for (const key of Object.keys(CHAMPION_STATS_DRAKE_METRICS)) {
    const typeRow = result.drakes.types[key as keyof typeof result.drakes.types]
    const csType = cs.totals.drakeTypes[key]
    if (typeRow && csType && (typeRow.byWin ?? 0) + (typeRow.byLoss ?? 0) <= 0) {
      typeRow.byWin = csType.byWin
      typeRow.byLoss = csType.byLoss
    }
    const soulRow = result.drakes.souls[key as keyof typeof result.drakes.souls]
    const csSoul = cs.totals.souls[key]
    if (!soulRow || !csSoul) continue
    if ((soulRow.byWin ?? 0) + (soulRow.byLoss ?? 0) <= 0) {
      soulRow.byWin = csSoul.byWin
      soulRow.byLoss = csSoul.byLoss
    }
  }
}

function applyChampionStatsObtentionToOverviewSides(
  result: OverviewSidesApiStats,
  cs: ChampionStatsTeamObjectives
): void {
  if (!result.drakesBySide) return
  const blue = cs.byTeam.get(100)
  const red = cs.byTeam.get(200)
  const elderRow = result.drakesBySide.types.elder
  if (elderRow && (elderRow.byBlue ?? 0) + (elderRow.byRed ?? 0) <= 0) {
    const bElder = blue?.elderSecured
    const rElder = red?.elderSecured
    elderRow.byBlue = (bElder?.byWin ?? 0) + (bElder?.byLoss ?? 0)
    elderRow.byRed = (rElder?.byWin ?? 0) + (rElder?.byLoss ?? 0)
  }
  for (const key of Object.keys(CHAMPION_STATS_DRAKE_METRICS)) {
    const typeRow = result.drakesBySide.types[key as keyof typeof result.drakesBySide.types]
    if (typeRow) {
      const blueDrake = blue?.drakeSecured[key]
      const redDrake = red?.drakeSecured[key]
      if ((typeRow.byBlue ?? 0) + (typeRow.byRed ?? 0) <= 0) {
        typeRow.byBlue = (blueDrake?.byWin ?? 0) + (blueDrake?.byLoss ?? 0)
        typeRow.byRed = (redDrake?.byWin ?? 0) + (redDrake?.byLoss ?? 0)
      }
    }
    const soulRow = result.drakesBySide.souls[key as keyof typeof result.drakesBySide.souls]
    if (!soulRow) continue
    const blueSec = blue?.soulSecured[key]
    const redSec = red?.soulSecured[key]
    if ((soulRow.byBlue ?? 0) + (soulRow.byRed ?? 0) <= 0) {
      soulRow.byBlue = (blueSec?.byWin ?? 0) + (blueSec?.byLoss ?? 0)
      soulRow.byRed = (redSec?.byWin ?? 0) + (redSec?.byLoss ?? 0)
    }
  }
}

/** Complète les winrates objectifs si l'histogramme est vide (données anciennes). */
function applyChampionStatsWinratesToOverviewTeams(
  result: OverviewTeamsStats,
  cs: ChampionStatsTeamObjectives
): void {
  if (result.objectiveFirstWinrateGlobal?.firstBlood == null && cs.totals.firstBloodWrGlobal != null) {
    result.objectiveFirstWinrateGlobal = result.objectiveFirstWinrateGlobal ?? {
      firstBlood: null,
      baron: null,
      dragon: null,
      tower: null,
      inhibitor: null,
      riftHerald: null,
      horde: null,
    }
    result.objectiveFirstWinrateGlobal.firstBlood = cs.totals.firstBloodWrGlobal
  }
  const elderType = result.drakes.types.elder
  if (elderType?.securedWinrateGlobal == null) {
    const w = elderType.byWin
    const l = elderType.byLoss
    elderType.securedWinrateGlobal = w + l > 0 ? (w / (w + l)) * 100 : null
  }
  for (const key of Object.keys(CHAMPION_STATS_DRAKE_METRICS)) {
    const typeRow = result.drakes.types[key as keyof typeof result.drakes.types]
    if (!typeRow) continue
    if (typeRow.securedWinrateGlobal == null) {
      const w = typeRow.byWin
      const l = typeRow.byLoss
      typeRow.securedWinrateGlobal = w + l > 0 ? (w / (w + l)) * 100 : null
    }
  }
}

function applyChampionStatsWinratesToOverviewSides(
  result: OverviewSidesApiStats,
  cs: ChampionStatsTeamObjectives
): void {
  const blue = cs.byTeam.get(100)
  const red = cs.byTeam.get(200)

  if (result.objectiveFirstWinrateBySide?.firstBlood?.blue == null) {
    result.objectiveFirstWinrateBySide = result.objectiveFirstWinrateBySide ?? {
      firstBlood: { blue: null, red: null },
      baron: { blue: null, red: null },
      dragon: { blue: null, red: null },
      tower: { blue: null, red: null },
      inhibitor: { blue: null, red: null },
      riftHerald: { blue: null, red: null },
      horde: { blue: null, red: null },
    }
    result.objectiveFirstWinrateBySide.firstBlood = {
      blue: blue?.firstBloodWr ?? null,
      red: red?.firstBloodWr ?? null,
    }
  }

  if (!result.drakesBySide) return

  const elder = result.drakesBySide.types.elder
  if (elder.winrateBlue == null) elder.winrateBlue = blue?.elderWr ?? null
  if (elder.winrateRed == null) elder.winrateRed = red?.elderWr ?? null

  for (const key of Object.keys(CHAMPION_STATS_DRAKE_METRICS)) {
    const typeRow = result.drakesBySide.types[key as keyof typeof result.drakesBySide.types]
    if (typeRow) {
      if (typeRow.winrateBlue == null) typeRow.winrateBlue = blue?.drakeWinrate[key] ?? null
      if (typeRow.winrateRed == null) typeRow.winrateRed = red?.drakeWinrate[key] ?? null
    }
    const soulRow = result.drakesBySide.souls[key as keyof typeof result.drakesBySide.souls]
    if (soulRow) {
      if (soulRow.winrateBlue == null) soulRow.winrateBlue = blue?.soulWinrate[key] ?? null
      if (soulRow.winrateRed == null) soulRow.winrateRed = red?.soulWinrate[key] ?? null
      if (soulRow.winrateBlue == null) {
        const b = blue?.soulSecured[key]
        const t = (b?.byWin ?? 0) + (b?.byLoss ?? 0)
        soulRow.winrateBlue = t > 0 ? ((b?.byWin ?? 0) / t) * 100 : null
      }
      if (soulRow.winrateRed == null) {
        const r = red?.soulSecured[key]
        const t = (r?.byWin ?? 0) + (r?.byLoss ?? 0)
        soulRow.winrateRed = t > 0 ? ((r?.byWin ?? 0) / t) * 100 : null
      }
    }
  }
}

/** Filtre histogramme : drakes élémentaires / souls / elder → objective_type = dragon + type_drake + is_soul. */
type ObjectiveHistogramFilter = {
  objectiveType: string
  typeDrake: string | null
  isSoul: boolean
}

const OBJECTIVE_KEY_TO_HISTOGRAM_FILTER: Record<string, ObjectiveHistogramFilter | null> = {
  baron: { objectiveType: 'baron', typeDrake: null, isSoul: false },
  dragon: { objectiveType: 'dragon', typeDrake: null, isSoul: false },
  tower: { objectiveType: 'tower', typeDrake: null, isSoul: false },
  inhibitor: { objectiveType: 'inhibitor', typeDrake: null, isSoul: false },
  riftHerald: { objectiveType: 'riftHerald', typeDrake: null, isSoul: false },
  horde: { objectiveType: 'horde', typeDrake: null, isSoul: false },
  elder: { objectiveType: 'dragon', typeDrake: 'elder', isSoul: false },
  earth_drake: { objectiveType: 'dragon', typeDrake: 'earth', isSoul: false },
  water_drake: { objectiveType: 'dragon', typeDrake: 'water', isSoul: false },
  wind_drake: { objectiveType: 'dragon', typeDrake: 'wind', isSoul: false },
  fire_drake: { objectiveType: 'dragon', typeDrake: 'fire', isSoul: false },
  hextec_drake: { objectiveType: 'dragon', typeDrake: 'hextec', isSoul: false },
  chem_drake: { objectiveType: 'dragon', typeDrake: 'chem', isSoul: false },
  earth_soul: { objectiveType: 'dragon', typeDrake: 'earth', isSoul: true },
  water_soul: { objectiveType: 'dragon', typeDrake: 'water', isSoul: true },
  wind_soul: { objectiveType: 'dragon', typeDrake: 'wind', isSoul: true },
  fire_soul: { objectiveType: 'dragon', typeDrake: 'fire', isSoul: true },
  hextec_soul: { objectiveType: 'dragon', typeDrake: 'hextec', isSoul: true },
  chem_soul: { objectiveType: 'dragon', typeDrake: 'chem', isSoul: true },
  first_blood: { objectiveType: 'firstBlood', typeDrake: null, isSoul: false },
  baron_first: { objectiveType: 'baronFirst', typeDrake: null, isSoul: false },
  dragon_first: { objectiveType: 'dragonFirst', typeDrake: null, isSoul: false },
  tower_first: { objectiveType: 'towerFirst', typeDrake: null, isSoul: false },
  inhibitor_first: { objectiveType: 'inhibitorFirst', typeDrake: null, isSoul: false },
  rift_herald_first: { objectiveType: 'riftHeraldFirst', typeDrake: null, isSoul: false },
  horde_first: { objectiveType: 'hordeFirst', typeDrake: null, isSoul: false },
  game_first: { objectiveType: 'gameFirst', typeDrake: null, isSoul: false },
}

function sqlObjectiveHistogramTypeClause(
  filter: ObjectiveHistogramFilter,
  alias = 'oh'
): string {
  const safeType = filter.objectiveType.replace(/'/g, "''")
  const parts = [
    `${alias}.objective_type = '${safeType}'`,
    `${alias}.is_soul = ${filter.isSoul ? 'TRUE' : 'FALSE'}`,
  ]
  if (filter.typeDrake == null) {
    parts.push(`${alias}.type_drake IS NULL`)
  } else {
    const safeDrake = filter.typeDrake.replace(/'/g, "''")
    parts.push(`${alias}.type_drake = '${safeDrake}'`)
  }
  return parts.join(' AND ')
}

function buildObjectiveHistogramWhere(
  pVersion: string | null,
  rankTier: string | string[] | null | undefined
): string {
  const conditions = ['1=1']
  if (pVersion) {
    conditions.push(`oh.game_version LIKE '${escapeSqlLikePrefix(normalizePatchMajorMinor(pVersion))}%'`)
  }
  conditions.push(...buildRankTierSqlConditions('oh', rankTier))
  conditions.push(`oh.region <> 'GLOBAL'`)
  return conditions.join(' AND ')
}

function securedGamesFromSideDistribution(dist: Record<string, number>): number {
  let total = 0
  for (const [bucketRaw, gamesRaw] of Object.entries(dist)) {
    const bucket = Number(bucketRaw)
    if (!Number.isFinite(bucket) || bucket < 1) continue
    total += Number(gamesRaw ?? 0)
  }
  return total
}

async function loadObjectiveDistributionBySides(
  pVersion: string | null,
  rankTier: string | string[] | null | undefined,
  objectiveKey: string
): Promise<ObjectiveDistributionSides> {
  const histogramFilter = OBJECTIVE_KEY_TO_HISTOGRAM_FILTER[objectiveKey]
  if (!histogramFilter) {
    return { blue: {}, red: {}, blueWins: {}, redWins: {} }
  }
  const whereSql = buildObjectiveHistogramWhere(pVersion, rankTier)
  const typeClause = sqlObjectiveHistogramTypeClause(histogramFilter)
  const ohFrom = await matchVersionedAggFrom('agg_objective_outcome_stats', pVersion, 'oh')
  const rows = await queryRawUnsafe<
    Array<{ team: number; objective_bucket: number; count_win: number; count_game: number }>
  >(`
    SELECT
      oh.team,
      oh.obj_count AS objective_bucket,
      SUM(CASE WHEN oh.outcome = 'win' THEN oh.count_games ELSE 0 END)::int AS count_win,
      SUM(oh.count_games)::int AS count_game
    FROM ${ohFrom}
    WHERE ${typeClause}
      AND ${whereSql}
    GROUP BY oh.team, oh.obj_count
  `)
  const blue: Record<string, number> = {}
  const red: Record<string, number> = {}
  const blueWins: Record<string, number> = {}
  const redWins: Record<string, number> = {}
  for (const r of rows) {
    const bucket = String(Number(r.objective_bucket ?? 0))
    const g = Number(r.count_game ?? 0)
    const w = Number(r.count_win ?? 0)
    const tid = Number(r.team)
    if (tid === 100) {
      blue[bucket] = (blue[bucket] ?? 0) + g
      blueWins[bucket] = (blueWins[bucket] ?? 0) + w
    } else if (tid === 200) {
      red[bucket] = (red[bucket] ?? 0) + g
      redWins[bucket] = (redWins[bucket] ?? 0) + w
    }
  }
  return { blue, red, blueWins, redWins }
}

async function loadObjectiveDistributionByOutcome(
  pVersion: string | null,
  rankTier: string | string[] | null | undefined,
  objectiveKey: string
): Promise<{ win: Record<string, number>; loss: Record<string, number> }> {
  const histogramFilter = OBJECTIVE_KEY_TO_HISTOGRAM_FILTER[objectiveKey]
  if (!histogramFilter) {
    return { win: {}, loss: {} }
  }
  const whereSql = buildObjectiveHistogramWhere(pVersion, rankTier)
  const typeClause = sqlObjectiveHistogramTypeClause(histogramFilter)
  const ohFrom = await matchVersionedAggFrom('agg_objective_outcome_stats', pVersion, 'oh')
  const rows = await queryRawUnsafe<
    Array<{ objective_bucket: number; win_cnt: number; loss_cnt: number }>
  >(`
    SELECT
      oh.obj_count AS objective_bucket,
      SUM(CASE WHEN oh.outcome = 'win' THEN oh.count_games ELSE 0 END)::int AS win_cnt,
      SUM(CASE WHEN oh.outcome = 'loss' THEN oh.count_games ELSE 0 END)::int AS loss_cnt
    FROM ${ohFrom}
    WHERE ${typeClause}
      AND ${whereSql}
    GROUP BY oh.obj_count
  `)
  const win: Record<string, number> = {}
  const loss: Record<string, number> = {}
  for (const r of rows) {
    const bucket = String(Number(r.objective_bucket ?? 0))
    win[bucket] = (win[bucket] ?? 0) + Number(r.win_cnt ?? 0)
    loss[bucket] = (loss[bucket] ?? 0) + Number(r.loss_cnt ?? 0)
  }
  return { win, loss }
}

function sumObjectiveCountFromDistribution(dist: Record<string, number> | undefined): number {
  if (!dist) return 0
  let total = 0
  for (const [bucketRaw, countRaw] of Object.entries(dist)) {
    const bucket = Number(bucketRaw)
    const count = Number(countRaw)
    if (!Number.isFinite(bucket) || !Number.isFinite(count)) continue
    total += bucket * count
  }
  return Math.max(0, Math.round(total))
}

/** Winrate global (tous côtés) quand l'équipe a le first sur l'objectif (bucket 1). */
function firstBucketWinrateFromOutcome(dist: {
  win: Record<string, number>
  loss: Record<string, number>
}): number | null {
  const w = Number(dist.win['1'] ?? 0)
  const l = Number(dist.loss['1'] ?? 0)
  const t = w + l
  if (t <= 0) return null
  const wr = (w / t) * 100
  return Math.min(100, Math.max(0, wr))
}

/** Winrate quand l'équipe a sécurisé l'objectif (tous buckets >= 1). */
function securedWinrateFromOutcome(dist: {
  win: Record<string, number>
  loss: Record<string, number>
}): number | null {
  const securedWins = securedGamesFromOutcome(dist.win)
  const securedLosses = securedGamesFromOutcome(dist.loss)
  const total = securedWins + securedLosses
  if (total <= 0) return null
  const wr = (securedWins / total) * 100
  return Math.min(100, Math.max(0, wr))
}

export type ObjectiveDistributionSides = {
  blue: Record<string, number>
  red: Record<string, number>
  blueWins: Record<string, number>
  redWins: Record<string, number>
}

function sideDistributionFields(dist: ObjectiveDistributionSides): {
  distributionByBlue: Record<string, number>
  distributionByRed: Record<string, number>
  distributionWinsByBlue: Record<string, number>
  distributionWinsByRed: Record<string, number>
} {
  return {
    distributionByBlue: dist.blue,
    distributionByRed: dist.red,
    distributionWinsByBlue: dist.blueWins,
    distributionWinsByRed: dist.redWins,
  }
}

function firstBucketWinrateBySide(dist: ObjectiveDistributionSides): {
  blue: number | null
  red: number | null
} {
  const bG = Number(dist.blue['1'] ?? 0)
  const bW = Number(dist.blueWins['1'] ?? 0)
  const rG = Number(dist.red['1'] ?? 0)
  const rW = Number(dist.redWins['1'] ?? 0)
  const clampWr = (w: number, g: number): number | null => {
    if (g <= 0) return null
    const wr = (Math.min(w, g) / g) * 100
    return Math.min(100, Math.max(0, wr))
  }
  return {
    blue: clampWr(bW, bG),
    red: clampWr(rW, rG),
  }
}

/** Winrate quand le côté sécurise l'objectif (bucket >= 1). */
function objectiveSecuredWinrateBySide(dist: ObjectiveDistributionSides): {
  blue: number | null
  red: number | null
} {
  let blueGames = 0
  let blueWins = 0
  let redGames = 0
  let redWins = 0
  for (const [bucketRaw, gamesRaw] of Object.entries(dist.blue)) {
    const bucket = Number(bucketRaw)
    if (!Number.isFinite(bucket) || bucket < 1) continue
    blueGames += Number(gamesRaw ?? 0)
    blueWins += Number(dist.blueWins[bucketRaw] ?? 0)
  }
  for (const [bucketRaw, gamesRaw] of Object.entries(dist.red)) {
    const bucket = Number(bucketRaw)
    if (!Number.isFinite(bucket) || bucket < 1) continue
    redGames += Number(gamesRaw ?? 0)
    redWins += Number(dist.redWins[bucketRaw] ?? 0)
  }
  return {
    blue: blueGames > 0 ? (blueWins / blueGames) * 100 : null,
    red: redGames > 0 ? (redWins / redGames) * 100 : null,
  }
}

export async function getOverviewSidesStats(
  version?: string | string[] | null,
  rankTier?: string | string[] | null,
  role?: string | null
): Promise<OverviewSidesApiStats | null> {
  if (!isDatabaseConfigured()) return null
  const now = Date.now()
  const cacheKey = sidesCacheKey(version, rankTier, role)
  const cached = overviewSidesCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.data
  const pVersion = toQueryStringArrayParam(version).length === 1 ? toQueryStringArrayParam(version)[0] : null
  const roleFilters = resolveOverviewRoleFilters(role)
  try {
    const condTeam = buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mv.')
    const mvSidesA = await matchVersionedAggFrom('agg_team_core_stats', version, 'mv')
    const sideRows = await queryRawUnsafe<Array<{ team_id: number; matches: bigint; wins: bigint }>>(`
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
    const champRows = await queryRawUnsafe<
      Array<{ team_id: number; champion_id: number; games: bigint; wins: bigint }>
    >(`
      SELECT
        mv.team_num AS team_id,
        mv.champion_id,
        SUM(mv.count_game)::bigint AS games,
        SUM(mv.count_win)::bigint AS wins
      FROM ${sideChampFrom}
      WHERE ${buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mv.')}
      ${roleFilters.champion ? `AND upper(mv.role_norm::text) = '${statsRoleSqlLiteral(roleFilters.champion)}'` : ''}
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
    const banRows = await queryRawUnsafe<Array<{ team_id: number; champion_id: number; cnt: bigint }>>(`
      SELECT
        mv.team_num AS team_id,
        mv.banned_champion_id AS champion_id,
        SUM(mv.ban_count)::bigint AS cnt
      FROM ${banSidesFrom}
      WHERE ${buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mv.')}
      ${roleFilters.banner ? `AND upper(mv.banner_role_norm::text) = '${statsRoleSqlLiteral(roleFilters.banner)}'` : ''}
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
    const teamAggRows = await queryRawUnsafe<
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
        count_inhibitor_first: bigint
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
        SUM(mv.count_inhibitor_first)::bigint AS count_inhibitor_first,
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
        row.count_inhibitor_first = BigInt(f.count_inhibitor_first)
        row.sum_elder_kills = BigInt(f.sum_elder_kills)
      }
    }
    const blue = teamAggRows.find((r) => Number(r.team) === 100)
    const red = teamAggRows.find((r) => Number(r.team) === 200)
    const n = (v: bigint | undefined) => Number(v ?? 0)
    const drakesBySide: NonNullable<OverviewSidesApiStats['drakesBySide']> = {
      types: {
        elder: { byBlue: 0, byRed: 0, winrateBlue: null, winrateRed: null },
        earth: { byBlue: 0, byRed: 0, winrateBlue: null, winrateRed: null },
        water: { byBlue: 0, byRed: 0, winrateBlue: null, winrateRed: null },
        wind: { byBlue: 0, byRed: 0, winrateBlue: null, winrateRed: null },
        fire: { byBlue: 0, byRed: 0, winrateBlue: null, winrateRed: null },
        hextec: { byBlue: 0, byRed: 0, winrateBlue: null, winrateRed: null },
        chem: { byBlue: 0, byRed: 0, winrateBlue: null, winrateRed: null },
      },
      souls: {
        earth: { byBlue: 0, byRed: 0, winrateBlue: null, winrateRed: null },
        water: { byBlue: 0, byRed: 0, winrateBlue: null, winrateRed: null },
        wind: { byBlue: 0, byRed: 0, winrateBlue: null, winrateRed: null },
        fire: { byBlue: 0, byRed: 0, winrateBlue: null, winrateRed: null },
        hextec: { byBlue: 0, byRed: 0, winrateBlue: null, winrateRed: null },
        chem: { byBlue: 0, byRed: 0, winrateBlue: null, winrateRed: null },
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
        inhibitorFirst: n(blue?.count_inhibitor_first),
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
        inhibitorFirst: n(red?.count_inhibitor_first),
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
      distEarthSoul,
      distWaterSoul,
      distWindSoul,
      distFireSoul,
      distHextecSoul,
      distChemSoul,
      distTower,
      distInhibitor,
      distRiftHerald,
      distHorde,
      distFirstBloodSides,
      distBaronFirstSides,
      distDragonFirstSides,
      distTowerFirstSides,
      distInhibitorFirstSides,
      distRiftHeraldFirstSides,
      distHordeFirstSides,
      distGameFirstOut,
      distGameFirstSides,
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
      loadObjectiveDistributionBySides(pVersion, rankTier, 'earth_soul'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'water_soul'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'wind_soul'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'fire_soul'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'hextec_soul'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'chem_soul'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'tower'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'inhibitor'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'riftHerald'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'horde'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'first_blood'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'baron_first'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'dragon_first'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'tower_first'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'inhibitor_first'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'rift_herald_first'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'horde_first'),
      loadObjectiveDistributionByOutcome(pVersion, rankTier, 'game_first'),
      loadObjectiveDistributionBySides(pVersion, rankTier, 'game_first'),
    ])
    objectivesBySide.blue.baronKills = sumObjectiveCountFromDistribution(distBaron.blue)
    objectivesBySide.red.baronKills = sumObjectiveCountFromDistribution(distBaron.red)
    objectivesBySide.blue.dragonKills = sumObjectiveCountFromDistribution(distDragon.blue)
    objectivesBySide.red.dragonKills = sumObjectiveCountFromDistribution(distDragon.red)
    objectivesBySide.blue.towerKills = sumObjectiveCountFromDistribution(distTower.blue)
    objectivesBySide.red.towerKills = sumObjectiveCountFromDistribution(distTower.red)
    objectivesBySide.blue.inhibitorKills = sumObjectiveCountFromDistribution(distInhibitor.blue)
    objectivesBySide.red.inhibitorKills = sumObjectiveCountFromDistribution(distInhibitor.red)
    objectivesBySide.blue.riftHeraldKills = sumObjectiveCountFromDistribution(distRiftHerald.blue)
    objectivesBySide.red.riftHeraldKills = sumObjectiveCountFromDistribution(distRiftHerald.red)
    objectivesBySide.blue.hordeKills = sumObjectiveCountFromDistribution(distHorde.blue)
    objectivesBySide.red.hordeKills = sumObjectiveCountFromDistribution(distHorde.red)
    const fbBlueFirst = firstGamesFromSideDistribution(distFirstBloodSides.blue)
    const fbRedFirst = firstGamesFromSideDistribution(distFirstBloodSides.red)
    if (fbBlueFirst + fbRedFirst > 0) {
      objectivesBySide.blue.firstBlood = fbBlueFirst
      objectivesBySide.red.firstBlood = fbRedFirst
    }
    const baronBlueFirst = firstGamesFromSideDistribution(distBaronFirstSides.blue)
    const baronRedFirst = firstGamesFromSideDistribution(distBaronFirstSides.red)
    if (baronBlueFirst + baronRedFirst > 0) {
      objectivesBySide.blue.baronFirst = baronBlueFirst
      objectivesBySide.red.baronFirst = baronRedFirst
    }
    const dragonBlueFirst = firstGamesFromSideDistribution(distDragonFirstSides.blue)
    const dragonRedFirst = firstGamesFromSideDistribution(distDragonFirstSides.red)
    if (dragonBlueFirst + dragonRedFirst > 0) {
      objectivesBySide.blue.dragonFirst = dragonBlueFirst
      objectivesBySide.red.dragonFirst = dragonRedFirst
    }
    const towerBlueFirst = firstGamesFromSideDistribution(distTowerFirstSides.blue)
    const towerRedFirst = firstGamesFromSideDistribution(distTowerFirstSides.red)
    if (towerBlueFirst + towerRedFirst > 0) {
      objectivesBySide.blue.towerFirst = towerBlueFirst
      objectivesBySide.red.towerFirst = towerRedFirst
    }
    const inhibBlueFirst = firstGamesFromSideDistribution(distInhibitorFirstSides.blue)
    const inhibRedFirst = firstGamesFromSideDistribution(distInhibitorFirstSides.red)
    if (inhibBlueFirst + inhibRedFirst > 0) {
      objectivesBySide.blue.inhibitorFirst = inhibBlueFirst
      objectivesBySide.red.inhibitorFirst = inhibRedFirst
    }
    const heraldBlueFirst = firstGamesFromSideDistribution(distRiftHeraldFirstSides.blue)
    const heraldRedFirst = firstGamesFromSideDistribution(distRiftHeraldFirstSides.red)
    if (heraldBlueFirst + heraldRedFirst > 0) {
      objectivesBySide.blue.riftHeraldFirst = heraldBlueFirst
      objectivesBySide.red.riftHeraldFirst = heraldRedFirst
    }
    const hordeBlueFirst = firstGamesFromSideDistribution(distHordeFirstSides.blue)
    const hordeRedFirst = firstGamesFromSideDistribution(distHordeFirstSides.red)
    if (hordeBlueFirst + hordeRedFirst > 0) {
      objectivesBySide.blue.hordeFirst = hordeBlueFirst
      objectivesBySide.red.hordeFirst = hordeRedFirst
    }
    drakesBySide.types.elder.byBlue = securedGamesFromSideDistribution(distElder.blue)
    drakesBySide.types.elder.byRed = securedGamesFromSideDistribution(distElder.red)
    drakesBySide.types.earth.byBlue = securedGamesFromSideDistribution(distEarthDrake.blue)
    drakesBySide.types.earth.byRed = securedGamesFromSideDistribution(distEarthDrake.red)
    drakesBySide.types.water.byBlue = securedGamesFromSideDistribution(distWaterDrake.blue)
    drakesBySide.types.water.byRed = securedGamesFromSideDistribution(distWaterDrake.red)
    drakesBySide.types.wind.byBlue = securedGamesFromSideDistribution(distWindDrake.blue)
    drakesBySide.types.wind.byRed = securedGamesFromSideDistribution(distWindDrake.red)
    drakesBySide.types.fire.byBlue = securedGamesFromSideDistribution(distFireDrake.blue)
    drakesBySide.types.fire.byRed = securedGamesFromSideDistribution(distFireDrake.red)
    drakesBySide.types.hextec.byBlue = securedGamesFromSideDistribution(distHextecDrake.blue)
    drakesBySide.types.hextec.byRed = securedGamesFromSideDistribution(distHextecDrake.red)
    drakesBySide.types.chem.byBlue = securedGamesFromSideDistribution(distChemDrake.blue)
    drakesBySide.types.chem.byRed = securedGamesFromSideDistribution(distChemDrake.red)
    drakesBySide.souls.earth.byBlue = firstGamesFromSideDistribution(distEarthSoul.blue)
    drakesBySide.souls.earth.byRed = firstGamesFromSideDistribution(distEarthSoul.red)
    drakesBySide.souls.water.byBlue = firstGamesFromSideDistribution(distWaterSoul.blue)
    drakesBySide.souls.water.byRed = firstGamesFromSideDistribution(distWaterSoul.red)
    drakesBySide.souls.wind.byBlue = firstGamesFromSideDistribution(distWindSoul.blue)
    drakesBySide.souls.wind.byRed = firstGamesFromSideDistribution(distWindSoul.red)
    drakesBySide.souls.fire.byBlue = firstGamesFromSideDistribution(distFireSoul.blue)
    drakesBySide.souls.fire.byRed = firstGamesFromSideDistribution(distFireSoul.red)
    drakesBySide.souls.hextec.byBlue = firstGamesFromSideDistribution(distHextecSoul.blue)
    drakesBySide.souls.hextec.byRed = firstGamesFromSideDistribution(distHextecSoul.red)
    drakesBySide.souls.chem.byBlue = firstGamesFromSideDistribution(distChemSoul.blue)
    drakesBySide.souls.chem.byRed = firstGamesFromSideDistribution(distChemSoul.red)
    drakesBySide.types.elder.distributionByBlue = distElder.blue
    drakesBySide.types.elder.distributionByRed = distElder.red
    drakesBySide.types.elder.distributionWinsByBlue = distElder.blueWins
    drakesBySide.types.elder.distributionWinsByRed = distElder.redWins
    drakesBySide.types.earth.distributionByBlue = distEarthDrake.blue
    drakesBySide.types.earth.distributionByRed = distEarthDrake.red
    drakesBySide.types.earth.distributionWinsByBlue = distEarthDrake.blueWins
    drakesBySide.types.earth.distributionWinsByRed = distEarthDrake.redWins
    drakesBySide.types.water.distributionByBlue = distWaterDrake.blue
    drakesBySide.types.water.distributionByRed = distWaterDrake.red
    drakesBySide.types.water.distributionWinsByBlue = distWaterDrake.blueWins
    drakesBySide.types.water.distributionWinsByRed = distWaterDrake.redWins
    drakesBySide.types.wind.distributionByBlue = distWindDrake.blue
    drakesBySide.types.wind.distributionByRed = distWindDrake.red
    drakesBySide.types.wind.distributionWinsByBlue = distWindDrake.blueWins
    drakesBySide.types.wind.distributionWinsByRed = distWindDrake.redWins
    drakesBySide.types.fire.distributionByBlue = distFireDrake.blue
    drakesBySide.types.fire.distributionByRed = distFireDrake.red
    drakesBySide.types.fire.distributionWinsByBlue = distFireDrake.blueWins
    drakesBySide.types.fire.distributionWinsByRed = distFireDrake.redWins
    drakesBySide.types.hextec.distributionByBlue = distHextecDrake.blue
    drakesBySide.types.hextec.distributionByRed = distHextecDrake.red
    drakesBySide.types.hextec.distributionWinsByBlue = distHextecDrake.blueWins
    drakesBySide.types.hextec.distributionWinsByRed = distHextecDrake.redWins
    drakesBySide.types.chem.distributionByBlue = distChemDrake.blue
    drakesBySide.types.chem.distributionByRed = distChemDrake.red
    drakesBySide.types.chem.distributionWinsByBlue = distChemDrake.blueWins
    drakesBySide.types.chem.distributionWinsByRed = distChemDrake.redWins
    const wrElder = objectiveSecuredWinrateBySide(distElder)
    drakesBySide.types.elder.winrateBlue = wrElder.blue
    drakesBySide.types.elder.winrateRed = wrElder.red
    const wrEarth = objectiveSecuredWinrateBySide(distEarthDrake)
    drakesBySide.types.earth.winrateBlue = wrEarth.blue
    drakesBySide.types.earth.winrateRed = wrEarth.red
    const wrWater = objectiveSecuredWinrateBySide(distWaterDrake)
    drakesBySide.types.water.winrateBlue = wrWater.blue
    drakesBySide.types.water.winrateRed = wrWater.red
    const wrWind = objectiveSecuredWinrateBySide(distWindDrake)
    drakesBySide.types.wind.winrateBlue = wrWind.blue
    drakesBySide.types.wind.winrateRed = wrWind.red
    const wrFire = objectiveSecuredWinrateBySide(distFireDrake)
    drakesBySide.types.fire.winrateBlue = wrFire.blue
    drakesBySide.types.fire.winrateRed = wrFire.red
    const wrHextec = objectiveSecuredWinrateBySide(distHextecDrake)
    drakesBySide.types.hextec.winrateBlue = wrHextec.blue
    drakesBySide.types.hextec.winrateRed = wrHextec.red
    const wrChem = objectiveSecuredWinrateBySide(distChemDrake)
    drakesBySide.types.chem.winrateBlue = wrChem.blue
    drakesBySide.types.chem.winrateRed = wrChem.red
    const wrEarthSoul = objectiveSecuredWinrateBySide(distEarthSoul)
    drakesBySide.souls.earth.winrateBlue = wrEarthSoul.blue
    drakesBySide.souls.earth.winrateRed = wrEarthSoul.red
    const wrWaterSoul = objectiveSecuredWinrateBySide(distWaterSoul)
    drakesBySide.souls.water.winrateBlue = wrWaterSoul.blue
    drakesBySide.souls.water.winrateRed = wrWaterSoul.red
    const wrWindSoul = objectiveSecuredWinrateBySide(distWindSoul)
    drakesBySide.souls.wind.winrateBlue = wrWindSoul.blue
    drakesBySide.souls.wind.winrateRed = wrWindSoul.red
    const wrFireSoul = objectiveSecuredWinrateBySide(distFireSoul)
    drakesBySide.souls.fire.winrateBlue = wrFireSoul.blue
    drakesBySide.souls.fire.winrateRed = wrFireSoul.red
    const wrHextecSoul = objectiveSecuredWinrateBySide(distHextecSoul)
    drakesBySide.souls.hextec.winrateBlue = wrHextecSoul.blue
    drakesBySide.souls.hextec.winrateRed = wrHextecSoul.red
    const wrChemSoul = objectiveSecuredWinrateBySide(distChemSoul)
    drakesBySide.souls.chem.winrateBlue = wrChemSoul.blue
    drakesBySide.souls.chem.winrateRed = wrChemSoul.red
    const objectivesBySideTable: OverviewSidesApiStats['objectivesBySideTable'] = {
      firstBlood: {
        firstByBlue: objectivesBySide.blue.firstBlood,
        firstByRed: objectivesBySide.red.firstBlood,
        ...sideDistributionFields(distFirstBloodSides),
      },
      baron: {
        firstByBlue: objectivesBySide.blue.baronFirst,
        firstByRed: objectivesBySide.red.baronFirst,
        killsByBlue: objectivesBySide.blue.baronKills,
        killsByRed: objectivesBySide.red.baronKills,
        ...sideDistributionFields(distBaron),
      },
      dragon: {
        firstByBlue: objectivesBySide.blue.dragonFirst,
        firstByRed: objectivesBySide.red.dragonFirst,
        killsByBlue: objectivesBySide.blue.dragonKills,
        killsByRed: objectivesBySide.red.dragonKills,
        ...sideDistributionFields(distDragon),
      },
      elder: {
        firstByBlue: objectivesBySide.blue.elderFirst,
        firstByRed: objectivesBySide.red.elderFirst,
        killsByBlue: objectivesBySide.blue.elderKills,
        killsByRed: objectivesBySide.red.elderKills,
        ...sideDistributionFields(distElder),
      },
      tower: {
        firstByBlue: objectivesBySide.blue.towerFirst,
        firstByRed: objectivesBySide.red.towerFirst,
        killsByBlue: objectivesBySide.blue.towerKills,
        killsByRed: objectivesBySide.red.towerKills,
        ...sideDistributionFields(distTower),
      },
      inhibitor: {
        firstByBlue: objectivesBySide.blue.inhibitorFirst,
        firstByRed: objectivesBySide.red.inhibitorFirst,
        killsByBlue: objectivesBySide.blue.inhibitorKills,
        killsByRed: objectivesBySide.red.inhibitorKills,
        ...sideDistributionFields(distInhibitor),
      },
      riftHerald: {
        firstByBlue: objectivesBySide.blue.riftHeraldFirst,
        firstByRed: objectivesBySide.red.riftHeraldFirst,
        killsByBlue: objectivesBySide.blue.riftHeraldKills,
        killsByRed: objectivesBySide.red.riftHeraldKills,
        ...sideDistributionFields(distRiftHerald),
      },
      horde: {
        firstByBlue: objectivesBySide.blue.hordeFirst,
        firstByRed: objectivesBySide.red.hordeFirst,
        killsByBlue: objectivesBySide.blue.hordeKills,
        killsByRed: objectivesBySide.red.hordeKills,
        ...sideDistributionFields(distHorde),
      },
    }

    const result: OverviewSidesApiStats = {
      matchCount,
      sideWinrate: { blue: blueSide, red: redSide },
      championWinrateBySide,
      championPickBySide,
      bansBySide,
      surrenderBySide,
      objectiveFirstWinrateBySide: {
        firstBlood: firstBucketWinrateBySide(distFirstBloodSides),
        baron: firstBucketWinrateBySide(distBaronFirstSides),
        dragon: firstBucketWinrateBySide(distDragonFirstSides),
        tower: firstBucketWinrateBySide(distTowerFirstSides),
        inhibitor: firstBucketWinrateBySide(distInhibitorFirstSides),
        riftHerald: firstBucketWinrateBySide(distRiftHeraldFirstSides),
        horde: firstBucketWinrateBySide(distHordeFirstSides),
      },
      objectiveFirstWinrateGames: {
        firstBlood:
          firstGamesFromSideDistribution(distFirstBloodSides.blue) +
          firstGamesFromSideDistribution(distFirstBloodSides.red),
        baron:
          firstGamesFromSideDistribution(distBaronFirstSides.blue) +
          firstGamesFromSideDistribution(distBaronFirstSides.red),
        dragon:
          firstGamesFromSideDistribution(distDragonFirstSides.blue) +
          firstGamesFromSideDistribution(distDragonFirstSides.red),
        tower:
          firstGamesFromSideDistribution(distTowerFirstSides.blue) +
          firstGamesFromSideDistribution(distTowerFirstSides.red),
        inhibitor:
          firstGamesFromSideDistribution(distInhibitorFirstSides.blue) +
          firstGamesFromSideDistribution(distInhibitorFirstSides.red),
        riftHerald:
          firstGamesFromSideDistribution(distRiftHeraldFirstSides.blue) +
          firstGamesFromSideDistribution(distRiftHeraldFirstSides.red),
        horde:
          firstGamesFromSideDistribution(distHordeFirstSides.blue) +
          firstGamesFromSideDistribution(distHordeFirstSides.red),
      },
      objectiveFirstWinrateGamesBySide: {
        firstBlood: {
          blue: firstGamesFromSideDistribution(distFirstBloodSides.blue),
          red: firstGamesFromSideDistribution(distFirstBloodSides.red),
        },
        baron: {
          blue: firstGamesFromSideDistribution(distBaronFirstSides.blue),
          red: firstGamesFromSideDistribution(distBaronFirstSides.red),
        },
        dragon: {
          blue: firstGamesFromSideDistribution(distDragonFirstSides.blue),
          red: firstGamesFromSideDistribution(distDragonFirstSides.red),
        },
        tower: {
          blue: firstGamesFromSideDistribution(distTowerFirstSides.blue),
          red: firstGamesFromSideDistribution(distTowerFirstSides.red),
        },
        inhibitor: {
          blue: firstGamesFromSideDistribution(distInhibitorFirstSides.blue),
          red: firstGamesFromSideDistribution(distInhibitorFirstSides.red),
        },
        riftHerald: {
          blue: firstGamesFromSideDistribution(distRiftHeraldFirstSides.blue),
          red: firstGamesFromSideDistribution(distRiftHeraldFirstSides.red),
        },
        horde: {
          blue: firstGamesFromSideDistribution(distHordeFirstSides.blue),
          red: firstGamesFromSideDistribution(distHordeFirstSides.red),
        },
      },
      gameFirstObjective: {
        distributionByWin: distGameFirstOut.win,
        distributionByLoss: distGameFirstOut.loss,
        distributionByBlue: distGameFirstSides.blue,
        distributionByRed: distGameFirstSides.red,
      },
      drakesBySide,
      objectivesBySide,
      objectivesBySideTable,
    }
    const csSidesObjectives = await loadChampionStatsTeamObjectives(
      pVersion,
      rankTier,
      roleFilters.champion
    )
    if (csSidesObjectives) {
      applyChampionStatsObtentionToOverviewSides(result, csSidesObjectives)
      applyChampionStatsWinratesToOverviewSides(result, csSidesObjectives)
    }
    capOverviewSidesObtentionCounts(result)
    overviewSidesCache.set(cacheKey, { data: result, expiresAt: now + OVERVIEW_CACHE_TTL_MS })
    return result
  } catch (err) {
    console.error('[getOverviewSidesStats]', err)
    return null
  }
}

function roleSqlClause(role: string | null | undefined): string {
  const r = normalizeStatsRoleForChampion(role)
  if (!r) return ''
  return ` AND upper(mv.role_norm::text) = '${statsRoleSqlLiteral(r)}'`
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
  const rows = await queryRawUnsafe<Array<{ champion_id: number; games: number; wins: number }>>(sql)
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
  const rows = await queryRawUnsafe<Array<{ champion_id: number; bans: number }>>(sql)
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
  const roleFilters = resolveOverviewRoleFilters(role)
  const pRankKey = rankTierCacheKey(rankTier)
  const voRaw = String(versionOldest).trim()
  const sinceCap = progressionSinceCap(sinceVersionPrefix)
  const now = Date.now()
  const cacheKey = `sidesprog4|${voRaw}|${pRankKey ?? ''}|${roleFilters.cacheKey}|${sinceCap ?? 'open'}`
  const cached = overviewSidesProgressionCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.data

  try {
    const rawMatchCond = buildRawMatchCond(null, rankTier).replace(/\bm\./g, 'mv.')
    const availablePatches = await listDistinctPatchVersions()
    const oldestClause = buildProgressionOldestOnlySql('mv', voRaw)
    const sinceClause = buildProgressionSinceSql('mv', voRaw, sinceCap, availablePatches)
    const rSql = roleSqlClause(roleFilters.champion)

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
  const conditions: string[] = ['1=1']
  if (versions.length === 1) {
    conditions.push(`tc.game_version LIKE '${normalizePatchMajorMinor(versions[0]).replace(/'/g, "''")}%'`)
  } else if (versions.length > 1) {
    conditions.push(
      `tc.game_version IN (${versions.map((v) => `'${normalizePatchMajorMinor(v).replace(/'/g, "''")}'`).join(',')})`
    )
  }
  conditions.push(...buildRankTierSqlConditions('tc', rankTier))
  const objective = (objectiveKey ?? '').trim()
  if (objective) {
    conditions.push(`tb.objective_key = '${objective.replace(/'/g, "''")}'`)
  }

  const whereSql = conditions.join(' AND ')
  try {
    const rows = await queryRawUnsafe<
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
      FROM archive_agg_team_bucket tb
      INNER JOIN archive_agg_team_core_stats tc ON tc.id = tb.team_stat_id
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
