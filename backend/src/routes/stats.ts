/**
 * API statistiques LoL (agrégats uniquement, pas de données brutes).
 * Champions, builds, runes, meilleurs joueurs.
 */
import { Router, Request, Response } from 'express'
import { RiotStatsAggregator } from '../services/RiotStatsAggregator.js'
import { getBuildsByChampion } from '../services/StatsBuildsService.js'
import { getRunesByChampion, getRuneStatsByChampion } from '../services/StatsRunesService.js'
import { getMatchupsByChampion } from '../services/StatsMatchupsService.js'
import {
  getTierListByLane,
  getMatchupDetailsByChampion,
  patchFromGameVersion,
} from '../services/MatchupTierService.js'
import {
  getTopPlayers,
  getTopPlayersByChampion,
  getPlayerBySummonerName,
  getChampionStatsForPlayer,
} from '../services/StatsPlayersService.js'
import {
  getOverviewStats,
  getOverviewDetailStats,
  getOverviewTeamsStats,
  getOverviewSidesStats,
  getOverviewDurationWinrateStats,
  getDurationWinrateByChampion,
  getOverviewProgressionStats,
  getOverviewProgressionFullStats,
} from '../services/StatsOverviewService.js'
import { getOverviewAbandons } from '../services/StatsAbandonsService.js'
import {
  getSummonerSpellsByChampion,
  getSummonerSpellsDuosByChampion,
} from '../services/StatsSummonerSpellsService.js'
import { isDatabaseConfigured } from '../db.js'
import {
  getPrecomputedChampions,
  getPrecomputedOverview,
  getPrecomputedOverviewTeams,
  getPrecomputedOverviewDetail,
  getPrecomputedDurationWinrate,
  getPrecomputedSides,
  getPrecomputedAbandons,
} from '../services/StatsPrecomputedService.js'

const router = Router()
const aggregator = new RiotStatsAggregator()

/** Perf: log backend duration and set X-Backend-Time / X-Stats-Path / X-SQL-Time so the front can show everything in one place. */
router.use((req: Request, res: Response, next) => {
  const start = Date.now()
  const path = req.path || req.originalUrl?.split('?')[0] || ''
  ;(res as Response & { locals: { sqlMs?: number } }).locals = (res as Response & { locals: Record<string, unknown> }).locals || {}
  const originalJson = res.json.bind(res)
  res.json = function (body: unknown) {
    const ms = Date.now() - start
    res.set('X-Backend-Time', String(ms))
    res.set('X-Stats-Path', path)
    const sqlMs = (res as Response & { locals: { sqlMs?: number } }).locals?.sqlMs
    if (typeof sqlMs === 'number') {
      res.set('X-SQL-Time', String(sqlMs))
    }
    return originalJson(body)
  }
  res.on('finish', () => {
    const ms = Date.now() - start
    const sqlMs = (res as Response & { locals: { sqlMs?: number } }).locals?.sqlMs
    if (typeof sqlMs === 'number') {
      console.log('[Stats backend]', req.method, path, ms + 'ms', '(SQL', sqlMs + 'ms)')
    } else {
      console.log('[Stats backend]', req.method, path, ms + 'ms')
    }
  })
  next()
})

function queryString(value: unknown): string | null {
  if (value == null) return null
  let s: string | null = null
  if (Array.isArray(value)) s = typeof value[0] === 'string' ? value[0] : null
  else if (typeof value === 'string') s = value
  if (s == null || s === '' || s === '[]' || s.startsWith('[')) return null
  return s
}

/** Return array of strings from query param (single value or repeated). */
function queryStringArray(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) {
    return value.filter((x): x is string => typeof x === 'string' && x !== '' && !x.startsWith('['))
  }
  if (typeof value === 'string' && value !== '' && !value.startsWith('[')) return [value]
  return []
}

function resolvePatchFromQuery(patchValue: unknown, versionValue: unknown): string | null {
  const patchRaw = queryString(patchValue)
  if (patchRaw) return patchRaw
  const version = queryString(versionValue)
  if (!version) return null
  return patchFromGameVersion(version)
}

