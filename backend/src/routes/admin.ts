import { spawn } from 'child_process'
import { Router } from 'express'
import { promises as fs } from 'fs'
import { dirname, join, resolve, isAbsolute } from 'path'
import { fileURLToPath } from 'url'
import { MetricsService } from '../services/MetricsService.js'
import { CronStatusService } from '../services/CronStatusService.js'
import { VersionService } from '../services/VersionService.js'
import { YouTubeService } from '../services/YouTubeService.js'
import {
  getTierListByLane,
  getMatchupDetailsByChampion,
  rebuildMatchupTierScores,
} from '../services/MatchupTierService.js'
import { runDataDragonSyncOnce } from '../cron/dataDragonSync.js'
import { runYouTubeSyncOnce } from '../cron/youtubeSync.js'
import { runCommunityDragonSyncOnce } from '../cron/communityDragonSync.js'
import { FileManager } from '../utils/fileManager.js'
import {
  readUnifiedLogEntries,
  deleteUnifiedLogsInRange,
  appendUnifiedLog,
  getUnifiedLogPathResolved,
  readUnifiedLogTail,
  parseUnifiedLogLine,
} from '../logging/unifiedAppLog.js'
import { getBuildEngagement } from '../services/BuildEngagementService.js'
import { readBalanceRules, writeBalanceRules } from '../services/BalanceRulesService.js'
import { getAdminDataCollectStats } from '../services/AdminDataCollectService.js'
import { buildRiotPollerAdminPayload } from '../services/PollerAdminView.js'
import {
  aggregatePollerMetricsFromUnifiedLog,
  type PollerLogSource,
} from '../services/PollerMetricsFromLog.js'
import {
  loadPollerObservabilityAdminResponse,
  readPollerProcessLogTail,
} from '../services/PollerMetricsAdminService.js'
import { resolveRiotApiKey } from '../services/RiotGateway.js'
import { riotGateway } from '../services/RiotGateway.js'
export type { AdminDataCollectStats } from '../services/AdminDataCollectService.js'

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

function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••'
  return key.slice(0, 4) + '…' + key.slice(-4)
}

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

/** GET /api/admin/data-stats — collecte : DB stats (`tracked_matches`, `players`) ou snapshot `statistiques` (sans lecture du log poller). */
router.get('/data-stats', async (_req, res) => {
  return res.json(await getAdminDataCollectStats())
})

