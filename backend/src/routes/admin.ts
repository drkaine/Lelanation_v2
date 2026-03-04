import { spawn } from 'child_process'
import { Router } from 'express'
import { promises as fs } from 'fs'
import { dirname, join, isAbsolute } from 'path'
import { fileURLToPath } from 'url'
import { MetricsService } from '../services/MetricsService.js'
import { CronStatusService, type CronJobKey, type CronJobStatus } from '../services/CronStatusService.js'
import { VersionService } from '../services/VersionService.js'
import { YouTubeService } from '../services/YouTubeService.js'
import {
  getTierListByLane,
  getMatchupDetailsByChampion,
  rebuildMatchupTierScores,
} from '../services/MatchupTierService.js'
import { runStatsPrecomputedRefreshOnce } from '../cron/statsPrecomputedRefresh.js'
import { runDataDragonSyncOnce } from '../cron/dataDragonSync.js'
import { runYouTubeSyncOnce } from '../cron/youtubeSync.js'
import { runCommunityDragonSyncOnce } from '../cron/communityDragonSync.js'
import { prisma } from '../db.js'
import { FileManager } from '../utils/fileManager.js'
import {
  getRiotPollerStatus,
  requestStopRiotPoller,
  startRiotPoller,
  isRiotPollerRunning,
} from '../worker/riotPoller.js'

type YouTubeChannelsConfig = { channels: Array<{ channelId: string; channelName: string } | string> }
type StoredChannelData = { channelId: string; channelName?: string; lastSync?: string; videos?: Array<unknown> }

const CONTACT_TYPES = ['suggestion', 'bug', 'reclamation', 'autre'] as const
type ContactType = (typeof CONTACT_TYPES)[number]
interface ContactEntry {
  name: string
  message: string
  date: string
  contact?: string
}
type ContactData = Record<ContactType, ContactEntry[]>

const router = Router()
const metrics = MetricsService.getInstance()
const cronStatus = new CronStatusService()
const versionService = new VersionService()
const youtubeService = new YouTubeService()

const __dirnameAdmin = dirname(fileURLToPath(import.meta.url))
const backendRoot = join(__dirnameAdmin, '..', '..')
const youtubeConfigFile = join(process.cwd(), 'data', 'youtube', 'channels.json')
const youtubeDataDir = join(process.cwd(), 'data', 'youtube')
const frontendYouTubeDir = join(process.cwd(), '..', 'frontend', 'public', 'data', 'youtube')
const contactFilePath = join(process.cwd(), 'data', 'contact.json')
const buildsDir = join(process.cwd(), 'data', 'builds')

function parseBasicAuth(authHeader: string): { username: string; password: string } | null {
  const [scheme, token] = authHeader.split(' ')
  if (scheme !== 'Basic' || !token) return null
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8')
    const idx = decoded.indexOf(':')
    if (idx === -1) return null
    return { username: decoded.slice(0, idx), password: decoded.slice(idx + 1) }
  } catch {
    return null
  }
}

// Basic auth for admin API (supports ADMIN_USER_NAME or ADMIN_USERNAME)
router.use((req, res, next) => {
  const user = process.env.ADMIN_USER_NAME ?? process.env.ADMIN_USERNAME
  const pass = process.env.ADMIN_PASSWORD
  if (!user || !pass) return next() // dev convenience

  const header = req.header('authorization')
  if (!header) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin"')
    return res.status(401).json({ error: 'Authentication required' })
  }
  const parsed = parseBasicAuth(header)
  if (!parsed || parsed.username !== user || parsed.password !== pass) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin"')
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  return next()
})

router.get('/me', (_req, res) => {
  return res.json({ ok: true })
})

router.get('/metrics', async (_req, res) => {
  return res.json(metrics.snapshot())
})

