/**
 * API statistiques LoL (agrégats uniquement, pas de données brutes).
 * GET /api/stats/champions - liste winrate/pickrate par champion
 * GET /api/stats/champions/:championId - détail par champion (et par rôle)
 */
import { Router, Request, Response } from 'express'
import { RiotStatsAggregator } from '../services/RiotStatsAggregator.js'

const router = Router()
const aggregator = new RiotStatsAggregator()

router.get('/champions', async (_req: Request, res: Response) => {
  const data = await aggregator.load()
  if (!data) {
    return res.status(200).json({
      totalGames: 0,
      champions: [],
      generatedAt: null,
      message: 'No stats yet. Run match collection and aggregation first.'
    })
  }
  return res.json({
    totalGames: data.totalGames,
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
  const data = await aggregator.load()
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

export default router
