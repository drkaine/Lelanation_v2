import axios from 'axios'
import { exec, spawn } from 'child_process'
import { Router } from 'express'
import { promises as fs } from 'fs'
import { dirname, join } from 'path'
import { createWriteStream } from 'fs'
import { fileURLToPath } from 'url'
import { MetricsService } from '../services/MetricsService.js'
import { CronStatusService } from '../services/CronStatusService.js'
import { VersionService } from '../services/VersionService.js'
import { YouTubeService } from '../services/YouTubeService.js'
import { getRiotApiService } from '../services/RiotApiService.js'
import {
  backfillParticipantRanks,
  backfillParticipantRoles,
  refreshMatchRanks,
  countParticipantsMissingRank,
  countParticipantsMissingRole,
} from '../services/StatsPlayersRefreshService.js'
import { discoverPlayersFromLeagueExp } from '../services/RiotLeagueExpDiscoveryService.js'
import { runRiotMatchCollectOnce } from '../cron/riotMatchCollect.js'
import { runStatsPrecomputedRefreshOnce } from '../cron/statsPrecomputedRefresh.js'
import { Prisma } from '../generated/prisma/index.js'
import { prisma } from '../db.js'
import { FileManager } from '../utils/fileManager.js'
import { RIOT_API_KEY_FILE } from '../utils/riotApiKey.js'
import { retryWithBackoff } from '../utils/retry.js'

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
const pm2AppName = process.env.PM2_APP_NAME ?? 'lelanation-backend'
const POLLER_SCRIPTS = new Set([
  'riot:worker',
  'riot:collect',
  'riot:backfill-ranks',
  'riot:backfill-roles',
  'riot:refresh-match-ranks',
  'riot:discover-players',
  'riot:discover-league-exp',
  'riot:enrich',
])
const RIOT_SCRIPT_STATUS_FILE = join(process.cwd(), 'data', 'cron', 'riot-script-status.json')
const RIOT_SCRIPT_LOG_DIR = join(process.cwd(), 'logs', 'scripts')

type ScriptStatusValue = 'started' | 'running' | 'stopped' | 'failed'
type ScriptStatusRow = {
  script: string
  status: ScriptStatusValue
  pid?: number
  args?: string[]
  lastStartAt?: string
  lastEndAt?: string
  lastExitCode?: number
}
type ScriptStatusMap = Record<string, ScriptStatusRow>

