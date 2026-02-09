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
import { refreshPlayersAndChampionStats } from '../services/StatsPlayersRefreshService.js'
import { getOverviewStats } from '../services/StatsOverviewService.js'

const router = Router()
const aggregator = new RiotStatsAggregator()

/** GET /api/stats/overview - total matches, last update, top winrate champions, matches per division, player count */
router.get('/overview', async (_req: Request, res: Response) => {
  const data = await getOverviewStats()
  if (!data) {
    return res.status(200).json({
      totalMatches: 0,
      lastUpdate: null,
      topWinrateChampions: [],
      matchesByDivision: [],
      matchesByVersion: [],
      playerCount: 0,
      message: 'No stats yet. Run match collection first.',
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

/** POST /api/stats/refresh-players - rafraîchir players (totalGames, totalWins) depuis participants */
router.post('/refresh-players', async (_req: Request, res: Response) => {
  try {
    const result = await refreshPlayersAndChampionStats()
    return res.json({
      ok: true,
      playersUpserted: result.playersUpserted,
      championStatsUpserted: result.championStatsUpserted,
    })
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Refresh failed',
    })
  }
})

export default router
