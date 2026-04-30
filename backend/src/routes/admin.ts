import { spawn } from 'child_process'
import { Router } from 'express'
import { promises as fs } from 'fs'
import { dirname, join, resolve, isAbsolute } from 'path'
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
import { runLiveAggArchiveCheckpointCronOnce } from '../cron/liveAggArchiveCheckpoint.js'
import { prisma } from '../db.js'
import { closePatch } from '../services/PatchLifecycleService.js'
import { archiveChampionTierDailySnapshotsInDateRange } from '../services/ChampionTierDailySnapshotService.js'
import { FileManager } from '../utils/fileManager.js'
import {
  readUnifiedLogEntries,
  deleteUnifiedLogsInRange,
  appendUnifiedLog,
  getUnifiedLogPathResolved,
  findLatestPollerSummaryEntries,
  type ParsedUnifiedLogEntry,
} from '../logging/unifiedAppLog.js'
import { getBuildEngagement } from '../services/BuildEngagementService.js'
import { readBalanceRules, writeBalanceRules } from '../services/BalanceRulesService.js'
import {
  startScript,
  switchToScript,
  requestStop,
  isAnyScriptRunning,
  getOrchestratorStatus,
  getLastFinishedInfo,
  type ScriptName,
  type LeagueXpOptions,
} from '../worker/scriptOrchestrator.js'
import { getRiotPollerStatus } from '../worker/riotPoller.js'
import { buildRiotPollerAdminPayload } from '../services/PollerAdminView.js'
import {
  aggregatePollerMetricsFromUnifiedLog,
  type PollerLogSource,
} from '../services/PollerMetricsFromLog.js'
import { resolveRiotApiKey } from '../services/RiotHttpClient.js'
import { riotGateway } from '../services/RiotGateway.js'
import type { MatchFiltersConfig } from '../services/RiotConfigService.js'

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
const MATCH_FILTERS_FILE = join(process.cwd(), 'data', 'riot', 'match-filters.json')

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

export type AdminDataCollectStats = {
  totalPlayers: number
  playersWrongKeyVersion: number
  lastNewPlayerAt: string | null
  lastPlayerLastSeenAt: string | null
  totalTrackedMatches: number
  trackedMatchesCreatedLast1h: number
  trackedAggregateStatus: Record<string, number>
  trackedLastAggregatedAt: string | null
  playersCreatedLast1h: number
  playersLastSeenLast1h: number
  pollerResume: {
    script: string
    atIso: string
    message: string
    windowStartIso: string | null
    windowEndIso: string | null
    delta: Record<string, unknown>
    httpWindowStats: unknown
    dbWindow1h: unknown
    requestsPerHour: unknown
    httpRequestsProjectedPerHour: unknown
  } | null
}

function pickNewerPollerLogEntry(
  a: ParsedUnifiedLogEntry | null,
  b: ParsedUnifiedLogEntry | null,
): ParsedUnifiedLogEntry | null {
  if (!a) return b
  if (!b) return a
  return a.atIso >= b.atIso ? a : b
}

function pollerResumeFromUnifiedEntry(
  e: ParsedUnifiedLogEntry,
): NonNullable<AdminDataCollectStats['pollerResume']> {
  const j = e.json ?? {}
  const delta = (j['delta'] as Record<string, unknown>) ?? {}
  return {
    script: e.script,
    atIso: e.atIso,
    message: e.message,
    windowStartIso: typeof j['windowStartIso'] === 'string' ? j['windowStartIso'] : null,
    windowEndIso: typeof j['windowEndIso'] === 'string' ? j['windowEndIso'] : null,
    delta,
    httpWindowStats: j['httpWindowStats'] ?? null,
    dbWindow1h: j['dbWindow1h'] ?? null,
    requestsPerHour: j['requestsPerHour'] ?? null,
    httpRequestsProjectedPerHour: j['httpRequestsProjectedPerHour'] ?? null,
  }
}