router.get('/balance-rules', async (_req, res) => {
  try {
    const rules = await readBalanceRules()
    return res.json({ rules })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

router.put('/balance-rules', async (req, res) => {
  try {
    const saved = await writeBalanceRules(req.body?.rules ?? req.body)
    if (!saved.ok) {
      return res.status(500).json({ error: saved.error ?? 'Unable to save balance rules' })
    }
    return res.json({ success: true, rules: saved.data })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

const ROOT_LOGS_DIR = resolve(backendRoot, '..', 'logs')
const SCRIPT_LOGS_DIR = join(ROOT_LOGS_DIR, 'scripts')
const RIOT_POLLER_LOGS_MAX_LINES = 1000
const SCRIPT_LOGS_MAX_LINES = 5000

router.get('/riot-poller/status', async (_req, res) => {
  const payload = await buildRiotPollerAdminPayload()
  return res.json(payload)
})

/** GET /api/admin/poller/observability — snapshots poller-metrics + files d’attente live. */
router.get('/poller/observability', async (_req, res) => {
  const payload = await loadPollerObservabilityAdminResponse(backendRoot, ROOT_LOGS_DIR)
  return res.json(payload)
})

/** @deprecated use GET /api/admin/poller/observability */
router.get('/poller-v2/observability', async (_req, res) => {
  const payload = await loadPollerObservabilityAdminResponse(backendRoot, ROOT_LOGS_DIR)
  return res.json(payload)
})

/** @deprecated alias */
router.get('/poller-v3/metrics', async (_req, res) => {
  const payload = await loadPollerObservabilityAdminResponse(backendRoot, ROOT_LOGS_DIR)
  return res.json(payload)
})

/** GET /api/admin/riot-poller/process-logs — tail PM2 stdout/stderr du process poller. */
router.get('/riot-poller/process-logs', async (req, res) => {
  const linesParam = Number(req.query.lines)
  const lines = Number.isFinite(linesParam) && linesParam > 0 ? Math.min(linesParam, 1000) : 200
  const stream =
    req.query.stream === 'error' ? 'error' : req.query.stream === 'out' ? 'out' : 'both'
  try {
    const { log, files } = await readPollerProcessLogTail(ROOT_LOGS_DIR, { stream, lines })
    return res.json({ log, files, logDir: 'logs' })
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
      log: [],
    })
  }
})

/** GET /api/admin/riot-poller/metrics — agrégation des résumés poller_v3_* dans le log unifié. */
router.get('/riot-poller/metrics', async (req, res) => {
  try {
    const granularity = req.query.granularity === 'day' ? 'day' : 'hour'
    const sourceParam = typeof req.query.source === 'string' ? req.query.source.trim() : 'v3'
    const legacy =
      sourceParam === 'legacy' || process.env.ADMIN_POLLER_LEGACY_LOG_SCRIPTS === '1'
    let sources: PollerLogSource[] = ['poller_v3_1h', 'poller_v3_30m', 'poller_v3_10m']
    if (legacy) {
      sources = ['poller_hourly', 'poller_30m', 'poller_v3_1h', 'poller_v3_30m']
    } else if (sourceParam === '1h' || sourceParam === 'hourly') {
      sources = ['poller_v3_1h']
    } else if (sourceParam === '30m') {
      sources = ['poller_v3_30m']
    } else if (sourceParam === '10m') {
      sources = ['poller_v3_10m']
    }

    const now = new Date()
    const toIso =
      typeof req.query.to === 'string' && req.query.to.trim()
        ? req.query.to.trim()
        : now.toISOString()
    let fromIso: string
    if (typeof req.query.from === 'string' && req.query.from.trim()) {
      fromIso = req.query.from.trim()
    } else if (granularity === 'day') {
      const days = Math.min(Math.max(parseInt(String(req.query.days ?? '14'), 10) || 14, 1), 90)
      fromIso = new Date(now.getTime() - days * 86_400_000).toISOString()
    } else {
      const hours = Math.min(Math.max(parseInt(String(req.query.hours ?? '72'), 10) || 72, 1), 168)
      fromIso = new Date(now.getTime() - hours * 3_600_000).toISOString()
    }

    const { buckets, logPath, linesScanned, matched } = await aggregatePollerMetricsFromUnifiedLog({
      granularity,
      fromIso,
      toIso,
      sources,
    })

    const sum = (fn: (b: (typeof buckets)[0]) => number) => buckets.reduce((a, b) => a + fn(b), 0)
    return res.json({
      granularity,
      fromIso,
      toIso,
      sources,
      logPath,
      linesScanned,
      matchedLines: matched,
      buckets,
      totals: {
        requests: sum((b) => b.requests),
        error429: sum((b) => b.error429),
        error400: sum((b) => b.error400),
        matches: sum((b) => b.matches),
        matchesApiIngestComplete: sum((b) => b.matchesApiIngestComplete),
        participants: sum((b) => b.participants),
        playersPolled: sum((b) => b.playersPolled),
        newPlayers: sum((b) => b.newPlayers),
        rateLimitRefreshPauses: sum((b) => b.rateLimitRefreshPauses),
        rateLimit429Pauses: sum((b) => b.rateLimit429Pauses),
        sampleCount: sum((b) => b.sampleCount),
      },
    })
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
      buckets: [],
    })
  }
})

/** GET /api/admin/riot-apikey - current key status (masked) */
router.get('/riot-apikey', async (_req, res) => {
  const resolved = await resolveRiotApiKey()
  if (!resolved.ok) {
    return res.json({ maskedKey: null })
  }
  return res.json({ maskedKey: maskKey(resolved.key), source: resolved.source })
})

/** PUT /api/admin/riot-apikey - deprecated (env-only key management). */
router.put('/riot-apikey', async (req, res) => {
  void req
  return res.status(410).json({ error: 'riot-apikey.json is removed. Configure RIOT_API_KEY in backend/.env.' })
})

/** POST /api/admin/riot-apikey/test - test current key with Riot API */
router.post('/riot-apikey/test', async (_req, res) => {
  const resolved = await resolveRiotApiKey()
  if (!resolved.ok) {
    return res.json({
      valid: false,
      error: resolved.error,
      keySource: null,
      keyLength: null,
    })
  }
  try {
    const r = await riotGateway.call('GET', `${riotGateway.getPlatformBase('euw1')}/lol/status/v4/platform-data`)
    if (r.status >= 200 && r.status < 300) {
      return res.json({ valid: true })
    }
    const data = r.data as { status?: { message?: string } }
    const msg = data?.status?.message ?? `HTTP ${r.status}`
    return res.json({
      valid: false,
      error: msg,
      keySource: resolved.source,
      keyLength: resolved.key.length,
    })
  } catch (err) {
    const gatewayErr = err as { status?: number; body?: { status?: { message?: string } } }
    const errorMessage =
      gatewayErr?.body?.status?.message ??
      (gatewayErr?.status ? `HTTP ${gatewayErr.status}` : err instanceof Error ? err.message : String(err))
    return res.json({
      valid: false,
      error: errorMessage,
      keySource: resolved.source,
      keyLength: resolved.key.length,
    })
  }
})

/** GET /api/admin/riot-api-stats — same payload as riot-poller/status (unified log summaries). */
router.get('/riot-api-stats', async (_req, res) => {
  return res.json(await buildRiotPollerAdminPayload())
})

router.get('/riot-poller/logs', async (req, res) => {
  const linesParam = Number(req.query.lines)
  const lines = Number.isFinite(linesParam) && linesParam > 0
    ? Math.min(linesParam, RIOT_POLLER_LOGS_MAX_LINES)
    : 200
  const sort = req.query.sort === 'asc' ? 'asc' : 'desc'
  const includeLegacyScripts =
    req.query.legacy === '1' ||
    req.query.includeLegacy === 'true' ||
    process.env.ADMIN_POLLER_LEGACY_LOG_SCRIPTS === '1'
  try {
    const tail = await readUnifiedLogTail(2 * 1024 * 1024)
    const allLines = tail.split(/\r?\n/).filter((l) => l.trim().length > 0)
    const pollerLines: string[] = []
    for (const line of allLines) {
      const p = parseUnifiedLogLine(line, 0)
      if (!p) continue
      const isPoller =
        p.script.startsWith('poller_v3_') ||
        p.script.startsWith('poller_db_') ||
        (includeLegacyScripts &&
          (p.script === 'poller' || p.script === 'poller_30m' || p.script === 'poller_hourly'))
      if (!isPoller) continue
      pollerLines.push(line)
    }
    const log = sort === 'asc' ? pollerLines.slice(-lines) : pollerLines.slice(-lines).reverse()
    return res.json({ log, logDir: 'lelanation-unified.log (tail)' })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
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

/** GET /api/admin/unified-logs — parsed unified log file (admin UI). */
router.get('/unified-logs', async (req, res) => {
  try {
    const section = typeof req.query.section === 'string' ? req.query.section.trim() : undefined
    const type = typeof req.query.type === 'string' ? req.query.type.trim() : undefined
    const script = typeof req.query.script === 'string' ? req.query.script.trim() : undefined
    const fromIso = typeof req.query.from === 'string' ? req.query.from.trim() : undefined
    const toIso = typeof req.query.to === 'string' ? req.query.to.trim() : undefined
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined
    const sort = req.query.sort === 'asc' ? 'asc' : 'desc'
    const limitParam = Number(req.query.limit)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 5000) : 500
    const offsetParam = Number(req.query.offset)
    const offset = Number.isFinite(offsetParam) ? Math.max(0, offsetParam) : 0

    const { entries, totalMatched } = await readUnifiedLogEntries({
      section: section || undefined,
      type: type || undefined,
      script: script || undefined,
      fromIso: fromIso || undefined,
      toIso: toIso || undefined,
      search: search || undefined,
      sort,
      limit,
      offset,
    })

    return res.json({
      entries,
      totalMatched,
      logPath: getUnifiedLogPathResolved(),
    })
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message, entries: [], totalMatched: 0 })
  }
})

/** DELETE body: { fromIso, toIso } — remove log lines in inclusive timestamp range. */
router.delete('/unified-logs', async (req, res) => {
  try {
    const fromIso = typeof req.body?.fromIso === 'string' ? req.body.fromIso.trim() : ''
    const toIso = typeof req.body?.toIso === 'string' ? req.body.toIso.trim() : ''
    if (!fromIso || !toIso) {
      return res.status(400).json({ error: 'fromIso and toIso (ISO 8601) are required' })
    }
    const { removed, kept } = await deleteUnifiedLogsInRange(fromIso, toIso)
    return res.json({ ok: true, removed, kept })
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message })
  }
})

