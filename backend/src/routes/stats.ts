/**
 * API statistiques LoL (agrégats uniquement, pas de données brutes).
 * Champions, builds, runes, meilleurs joueurs.
 */
import { Router, Request, Response } from 'express'
import { RiotStatsAggregator } from '../services/RiotStatsAggregator.js'
import { getBuildsByChampion } from '../services/StatsBuildsService.js'
import { getRunesByChampion } from '../services/StatsRunesService.js'
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
  getOverviewProgressionStats,
} from '../services/StatsOverviewService.js'
import { isDatabaseConfigured } from '../db.js'

const router = Router()
const aggregator = new RiotStatsAggregator()

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

/** GET /api/stats/overview - total matches, last update, top winrate champions, matches per division, player count. Query: ?version=16.1 &rankTier=GOLD */
router.get('/overview', async (req: Request, res: Response) => {
  const version = queryString(req.query.version)
  const rankTier = queryString(req.query.rankTier)
  const data = await getOverviewStats(version, rankTier)
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

/** GET /api/stats/overview-detail - runes, rune sets, items, item sets, items by order, summoner spells. Query: ?version=16.1 &rankTier=GOLD */
router.get('/overview-detail', async (req: Request, res: Response) => {
  const version = queryString(req.query.version)
  const rankTier = queryString(req.query.rankTier)
  const data = await getOverviewDetailStats(version, rankTier)
  if (!data) {
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

/** GET /api/stats/overview-duration-winrate - duration (5-min buckets) vs winrate. Query: ?version=16.1 &rankTier=GOLD */
router.get('/overview-duration-winrate', async (req: Request, res: Response) => {
  const version = queryString(req.query.version)
  const rankTier = queryString(req.query.rankTier)
  const data = await getOverviewDurationWinrateStats(version, rankTier)
  if (!data) {
    return res.status(200).json({ buckets: [] })
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

/** GET /api/stats/overview-teams - bans and objectives (first + kills) by win/loss from matches.teams. Query: ?version=16.1 &rankTier=GOLD */
router.get('/overview-teams', async (req: Request, res: Response) => {
  const version = queryString(req.query.version)
  const rankTier = queryString(req.query.rankTier)
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

/** GET /api/stats/overview-sides - winrate, champions, objectives, bans by side. Query: ?version=16.1&version=16.2&rankTier=GOLD&rankTier=PLATINUM (multi-select) */
router.get('/overview-sides', async (req: Request, res: Response) => {
  const version = queryStringArray(req.query.version)
  const rankTier = queryStringArray(req.query.rankTier)
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

router.get('/champions', async (req: Request, res: Response) => {
  const rankTier = (req.query.rankTier as string) || undefined
  const role = (req.query.role as string) || undefined
  const data = await aggregator.load({ rankTier: rankTier ?? null, role: role ?? null })
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
    byRole: row.byRole,
    totalGames: data.totalGames,
    generatedAt: data.generatedAt
  })
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

/** GET /api/stats/players - meilleurs joueurs (classement général) */
router.get('/players', async (req: Request, res: Response) => {
  const rankTier = (req.query.rankTier as string) || undefined
  const minGames = req.query.minGames != null ? parseInt(String(req.query.minGames), 10) : 50
  const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 100
  const list = await getTopPlayers({
    rankTier: rankTier ?? null,
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
  const minGames = req.query.minGames != null ? parseInt(String(req.query.minGames), 10) : 20
  const limit = req.query.limit != null ? parseInt(String(req.query.limit), 10) : 50
  const list = await getTopPlayersByChampion({
    championId,
    rankTier: rankTier ?? null,
    minGames,
    limit,
  })
  return res.json({ players: list })
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
