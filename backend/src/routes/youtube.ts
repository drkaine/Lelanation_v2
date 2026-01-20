import { Router } from 'express'
import { join } from 'path'
import { FileManager } from '../utils/fileManager.js'
import { YouTubeService } from '../services/YouTubeService.js'
import { retryWithBackoff } from '../utils/retry.js'
import { DiscordService } from '../services/DiscordService.js'

type YouTubeChannelsConfig = {
  channels: Array<
    | {
        channelId: string
        channelName: string
      }
    | string
  >
}

type StoredChannelData = {
  channelId: string
  channelName?: string
  lastSync?: string
  videos?: Array<unknown>
}

const router = Router()
const youtubeService = new YouTubeService()
const discordService = new DiscordService()

const channelsConfigFile = join(process.cwd(), 'data', 'youtube', 'channels.json')
const youtubeDataDir = join(process.cwd(), 'data', 'youtube')

async function readChannelsConfig(): Promise<
  { ok: true; value: YouTubeChannelsConfig } | { ok: false; status: number; error: string }
> {
  const configResult = await FileManager.readJson<YouTubeChannelsConfig>(channelsConfigFile)
  if (configResult.isErr()) {
    if (configResult.unwrapErr().code === 'FILE_NOT_FOUND') {
      return { ok: true, value: { channels: [] } }
    }
    return { ok: false, status: 500, error: configResult.unwrapErr().message }
  }

  const config = configResult.unwrap()
  return { ok: true, value: { channels: Array.isArray(config.channels) ? config.channels : [] } }
}

async function writeChannelsConfig(
  config: YouTubeChannelsConfig
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const writeResult = await FileManager.writeJson(channelsConfigFile, config)
  if (writeResult.isErr()) {
    return { ok: false, status: 500, error: writeResult.unwrapErr().message }
  }
  return { ok: true }
}

/**
 * Get channels config (raw)
 */
router.get('/channels', async (_req, res) => {
  const config = await readChannelsConfig()
  if (!config.ok) return res.status(config.status).json({ error: config.error })
  return res.json(config.value)
})

/**
 * Admin: add a channel to config
 * Body:
 * - { channel: "UC..." } OR { channelId: "UC..." } OR { query: "Lelariva_LoL" }
 */
router.post('/channels', async (req, res) => {
  const raw =
    (req.body?.channel as unknown) ??
    (req.body?.channelId as unknown) ??
    (req.body?.query as unknown)

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return res.status(400).json({ error: 'Missing channel (channelId or query)' })
  }

  const resolved = await youtubeService.resolveChannelConfig(raw)
  if (resolved.isErr()) {
    return res.status(400).json({ error: resolved.unwrapErr().message })
  }
  const channel = resolved.unwrap()

  const config = await readChannelsConfig()
  if (!config.ok) return res.status(config.status).json({ error: config.error })

  const exists = (config.value.channels ?? []).some((entry) =>
    typeof entry === 'string' ? entry === channel.channelId : entry.channelId === channel.channelId
  )
  if (exists) {
    return res.json({ success: true, channels: config.value.channels })
  }

  const next: YouTubeChannelsConfig = {
    channels: [
      ...(config.value.channels ?? []),
      { channelId: channel.channelId, channelName: channel.channelName }
    ]
  }

  const write = await writeChannelsConfig(next)
  if (!write.ok) return res.status(write.status).json({ error: write.error })
  return res.json({ success: true, channels: next.channels })
})

/**
 * Admin: remove a channel from config
 */
router.delete('/channels/:channelId', async (req, res) => {
  const channelId = req.params.channelId
  if (!channelId || channelId.trim().length === 0) {
    return res.status(400).json({ error: 'Missing channelId' })
  }

  const config = await readChannelsConfig()
  if (!config.ok) return res.status(config.status).json({ error: config.error })

  const filtered = (config.value.channels ?? []).filter((entry) =>
    typeof entry === 'string' ? entry !== channelId : entry.channelId !== channelId
  )

  const next: YouTubeChannelsConfig = { channels: filtered }
  const write = await writeChannelsConfig(next)
  if (!write.ok) return res.status(write.status).json({ error: write.error })
  return res.json({ success: true, channels: next.channels })
})

/**
 * Get stored sync status (per channel file)
 */
router.get('/status', async (_req, res) => {
  const configResult = await readChannelsConfig()
  if (!configResult.ok) return res.status(configResult.status).json({ error: configResult.error })

  const config = configResult.value
  const status = await Promise.all(
    (config.channels ?? []).map(async (entry) => {
      const channelId = typeof entry === 'string' ? entry : entry.channelId
      const channelName = typeof entry === 'string' ? entry : entry.channelName
      const filePath = join(youtubeDataDir, `${channelId}.json`)

      const exists = await FileManager.exists(filePath)
      if (!exists) {
        return {
          channelId,
          channelName,
          synced: false,
          lastSync: null,
          videoCount: 0
        }
      }

      const dataResult = await FileManager.readJson<StoredChannelData>(filePath)
      if (dataResult.isErr()) {
        return {
          channelId,
          channelName,
          synced: false,
          lastSync: null,
          videoCount: 0,
          error: dataResult.unwrapErr().message
        }
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

  return res.json({ channels: status })
})

/**
 * Get stored channel data (videos + metadata)
 */
router.get('/channels/:channelId', async (req, res) => {
  const channelId = req.params.channelId
  const filePath = join(youtubeDataDir, `${channelId}.json`)

  const readResult = await FileManager.readJson<unknown>(filePath)
  if (readResult.isErr()) {
    if (readResult.unwrapErr().code === 'FILE_NOT_FOUND') {
      return res.status(404).json({ error: 'Channel data not found' })
    }
    return res.status(500).json({ error: readResult.unwrapErr().message })
  }

  return res.json(readResult.unwrap())
})

/**
 * Trigger manual YouTube sync
 */
router.post('/trigger', async (_req, res) => {
  const configResult = await readChannelsConfig()
  if (!configResult.ok) return res.status(configResult.status).json({ error: configResult.error })

  const channels = configResult.value.channels ?? []
  if (channels.length === 0) {
    return res.status(400).json({ error: 'No YouTube channels configured' })
  }

  const syncResult = await retryWithBackoff(
    () => youtubeService.syncChannels(channels),
    {
      maxRetries: 10,
      initialDelay: 1000,
      maxDelay: 30000,
      multiplier: 2
    }
  )

  if (syncResult.isErr()) {
    const error = syncResult.unwrapErr()
    await discordService.sendAlert(
      'YouTube Sync Failed',
      `Failed to synchronize YouTube videos after retries`,
      error,
      { channelsCount: channels.length, timestamp: new Date().toISOString() }
    )
    return res.status(500).json({ error: error.message })
  }

  const data = syncResult.unwrap()
  return res.json({ success: true, ...data })
})

export default router

