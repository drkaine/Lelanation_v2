import { Router } from 'express'
import { join } from 'path'
import { FileManager } from '../utils/fileManager.js'
import { YouTubeService } from '../services/YouTubeService.js'
import { fetchYouTubeCommunityPosts } from '../services/youtubeCommunityPosts.js'
import {
  addChannelToConfig,
  channelSyncStatus,
  readChannelsConfig,
  removeChannelFromConfig,
  type StoredChannelData,
  type YouTubeChannelsConfig,
} from '../services/youtubeChannels.js'

const router = Router()
const youtubeService = new YouTubeService()

const channelsConfigFile = join(process.cwd(), 'data', 'youtube', 'channels.json')
const youtubeDataDir = join(process.cwd(), 'data', 'youtube')
const frontendYouTubeDir = join(process.cwd(), '..', 'frontend', 'public', 'data', 'youtube')
const youtubeDirs = { backendDir: youtubeDataDir, frontendDir: frontendYouTubeDir }

/**
 * Get channels config (raw)
 * Tries backend first, then frontend public directory
 */
router.get('/channels', async (_req, res) => {
  // Try backend first
  const config = await readChannelsConfig(channelsConfigFile)
  if (config.ok) {
    return res.json(config.value)
  }

  // Fallback to frontend public directory
  const frontendConfigPath = join(frontendYouTubeDir, 'channels.json')
  const frontendResult = await FileManager.readJson<YouTubeChannelsConfig>(frontendConfigPath)
  if (frontendResult.isOk()) {
    console.debug(`[YouTube API] Reading config from frontend public: ${frontendConfigPath}`)
    return res.json(frontendResult.unwrap())
  }

  return res.status(config.status).json({ error: config.error })
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

  const added = await addChannelToConfig(channelsConfigFile, channel)
  if (!added.ok) return res.status(added.status).json({ error: added.error })
  return res.json({ success: true, channels: added.channels })
})

/**
 * Admin: remove a channel from config
 */
router.delete('/channels/:channelId', async (req, res) => {
  const channelId = req.params.channelId
  if (!channelId || channelId.trim().length === 0) {
    return res.status(400).json({ error: 'Missing channelId' })
  }

  const removed = await removeChannelFromConfig(channelsConfigFile, channelId)
  if (!removed.ok) return res.status(removed.status).json({ error: removed.error })
  return res.json({ success: true, channels: removed.channels })
})

/**
 * Get stored sync status (per channel file)
 * Tries backend first, then frontend public directory
 */
router.get('/status', async (_req, res) => {
  const configResult = await readChannelsConfig(channelsConfigFile)
  if (!configResult.ok) return res.status(configResult.status).json({ error: configResult.error })

  const config = configResult.value
  const status = await Promise.all(
    (config.channels ?? []).map(entry => channelSyncStatus(entry, youtubeDirs))
  )

  return res.json({ channels: status })
})

/**
 * Get stored channel data (videos + metadata)
 * Tries backend first, then frontend public directory (for static serving)
 */
router.get('/channels/:channelId', async (req, res) => {
  const channelId = req.params.channelId
  const backendPath = join(youtubeDataDir, `${channelId}.json`)
  const frontendPath = join(frontendYouTubeDir, `${channelId}.json`)

  // Try backend first
  let readResult = await FileManager.readJson<unknown>(backendPath)
  
  // If backend file doesn't exist, try frontend public directory
  if (readResult.isErr() && readResult.unwrapErr().code === 'FILE_NOT_FOUND') {
    readResult = await FileManager.readJson<unknown>(frontendPath)
    if (readResult.isOk()) {
      console.debug(`[YouTube API] Reading from frontend public: ${frontendPath}`)
    }
  }

  if (readResult.isErr()) {
    if (readResult.unwrapErr().code === 'FILE_NOT_FOUND') {
      return res.status(404).json({ error: 'Channel data not found' })
    }
    return res.status(500).json({ error: readResult.unwrapErr().message })
  }

  return res.json(readResult.unwrap())
})

/**
 * Get a single community post with all images (cached file first, then live fetch).
 */
router.get('/channels/:channelId/posts/:postId', async (req, res) => {
  const channelId = req.params.channelId
  const postId = req.params.postId
  if (!channelId || !postId) {
    return res.status(400).json({ error: 'Missing channelId or postId' })
  }

  const backendPath = join(youtubeDataDir, `${channelId}.json`)
  const frontendPath = join(frontendYouTubeDir, `${channelId}.json`)

  let readResult = await FileManager.readJson<StoredChannelData>(backendPath)
  if (readResult.isErr() && readResult.unwrapErr().code === 'FILE_NOT_FOUND') {
    readResult = await FileManager.readJson<StoredChannelData>(frontendPath)
  }

  if (readResult.isOk()) {
    const data = readResult.unwrap()
    const cachedPost = (data.videos ?? []).find(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        String((item as { id?: unknown }).id) === postId
    )
    const imageUrls = Array.isArray(cachedPost?.imageUrls)
      ? cachedPost.imageUrls.filter((url): url is string => typeof url === 'string' && url.length > 0)
      : []
    if (imageUrls.length > 1) {
      return res.json(cachedPost)
    }
  }

  const configResult = await readChannelsConfig(channelsConfigFile)
  if (!configResult.ok) {
    return res.status(configResult.status).json({ error: configResult.error })
  }

  const entry = (configResult.value.channels ?? []).find(item =>
    typeof item === 'string' ? item === channelId : item.channelId === channelId
  )
  const channelName =
    typeof entry === 'string' ? entry : entry?.channelName || entry?.channelId || channelId

  const postsResult = await fetchYouTubeCommunityPosts({
    channelId,
    channelTitle: channelName,
    maxPosts: 100,
  })

  if (postsResult.isErr()) {
    return res.status(502).json({ error: postsResult.unwrapErr().message })
  }

  const post = postsResult.unwrap().find(item => item.id === postId)
  if (!post) {
    return res.status(404).json({ error: 'Community post not found' })
  }

  return res.json(post)
})

/**
 * Manual YouTube sync — disabled on public API (use admin or cron).
 */
router.post('/trigger', (_req, res) => {
  return res.status(404).json({ error: 'Not found' })
})

export default router