router.get('/cron', async (_req, res) => {
  const cronFile = await cronStatus.getStatus()
  const cronRaw = cronFile.isOk() ? (cronFile.unwrap() as any) : null
  const cronJobs = cronRaw?.jobs ?? null

  const versionResult = await versionService.getCurrentVersion()
  const gameVersion = versionResult.isOk() ? versionResult.unwrap() : null

  const ytConfigResult = await FileManager.readJson<YouTubeChannelsConfig>(youtubeConfigFile)
  const ytConfig = ytConfigResult.isOk() ? ytConfigResult.unwrap() : { channels: [] }

  const ytStatus = await Promise.all(
    (ytConfig.channels ?? []).map(async (entry) => {
      const channelId = typeof entry === 'string' ? entry : entry.channelId
      const channelName = typeof entry === 'string' ? entry : entry.channelName
      const backendPath = join(youtubeDataDir, `${channelId}.json`)
      const frontendPath = join(frontendYouTubeDir, `${channelId}.json`)
      let filePath = backendPath
      let exists = await FileManager.exists(filePath)
      if (!exists) {
        filePath = frontendPath
        exists = await FileManager.exists(filePath)
      }
      if (!exists) {
        return { channelId, channelName, synced: false, lastSync: null, videoCount: 0 }
      }
      const dataResult = await FileManager.readJson<StoredChannelData>(filePath)
      if (dataResult.isErr()) {
        return { channelId, channelName, synced: false, lastSync: null, videoCount: 0, error: dataResult.unwrapErr().message }
      }
      const data = dataResult.unwrap()
      const videoCount = Array.isArray(data.videos) ? data.videos.length : 0
      return {
        channelId: data.channelId || channelId,
        channelName: data.channelName || channelName,
        synced: true,
        lastSync: data.lastSync || null,
        videoCount
      }
    })
  )

  return res.json({
    cronJobs,
    dataDragon: {
      currentVersion: gameVersion?.currentVersion || null,
      lastSyncDate: gameVersion?.lastSyncDate || null,
      lastSyncTimestamp: gameVersion?.lastSyncTimestamp || null
    },
    youtube: {
      channels: ytStatus
    }
  })
})

// --- Contact (admin) ---
function emptyContactData(): ContactData {
  return { suggestion: [], bug: [], reclamation: [], autre: [] }
}

router.get('/contact', async (_req, res) => {
  const result = await FileManager.readJson<ContactData>(contactFilePath)
  if (result.isErr()) {
    if (result.unwrapErr().code === 'FILE_NOT_FOUND') {
      return res.json(emptyContactData())
    }
    return res.status(500).json({ error: result.unwrapErr().message })
  }
  const data = result.unwrap()
  const out: ContactData = emptyContactData()
  for (const key of CONTACT_TYPES) {
    if (Array.isArray(data[key])) out[key] = data[key]
  }
  return res.json(out)
})

router.delete('/contact/:type/:index', async (req, res) => {
  const type = req.params.type as ContactType
  const index = parseInt(req.params.index, 10)
  if (!CONTACT_TYPES.includes(type) || !Number.isInteger(index) || index < 0) {
    return res.status(400).json({ error: 'Invalid type or index' })
  }

  const result = await FileManager.readJson<ContactData>(contactFilePath)
  if (result.isErr()) {
    if (result.unwrapErr().code === 'FILE_NOT_FOUND') return res.json({ ok: true })
    return res.status(500).json({ error: result.unwrapErr().message })
  }
  const data = result.unwrap()
  const arr = Array.isArray(data[type]) ? data[type] : []
  if (index >= arr.length) {
    return res.status(404).json({ error: 'Entry not found' })
  }
  arr.splice(index, 1)
  data[type] = arr
  const writeResult = await FileManager.writeJson(contactFilePath, data)
  if (writeResult.isErr()) {
    return res.status(500).json({ error: writeResult.unwrapErr().message })
  }
  return res.json({ ok: true })
})

// --- Sync data (DDragon + Community Dragon + YouTube) — script optionnel ---
router.post('/sync-data', (_req, res) => {
  res.status(202).json({
    success: true,
    message: 'Sync données (Data Dragon, Community Dragon, YouTube) lancé en arrière-plan. Consultez les logs si besoin.',
  })
  const child = spawn('npm', ['run', 'sync:data'], {
    cwd: backendRoot,
    detached: true,
    stdio: 'ignore',
    env: process.env,
  })
  child.unref()
})

