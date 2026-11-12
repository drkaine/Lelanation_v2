/**
 * Routes for the companion app: track download, download stats, optional ranked match hints from the desktop app.
 */
import { Router, type Request, type Response } from 'express'
import { isAbsolute, join } from 'path'
import { promises as fs } from 'fs'
import { tryReserveTrackedMatch } from '../worker/matchTrackingReserve.js'
import { getCompanionChampionBenchmark } from '../services/CompanionBenchmarkService.js'
import { normalizePatchMajorMinor } from '../services/statsAggArchive.js'
import { createRateLimit } from '../utils/httpRateLimit.js'
import { bumpDownloadStats, createSerialQueue, type DownloadStats } from '../utils/downloadStats.js'

const router = Router()

const TRACKED_MATCH_ID_RE = /^[A-Z0-9]+_\d+$/
// Keyed on req.ip (trusted proxy only): a client cannot dodge it with its own X-Forwarded-For.
const trackedMatchRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  keyPrefix: 'app-tracked-match',
})
const trackDownloadRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyPrefix: 'app-track-download',
})

const DOWNLOAD_STATS_PATH = join(process.cwd(), 'data', 'download-stats.json')

const downloadStatsQueue = createSerialQueue()

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

router.post('/track-download', trackDownloadRateLimit, async (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().slice(0, 10)
    await downloadStatsQueue(async () => {
      await writeDownloadStats(bumpDownloadStats(await readDownloadStats(), today))
    })
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
 * GET /api/app/download — public companion installer (same sources as admin route).
 */
router.get('/download', async (_req: Request, res: Response) => {
  const externalDownloadUrl = process.env.COMPANION_APP_DOWNLOAD_URL?.trim()
  if (externalDownloadUrl) {
    return res.json({ redirect: externalDownloadUrl })
  }
  const defaultPath = join(process.cwd(), 'data', 'releases', 'lelanation-companion-setup.exe')
  const raw = process.env.COMPANION_APP_INSTALLER_PATH
  const absolutePath = raw ? (isAbsolute(raw) ? raw : join(process.cwd(), raw)) : defaultPath
  try {
    await fs.access(absolutePath)
  } catch {
    return res.status(404).json({
      error: 'Installer not available',
      hint: 'Set COMPANION_APP_INSTALLER_PATH or place the installer in data/releases/',
    })
  }
  const filename = absolutePath.split(/[/\\]/).pop() ?? 'lelanation-companion-setup.exe'
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  return res.sendFile(absolutePath)
})

/**
 * POST /api/app/submit-tracked-match — companion opt-in: reserve a ranked match id for poller ingestion (no PII).
 */
router.post('/submit-tracked-match', trackedMatchRateLimit, async (req: Request, res: Response) => {
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

function queryString(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  return value.trim()
}

function normalizeRankTierParam(raw: string | null): string | null {
  if (!raw) return null
  const tier = raw.trim().split(/\s+/)[0]?.toUpperCase()
  if (!tier || tier === 'UNRANKED') return null
  return tier
}

function normalizeRoleParam(raw: string | null): string | null {
  if (!raw) return null
  const r = raw.trim().toUpperCase()
  if (r === 'MID' || r === 'MIDLANE') return 'MIDDLE'
  if (r === 'BOT' || r === 'ADC') return 'BOTTOM'
  if (r === 'SUP' || r === 'SUPPORT') return 'UTILITY'
  if (r === 'JGL') return 'JUNGLE'
  return r
}

/**
 * GET /api/app/companion/champion-benchmark
 * Average stats for a champion at a given patch / rank / role (companion ranked recap).
 * Query: ?championId=83&patch=16.13&rankTier=GOLD&role=TOP
 */
router.get('/companion/champion-benchmark', async (req: Request, res: Response) => {
  const championId = parseInt(String(req.query.championId ?? ''), 10)
  if (!Number.isFinite(championId) || championId <= 0) {
    return res.status(400).json({ error: 'Invalid championId' })
  }
  const patchRaw = queryString(req.query.patch) ?? queryString(req.query.version)
  const patch = patchRaw ? normalizePatchMajorMinor(patchRaw) : null
  const rankTier = normalizeRankTierParam(queryString(req.query.rankTier))
  const role = normalizeRoleParam(queryString(req.query.role))

  try {
    const data = await getCompanionChampionBenchmark({
      championId,
      version: patch,
      rankTier,
      role,
    })
    if (!data) {
      return res.status(200).json({
        championId,
        games: 0,
        metrics: {},
        avgDamageToChampions: null,
        winrate: null,
      })
    }
    res.set('Cache-Control', 'public, max-age=120')
    return res.json(data)
  } catch (e) {
    console.warn('[app/companion/champion-benchmark]', e)
    return res.status(500).json({ error: 'Benchmark query failed' })
  }
})

export default router