const STATS_CACHE_MAX_AGE = 60 // seconds — allow browser/CDN cache for stats GET

/** GET /api/stats/overview - total matches, last update, top winrate champions, matches per division, player count. Query: ?version=16.1 &rankTier=GOLD */
router.get('/overview', async (req: Request, res: Response) => {
  res.set('Cache-Control', `public, max-age=${STATS_CACHE_MAX_AGE}`)
  const version = queryString(req.query.version)
  const rankTier = queryString(req.query.rankTier)
  const sqlStart = Date.now()
  if (version == null) {
    const pre = await getPrecomputedOverview(rankTier ?? null)
    if (pre?.data) {
      ;(res as Response & { locals: { sqlMs?: number } }).locals.sqlMs = Date.now() - sqlStart
      return res.json(pre.data)
    }
  }
  const data = await getOverviewStats(version, rankTier)
  ;(res as Response & { locals: { sqlMs?: number } }).locals.sqlMs = Date.now() - sqlStart
  if (!data) {
    const reason = !isDatabaseConfigured()
      ? 'DATABASE_URL not configured'
      : 'Query failed or no data'
    console.warn('[GET /overview] getOverviewStats returned null:', reason)
    return res.status(200).json({
      totalMatches: 0,
      lastUpdate: null,
      topWinrateChampions: [],
      topPickrateChampions: [],
      topBanrateChampions: [],
      matchesByDivision: [],
      matchesByVersion: [],
      playerCount: 0,
      message: 'No stats yet. Run match collection first.',
    })
  }
  return res.json(data)
})

/** GET /api/stats/overview-detail - runes, rune sets, items, item sets, items by order, summoner spells. Query: ?version=16.1 &rankTier=GOLD &includeSmite=1. Lit précalculé si version null. */
router.get('/overview-detail', async (req: Request, res: Response) => {
  res.set('Cache-Control', `public, max-age=${STATS_CACHE_MAX_AGE}`)
  const version = queryString(req.query.version)
  const rankTier = queryString(req.query.rankTier)
  const includeSmite = req.query.includeSmite === '1' || req.query.includeSmite === 'true'
  const sqlStart = Date.now()
  if (version == null) {
    const pre = await getPrecomputedOverviewDetail(rankTier ?? null, includeSmite)
    if (pre?.data) {
      ;(res as Response & { locals: { sqlMs?: number } }).locals.sqlMs = Date.now() - sqlStart
      return res.json(pre.data)
    }
  }
  const data = await getOverviewDetailStats(version, rankTier, includeSmite)
  ;(res as Response & { locals: { sqlMs?: number } }).locals.sqlMs = Date.now() - sqlStart
  if (!data) {
    console.warn('[GET /overview-detail] no data (version=%s rankTier=%s)', version ?? 'null', rankTier ?? 'null')
    return res.status(200).json({
      totalParticipants: 0,
      runes: [],
      runeSets: [],
      items: [],
      itemSets: [],
      itemsByOrder: {},
      summonerSpells: [],
    })
  }
  return res.json(data)
})

/** GET /api/stats/overview-duration-winrate - duration (5-min buckets) vs winrate. Query: ?version=16.1 &rankTier=GOLD. Lit précalculé si version null. */
router.get('/overview-duration-winrate', async (req: Request, res: Response) => {
  res.set('Cache-Control', `public, max-age=${STATS_CACHE_MAX_AGE}`)
  const version = queryString(req.query.version)
  const rankTier = queryString(req.query.rankTier)
  if (version == null) {
    const pre = await getPrecomputedDurationWinrate(rankTier ?? null)
    if (pre?.data) return res.json(pre.data)
  }
  const data = await getOverviewDurationWinrateStats(version, rankTier)
  if (!data) {
    return res.status(200).json({ buckets: [] })
  }
  return res.json(data)
})

