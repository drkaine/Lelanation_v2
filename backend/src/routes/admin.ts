import axios from 'axios'
import { exec } from 'child_process'
import { Router } from 'express'
import { promises as fs } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { MetricsService } from '../services/MetricsService.js'
import { CronStatusService } from '../services/CronStatusService.js'
import { VersionService } from '../services/VersionService.js'
import { YouTubeService } from '../services/YouTubeService.js'
import { getRiotApiService } from '../services/RiotApiService.js'
import {
  backfillParticipantRanks,
  refreshMatchRanks,
} from '../services/StatsPlayersRefreshService.js'
import { runRiotMatchCollectOnce } from '../cron/riotMatchCollect.js'
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

const youtubeConfigFile = join(process.cwd(), 'data', 'youtube', 'channels.json')
const youtubeDataDir = join(process.cwd(), 'data', 'youtube')
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
      const filePath = join(youtubeDataDir, `${channelId}.json`)
      const exists = await FileManager.exists(filePath)
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
      select: {
        puuid: true,
        summonerId: true,
        summonerName: true,
        region: true,
        totalGames: true,
        lastSeen: true,
      },
      orderBy: { lastSeen: 'desc' },
    })
    const total = await prisma.player.count({ where: { summonerName: null } })
    return res.json({
      total,
      returned: players.length,
      players: players.map((p) => ({
        puuid: p.puuid,
        summonerId: p.summonerId,
        summonerName: p.summonerName,
        region: p.region,
        totalGames: p.totalGames,
        lastSeen: p.lastSeen?.toISOString() ?? null,
        hasSummonerId: !!p.summonerId,
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
  res.status(202).json({
    success: true,
    message: 'Collecte lancée en arrière-plan. Actualisez la page dans quelques minutes pour voir le résultat.',
  })
  runRiotMatchCollectOnce().catch((e) => {
    console.error('[admin] riot-collect-now background run failed:', e)
  })
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
  const limit = Math.min(Math.max(1, parseInt(String(req.query?.limit || 500), 10) || 500), 2000)
  const rows = await prisma.player.findMany({
    orderBy: [{ totalGames: 'desc' }],
    take: limit,
    select: {
      puuid: true,
      summonerName: true,
      region: true,
      totalGames: true,
      totalWins: true,
    },
  })
  const players = rows.map((p) => ({
    puuid: p.puuid,
    summonerName: p.summonerName,
    region: p.region,
    totalGames: p.totalGames,
    totalWins: p.totalWins,
    winrate: p.totalGames > 0 ? Math.round((p.totalWins / p.totalGames) * 10000) / 100 : 0,
  }))
  return res.json({ players, total: players.length })
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
  let summonerId: string | null = null
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
      summonerId = s.id || null
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
      summonerId,
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

