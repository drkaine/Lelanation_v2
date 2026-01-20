import cron from 'node-cron'
import { YouTubeService } from '../services/YouTubeService.js'
import { DiscordService } from '../services/DiscordService.js'
import { retryWithBackoff } from '../utils/retry.js'
import { FileManager } from '../utils/fileManager.js'
import { join } from 'path'
import { CronStatusService } from '../services/CronStatusService.js'

interface YouTubeChannelConfig {
  channelId: string
  channelName: string
}

type YouTubeChannelsConfigFile = {
  channels: Array<YouTubeChannelConfig | string>
}

/**
 * YouTube synchronization cron job
 * Runs daily at 03:00 (3 AM)
 */
export function setupYouTubeSync(): void {
  const youtubeService = new YouTubeService()
  const discordService = new DiscordService()
  const cronStatus = new CronStatusService()
  const configFile = join(process.cwd(), 'data', 'youtube', 'channels.json')

  // Schedule daily sync at 03:00
  cron.schedule('0 3 * * *', async () => {
    console.log('[Cron] Starting YouTube synchronization...')
    await cronStatus.markStart('youtubeSync')

    // Load channel configuration
    const configResult = await FileManager.readJson<YouTubeChannelsConfigFile>(configFile)

    if (configResult.isErr()) {
      // If config file doesn't exist, create empty one
      if (configResult.unwrapErr().code === 'FILE_NOT_FOUND') {
        const createResult = await FileManager.writeJson(configFile, {
          channels: []
        })
        if (createResult.isErr()) {
          console.error('[Cron] Failed to create channels config:', createResult.unwrapErr())
        }
      }

      console.log('[Cron] No YouTube channels configured. Skipping sync.')
      await cronStatus.markSuccess('youtubeSync')
      return
    }

    const config = configResult.unwrap()
    if (!config.channels || config.channels.length === 0) {
      console.log('[Cron] No YouTube channels configured. Skipping sync.')
      await cronStatus.markSuccess('youtubeSync')
      return
    }

    console.log(`[Cron] Syncing ${config.channels.length} YouTube channels...`)

    // Sync with retry logic
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
      console.error('[Cron] YouTube sync failed after retries:', error)
      await cronStatus.markFailure('youtubeSync', error)

      await discordService.sendAlert(
        'YouTube Sync Failed',
        `Failed to synchronize YouTube videos after 10 retry attempts`,
        error,
        {
          channelsCount: config.channels.length,
          timestamp: new Date().toISOString()
        }
      )
      return
    }

    const syncData = syncResult.unwrap()

    console.log(
      `[Cron] YouTube sync completed successfully. Synced ${syncData.syncedChannels}/${config.channels.length} channels, ${syncData.totalVideos} videos total`
    )
    await cronStatus.markSuccess('youtubeSync')
  })

  console.log('[Cron] YouTube sync scheduled: Daily at 03:00')
}