// --- Rafraîchir les tables stats pré-calculées (job horaire; déclenchement manuel possible) ---
router.post('/refresh-precomputed-stats', (_req, res) => {
  res.status(202).json({
    success: true,
    message: 'Rafraîchissement des stats pré-calculées lancé en arrière-plan. Comptez quelques minutes.',
  })
  runStatsPrecomputedRefreshOnce()
    .then((r) => {
      if (r.ok) console.log('[admin] refresh-precomputed-stats ok, entries:', r.refreshed?.length ?? 0)
      else console.warn('[admin] refresh-precomputed-stats failed:', r.error)
    })
    .catch((e) => console.error('[admin] refresh-precomputed-stats error:', e))
})


/** GET /api/admin/data-stats - stats for Data tab (matches without rank, last new player, etc.). No summonerName. */
router.get('/data-stats', async (_req, res) => {
  let dataStats = { matchesWithoutRank: 0, lastNewPlayerAt: null as string | null }
  try {
    const [matchesWithoutRank, lastPlayer] = await Promise.all([
      prisma.match.count({ where: { rank: null } }),
      prisma.player.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ])
    dataStats = {
      matchesWithoutRank,
      lastNewPlayerAt: lastPlayer?.createdAt?.toISOString() ?? null,
    }
  } catch {
    // ignore
  }
  return res.json(dataStats)
})

const CRON_JOBS: Array<{ key: string; label: string }> = [
  { key: 'dataDragonSync', label: 'dataDragonSync' },
  { key: 'youtubeSync', label: 'youtubeSync' },
  { key: 'communityDragonSync', label: 'communityDragonSync' },
]

router.get('/riot-scripts-status', async (_req, res) => {
  const cronResult = await cronStatus.getStatus()
  const cronJobs: Record<CronJobKey, CronJobStatus> = cronResult.isOk()
    ? cronResult.unwrap().jobs
    : ({
        dataDragonSync: { job: 'dataDragonSync', lastStartAt: null, lastSuccessAt: null, lastFailureAt: null, lastFailureMessage: null },
        youtubeSync: { job: 'youtubeSync', lastStartAt: null, lastSuccessAt: null, lastFailureAt: null, lastFailureMessage: null },
        communityDragonSync: { job: 'communityDragonSync', lastStartAt: null, lastSuccessAt: null, lastFailureAt: null, lastFailureMessage: null },
      } as Record<CronJobKey, CronJobStatus>)

  const crons = CRON_JOBS.map(({ key, label }) => {
    const job = cronJobs[key as CronJobKey]
    return {
      script: label,
      type: 'cron' as const,
      lastStartAt: job?.lastStartAt ?? null,
      lastSuccessAt: job?.lastSuccessAt ?? null,
      lastFailureAt: job?.lastFailureAt ?? null,
      lastFailureMessage: job?.lastFailureMessage ?? null,
    }
  })

  let dataStats = { matchesWithoutRank: 0, lastNewPlayerAt: null as string | null }
  try {
    const [matchesWithoutRank, lastPlayer] = await Promise.all([
      prisma.match.count({ where: { rank: null } }),
      prisma.player.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ])
    dataStats = {
      matchesWithoutRank,
      lastNewPlayerAt: lastPlayer?.createdAt?.toISOString() ?? null,
    }
  } catch {
    // ignore
  }

  const pollerStatus = getRiotPollerStatus()
  const riotPoller = {
    isRunning: pollerStatus.isRunning,
    status: pollerStatus.isRunning ? 'running' : (pollerStatus.lastError ? 'error' : 'stopped'),
    lastError: pollerStatus.lastError,
    lastLoopStartedAt: pollerStatus.lastLoopStartedAt,
    lastLoopFinishedAt: pollerStatus.lastLoopFinishedAt,
    requestCount: pollerStatus.requestCount,
    error429Count: pollerStatus.error429Count,
    error400Count: pollerStatus.error400Count,
    matchesFetched: pollerStatus.matchesFetched,
    playersFetched: pollerStatus.playersFetched,
    participantsFetched: pollerStatus.participantsFetched,
    matchesRankFixed: pollerStatus.matchesRankFixed,
    participantsRankFixed: pollerStatus.participantsRankFixed,
    participantsRoleFixed: pollerStatus.participantsRoleFixed,
  }

  return res.json({ scripts: [], crons, dataStats, riotPoller })
})

const ROOT_LOGS_DIR = join(backendRoot, '..', 'logs')
const SCRIPT_LOGS_DIR = join(ROOT_LOGS_DIR, 'scripts')
const RIOT_POLLER_LOG_PATH = join(ROOT_LOGS_DIR, 'riot-poller.log')
const RIOT_POLLER_LOGS_MAX_LINES = 1000
const SCRIPT_LOGS_MAX_LINES = 5000

