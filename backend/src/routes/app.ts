/**
 * Routes for the companion app: submit match ID + region for ingestion.
 * POST /api/app/match — body: { matchId, region }. Rate limited per IP.
 */
import { Router, type Request, type Response } from 'express'
import { join } from 'path'
import { promises as fs } from 'fs'
import { getRiotApiService } from '../services/RiotApiService.js'
import { upsertMatchFromRiot } from '../services/MatchCollectService.js'
import { fetchRanksForPuuids } from '../services/StatsPlayersRefreshService.js'
import { isEuropePlatform, normalizeEuropeRegion, type EuropePlatform } from '../utils/riotRegions.js'
import { isDatabaseConfigured, prisma } from '../db.js'

const router = Router()

/** Rate limit: max requests per window per IP. */
const APP_MATCH_RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const APP_MATCH_RATE_LIMIT_MAX = 10
const ipTimestamps = new Map<string, number[]>()

function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string') return xff.split(',')[0].trim()
  if (Array.isArray(xff) && xff[0]) return String(xff[0]).trim()
  return req.socket?.remoteAddress ?? 'unknown'
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const cutoff = now - APP_MATCH_RATE_LIMIT_WINDOW_MS
  let timestamps = ipTimestamps.get(ip) ?? []
  timestamps = timestamps.filter((t) => t > cutoff)
  if (timestamps.length >= APP_MATCH_RATE_LIMIT_MAX) return true
  timestamps.push(now)
  ipTimestamps.set(ip, timestamps)
  return false
}

/**
 * POST /api/app/match
 * Body: { matchId: string, region: string } (region = euw1 | eun1 | tr1 | ru | me1).
 * Fetches match from Riot Match-v5 (Europe), upserts match + participants, upserts players.
 */
router.post('/match', async (req: Request, res: Response) => {
  const ip = getClientIp(req)
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests', retryAfter: 60 })
  }

  const matchId = typeof req.body?.matchId === 'string' ? req.body.matchId.trim() : ''
  const rawRegion = typeof req.body?.region === 'string' ? req.body.region.trim() : ''

  if (!matchId) {
    return res.status(400).json({ error: 'Missing or invalid matchId' })
  }

  const region = normalizeEuropeRegion(rawRegion)
  if (!region) {
    return res.status(400).json({
      error: 'Missing or invalid region',
      allowed: ['euw1', 'eun1', 'tr1', 'ru', 'me1'],
    })
  }

  if (!isDatabaseConfigured()) {
    return res.status(503).json({ error: 'Database not configured' })
  }

  try {
    const riotApi = getRiotApiService()
    const matchResult = await riotApi.getMatch(matchId)
    if (matchResult.isErr()) {
      const err = matchResult.unwrapErr()
      const status = err.cause && typeof (err.cause as { response?: { status?: number } }).response?.status === 'number'
        ? (err.cause as { response: { status: number } }).response.status
        : 500
      if (status === 404) {
        return res.status(404).json({ error: 'Match not found' })
      }
      if (status === 429) {
        return res.status(429).json({ error: 'Riot API rate limit', retryAfter: 60 })
      }
      return res.status(502).json({ error: 'Riot API error', message: err.message })
    }

    const matchData = matchResult.unwrap()
    const info = matchData.info
    if (!info || info.queueId !== 420) {
      return res.status(400).json({ error: 'Not a Ranked Solo/Duo match (queue 420)' })
    }

    const platformId = (info as { platformId?: unknown }).platformId
    const payloadPlatform = typeof platformId === 'string' ? platformId.toLowerCase() : ''
    const resolvedRegion: EuropePlatform = isEuropePlatform(payloadPlatform) ? (payloadPlatform as EuropePlatform) : region

    const participants = info.participants ?? []
    const puuids = participants
      .map((p: { puuid?: string }) => (typeof p.puuid === 'string' ? p.puuid.trim() : ''))
      .filter((puuid: string) => puuid !== '')

    let rankByPuuid: Map<string, { tier: string; rank: string; leaguePoints: number } | null> | undefined
    try {
      rankByPuuid = await fetchRanksForPuuids(resolvedRegion, puuids)
    } catch {
      // optional: proceed without ranks
    }

    const { inserted } = await upsertMatchFromRiot(resolvedRegion, matchData, rankByPuuid)
    if (inserted) {
      for (const p of participants) {
        const participantPuuid = typeof p.puuid === 'string' ? p.puuid.trim() : ''
        if (!participantPuuid) continue
        await prisma.player.upsert({
          where: { puuid: participantPuuid },
          create: { puuid: participantPuuid, region: resolvedRegion, lastSeen: null },
          update: {},
        })
      }
    }

    return res.status(inserted ? 201 : 200).json({ ok: true, inserted })
  } catch (e) {
    console.error('[app/match]', e)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

const DOWNLOAD_STATS_PATH = join(process.cwd(), 'data', 'download-stats.json')

interface DownloadStats {
  total: number
  daily: Record<string, number>
}

async function readDownloadStats(): Promise<DownloadStats> {
  try {
    const raw = await fs.readFile(DOWNLOAD_STATS_PATH, 'utf-8')
    return JSON.parse(raw) as DownloadStats
  } catch {
    return { total: 0, daily: {} }
  }
}

async function writeDownloadStats(stats: DownloadStats): Promise<void> {
  const dir = join(process.cwd(), 'data')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(DOWNLOAD_STATS_PATH, JSON.stringify(stats, null, 2))
}

router.post('/track-download', async (_req: Request, res: Response) => {
  try {
    const stats = await readDownloadStats()
    const today = new Date().toISOString().slice(0, 10)
    stats.total += 1
    stats.daily[today] = (stats.daily[today] || 0) + 1
    await writeDownloadStats(stats)
    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Failed to track download' })
  }
})

router.get('/download-stats', async (_req: Request, res: Response) => {
  try {
    const stats = await readDownloadStats()
    return res.json(stats)
  } catch {
    return res.status(500).json({ error: 'Failed to read download stats' })
  }
})

export default router