/** GET /api/stats/overview-abandons - remake & surrender rates. Query: ?version=16.1 &rankTier=GOLD. Lit précalculé si version null. */
router.get('/overview-abandons', async (req: Request, res: Response) => {
  res.set('Cache-Control', `public, max-age=${STATS_CACHE_MAX_AGE}`)
  const version = queryString(req.query.version)
  const rankTier = queryString(req.query.rankTier)
  if (version == null) {
    const pre = await getPrecomputedAbandons(rankTier ?? null)
    if (pre?.data) return res.json(pre.data)
  }
  const data = await getOverviewAbandons(version, rankTier)
  if (!data) {
    return res.status(200).json({
      totalMatches: 0,
      remakeCount: 0,
      remakeRate: 0,
      earlySurrenderCount: 0,
      earlySurrenderRate: 0,
      surrenderCount: 0,
      surrenderRate: 0,
    })
  }
  return res.json(data)
})

/** GET /api/stats/overview-progression - WR delta from oldest version to all since. Query: ?version=16.1 &rankTier=GOLD */
router.get('/overview-progression', async (req: Request, res: Response) => {
  const version = queryString(req.query.version)
  const rankTier = queryString(req.query.rankTier)
  const data = await getOverviewProgressionStats(version, rankTier)
  if (!data) {
    return res.status(200).json({ oldestVersion: null, gainers: [], losers: [] })
  }
  return res.json(data)
})

/** GET /api/stats/overview-progression-full - All champions with WR and pickrate progression. Query: ?version=16.1 &rankTier=GOLD */
router.get('/overview-progression-full', async (req: Request, res: Response) => {
  const version = queryString(req.query.version)
  const rankTier = queryString(req.query.rankTier)
  const data = await getOverviewProgressionFullStats(version, rankTier)
  if (!data) {
    return res.status(200).json({ oldestVersion: null, champions: [] })
  }
  return res.json(data)
})

/** GET /api/stats/overview-teams - bans and objectives (first + kills) by win/loss. Query: ?version=16.1 &rankTier=GOLD. Lit précalculé si version null. */
router.get('/overview-teams', async (req: Request, res: Response) => {
  const version = queryString(req.query.version)
  const rankTier = queryString(req.query.rankTier)
  if (version == null) {
    const pre = await getPrecomputedOverviewTeams(rankTier ?? null)
    if (pre?.data) return res.json(pre.data)
  }
  const data = await getOverviewTeamsStats(version, rankTier)
  if (!data) {
    return res.status(200).json({
      matchCount: 0,
      bans: { byWin: [], byLoss: [], top20Total: [] },
      objectives: {
        firstBlood: { firstByWin: 0, firstByLoss: 0 },
        baron: { firstByWin: 0, firstByLoss: 0, killsByWin: 0, killsByLoss: 0 },
        dragon: { firstByWin: 0, firstByLoss: 0, killsByWin: 0, killsByLoss: 0 },
        tower: { firstByWin: 0, firstByLoss: 0, killsByWin: 0, killsByLoss: 0 },
        inhibitor: { firstByWin: 0, firstByLoss: 0, killsByWin: 0, killsByLoss: 0 },
        riftHerald: { firstByWin: 0, firstByLoss: 0, killsByWin: 0, killsByLoss: 0 },
        horde: { firstByWin: 0, firstByLoss: 0, killsByWin: 0, killsByLoss: 0 },
      },
    })
  }
  return res.json(data)
})