router.get('/riot-poller/status', (_req, res) => {
  return res.json(getRiotPollerStatus())
})

router.post('/riot-poller/stop', (_req, res) => {
  if (!isRiotPollerRunning()) {
    return res.json({ success: true, message: 'Poller already stopped.' })
  }
  requestStopRiotPoller()
  return res.status(202).json({ success: true, message: 'Stop requested. The current loop will finish then stop.' })
})

router.post('/riot-poller/start', (_req, res) => {
  if (isRiotPollerRunning()) {
    return res.json({ success: true, message: 'Poller already running.' })
  }
  startRiotPoller()
  return res.status(202).json({ success: true, message: 'Poller started.' })
})

router.get('/riot-poller/logs', async (req, res) => {
  const linesParam = Number(req.query.lines)
  const lines = Number.isFinite(linesParam) && linesParam > 0
    ? Math.min(linesParam, RIOT_POLLER_LOGS_MAX_LINES)
    : 200
  try {
    const content = await fs.readFile(RIOT_POLLER_LOG_PATH, 'utf-8')
    const all = content.split(/\r?\n/).filter((l) => l.trim().length > 0)
    const log = all.slice(-lines)
    return res.json({ log, logDir: 'logs' })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return res.json({ log: [], logDir: 'logs' })
    }
    return res.status(500).json({ error: (err as Error).message })
  }
})

/** GET /api/admin/script-logs/scripts - list script log filenames (without .log) for "all logs" UI */
router.get('/script-logs/scripts', async (_req, res) => {
  try {
    await fs.mkdir(SCRIPT_LOGS_DIR, { recursive: true })
    const names = await fs.readdir(SCRIPT_LOGS_DIR)
    const scripts = names
      .filter((n) => n.endsWith('.log'))
      .map((n) => n.slice(0, -4))
      .sort()
    return res.json({ scripts, logDir: 'logs/scripts' })
  } catch (err) {
    return res.status(500).json({ scripts: [], error: (err as Error).message })
  }
})

/** GET /api/admin/script-logs?script=...&lines=...&sort=asc|desc - read one or all script logs */
router.get('/script-logs', async (req, res) => {
  const script = typeof req.query.script === 'string' ? req.query.script.trim() : ''
  const linesParam = Number(req.query.lines)
  const lines = Number.isFinite(linesParam) && linesParam > 0
    ? Math.min(linesParam, SCRIPT_LOGS_MAX_LINES)
    : 200
  const sort = req.query.sort === 'asc' ? 'asc' : 'desc'
  try {
    await fs.mkdir(SCRIPT_LOGS_DIR, { recursive: true })
    if (!script || script === 'all') {
      const names = await fs.readdir(SCRIPT_LOGS_DIR)
      const logFiles = names.filter((n) => n.endsWith('.log')).sort()
      const allLines: string[] = []
      for (const f of logFiles) {
        const content = await fs.readFile(join(SCRIPT_LOGS_DIR, f), 'utf-8').catch(() => '')
        const fileLines = content.split(/\r?\n/).filter((l) => l.trim().length > 0)
        const prefix = `[${f.slice(0, -4)}] `
        for (const line of fileLines) allLines.push(prefix + line)
      }
      allLines.sort((a, b) => {
        const tsA = a.match(/^\[[^\]]+\]\s*\[(\d{4}-\d{2}-\d{2}T[^\]]+)\]/)?.[1] ?? ''
        const tsB = b.match(/^\[[^\]]+\]\s*\[(\d{4}-\d{2}-\d{2}T[^\]]+)\]/)?.[1] ?? ''
        return sort === 'asc' ? tsA.localeCompare(tsB) : tsB.localeCompare(tsA)
      })
      const log = allLines.slice(-lines)
      if (sort === 'desc') log.reverse()
      return res.json({ log, logDir: 'logs/scripts' })
    }
    const safe = script.replace(/[^a-zA-Z0-9_-]/g, '_')
    const filePath = join(SCRIPT_LOGS_DIR, `${safe}.log`)
    const content = await fs.readFile(filePath, 'utf-8')
    const all = content.split(/\r?\n/).filter((l) => l.trim().length > 0)
    const log = sort === 'asc' ? all.slice(-lines) : all.slice(-lines).reverse()
    return res.json({ log, logDir: 'logs/scripts' })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return res.json({ log: [], logDir: 'logs/scripts' })
    }
    return res.status(500).json({ error: (err as Error).message })
  }
})

