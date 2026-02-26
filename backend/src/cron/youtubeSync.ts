import cron from 'node-cron'
import { YouTubeService } from '../services/YouTubeService.js'
import { DiscordService } from '../services/DiscordService.js'
import { retryWithBackoff } from '../utils/retry.js'
import { FileManager } from '../utils/fileManager.js'
import { join } from 'path'
import { CronStatusService } from '../services/CronStatusService.js'
import { StaticAssetsService } from '../services/StaticAssetsService.js'
import { createCronLogger } from '../utils/cronLogger.js'

interface YouTubeChannelConfig {
  channelId: string
  channelName: string
}

type YouTubeChannelsConfigFile = {
  channels: Array<YouTubeChannelConfig | string>
}

/**
 * Run YouTube sync once (used by cron schedule and manual trigger).
 */
export async function runYouTubeSyncOnce(): Promise<
  { ok: true; syncedChannels: number; totalVideos: number } | { ok: false; error: string }
> {
  const youtubeService = new YouTubeService()
  const discordService = new DiscordService()
  const cronStatus = new CronStatusService()
  const staticAssets = new StaticAssetsService()
  const log = createCronLogger('youtubeSync')
  const configFile = join(process.cwd(), 'data', 'youtube', 'channels.json')

  const startTime = new Date()
  await log.info('START YouTube synchronization')

  await cronStatus.markStart('youtubeSync')

  // Load channel configuration
  const configResult = await FileManager.readJson<YouTubeChannelsConfigFile>(configFile)

  if (configResult.isErr()) {
    if (configResult.unwrapErr().code === 'FILE_NOT_FOUND') {
      const createResult = await FileManager.writeJson(configFile, { channels: [] })
      if (createResult.isErr()) {
        await log.error('Failed to create channels config:', createResult.unwrapErr())
      }
    }
    await log.info('No YouTube channels configured. Skipping sync.')
    await cronStatus.markSuccess('youtubeSync')
    return { ok: true, syncedChannels: 0, totalVideos: 0 }
  }

  const config = configResult.unwrap()
  if (!config.channels || config.channels.length === 0) {
    await log.info('No YouTube channels configured. Skipping sync.')
    await cronStatus.markSuccess('youtubeSync')
    return { ok: true, syncedChannels: 0, totalVideos: 0 }
  }

  await log.step('Syncing channels', { count: config.channels.length })

  const syncResult = await retryWithBackoff(
    () => youtubeService.syncChannels(config.channels),
    {
      maxRetries: 10,
      initialDelay: 1000,
      maxDelay: 30000,
      multiplier: 2
    }
  )

  if (syncResult.isErr()) {
    const error = syncResult.unwrapErr()
    await log.error('YouTube sync failed after retries:', error)
    await cronStatus.markFailure('youtubeSync', error)

    const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
    await discordService.sendAlert(
      '❌ YouTube Sync Failed',
      `Failed to synchronize YouTube videos after 10 retry attempts`,
      error,
      {
        channelsCount: config.channels.length,
        duration: `${duration}s`,
        retries: '10',
        timestamp: new Date().toISOString(),
      }
    )
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }

  const syncData = syncResult.unwrap()

  await log.info('YouTube sync completed. Synced', syncData.syncedChannels, '/', config.channels.length, 'channels,', syncData.totalVideos, 'videos total')

  // Copy YouTube data to frontend
  await log.step('Copying YouTube data to frontend')
  const copyResult = await staticAssets.copyYouTubeAssetsToFrontend(true, true)
  if (copyResult.isOk()) {
    const stats = copyResult.unwrap()
    await log.info('YouTube assets copied:', stats.copied, 'files,', stats.deleted, 'backend files deleted')
  } else {
    await log.warn('Failed to copy YouTube assets to frontend:', copyResult.unwrapErr())
  }

  await cronStatus.markSuccess('youtubeSync')

  const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
  await log.step('Done', {
    syncedChannels: `${syncData.syncedChannels}/${config.channels.length}`,
    totalVideos: syncData.totalVideos,
    duration: `${duration}s`
  })

  return {
    ok: true,
    syncedChannels: syncData.syncedChannels,
    totalVideos: syncData.totalVideos,
  }
}

/**
 * YouTube synchronization cron job
 * Runs every hour (at minute 0)
 */
export function setupYouTubeSync(): void {
  cron.schedule('0 * * * *', () => void runYouTubeSyncOnce(), {
    timezone: 'Etc/UTC'
  })

  console.log('[Cron] YouTube sync scheduled: Every hour (0 min UTC)')
}
