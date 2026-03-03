/**
 * Routes for the companion app: track download, download stats.
 * (Riot match ingestion removed.)
 */
import { Router, type Request, type Response } from 'express'
import { join } from 'path'
import { promises as fs } from 'fs'

const router = Router()

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