/** Trigger a cron job manually (dataDragonSync, youtubeSync, communityDragonSync). */
const CRON_TRIGGER_JOBS = new Set(['dataDragonSync', 'youtubeSync', 'communityDragonSync'])
router.post('/cron/trigger/:job', async (req, res) => {
  const job = typeof req.params?.job === 'string' ? req.params.job.trim() : ''
  if (!CRON_TRIGGER_JOBS.has(job)) {
    return res.status(400).json({ error: `Invalid cron job: ${job}. Allowed: ${[...CRON_TRIGGER_JOBS].join(', ')}` })
  }
  try {
    if (job === 'dataDragonSync') {
      const result = await runDataDragonSyncOnce()
      if (result.ok) {
        return res.json({ success: true, version: result.version })
      }
      return res.status(500).json({ success: false, error: result.error })
    }
    if (job === 'youtubeSync') {
      const result = await runYouTubeSyncOnce()
      if (result.ok) {
        return res.json({ success: true, syncedChannels: result.syncedChannels, totalVideos: result.totalVideos })
      }
      return res.status(500).json({ success: false, error: result.error })
    }
    if (job === 'communityDragonSync') {
      const result = await runCommunityDragonSyncOnce()
      if (result.ok) {
        return res.json({ success: true, synced: result.synced, failed: result.failed, skipped: result.skipped })
      }
      return res.status(500).json({ success: false, error: result.error })
    }
    return res.status(400).json({ error: `Invalid cron job: ${job}` })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ success: false, error: msg })
  }
})


// --- Builds stats ---
router.get('/builds/stats', async (_req, res) => {
  try {
    const names = await fs.readdir(buildsDir).catch(() => [] as string[])
    const files = names.filter((n) => n.endsWith('.json'))
    const publicCount = files.filter((n) => !n.endsWith('_priv.json')).length
    const privateCount = files.filter((n) => n.endsWith('_priv.json')).length
    return res.json({
      total: files.length,
      public: publicCount,
      private: privateCount
    })
  } catch {
    return res.json({ total: 0, public: 0, private: 0 })
  }
})

// --- YouTube: trigger sync (admin-protected) ---
async function readYoutubeChannelsConfig(): Promise<
  { ok: true; value: YouTubeChannelsConfig } | { ok: false; status: number; error: string }
> {
  const configResult = await FileManager.readJson<YouTubeChannelsConfig>(youtubeConfigFile)
  if (configResult.isErr()) {
    if (configResult.unwrapErr().code === 'FILE_NOT_FOUND') {
      return { ok: true, value: { channels: [] } }
    }
    return { ok: false, status: 500, error: configResult.unwrapErr().message }
  }
  const config = configResult.unwrap()
  return { ok: true, value: { channels: Array.isArray(config.channels) ? config.channels : [] } }
}

router.post('/youtube/trigger', async (_req, res) => {
  const result = await runYouTubeSyncOnce()
  if (result.ok) {
    return res.json({ success: true, syncedChannels: result.syncedChannels, totalVideos: result.totalVideos })
  }
  return res.status(500).json({ error: result.error })
})

// --- YouTube: add channel by @handle (admin-protected) ---
router.post('/youtube/channels', async (req, res) => {
  const raw = (req.body?.handle as unknown) ?? (req.body?.query as unknown) ?? (req.body?.channelId as unknown)
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return res.status(400).json({ error: 'Missing handle (e.g. @Lelariva_LoL)' })
  }
  const resolved = await youtubeService.resolveChannelConfig(raw.trim())
  if (resolved.isErr()) {
    return res.status(400).json({ error: resolved.unwrapErr().message })
  }
  const channel = resolved.unwrap()

  const config = await readYoutubeChannelsConfig()
  if (!config.ok) return res.status(config.status).json({ error: config.error })

  const exists = (config.value.channels ?? []).some((entry) =>
    typeof entry === 'string' ? entry === channel.channelId : entry.channelId === channel.channelId
  )
  if (exists) {
    return res.json({ success: true, channels: config.value.channels })
  }

  const next: YouTubeChannelsConfig = {
    channels: [...(config.value.channels ?? []), { channelId: channel.channelId, channelName: channel.channelName }]
  }
  const writeResult = await FileManager.writeJson(youtubeConfigFile, next)
  if (writeResult.isErr()) {
    return res.status(500).json({ error: writeResult.unwrapErr().message })
  }
  return res.json({ success: true, channels: next.channels })
})