/** GET /api/stats/overview-sides - winrate, champions, objectives, bans by side. Lit précalculé si version null et un seul rankTier. */
router.get('/overview-sides', async (req: Request, res: Response) => {
  const version = queryStringArray(req.query.version)
  const rankTier = queryStringArray(req.query.rankTier)
  if (version.length === 0 && rankTier.length <= 1) {
    const pre = await getPrecomputedSides(rankTier[0] ?? null)
    if (pre?.data) return res.json(pre.data)
  }
  const data = await getOverviewSidesStats(
    version.length ? version : null,
    rankTier.length ? rankTier : null
  )
  if (!data) {
    const emptyObjTable = {
      firstBlood: { firstByBlue: 0, firstByRed: 0 },
      baron: { firstByBlue: 0, firstByRed: 0, killsByBlue: 0, killsByRed: 0, distributionByBlue: {}, distributionByRed: {} },
      dragon: { firstByBlue: 0, firstByRed: 0, killsByBlue: 0, killsByRed: 0, distributionByBlue: {}, distributionByRed: {} },
      tower: { firstByBlue: 0, firstByRed: 0, killsByBlue: 0, killsByRed: 0, distributionByBlue: {}, distributionByRed: {} },
      inhibitor: { firstByBlue: 0, firstByRed: 0, killsByBlue: 0, killsByRed: 0, distributionByBlue: {}, distributionByRed: {} },
      riftHerald: { firstByBlue: 0, firstByRed: 0, killsByBlue: 0, killsByRed: 0, distributionByBlue: {}, distributionByRed: {} },
      horde: { firstByBlue: 0, firstByRed: 0, killsByBlue: 0, killsByRed: 0, distributionByBlue: {}, distributionByRed: {} },
    }
    return res.status(200).json({
      matchCount: 0,
      sideWinrate: { blue: { matches: 0, wins: 0, winrate: 0 }, red: { matches: 0, wins: 0, winrate: 0 } },
      championWinrateBySide: { blue: [], red: [] },
      championPickBySide: { blue: [], red: [] },
      objectivesBySide: {
        blue: {
          firstBlood: 0, baronFirst: 0, baronKills: 0, dragonFirst: 0, dragonKills: 0,
          towerFirst: 0, towerKills: 0, inhibitorFirst: 0, inhibitorKills: 0,
          riftHeraldFirst: 0, riftHeraldKills: 0, hordeFirst: 0, hordeKills: 0,
        },
        red: {
          firstBlood: 0, baronFirst: 0, baronKills: 0, dragonFirst: 0, dragonKills: 0,
          towerFirst: 0, towerKills: 0, inhibitorFirst: 0, inhibitorKills: 0,
          riftHeraldFirst: 0, riftHeraldKills: 0, hordeFirst: 0, hordeKills: 0,
        },
      },
      objectivesBySideTable: emptyObjTable,
      bansBySide: { blue: [], red: [] },
    })
  }
  return res.json(data)
})

/** GET /api/stats/champions - lit précalculé si disponible (version implicite null), sinon calcul live. */
router.get('/champions', async (req: Request, res: Response) => {
  res.set('Cache-Control', `public, max-age=${STATS_CACHE_MAX_AGE}`)
  const rankTier = (req.query.rankTier as string) || undefined
  const role = (req.query.role as string) || undefined
  const sqlStart = Date.now()
  const pre = await getPrecomputedChampions(rankTier ?? null, role ?? null)
  if (pre?.data) {
    const d = pre.data as { totalGames?: number; totalMatches?: number; champions?: unknown[]; generatedAt?: string | null }
    ;(res as Response & { locals: { sqlMs?: number } }).locals.sqlMs = Date.now() - sqlStart
    return res.json({
      totalGames: d.totalGames ?? 0,
      totalMatches: d.totalMatches ?? 0,
      champions: d.champions ?? [],
      generatedAt: d.generatedAt ?? null
    })
  }
  const data = await aggregator.load({ rankTier: rankTier ?? null, role: role ?? null })
  ;(res as Response & { locals: { sqlMs?: number } }).locals.sqlMs = Date.now() - sqlStart
  if (!data) {
    return res.status(200).json({
      totalGames: 0,
      totalMatches: 0,
      champions: [],
      generatedAt: null,
      message: 'No stats yet. Run match collection and aggregation first.'
    })
  }
  return res.json({
    totalGames: data.totalGames,
    totalMatches: data.totalMatches,
    champions: data.champions,
    generatedAt: data.generatedAt
  })
})

