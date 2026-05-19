/**
 * Routes for the companion app: track download, download stats, optional ranked match hints from the desktop app.
 */
import { Router, type Request, type Response } from 'express'
import { join } from 'path'
import { promises as fs } from 'fs'
import { tryReserveTrackedMatch } from '../worker/processedMatchReserve.js'

const router = Router()

const TRACKED_MATCH_ID_RE = /^[A-Z0-9]+_\d+$/
const RL_WINDOW_MS = 60 * 60 * 1000
const RL_MAX = 100
const rlBuckets = new Map<string, number[]>()

function clientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0]?.trim().slice(0, 80) ?? 'unknown'
  }
  if (Array.isArray(xff) && xff[0]) {
    return String(xff[0]).trim().slice(0, 80)
  }
  return req.socket.remoteAddress?.slice(0, 80) ?? 'unknown'
}

function rateLimitOk(ip: string): boolean {
  const now = Date.now()
  const arr = (rlBuckets.get(ip) ?? []).filter((t) => now - t < RL_WINDOW_MS)
  if (arr.length >= RL_MAX) return false
  arr.push(now)
  rlBuckets.set(ip, arr)
  return true
}

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

/**
 * POST /api/app/submit-tracked-match — companion opt-in: reserve a ranked match id for poller ingestion (no PII).
 */
router.post('/submit-tracked-match', async (req: Request, res: Response) => {
  const ip = clientIp(req)
  if (!rateLimitOk(ip)) {
    return res.status(429).json({ error: 'Too many requests' })
  }
  const matchId = typeof req.body?.matchId === 'string' ? req.body.matchId.trim() : ''
  if (!TRACKED_MATCH_ID_RE.test(matchId)) {
    return res.status(400).json({ error: 'Invalid matchId' })
  }
  try {
    const reserved = await tryReserveTrackedMatch(matchId)
    return res.json({ ok: true, reserved })
  } catch (e) {
    console.warn('[app/submit-tracked-match]', e)
    return res.status(500).json({ error: 'Server error' })
  }
})

export default router