router.get('/matchup-tier-list', async (req, res) => {
  const patch = typeof req.query.patch === 'string' ? req.query.patch.trim() : ''
  if (!patch) return res.status(400).json({ error: 'patch is required (example: 16.4)' })
  const lane = typeof req.query.lane === 'string' ? req.query.lane.trim().toUpperCase() : null
  const rankTier = typeof req.query.rankTier === 'string' ? req.query.rankTier.trim().toUpperCase() : null
  const minGamesRaw = Number(req.query.minGames ?? 20)
  const minGames = Number.isFinite(minGamesRaw) ? Math.max(1, Math.min(1000, Math.trunc(minGamesRaw))) : 20
  const limitRaw = Number(req.query.limit ?? 100)
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.trunc(limitRaw))) : 100
  try {
    const tierList = await getTierListByLane({
      patch,
      lane,
      rankTier,
      minGames,
      limit,
    })
    return res.json({
      patch,
      lane: lane || null,
      rankTier: rankTier || null,
      minGames,
      count: tierList.length,
      tierList,
    })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load matchup tier list' })
  }
})

router.get('/matchup-tier/:championId', async (req, res) => {
  const championId = Number(req.params.championId)
  if (!Number.isFinite(championId) || championId <= 0) {
    return res.status(400).json({ error: 'Invalid championId' })
  }
  const patch = typeof req.query.patch === 'string' ? req.query.patch.trim() : ''
  if (!patch) return res.status(400).json({ error: 'patch is required (example: 16.4)' })
  const lane = typeof req.query.lane === 'string' ? req.query.lane.trim().toUpperCase() : null
  const rankTier = typeof req.query.rankTier === 'string' ? req.query.rankTier.trim().toUpperCase() : null
  const minGamesRaw = Number(req.query.minGames ?? 10)
  const minGames = Number.isFinite(minGamesRaw) ? Math.max(1, Math.min(1000, Math.trunc(minGamesRaw))) : 10
  const limitRaw = Number(req.query.limit ?? 100)
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.trunc(limitRaw))) : 100
  try {
    const matchups = await getMatchupDetailsByChampion({
      championId,
      patch,
      lane,
      rankTier,
      minGames,
      limit,
    })
    return res.json({
      championId,
      patch,
      lane: lane || null,
      rankTier: rankTier || null,
      minGames,
      count: matchups.length,
      matchups,
    })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load matchups' })
  }
})

router.post('/matchup-tier/rebuild', async (req, res) => {
  const patch = typeof req.body?.patch === 'string' ? req.body.patch.trim() : ''
  if (!patch) return res.status(400).json({ error: 'patch is required (example: 16.4)' })
  const rankTier = typeof req.body?.rankTier === 'string' ? req.body.rankTier.trim().toUpperCase() : null
  try {
    const result = await rebuildMatchupTierScores({ patch, rankTier })
    return res.json({
      ok: true,
      patch: result.patch,
      rankFilterKey: result.rankFilterKey,
      rows: result.rows,
    })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to rebuild matchup tier scores' })
  }
})

/**
 * GET /api/admin/app-download
 * Serves the companion app installer (Windows). Protected by admin auth.
 * Set COMPANION_APP_INSTALLER_PATH to the full path of the .exe or .msi; default: data/releases/lelanation-companion-setup.exe
 */
router.get('/app-download', async (_req, res) => {
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
    return res.status(404).json({ error: 'Installer not available', hint: 'Set COMPANION_APP_INSTALLER_PATH or place the installer in data/releases/' })
  }
  const filename = absolutePath.split(/[/\\]/).pop() ?? 'lelanation-companion-setup.exe'
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  return res.sendFile(absolutePath)
})

export default router

