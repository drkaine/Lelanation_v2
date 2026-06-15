import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { resolveFrontendRoot } from './seoCatalog'
import type { YouTubeChannelData, YouTubeChannelStatus, YouTubeVideo } from '~/types/youtube'

type ChannelsConfig = {
  channels: Array<{ channelId: string; channelName?: string } | string>
}

function readChannelsConfig(frontendRoot: string): ChannelsConfig['channels'] {
  const configPath = join(frontendRoot, 'public/data/youtube/channels.json')
  if (!existsSync(configPath)) return []
  try {
    const data = JSON.parse(readFileSync(configPath, 'utf-8')) as ChannelsConfig
    return Array.isArray(data.channels) ? data.channels : []
  } catch {
    return []
  }
}

export function readYouTubeChannelDataFromDisk(
  frontendRoot: string,
  channelId: string
): YouTubeChannelData | null {
  if (!channelId) return null
  const channelPath = join(frontendRoot, `public/data/youtube/${channelId}.json`)
  if (!existsSync(channelPath)) return null
  try {
    return JSON.parse(readFileSync(channelPath, 'utf-8')) as YouTubeChannelData
  } catch {
    return null
  }
}

export function loadYouTubeStatusFromDisk(cwd = process.cwd()): YouTubeChannelStatus[] {
  const frontendRoot = resolveFrontendRoot(cwd)
  const channels = readChannelsConfig(frontendRoot)
  return channels.map(entry => {
    const channelId = typeof entry === 'string' ? entry : entry.channelId
    const channelName = typeof entry === 'string' ? undefined : entry.channelName
    const data = readYouTubeChannelDataFromDisk(frontendRoot, channelId)
    return {
      channelId: data?.channelId || channelId,
      channelName: data?.channelName || channelName || channelId,
      synced: Boolean(data),
      lastSync: data?.lastSync ?? null,
      videoCount: Array.isArray(data?.videos) ? data.videos.length : 0,
    } satisfies YouTubeChannelStatus
  })
}

export function listAllYouTubeVideosFromDisk(cwd = process.cwd()): YouTubeVideo[] {
  const frontendRoot = resolveFrontendRoot(cwd)
  const youtubeDir = join(frontendRoot, 'public/data/youtube')
  if (!existsSync(youtubeDir)) return []

  const byId = new Map<string, YouTubeVideo>()
  for (const file of readdirSync(youtubeDir)) {
    if (!file.endsWith('.json') || file === 'channels.json') continue
    try {
      const data = JSON.parse(readFileSync(join(youtubeDir, file), 'utf-8')) as YouTubeChannelData
      for (const video of data.videos ?? []) {
        if (video?.id) byId.set(video.id, video)
      }
    } catch {
      // skip invalid channel file
    }
  }
  return [...byId.values()]
}