router.get('/champions/:championId', async (req: Request, res: Response) => {
  const championIdParam = req.params.championId
  if (Array.isArray(championIdParam)) {
    return res.status(400).json({ error: 'Invalid champion ID' })
  }
  const championId = parseInt(championIdParam, 10)
  if (Number.isNaN(championId)) {
    return res.status(400).json({ error: 'Invalid champion ID' })
  }
  const rankTier = (req.query.rankTier as string) || undefined
  const role = (req.query.role as string) || undefined
  const data = await aggregator.load({ rankTier: rankTier ?? null, role: role ?? null })
  if (!data) {
    return res.status(404).json({ error: 'No stats available' })
  }
  const row = data.champions.find((c: { championId: number }) => c.championId === championId)
  if (!row) {
    return res.status(404).json({ error: 'Champion not found in stats' })
  }
  return res.json({
    championId: row.championId,
    games: row.games,
    wins: row.wins,
    winrate: row.winrate,
    pickrate: row.pickrate,
    banrate: row.banrate,
    presence: row.presence,
    byRole: row.byRole,
    totalGames: data.totalGames,
    generatedAt: data.generatedAt
  })
})

/** GET /api/stats/champions/:championId/duration-winrate - duration (5-min buckets) vs winrate for this champion. Query: ?version=16.1 &rankTier=GOLD */
router.get('/champions/:championId/duration-winrate', async (req: Request, res: Response) => {
  const championId = parseInt(String(req.params.championId), 10)
  if (Number.isNaN(championId)) {
    return res.status(400).json({ error: 'Invalid championId' })
  }
  const version = queryString(req.query.version)
  const rankTier = queryString(req.query.rankTier)
  const data = await getDurationWinrateByChampion(championId, version, rankTier)
  if (!data) {
    return res.status(200).json({ buckets: [] })
  }
  return res.json(data)
})

/** GET /api/stats/champions/:championId/builds */
router.get('/champions/:championId/builds', async (req: Request, res: Response) => {
  const raw = req.params.championId
  const championId = parseInt(Array.isArray(raw) ? raw[0] : raw, 10)
  if (Number.isNaN(championId)) {
    return res.status(400).json({ error: 'Invalid champion ID' })
  }
  const rankTier = (req.query.rankTier as string) || undefined
  const role = (req.query.role as string) || undefined
  const patch = (req.query.patch as string) || undefined
  const minGames = req.query.minGames != null ? parseInt(String(req.query.minGames), 10) : 10
  const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 20
  const data = await getBuildsByChampion({
    championId,
    rankTier: rankTier ?? null,
    role: role ?? null,
    patch: patch ?? null,
    minGames,
    limit,
  })
  if (!data) {
    return res.status(200).json({ totalGames: 0, builds: [], message: 'No stats yet.' })
  }
  return res.json(data)
})

/** GET /api/stats/champions/:championId/runes */
router.get('/champions/:championId/runes', async (req: Request, res: Response) => {
  const rawR = req.params.championId
  const championId = parseInt(Array.isArray(rawR) ? rawR[0] : rawR, 10)
  if (Number.isNaN(championId)) {
    return res.status(400).json({ error: 'Invalid champion ID' })
  }
  const rankTier = (req.query.rankTier as string) || undefined
  const patch = (req.query.patch as string) || undefined
  const minGames = req.query.minGames != null ? parseInt(String(req.query.minGames), 10) : 10
  const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 20
  const data = await getRunesByChampion({
    championId,
    rankTier: rankTier ?? null,
    patch: patch ?? null,
    minGames,
    limit,
  })
  if (!data) {
    return res.status(200).json({ totalGames: 0, runes: [], message: 'No stats yet.' })
  }
  return res.json(data)
})

/** GET /api/stats/champions/:championId/runes-per-rune - per-rune pick/win for champion (like stats runes tab). Query: ?version=16.1 &rankTier=GOLD &minGames=10 */
router.get('/champions/:championId/runes-per-rune', async (req: Request, res: Response) => {
  const rawR = req.params.championId
  const championId = parseInt(Array.isArray(rawR) ? rawR[0] : rawR, 10)
  if (Number.isNaN(championId)) {
    return res.status(400).json({ error: 'Invalid champion ID' })
  }
  const version = queryString(req.query.version)
  const rankTier = queryString(req.query.rankTier)
  const minGames = req.query.minGames != null ? parseInt(String(req.query.minGames), 10) : 10
  const data = await getRuneStatsByChampion({
    championId,
    version: version ?? null,
    rankTier: rankTier ?? null,
    minGames,
  })
  if (!data) {
    return res.status(200).json({ totalGames: 0, runes: [], message: 'No stats yet.' })
  }
  return res.json(data)
})