async function readScriptStatusMap(): Promise<ScriptStatusMap> {
  const r = await FileManager.readJson<ScriptStatusMap>(RIOT_SCRIPT_STATUS_FILE)
  if (r.isErr()) return {}
  return r.unwrap() ?? {}
}
async function writeScriptStatusMap(data: ScriptStatusMap): Promise<void> {
  await FileManager.ensureDir(dirname(RIOT_SCRIPT_STATUS_FILE))
  await FileManager.writeJson(RIOT_SCRIPT_STATUS_FILE, data)
}
async function updateScriptStatus(script: string, patch: Partial<ScriptStatusRow>): Promise<void> {
  const map = await readScriptStatusMap()
  const current = map[script] ?? { script, status: 'stopped' as ScriptStatusValue }
  map[script] = { ...current, ...patch, script }
  await writeScriptStatusMap(map)
}
function scriptLogFile(script: string): string {
  const safe = script.replace(/[^a-zA-Z0-9_-]/g, '_')
  return join(RIOT_SCRIPT_LOG_DIR, `${safe}.log`)
}
async function tailScriptLog(script: string, lines = 20): Promise<string[]> {
  const file = scriptLogFile(script)
  const content = await fs.readFile(file, 'utf-8').catch(() => '')
  if (!content) return []
  const arr = content.split(/\r?\n/).filter((l) => l.trim().length > 0)
  return arr.slice(-Math.max(1, lines))
}
async function appendScriptLog(script: string, message: string): Promise<void> {
  await fs.mkdir(RIOT_SCRIPT_LOG_DIR, { recursive: true })
  await fs.appendFile(scriptLogFile(script), `[${new Date().toISOString()}] ${message}\n`, 'utf-8')
}
function isPidAlive(pid: number | undefined): boolean {
  if (!pid || !Number.isFinite(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const youtubeConfigFile = join(process.cwd(), 'data', 'youtube', 'channels.json')
const youtubeDataDir = join(process.cwd(), 'data', 'youtube')
const frontendYouTubeDir = join(process.cwd(), '..', 'frontend', 'public', 'data', 'youtube')
const contactFilePath = join(process.cwd(), 'data', 'contact.json')
const buildsDir = join(process.cwd(), 'data', 'builds')
const riotApikeyFile = RIOT_API_KEY_FILE

interface RiotApikeyConfig {
  riotApiKey?: string
}

type SeedPlayerPlatform = 'euw1' | 'eun1'

function maskRiotApiKey(key: string): string {
  if (!key || key.length < 12) return '****'
  return `${key.slice(0, 6)}****...${key.slice(-4)}`
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
  const cronJobs = cronFile.isOk() ? cronFile.unwrap().jobs : null

  const versionResult = await versionService.getCurrentVersion()
  const gameVersion = versionResult.isOk() ? versionResult.unwrap() : null

  const ytConfigResult = await FileManager.readJson<YouTubeChannelsConfig>(youtubeConfigFile)
  const ytConfig = ytConfigResult.isOk() ? ytConfigResult.unwrap() : { channels: [] }

  const riotWorkerHeartbeatPath = join(process.cwd(), 'data', 'cron', 'riot-worker-heartbeat.json')
  let riotWorker: { lastBeat: string | null; active: boolean } = { lastBeat: null, active: false }
  const heartbeatResult = await FileManager.readJson<{ lastBeat?: string }>(riotWorkerHeartbeatPath)
  if (heartbeatResult.isOk()) {
    const data = heartbeatResult.unwrap()
    const lastBeat = data?.lastBeat ?? null
    if (lastBeat) {
      const beatMs = new Date(lastBeat).getTime()
      riotWorker = { lastBeat, active: Date.now() - beatMs < 10 * 60 * 1000 } // active if beat within 10 min
    }
  }

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
    riotWorker,
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

// --- Players with empty summoner_name (for enrichment / verification) ---
router.get('/players-missing-summoner-name', async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 500)
    const players = await prisma.player.findMany({
      where: { summonerName: null },
      take: limit,
      select: { puuid: true, summonerName: true, region: true, lastSeen: true },
      orderBy: { lastSeen: 'desc' },
    })
    const total = await prisma.player.count({ where: { summonerName: null } })
    return res.json({
      total,
      returned: players.length,
      players: players.map((p) => ({
        puuid: p.puuid,
        summonerName: p.summonerName,
        region: p.region,
        lastSeen: p.lastSeen?.toISOString() ?? null,
      })),
    })
  } catch (e) {
    return res.status(500).json({
      error: e instanceof Error ? e.message : 'Failed to list players with missing summoner name',
    })
  }
})

// --- Backfill participant rank (rankTier, rankDivision, rankLp) from Riot League API ---
router.post('/backfill-participant-ranks', async (req, res) => {
  try {
    const missingCount = await countParticipantsMissingRank()
    if (missingCount === 0) {
      return res.json({ updated: 0, errors: 0, skipped: true, reason: 'Aucun participant sans rank' })
    }
    const limit = Math.min(parseInt(String(req.query.limit || '200'), 10) || 200, 500)
    const result = await backfillParticipantRanks(limit)
    return res.json(result)
  } catch (e) {
    return res.status(500).json({
      error: e instanceof Error ? e.message : 'Backfill participant ranks failed',
    })
  }
})

// --- Recompute Match.rank from participants (average rank of players in the match) ---
router.post('/refresh-match-ranks', async (_req, res) => {
  try {
    const result = await refreshMatchRanks()
    return res.json(result)
  } catch (e) {
    return res.status(500).json({
      error: e instanceof Error ? e.message : 'Refresh match ranks failed',
    })
  }
})

// --- Trigger Riot match collection (one run, used by admin "Relancer la collecte") ---
// Runs in background to avoid 504 (collect can take several minutes). Returns 202 immediately.
router.post('/riot-collect-now', (_req, res) => {
  void updateScriptStatus('riot:collect', {
    status: 'started',
    lastStartAt: new Date().toISOString(),
    args: [],
  })
  void appendScriptLog('riot:collect', 'START manual collect')
  res.status(202).json({
    success: true,
    message: 'Collecte lancée en arrière-plan. Actualisez la page dans quelques minutes pour voir le résultat.',
  })
  runRiotMatchCollectOnce()
    .then(() => {
      void appendScriptLog('riot:collect', 'END manual collect exit=0')
      return updateScriptStatus('riot:collect', {
        status: 'stopped',
        lastEndAt: new Date().toISOString(),
        lastExitCode: 0,
      })
    })
    .catch((e) => {
      console.error('[admin] riot-collect-now background run failed:', e)
      void appendScriptLog('riot:collect', `END manual collect exit=1 error=${e instanceof Error ? e.message : 'unknown'}`)
      void updateScriptStatus('riot:collect', {
        status: 'failed',
        lastEndAt: new Date().toISOString(),
        lastExitCode: 1,
      })
    })
})

// --- Build replay links from recent matches of a summoner (admin tool) ---
router.post('/riot-replay-links', async (req, res) => {
  try {
    const rawSummoner = typeof req.body?.summonerName === 'string' ? req.body.summonerName.trim() : ''
    const region = req.body?.region === 'eun1' ? 'eun1' : 'euw1'
    const countRaw = Number(req.body?.count ?? 10)
    const count = Number.isFinite(countRaw) ? Math.max(1, Math.min(100, Math.trunc(countRaw))) : 10
    if (!rawSummoner) {
      return res.status(400).json({ error: 'summonerName is required' })
    }

    const riotApi = getRiotApiService()
    const rawHashtag = rawSummoner.lastIndexOf('#')
    const rawDash = rawSummoner.lastIndexOf('-')
    const normalizedRiotId =
      rawHashtag > 0 && rawHashtag < rawSummoner.length - 1
        ? {
            gameName: rawSummoner.slice(0, rawHashtag).trim(),
            tagLine: rawSummoner.slice(rawHashtag + 1).trim(),
          }
        : rawDash > 0 &&
            rawDash < rawSummoner.length - 1 &&
            !rawSummoner.includes(' ') &&
            /^[A-Za-z0-9]{2,5}$/.test(rawSummoner.slice(rawDash + 1).trim())
          ? {
              gameName: rawSummoner.slice(0, rawDash).trim(),
              tagLine: rawSummoner.slice(rawDash + 1).trim(),
            }
          : null

    let resolvedPuuid = ''
    let resolvedName = rawSummoner

    if (normalizedRiotId?.gameName && normalizedRiotId?.tagLine) {
      const accountResult = await riotApi.getAccountByRiotId(normalizedRiotId.gameName, normalizedRiotId.tagLine)
      if (accountResult.isErr()) {
        const err = accountResult.unwrapErr()
        const status = err.cause && axios.isAxiosError(err.cause) ? err.cause.response?.status : undefined
        if (status === 404) return res.status(404).json({ error: 'Riot ID not found' })
        if (status === 401 || status === 403) {
          return res.status(400).json({ error: 'Riot API key invalid or expired. Update it in Admin.' })
        }
        return res.status(400).json({ error: err.message || 'Failed to resolve Riot ID' })
      }
      resolvedPuuid = accountResult.unwrap().puuid
      const summonerByPuuid = await riotApi.getSummonerByPuuid(region, resolvedPuuid)
      if (summonerByPuuid.isOk()) resolvedName = summonerByPuuid.unwrap().name || rawSummoner
    } else {
      const summonerResult = await riotApi.getSummonerByName(region, rawSummoner)
      if (summonerResult.isErr()) {
        const err = summonerResult.unwrapErr()
        const status = err.cause && axios.isAxiosError(err.cause) ? err.cause.response?.status : undefined
        if (status === 404) return res.status(404).json({ error: 'Summoner not found' })
        if (status === 401 || status === 403) {
          return res.status(400).json({ error: 'Riot API key invalid or expired. Update it in Admin.' })
        }
        return res.status(400).json({ error: err.message || 'Failed to resolve summoner' })
      }
      const summoner = summonerResult.unwrap()
      resolvedPuuid = summoner.puuid
      resolvedName = summoner.name || rawSummoner
    }

    const idsResult = await riotApi.getMatchIdsByPuuid(resolvedPuuid, { count, queue: null })
    if (idsResult.isErr()) {
      const err = idsResult.unwrapErr()
      return res.status(400).json({ error: err.message || 'Failed to fetch matches for summoner' })
    }

    const platformSlug = region === 'eun1' ? 'eune' : 'euw'
    const matchIds = idsResult.unwrap()
    const matches = matchIds.map((matchId) => {
      const gameId = matchId.includes('_') ? matchId.split('_').pop() ?? matchId : matchId
      return {
        matchId,
        replayUrl: `https://www.leagueofgraphs.com/match/${platformSlug}/${gameId}`,
        matchApiUrl: `https://europe.api.riotgames.com/lol/match/v5/matches/${matchId}`,
        timelineApiUrl: `https://europe.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline`,
      }
    })

    return res.json({
      summonerName: resolvedName,
      puuid: resolvedPuuid,
      region,
      countRequested: count,
      countReturned: matches.length,
      matches,
    })
  } catch (e) {
    return res.status(500).json({
      error: e instanceof Error ? e.message : 'Failed to build replay links',
    })
  }
})

// --- Discover players from league-exp entries (for later poll by worker) ---
router.post('/riot-discover-league-exp', (req, res) => {
  const platform = req.body?.platform === 'eun1' ? 'eun1' : 'euw1'
  const queue = typeof req.body?.queue === 'string' && req.body.queue.trim() ? req.body.queue.trim() : 'RANKED_SOLO_5x5'
  const tier = typeof req.body?.tier === 'string' ? req.body.tier.toUpperCase() : 'GOLD'
  const division = typeof req.body?.division === 'string' ? req.body.division.toUpperCase() : 'I'
  const pagesRaw = Number(req.body?.pages ?? req.query?.pages ?? 3)
  const pages = Number.isFinite(pagesRaw) ? Math.max(1, Math.min(50, Math.trunc(pagesRaw))) : 3

  void updateScriptStatus('riot:discover-league-exp', {
    status: 'started',
    lastStartAt: new Date().toISOString(),
    args: [platform, queue, tier, division, String(pages)],
  })
  void appendScriptLog(
    'riot:discover-league-exp',
    `START platform=${platform} queue=${queue} tier=${tier} division=${division} pages=${pages}`
  )
  res.status(202).json({
    success: true,
    message: `Découverte league-exp lancée en arrière-plan (${platform} ${queue} ${tier} ${division}, pages=${pages}).`,
  })

  discoverPlayersFromLeagueExp({ platform, queue, tier, division, pages })
    .then((result) => {
      console.log('[admin] riot-discover-league-exp done:', result)
      void appendScriptLog('riot:discover-league-exp', `END exit=0 playersUpserted=${result?.playersUpserted ?? 'n/a'}`)
      return updateScriptStatus('riot:discover-league-exp', {
        status: 'stopped',
        lastEndAt: new Date().toISOString(),
        lastExitCode: 0,
      })
    })
    .catch((e) => {
      console.error('[admin] riot-discover-league-exp failed:', e)
      void appendScriptLog('riot:discover-league-exp', `END exit=1 error=${e instanceof Error ? e.message : 'unknown'}`)
      void updateScriptStatus('riot:discover-league-exp', {
        status: 'failed',
        lastEndAt: new Date().toISOString(),
        lastExitCode: 1,
      })
    })
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

// --- Trigger backfill participant ranks in background (like riot-collect-now, avoids 504) ---
// Worker = long-running process (npm run riot:worker). Backfill = one-shot fill of missing ranks.
router.post('/riot-backfill-ranks', (req, res) => {
  const limit = Math.min(parseInt(String(req.query?.limit || '200'), 10) || 200, 5000)
  void appendScriptLog('riot:backfill-ranks', `START limit=${limit}`)
  void updateScriptStatus('riot:backfill-ranks', {
    status: 'started',
    lastStartAt: new Date().toISOString(),
    args: [String(limit)],
  })
  res.status(202).json({
    success: true,
    message: `Backfill rangs lancé en arrière-plan (limit=${limit}). Actualisez dans quelques minutes.`,
  })
  ;(async () => {
    try {
      const missingCount = await countParticipantsMissingRank()
      if (missingCount === 0) {
        const { matchesUpdated } = await refreshMatchRanks()
        console.log('[admin] riot-backfill-ranks: 0 participants sans rank, Match.rank refresh:', matchesUpdated)
        void appendScriptLog('riot:backfill-ranks', `END exit=0 missing=0 matchesUpdated=${matchesUpdated}`)
        void updateScriptStatus('riot:backfill-ranks', {
          status: 'stopped',
          lastEndAt: new Date().toISOString(),
          lastExitCode: 0,
        })
        return
      }
      const { updated, errors } = await backfillParticipantRanks(limit)
      console.log('[admin] riot-backfill-ranks: updated=', updated, 'errors=', errors)
      const { matchesUpdated } = await refreshMatchRanks()
      console.log('[admin] riot-backfill-ranks: matchesUpdated=', matchesUpdated)
      void appendScriptLog(
        'riot:backfill-ranks',
        `END exit=0 updated=${updated} errors=${errors} matchesUpdated=${matchesUpdated}`
      )
      void updateScriptStatus('riot:backfill-ranks', {
        status: 'stopped',
        lastEndAt: new Date().toISOString(),
        lastExitCode: 0,
      })
    } catch (e) {
      console.error('[admin] riot-backfill-ranks failed:', e)
      void appendScriptLog('riot:backfill-ranks', `END exit=1 error=${e instanceof Error ? e.message : 'unknown'}`)
      void updateScriptStatus('riot:backfill-ranks', {
        status: 'failed',
        lastEndAt: new Date().toISOString(),
        lastExitCode: 1,
      })
    }
  })()
})

// --- Trigger backfill participant roles in background (fills participants.role when null) ---
router.post('/riot-backfill-roles', (req, res) => {
  const limit = Math.min(parseInt(String(req.query?.limit || '50'), 10) || 50, 500)
  void appendScriptLog('riot:backfill-roles', `START matches=${limit}`)
  void updateScriptStatus('riot:backfill-roles', {
    status: 'started',
    lastStartAt: new Date().toISOString(),
    args: [String(limit)],
  })
  res.status(202).json({
    success: true,
    message: `Backfill rôles lancé en arrière-plan (matches=${limit}). Actualisez dans quelques minutes.`,
  })
  ;(async () => {
    try {
      const missingCount = await countParticipantsMissingRole()
      if (missingCount === 0) {
        console.log('[admin] riot-backfill-roles: 0 participants sans role, skip')
        void appendScriptLog('riot:backfill-roles', 'END exit=0 missing=0')
        void updateScriptStatus('riot:backfill-roles', {
          status: 'stopped',
          lastEndAt: new Date().toISOString(),
          lastExitCode: 0,
        })
        return
      }
      const { updated, errors, matches } = await backfillParticipantRoles(limit)
      console.log('[admin] riot-backfill-roles:', { matches, updated, errors })
      void appendScriptLog('riot:backfill-roles', `END exit=0 matches=${matches} updated=${updated} errors=${errors}`)
      void updateScriptStatus('riot:backfill-roles', {
        status: 'stopped',
        lastEndAt: new Date().toISOString(),
        lastExitCode: 0,
      })
    } catch (e) {
      console.error('[admin] riot-backfill-roles failed:', e)
      void appendScriptLog('riot:backfill-roles', `END exit=1 error=${e instanceof Error ? e.message : 'unknown'}`)
      void updateScriptStatus('riot:backfill-roles', {
        status: 'failed',
        lastEndAt: new Date().toISOString(),
        lastExitCode: 1,
      })
    }
  })()
})

// --- Generic poller scripts launcher (whitelisted npm scripts, background) ---
router.post('/riot-script-run', async (req, res) => {
  const script = typeof req.body?.script === 'string' ? req.body.script.trim() : ''
  const rawArgs = Array.isArray(req.body?.args) ? req.body.args : []
  const args = rawArgs.filter((a: unknown): a is string => typeof a === 'string' && a.trim().length > 0).slice(0, 10)
  if (!POLLER_SCRIPTS.has(script)) {
    return res.status(400).json({ error: `Unsupported script "${script}"` })
  }
  const statusMap = await readScriptStatusMap()
  const existing = statusMap[script]
  if (existing && (existing.status === 'running' || existing.status === 'started') && isPidAlive(existing.pid)) {
    return res.status(409).json({
      success: false,
      error: `Script ${script} is already active.`,
    })
  }

  if (script === 'riot:worker') {
    // Best effort guard: avoid duplicate workers if heartbeat is fresh.
    const hb = await FileManager.readJson<{ lastBeat?: string }>(join(process.cwd(), 'data', 'cron', 'riot-worker-heartbeat.json'))
    if (hb.isOk() && hb.unwrap()?.lastBeat) {
      const ageMs = Date.now() - new Date(hb.unwrap().lastBeat!).getTime()
      if (ageMs < 10 * 60 * 1000) {
        return res.status(409).json({
          success: false,
          error: 'Riot worker already appears active (heartbeat < 10 min).',
        })
      }
    }
  }

  await fs.mkdir(RIOT_SCRIPT_LOG_DIR, { recursive: true })
  const logPath = scriptLogFile(script)
  const logStream = createWriteStream(logPath, { flags: 'a' })
  logStream.write(`\n[${new Date().toISOString()}] START ${script} ${args.join(' ')}\n`)

  const childArgs = ['run', script, ...(args.length ? ['--', ...args] : [])]
  const child = spawn('npm', childArgs, {
    cwd: backendRoot,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  })
  if (child.stdout) child.stdout.on('data', (d) => logStream.write(String(d)))
  if (child.stderr) child.stderr.on('data', (d) => logStream.write(String(d)))
  void updateScriptStatus(script, {
    status: 'running',
    pid: child.pid ?? undefined,
    args,
    lastStartAt: new Date().toISOString(),
  })
  child.on('close', (code) => {
    logStream.write(`[${new Date().toISOString()}] END ${script} exit=${code ?? 'null'}\n`)
    logStream.end()
    void updateScriptStatus(script, {
      status: code === 0 ? 'stopped' : 'failed',
      lastEndAt: new Date().toISOString(),
      lastExitCode: code ?? undefined,
      pid: undefined,
    })
  })

  return res.status(202).json({
    success: true,
    message: `Script ${script} lancé en arrière-plan.`,
    script,
    args,
  })
})

router.get('/riot-scripts-status', async (_req, res) => {
  const map = await readScriptStatusMap()
  const hb = await FileManager.readJson<{ lastBeat?: string }>(join(process.cwd(), 'data', 'cron', 'riot-worker-heartbeat.json'))
  const workerBeat = hb.isOk() ? hb.unwrap()?.lastBeat : null
  const workerActive = !!workerBeat && (Date.now() - new Date(workerBeat).getTime()) < 10 * 60 * 1000
  const scripts = [...POLLER_SCRIPTS].map((script) => {
    const row = map[script] ?? { script, status: 'stopped' as ScriptStatusValue }
    const alive = isPidAlive(row.pid)
    const safeRow = (row.status === 'running' || row.status === 'started') && !alive
      ? { ...row, status: 'stopped' as ScriptStatusValue, pid: undefined }
      : row
    if (script === 'riot:worker') {
      return {
        ...safeRow,
        status: workerActive ? 'running' : safeRow.status === 'running' ? 'started' : safeRow.status,
        workerHeartbeat: workerBeat ?? null,
      }
    }
    return safeRow
  })
  return res.json({ scripts })
})

router.get('/riot-script-logs', async (req, res) => {
  const script = typeof req.query?.script === 'string' ? req.query.script.trim() : ''
  if (!POLLER_SCRIPTS.has(script)) return res.status(400).json({ error: `Unsupported script "${script}"` })
  const linesRaw = Number(req.query?.lines ?? 20)
  const lines = Number.isFinite(linesRaw) ? Math.max(1, Math.min(200, Math.trunc(linesRaw))) : 20
  const logLines = await tailScriptLog(script, lines)
  return res.json({
    script,
    linesRequested: lines,
    linesReturned: logLines.length,
    log: logLines,
  })
})

// --- Request Riot worker to stop (used by admin "Stopper le poller") ---
// Writes a stop-request file; the worker (npm run riot:worker) checks it at the start of each cycle and exits.
const RIOT_WORKER_STOP_REQUEST_FILE = join(process.cwd(), 'data', 'cron', 'riot-worker-stop-request.json')
async function writeRiotWorkerStopRequest(): Promise<void> {
  const dir = join(process.cwd(), 'data', 'cron')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(
    RIOT_WORKER_STOP_REQUEST_FILE,
    JSON.stringify({ requestedAt: new Date().toISOString() }, null, 0),
    'utf-8'
  )
}

router.post('/riot-script-stop', async (req, res) => {
  const script = typeof req.body?.script === 'string' ? req.body.script.trim() : ''
  if (!POLLER_SCRIPTS.has(script)) return res.status(400).json({ success: false, error: `Unsupported script "${script}"` })
  const map = await readScriptStatusMap()
  const row = map[script]
  const pid = row?.pid
  const alive = isPidAlive(pid)
  try {
    if (script === 'riot:worker') {
      await writeRiotWorkerStopRequest()
      if (alive && pid) process.kill(pid, 'SIGTERM')
      void appendScriptLog('riot:worker', 'STOP requested from admin')
      void updateScriptStatus('riot:worker', {
        status: 'started',
        lastEndAt: new Date().toISOString(),
        pid: alive ? pid : undefined,
      })
      return res.json({
        success: true,
        message: 'Demande d’arrêt envoyée. Le worker s’arrête à la fin du cycle (ou immédiatement si piloté ici).',
      })
    }
    if (!alive || !pid) {
      return res.status(409).json({ success: false, error: `Script ${script} is not active.` })
    }
    process.kill(pid, 'SIGTERM')
    void appendScriptLog(script, `STOP sent SIGTERM pid=${pid}`)
    void updateScriptStatus(script, {
      status: 'started',
      lastEndAt: new Date().toISOString(),
    })
    return res.json({ success: true, message: `Arrêt demandé pour ${script}.` })
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: e instanceof Error ? e.message : 'Failed to stop script',
    })
  }
})

router.post('/riot-worker-stop', async (_req, res) => {
  try {
    await writeRiotWorkerStopRequest()
    void appendScriptLog('riot:worker', 'STOP requested from legacy endpoint')
    return res.json({
      success: true,
      message: 'Demande d’arrêt envoyée. Le worker s’arrêtera à la fin du cycle en cours (sous 1–2 min).',
    })
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: e instanceof Error ? e.message : 'Failed to write stop request',
    })
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
  const config = await readYoutubeChannelsConfig()
  if (!config.ok) return res.status(config.status).json({ error: config.error })
  const channels = config.value.channels ?? []
  if (channels.length === 0) {
    return res.status(400).json({ error: 'No YouTube channels configured' })
  }
  const syncResult = await retryWithBackoff(
    () => youtubeService.syncChannels(channels),
    { maxRetries: 10, initialDelay: 1000, maxDelay: 30000, multiplier: 2 }
  )
  if (syncResult.isErr()) {
    return res.status(500).json({ error: syncResult.unwrapErr().message })
  }
  const data = syncResult.unwrap()
  return res.json({ success: true, ...data })
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

// --- Riot API key (admin) ---
router.get('/riot-apikey', async (_req, res) => {
  const fileResult = await FileManager.readJson<RiotApikeyConfig>(riotApikeyFile)
  const fromFile = fileResult.isOk() ? fileResult.unwrap().riotApiKey : undefined
  const fromEnv = process.env.RIOT_API_KEY
  const key = (typeof fromFile === 'string' && fromFile.trim() !== '') ? fromFile : fromEnv
  const hasKey = typeof key === 'string' && key.trim() !== ''
  return res.json({
    hasKey: !!hasKey,
    maskedKey: hasKey ? maskRiotApiKey(key!) : undefined
  })
})

/** Test current Riot API key against Riot (EUW). Returns valid + diagnostics on failure. */
router.get('/riot-apikey/test', async (_req, res) => {
  const { getRiotApiKeyWithSourceAsync } = await import('../utils/riotApiKey.js')
  const { getRiotApiService } = await import('../services/RiotApiService.js')
  const riotApi = getRiotApiService()
  riotApi.invalidateKeyCache()
  const { key, source } = await getRiotApiKeyWithSourceAsync()
  if (!key) {
    return res.json({
      valid: false,
      error: 'Aucune clé configurée (fichier admin ou RIOT_API_KEY).',
      keySource: null,
      keyLength: 0,
    })
  }
  const result = await riotApi.getChallengerLeague('euw1')
  if (result.isOk()) {
    return res.json({ valid: true })
  }
  const err = result.unwrapErr()
  const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : String(err)
  return res.json({
    valid: false,
    error: message,
    keySource: source,
    keyLength: key.length,
  })
})

router.put('/riot-apikey', async (req, res) => {
  const raw = req.body?.riotApiKey ?? req.body?.apiKey ?? req.body?.key
  const value = typeof raw === 'string' ? raw.trim() : ''
  const dirResult = await FileManager.ensureDir(dirname(RIOT_API_KEY_FILE))
  if (dirResult.isErr()) {
    return res.status(500).json({ error: dirResult.unwrapErr().message })
  }
  const writeResult = await FileManager.writeJson<RiotApikeyConfig>(riotApikeyFile, {
    riotApiKey: value || undefined
  })
  if (writeResult.isErr()) {
    return res.status(500).json({ error: writeResult.unwrapErr().message })
  }
  getRiotApiService().invalidateKeyCache()
  exec(
    `npm run build && pm2 restart ${pm2AppName}`,
    { cwd: backendRoot, timeout: 120_000 },
    (err, stdout, stderr) => {
      if (err) {
        console.warn('[admin] Riot API key saved but build/PM2 restart failed:', err.message)
        if (stderr) console.warn('[admin] stderr:', stderr)
      } else if (stdout) {
        console.log('[admin] Build and PM2 restart done:', stdout.trim())
      }
    }
  )
  return res.json({
    success: true,
    hasKey: value.length > 0,
    maskedKey: value.length > 0 ? maskRiotApiKey(value) : undefined
  })
})

// --- All players (DB, for admin visibility) ---
router.get('/players', async (req, res) => {
  const limit = Math.min(Math.max(1, parseInt(String(req.query?.limit || 15), 10) || 15), 2000)
  const offset = Math.max(0, parseInt(String(req.query?.offset || 0), 10) || 0)
  const search = typeof req.query?.search === 'string' ? req.query.search.trim() : ''

  const likePattern = search ? `%${search}%` : ''
  const whereFragment = search
    ? Prisma.sql`WHERE (summoner_name ILIKE ${likePattern} OR puuid::text ILIKE ${likePattern})`
    : Prisma.sql``

  const [rows, total] = await Promise.all([
    prisma.$queryRaw<
      Array<{ puuid: string; summonerName: string | null; region: string; totalGames: number; totalWins: number }>
    >(Prisma.sql`
      SELECT puuid, summoner_name AS "summonerName", region, total_games AS "totalGames", total_wins AS "totalWins"
      FROM players_with_stats
      ${whereFragment}
      ORDER BY total_games DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `),
    search
      ? prisma
          .$queryRaw<[{ count: bigint }]>(Prisma.sql`
            SELECT COUNT(*)::bigint AS count FROM players_with_stats
            WHERE (summoner_name ILIKE ${likePattern} OR puuid::text ILIKE ${likePattern})
          `)
          .then((r) => Number(r[0]?.count ?? 0))
      : prisma.player.count(),
  ])

  const players = rows.map((p) => ({
    puuid: p.puuid,
    summonerName: p.summonerName,
    region: p.region,
    totalGames: p.totalGames,
    totalWins: p.totalWins,
    winrate: p.totalGames > 0 ? Math.round((p.totalWins / p.totalGames) * 10000) / 100 : 0,
  }))
  return res.json({ players, total })
})

// --- Seed players (players table = single source for match crawl) ---
router.get('/seed-players', async (_req, res) => {
  const rows = await prisma.player.findMany({
    orderBy: { createdAt: 'asc' },
    select: { puuid: true, summonerName: true, region: true },
  })
  const players = rows.map((p) => ({
    id: p.puuid,
    label: p.summonerName ?? '—',
    platform: p.region as SeedPlayerPlatform,
  }))
  return res.json({ players })
})

/** Tag line used when user enters only game name (no #, no -): try Riot ID with platform as tag. */
const PLATFORM_TAG: Record<string, string> = { euw1: 'EUW', eun1: 'EUN1' }

/** Parse label into gameName + tagLine. Supports: Name#Tag, Name-Tag (op.gg style), or Name (use platform tag). */
function parseRiotIdLabel(label: string, platform: string): { gameName: string; tagLine: string; labelToStore: string } {
  if (label.includes('#')) {
    const parts = label.split('#').map((s: string) => s.trim())
    const gameName = parts[0] ?? ''
    const tagLine = parts[1] ?? ''
    return { gameName, tagLine, labelToStore: label }
  }
  const lastDash = label.lastIndexOf('-')
  if (lastDash > 0 && lastDash < label.length - 1) {
    const gameName = label.slice(0, lastDash).trim()
    const tagLine = label.slice(lastDash + 1).trim()
    if (gameName && tagLine) {
      return { gameName, tagLine, labelToStore: `${gameName}#${tagLine}` }
    }
  }
  const tagLine = PLATFORM_TAG[platform] ?? 'EUW'
  return { gameName: label, tagLine, labelToStore: `${label}#${tagLine}` }
}

router.post('/seed-players', async (req, res) => {
  const rawLabel = req.body?.label ?? req.body?.name ?? req.body?.pseudo ?? ''
  const label = typeof rawLabel === 'string' ? rawLabel.trim() : ''
  const rawPlatform = req.body?.platform ?? req.body?.region ?? 'euw1'
  const platform = rawPlatform === 'eun1' ? 'eun1' : 'euw1'

  if (!label) {
    return res.status(400).json({ error: 'label is required (Riot ID: Name#Tag or summoner name)' })
  }

  const { gameName, tagLine, labelToStore } = parseRiotIdLabel(label, platform)
  if (!gameName || !tagLine) {
    return res.status(400).json({ error: 'Invalid Riot ID format (use Name#Tag or Name-Tag)' })
  }

  // Resolve Riot ID via API and get puuid + summoner info
  const riotApi = getRiotApiService()
  let puuid: string
  let summonerName: string | null = labelToStore
  try {
    const accountResult = await riotApi.getAccountByRiotId(gameName, tagLine)
    if (accountResult.isErr()) {
      const err = accountResult.unwrapErr()
      const status = err.cause && axios.isAxiosError(err.cause) ? err.cause.response?.status : undefined
      if (status === 404) {
        if (label.includes('#') || label.includes('-')) {
          return res.status(400).json({ error: 'Player not found (Riot ID does not exist)' })
        }
        return res.status(400).json({
          error: `No player "${label}" with tag ${tagLine}. This player may use another tag (e.g. Urpog#URGOT). Copy the Riot ID from op.gg: in the URL it appears as Name-Tag (e.g. Urpog-URGOT). Paste that in the field.`,
        })
      }
      if (status === 401 || status === 403) {
        return res.status(400).json({ error: 'Riot API key invalid or expired. Update it in Admin.' })
      }
      return res.status(400).json({ error: err.message || 'Riot API error' })
    }
    puuid = accountResult.unwrap().puuid
    const summonerResult = await riotApi.getSummonerByPuuid(platform === 'eun1' ? 'eun1' : 'euw1', puuid)
    if (summonerResult.isOk()) {
      const s = summonerResult.unwrap()
      if (s.name) summonerName = s.name
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('RIOT_API_KEY') || message.includes('not configured')) {
      return res.status(400).json({ error: 'Riot API key not configured. Set it in Admin > Riot API key.' })
    }
    return res.status(400).json({ error: message || 'Validation failed' })
  }

  const region = platform === 'eun1' ? 'eun1' : 'euw1'
  const existingPlayer = await prisma.player.findUnique({ where: { puuid } })
  if (existingPlayer) {
    return res.status(409).json({
      error: 'Player already in list',
      code: 'ALREADY_PLAYER',
      summonerName: existingPlayer.summonerName ?? undefined,
    })
  }

  await prisma.player.create({
    data: {
      puuid,
      summonerName,
      region,
      lastSeen: null,
    },
  })
  return res.status(201).json({
    player: { id: puuid, label: summonerName ?? '—', platform: region },
  })
})

router.delete('/seed-players/:id', async (req, res) => {
  const puuid = req.params?.id
  if (!puuid) return res.status(400).json({ error: 'id is required' })

  try {
    await prisma.player.delete({ where: { puuid } })
    return res.json({ success: true })
  } catch {
    return res.status(404).json({ error: 'Player not found' })
  }
})

export default router