/** POST body: { type?, script?, message, json? } — frontend / client events into unified log. */
router.post('/client-log', async (req, res) => {
  try {
    const message = typeof req.body?.message === 'string' ? req.body.message : ''
    if (!message.trim()) {
      return res.status(400).json({ error: 'message is required' })
    }
    const type = typeof req.body?.type === 'string' && req.body.type.trim() ? req.body.type.trim() : 'info'
    const script = typeof req.body?.script === 'string' && req.body.script.trim() ? req.body.script.trim() : 'frontend'
    const json =
      req.body?.json != null && typeof req.body.json === 'object'
        ? (req.body.json as Record<string, unknown>)
        : null
    await appendUnifiedLog({ section: 'front', type, script, message, json })
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message })
  }
})

/** Trigger a cron job manually (dataDragonSync, youtubeSync, communityDragonSync). */
const CRON_TRIGGER_JOBS = new Set([
  'dataDragonSync',
  'youtubeSync',
  'communityDragonSync',
])
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
      const result = await runCommunityDragonSyncOnce({ force: true })
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

// --- Build engagement stats (admin only) ---
router.get('/builds/:id/engagement', async (req, res) => {
  const buildId = typeof req.params.id === 'string' ? req.params.id.trim() : ''
  if (!buildId) return res.status(400).json({ error: 'Invalid build id' })
  try {
    const stats = await getBuildEngagement(buildId)
    return res.json({
      buildId: stats.buildId,
      views: stats.views,
      sharesTotal: stats.shares.link + stats.shares.image + stats.shares.image_with_meta,
      shares: stats.shares,
      lastViewedAt: stats.lastViewedAt,
      lastSharedAt: stats.lastSharedAt,
      updatedAt: stats.updatedAt,
    })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
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