/** GET /api/stats/champions/:championId/matchups - winrate vs each opponent. Query: ?version=16.1 &rankTier=GOLD &minGames=10 */
router.get('/champions/:championId/matchups', async (req: Request, res: Response) => {
  const rawR = req.params.championId
  const championId = parseInt(Array.isArray(rawR) ? rawR[0] : rawR, 10)
  if (Number.isNaN(championId)) {
    return res.status(400).json({ error: 'Invalid champion ID' })
  }
  const version = queryString(req.query.version)
  const rankTier = queryString(req.query.rankTier)
  const minGames = req.query.minGames != null ? parseInt(String(req.query.minGames), 10) : 10
  const data = await getMatchupsByChampion({
    championId,
    version: version ?? null,
    rankTier: rankTier ?? null,
    minGames,
  })
  if (!data) {
    return res.status(200).json({ matchups: [], message: 'No stats yet.' })
  }
  return res.json(data)
})

/** GET /api/stats/champions/:championId/matchups-tier - matchup score/tier rows for one champion.
 * Query: ?patch=16.4 or ?version=16.4.1&rankTier=GOLD&lane=TOP&minGames=10
 */
router.get('/champions/:championId/matchups-tier', async (req: Request, res: Response) => {
  const raw = req.params.championId
  const championId = parseInt(Array.isArray(raw) ? raw[0] : raw, 10)
  if (Number.isNaN(championId) || championId <= 0) {
    return res.status(400).json({ error: 'Invalid champion ID' })
  }
  const patch = resolvePatchFromQuery(req.query.patch, req.query.version)
  if (!patch) {
    return res.status(400).json({ error: 'Missing patch/version for matchup-tier query' })
  }
  const rankTier = queryString(req.query.rankTier)
  const lane = queryString(req.query.lane) ?? queryString(req.query.role)
  const minGames = req.query.minGames != null ? parseInt(String(req.query.minGames), 10) : 10
  const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 100
  const data = await getMatchupDetailsByChampion({
    championId,
    patch,
    rankTier: rankTier ?? null,
    lane: lane ?? null,
    minGames,
    limit,
  })
  return res.json({ patch, championId, matchups: data })
})

/** GET /api/stats/matchup-tier-list - champion tier rows from matchup scores.
 * Query: ?patch=16.4 or ?version=16.4.1&rankTier=GOLD&lane=TOP&minGames=20
 */
router.get('/matchup-tier-list', async (req: Request, res: Response) => {
  const patch = resolvePatchFromQuery(req.query.patch, req.query.version)
  if (!patch) {
    return res.status(400).json({ error: 'Missing patch/version for matchup-tier-list query' })
  }
  const rankTier = queryString(req.query.rankTier)
  const lane = queryString(req.query.lane) ?? queryString(req.query.role)
  const minGames = req.query.minGames != null ? parseInt(String(req.query.minGames), 10) : 20
  const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 300
  const rows = await getTierListByLane({
    patch,
    rankTier: rankTier ?? null,
    lane: lane ?? null,
    minGames,
    limit,
  })
  return res.json({
    patch,
    rankTier: rankTier ?? null,
    lane: lane ?? null,
    rows,
  })
})