async function getAdminDataCollectStats(): Promise<AdminDataCollectStats> {
  const empty: AdminDataCollectStats = {
    totalPlayers: 0,
    playersWrongKeyVersion: 0,
    lastNewPlayerAt: null,
    lastPlayerLastSeenAt: null,
    totalTrackedMatches: 0,
    trackedMatchesCreatedLast1h: 0,
    trackedAggregateStatus: {},
    trackedLastAggregatedAt: null,
    playersCreatedLast1h: 0,
    playersLastSeenLast1h: 0,
    pollerResume: null,
  }
  const since1h = new Date(Date.now() - 60 * 60 * 1000)
  try {
    const [
      lastPlayer,
      maxLastSeenAgg,
      totalPlayers,
      trackedTotal,
      tracked1h,
      trackedAggByStatus,
      trackedLastAggregatedAt,
      playersWrongKeyVersion,
      playersCreated1h,
      playersLastSeen1h,
      logSummaries,
    ] = await Promise.all([
      prisma.player.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      prisma.player.aggregate({ _max: { lastSeen: true } }),
      prisma.player.count(),
      prisma.$queryRaw<Array<{ c: bigint }>>`SELECT COUNT(*)::bigint AS c FROM tracked_matches`,
      prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(*)::bigint AS c FROM tracked_matches WHERE created_at >= ${since1h}
      `,
      prisma.$queryRaw<Array<{ aggregate_status: string; c: bigint }>>`
        SELECT aggregate_status, COUNT(*)::bigint AS c
        FROM tracked_matches
        GROUP BY aggregate_status
      `,
      prisma.$queryRaw<Array<{ d: Date | null }>>`
        SELECT MAX(aggregated_at) AS d
        FROM tracked_matches
      `,
      prisma.player.count({ where: { puuidKeyVersion: null } }),
      prisma.player.count({ where: { createdAt: { gte: since1h } } }),
      prisma.player.count({ where: { lastSeen: { gte: since1h } } }),
      findLatestPollerSummaryEntries(),
    ])
    const latest = pickNewerPollerLogEntry(logSummaries.last30m, logSummaries.lastHourly)
    return {
      totalPlayers,
      playersWrongKeyVersion,
      lastNewPlayerAt: lastPlayer?.createdAt?.toISOString() ?? null,
      lastPlayerLastSeenAt: maxLastSeenAgg._max.lastSeen?.toISOString() ?? null,
      totalTrackedMatches: Number(trackedTotal[0]?.c ?? 0),
      trackedMatchesCreatedLast1h: Number(tracked1h[0]?.c ?? 0),
      trackedAggregateStatus: Object.fromEntries(
        trackedAggByStatus.map((r) => [r.aggregate_status, Number(r.c ?? 0)])
      ),
      trackedLastAggregatedAt: trackedLastAggregatedAt[0]?.d?.toISOString() ?? null,
      playersCreatedLast1h: playersCreated1h,
      playersLastSeenLast1h: playersLastSeen1h,
      pollerResume: latest ? pollerResumeFromUnifiedEntry(latest) : null,
    }
  } catch {
    return empty
  }
}

/** GET /api/admin/data-stats — collecte : DB (`tracked_matches`, `players`) + dernier résumé poller (log unifié). */
router.get('/data-stats', async (_req, res) => {
  return res.json(await getAdminDataCollectStats())
})

router.get('/active-patches', async (_req, res) => {
  try {
    const patches = await prisma.activePatch.findMany({
      orderBy: { gameVersion: 'asc' },
      select: {
        gameVersion: true,
        gamesNumber: true,
        gameNumberMax: true,
        isCurrent: true,
        archivedAt: true,
      },
    })
    return res.json({ patches })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

router.get('/patch-close-options', async (_req, res) => {
  try {
    const options = await versionService.listPatchCloseOptions()
    return res.json({ options })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

router.post('/patch-close', async (req, res) => {
  const patchLabelRaw =
    typeof req.body?.patchLabel === 'string'
      ? req.body.patchLabel.trim()
      : typeof req.body?.patch === 'string'
        ? req.body.patch.trim()
        : ''
  if (!patchLabelRaw) {
    return res.status(400).json({ error: 'patchLabel is required' })
  }
  try {
    const window = await versionService.resolveSnapshotWindowForPatch(patchLabelRaw)
    if (!window) {
      return res.status(400).json({
        error: 'Unknown patch or invalid date window (check data/game/versions.json)',
      })
    }
    const closeSummary = await closePatch(window.patchLabel)
    const { archivedRowCount } = await archiveChampionTierDailySnapshotsInDateRange(
      window.startInclusive,
      window.endExclusive,
    )
    return res.json({
      ok: true,
      patch: window.patchLabel,
      version: window.version,
      startInclusive: window.startInclusive,
      endExclusive: window.endExclusive,
      snapshotRowsArchived: archivedRowCount,
      isLatestInRecap: window.isLatestInRecap,
      closeSummary,
    })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

router.put('/active-patches/:patch/max', async (req, res) => {
  const patch = typeof req.params.patch === 'string' ? req.params.patch.trim() : ''
  const gameNumberMaxRaw = Number(req.body?.gameNumberMax)
  if (!patch) return res.status(400).json({ error: 'patch is required' })
  if (!Number.isFinite(gameNumberMaxRaw) || gameNumberMaxRaw < 1) {
    return res.status(400).json({ error: 'gameNumberMax must be a positive integer' })
  }
  const gameNumberMax = Math.trunc(gameNumberMaxRaw)
  try {
    // Source of truth: keep match-filters.json in sync with admin edits.
    const configResult = await FileManager.readJson<MatchFiltersConfig>(MATCH_FILTERS_FILE)
    if (configResult.isErr()) {
      return res.status(500).json({ error: configResult.unwrapErr().message })
    }
    const config = configResult.unwrap()
    if (!Array.isArray(config.versions)) {
      return res.status(500).json({ error: 'match-filters.json: versions is invalid' })
    }
    const versionRow = config.versions.find(v => (v?.version ?? '').trim() === patch)
    if (!versionRow) {
      return res.status(404).json({ error: `Patch ${patch} not found in match-filters.json` })
    }
    versionRow.maxMatches = gameNumberMax
    if (typeof versionRow.completed !== 'boolean') versionRow.completed = false
    const writeResult = await FileManager.writeJson(MATCH_FILTERS_FILE, config)
    if (writeResult.isErr()) {
      return res.status(500).json({ error: writeResult.unwrapErr().message })
    }

    const existing = await prisma.activePatch.findUnique({
      where: { gameVersion: patch },
      select: { gamesNumber: true },
    })
    if (!existing) return res.status(404).json({ error: 'Patch not found in active_patches' })
    const updated = await prisma.activePatch.update({
      where: { gameVersion: patch },
      data: {
        gameNumberMax,
        isCurrent: existing.gamesNumber < gameNumberMax,
      },
      select: {
        gameVersion: true,
        gamesNumber: true,
        gameNumberMax: true,
        isCurrent: true,
      },
    })
    return res.json({ success: true, patch: updated })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
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

const CRON_JOBS: Array<{ key: string; label: string }> = [
  { key: 'dataDragonSync', label: 'dataDragonSync' },
  { key: 'youtubeSync', label: 'youtubeSync' },
  { key: 'communityDragonSync', label: 'communityDragonSync' },
  { key: 'liveAggArchiveCheckpoint', label: 'liveAggArchiveCheckpoint' },
]

router.get('/riot-scripts-status', async (_req, res) => {
  const cronResult = await cronStatus.getStatus()
  const cronJobs: Record<CronJobKey, CronJobStatus> = cronResult.isOk()
    ? cronResult.unwrap().jobs
    : ({
        dataDragonSync: { job: 'dataDragonSync', lastStartAt: null, lastSuccessAt: null, lastFailureAt: null, lastFailureMessage: null },
        youtubeSync: { job: 'youtubeSync', lastStartAt: null, lastSuccessAt: null, lastFailureAt: null, lastFailureMessage: null },
        communityDragonSync: { job: 'communityDragonSync', lastStartAt: null, lastSuccessAt: null, lastFailureAt: null, lastFailureMessage: null },
        liveAggArchiveCheckpoint: { job: 'liveAggArchiveCheckpoint', lastStartAt: null, lastSuccessAt: null, lastFailureAt: null, lastFailureMessage: null },
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

  const dataStats = await getAdminDataCollectStats()

  const orchestratorStatus = getOrchestratorStatus()
  const lastFinished = getLastFinishedInfo()
  const riotPoller = await buildRiotPollerAdminPayload()

  const orchestrator = {
    activeScript: orchestratorStatus.activeScript,
    isRunning: orchestratorStatus.isRunning,
    startedAt: orchestratorStatus.startedAt,
    finishedAt: orchestratorStatus.finishedAt,
    lastError: orchestratorStatus.lastError,
    shouldStop: orchestratorStatus.shouldStop,
    counters: orchestratorStatus.counters,
    lastFinishedScript: lastFinished.script,
    lastFinishedAt: lastFinished.finishedAt,
  }

  const scripts = [
    {
      script: 'poller',
      status: riotPoller.isRunning ? 'running' : 'stopped',
    },
    {
      script: 'puuid-migration',
      status:
        orchestratorStatus.activeScript === 'puuid-migration' && orchestratorStatus.isRunning
          ? 'running'
          : 'stopped',
    },
    {
      script: 'league-xp',
      status:
        orchestratorStatus.activeScript === 'league-xp' && orchestratorStatus.isRunning
          ? 'running'
          : 'stopped',
    },
  ]

  return res.json({ scripts, crons, dataStats, riotPoller, orchestrator })
})

const ROOT_LOGS_DIR = resolve(backendRoot, '..', 'logs')
const SCRIPT_LOGS_DIR = join(ROOT_LOGS_DIR, 'scripts')
const RIOT_POLLER_LOG_PATH = join(ROOT_LOGS_DIR, 'riot-poller.log')
const RIOT_POLLER_LOGS_MAX_LINES = 1000
const SCRIPT_LOGS_MAX_LINES = 5000

router.get('/riot-poller/status', async (_req, res) => {
  const payload = await buildRiotPollerAdminPayload()
  return res.json(payload)
})

/** GET /api/admin/riot-poller/metrics — aggregate poller_hourly / poller_30m from unified log */
router.get('/riot-poller/metrics', async (req, res) => {
  try {
    const granularity = req.query.granularity === 'day' ? 'day' : 'hour'
    const sourceParam = typeof req.query.source === 'string' ? req.query.source.trim() : 'both'
    let sources: PollerLogSource[] = ['poller_hourly', 'poller_30m']
    if (sourceParam === 'hourly') sources = ['poller_hourly']
    else if (sourceParam === '30m' || sourceParam === 'poller_30m') sources = ['poller_30m']

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

/** GET /api/admin/riot-script/status — unified orchestrator status (all scripts). */
router.get('/riot-script/status', (_req, res) => {
  const s = getOrchestratorStatus()
  const lastFinished = getLastFinishedInfo()
  return res.json({ ...s, lastFinishedScript: lastFinished.script, lastFinishedAt: lastFinished.finishedAt })
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

/** GET /api/admin/riot-api-stats - poller stats for admin UI (legacy endpoint). */
router.get('/riot-api-stats', (_req, res) => {
  return res.json(getRiotPollerStatus())
})

router.post('/riot-poller/stop', (_req, res) => {
  if (!isAnyScriptRunning()) {
    return res.json({ success: true, message: 'No script running.' })
  }
  requestStop()
  return res.status(202).json({ success: true, message: 'Stop requested. The current task will finish then the script will stop.' })
})

router.post('/riot-poller/start', async (_req, res) => {
  if (isAnyScriptRunning()) {
    const s = getOrchestratorStatus()
    return res.json({ success: true, message: `Script '${s.activeScript}' is already running.` })
  }
  const result = await startScript('poller')
  if (!result.ok) return res.status(409).json({ success: false, error: result.error })
  return res.status(202).json({ success: true, message: 'Poller started.' })
})

/**
 * POST /api/admin/riot-script/start
 * Body: { script: 'poller' | 'puuid-migration' | 'league-xp', options?: { queue, tier, division, region, maxPages } }
 * Starts the specified script. Returns 409 if a script is already running.
 */
router.post('/riot-script/start', async (req, res) => {
  const VALID_SCRIPTS: ScriptName[] = ['poller', 'puuid-migration', 'league-xp']
  const scriptName = typeof req.body?.script === 'string' ? (req.body.script as ScriptName) : null
  if (!scriptName || !VALID_SCRIPTS.includes(scriptName)) {
    return res.status(400).json({ error: `Invalid script. Allowed: ${VALID_SCRIPTS.join(', ')}` })
  }

  const options: LeagueXpOptions = {}
  if (scriptName === 'league-xp' && req.body?.options && typeof req.body.options === 'object') {
    const o = req.body.options as Record<string, unknown>
    if (typeof o['queue'] === 'string') options.queue = o['queue']
    if (typeof o['tier'] === 'string') options.tier = o['tier'].toUpperCase()
    if (typeof o['division'] === 'string') options.division = o['division'].toUpperCase()
    if (typeof o['region'] === 'string') options.region = o['region'].toLowerCase()
    if (typeof o['maxPages'] === 'number') options.maxPages = Math.max(1, Math.min(100, Math.trunc(o['maxPages'])))
  }

  const result = await startScript(scriptName, options)
  if (!result.ok) return res.status(409).json({ success: false, error: result.error })
  return res.status(202).json({ success: true, message: `Script '${scriptName}' started.` })
})

/**
 * POST /api/admin/riot-script/switch
 * Body: { script, options? } - stops previous running script (if any), then starts requested one.
 */
router.post('/riot-script/switch', async (req, res) => {
  const VALID_SCRIPTS: ScriptName[] = ['poller', 'puuid-migration', 'league-xp']
  const scriptName = typeof req.body?.script === 'string' ? (req.body.script as ScriptName) : null
  if (!scriptName || !VALID_SCRIPTS.includes(scriptName)) {
    return res.status(400).json({ error: `Invalid script. Allowed: ${VALID_SCRIPTS.join(', ')}` })
  }

  const options: LeagueXpOptions = {}
  if (scriptName === 'league-xp' && req.body?.options && typeof req.body.options === 'object') {
    const o = req.body.options as Record<string, unknown>
    if (typeof o['queue'] === 'string') options.queue = o['queue']
    if (typeof o['tier'] === 'string') options.tier = o['tier'].toUpperCase()
    if (typeof o['division'] === 'string') options.division = o['division'].toUpperCase()
    if (typeof o['region'] === 'string') options.region = o['region'].toLowerCase()
    if (typeof o['maxPages'] === 'number') options.maxPages = Math.max(1, Math.min(100, Math.trunc(o['maxPages'])))
  }

  const result = await switchToScript(scriptName, options)
  if (!result.ok) return res.status(409).json({ success: false, error: result.error })
  return res.status(202).json({
    success: true,
    message: result.previousScript
      ? `Script '${result.previousScript}' stopped, '${scriptName}' started.`
      : `Script '${scriptName}' started.`,
  })
})

/**
 * POST /api/admin/riot-script/stop
 * Gracefully stops the currently running script.
 */
router.post('/riot-script/stop', (_req, res) => {
  if (!isAnyScriptRunning()) {
    return res.json({ success: true, message: 'No script is running.' })
  }
  const s = getOrchestratorStatus()
  requestStop()
  return res.status(202).json({
    success: true,
    message: `Stop requested for '${s.activeScript}'. It will finish its current task before stopping.`,
  })
})

router.get('/riot-poller/logs', async (req, res) => {
  const linesParam = Number(req.query.lines)
  const lines = Number.isFinite(linesParam) && linesParam > 0
    ? Math.min(linesParam, RIOT_POLLER_LOGS_MAX_LINES)
    : 200
  const sort = req.query.sort === 'asc' ? 'asc' : 'desc'
  const pathsToTry = [
    RIOT_POLLER_LOG_PATH,
    resolve(process.cwd(), 'logs', 'riot-poller.log'),
  ]
  for (const logPath of pathsToTry) {
    try {
      const content = await fs.readFile(logPath, 'utf-8')
      const all = content.split(/\r?\n/).filter((l) => l.trim().length > 0)
      const log = sort === 'asc' ? all.slice(-lines) : all.slice(-lines).reverse()
      return res.json({ log, logDir: 'logs' })
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        return res.status(500).json({ error: (err as Error).message })
      }
    }
  }
  return res.json({ log: [], logDir: 'logs' })
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

/** Trigger a cron job manually (dataDragonSync, youtubeSync, communityDragonSync, liveAggArchiveCheckpoint). */
const CRON_TRIGGER_JOBS = new Set([
  'dataDragonSync',
  'youtubeSync',
  'communityDragonSync',
  'liveAggArchiveCheckpoint',
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
      const result = await runCommunityDragonSyncOnce()
      if (result.ok) {
        return res.json({ success: true, synced: result.synced, failed: result.failed, skipped: result.skipped })
      }
      return res.status(500).json({ success: false, error: result.error })
    }
    if (job === 'liveAggArchiveCheckpoint') {
      const result = await runLiveAggArchiveCheckpointCronOnce()
      if (result.ok) {
        return res.json({
          success: true,
          livePatches: result.livePatches ?? [],
          copiedTables: result.copiedTables ?? [],
          deletedRawRows: result.deletedRawRows ?? 0,
        })
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