/** GET /api/stats/champions/:championId/summoner-spells - per-spell stats for this champion. Query: ?version=16.1 &rankTier=GOLD */
router.get('/champions/:championId/summoner-spells', async (req: Request, res: Response) => {
  const rawR = req.params.championId
  const championId = parseInt(Array.isArray(rawR) ? rawR[0] : rawR, 10)
  if (Number.isNaN(championId)) {
    return res.status(400).json({ error: 'Invalid champion ID' })
  }
  const version = queryString(req.query.version)
  const rankTier = queryString(req.query.rankTier)
  const data = await getSummonerSpellsByChampion(championId, version, rankTier)
  if (!data) {
    return res.status(200).json({ totalGames: 0, spells: [], message: 'No stats yet.' })
  }
  return res.json(data)
})

/** GET /api/stats/champions/:championId/summoner-spells-duos - spell pairs for this champion. Query: ?version=16.1 &rankTier=GOLD */
router.get('/champions/:championId/summoner-spells-duos', async (req: Request, res: Response) => {
  const rawR = req.params.championId
  const championId = parseInt(Array.isArray(rawR) ? rawR[0] : rawR, 10)
  if (Number.isNaN(championId)) {
    return res.status(400).json({ error: 'Invalid champion ID' })
  }
  const version = queryString(req.query.version)
  const rankTier = queryString(req.query.rankTier)
  const data = await getSummonerSpellsDuosByChampion(championId, version, rankTier)
  if (!data) {
    return res.status(200).json({ totalGames: 0, duos: [], message: 'No stats yet.' })
  }
  return res.json(data)
})

/** GET /api/stats/players/search?name=... - lookup player by summoner name */
router.get('/players/search', async (req: Request, res: Response) => {
  const name = (req.query.name as string)?.trim()
  if (!name) {
    return res.status(400).json({ error: 'Query "name" is required' })
  }
  const player = await getPlayerBySummonerName(name)
  if (!player) {
    return res.status(404).json({ error: 'Player not found' })
  }
  const championStats = await getChampionStatsForPlayer(player.puuid)
  return res.json({ player, championStats })
})

/** GET /api/stats/players - meilleurs joueurs (classement général). Par défaut Master → Challenger uniquement (stats globale). */
router.get('/players', async (req: Request, res: Response) => {
  const rankTier = (req.query.rankTier as string) || undefined
  const highRankOnly = req.query.highRankOnly !== '0' && req.query.highRankOnly !== 'false'
  const minGames = req.query.minGames != null ? parseInt(String(req.query.minGames), 10) : 50
  const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 100
  const list = await getTopPlayers({
    rankTier: rankTier ?? null,
    highRankOnly,
    minGames,
    limit,
  })
  return res.json({ players: list })
})

/** GET /api/stats/champions/:championId/players - meilleurs joueurs sur un champion */
router.get('/champions/:championId/players', async (req: Request, res: Response) => {
  const raw = req.params.championId
  const championId = parseInt(Array.isArray(raw) ? raw[0] : raw, 10)
  if (Number.isNaN(championId)) {
    return res.status(400).json({ error: 'Invalid champion ID' })
  }
  const rankTier = (req.query.rankTier as string) || undefined
  const highRankOnly = req.query.highRankOnly === '1' || req.query.highRankOnly === 'true'
  const minGames = req.query.minGames != null ? parseInt(String(req.query.minGames), 10) : 20
  const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 50
  const list = await getTopPlayersByChampion({
    championId,
    rankTier: rankTier ?? null,
    highRankOnly,
    minGames,
    limit,
  })
  return res.json({
    players: list.map((p) => ({ ...p, totalGames: p.games })),
  })
})

/** POST /api/stats/aggregate - recalculer les agrégats (admin / cron) */
router.post('/aggregate', async (_req: Request, res: Response) => {
  try {
    const data = await aggregator.computeAndSave()
    return res.json({
      ok: true,
      totalGames: data.totalGames,
      championsCount: data.champions.length,
      generatedAt: data.generatedAt
    })
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Aggregation failed'
    })
  }
})

/** POST /api/stats/refresh-players - no-op: total_games/total_wins via view players_with_stats */
router.post('/refresh-players', async (_req: Request, res: Response) => {
  try {
    return res.json({
      ok: true,
      message: 'Stats computed from view players_with_stats, no refresh needed',
    })
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Refresh failed',
    })
  }
})

export default router
