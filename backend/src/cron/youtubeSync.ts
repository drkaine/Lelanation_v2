import cron from 'node-cron'
import { YouTubeService } from '../services/YouTubeService.js'
import { DiscordService } from '../services/DiscordService.js'
import { retryWithBackoff } from '../utils/retry.js'
import { FileManager } from '../utils/fileManager.js'
import { join } from 'path'
import { CronStatusService } from '../services/CronStatusService.js'
import { StaticAssetsService } from '../services/StaticAssetsService.js'

interface YouTubeChannelConfig {
  channelId: string
  channelName: string
}

type YouTubeChannelsConfigFile = {
  channels: Array<YouTubeChannelConfig | string>
}

/**
 * YouTube synchronization cron job
 * Runs every hour (at minute 0)
 */
export function setupYouTubeSync(): void {
  const youtubeService = new YouTubeService()
  const discordService = new DiscordService()
  const cronStatus = new CronStatusService()
  const staticAssets = new StaticAssetsService()
  const configFile = join(process.cwd(), 'data', 'youtube', 'channels.json')

  // Schedule sync every hour
  cron.schedule('0 * * * *', async () => {
    const startTime = new Date()
    console.log('[Cron] Starting YouTube synchronization...')

    // Send start notification
    await discordService.sendSuccess(
      '🔄 YouTube Sync Started',
      'The hourly YouTube synchronization cron job has started',
      {
        startedAt: startTime.toISOString(),
        scheduledTime: 'Every hour (0 min) UTC',
      }
    )

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
      return
    }

    const syncData = syncResult.unwrap()

    console.log(
      `[Cron] YouTube sync completed successfully. Synced ${syncData.syncedChannels}/${config.channels.length} channels, ${syncData.totalVideos} videos total`
    )

    // Copy YouTube data to frontend (for faster, scalable serving)
    console.log(`[Cron] Copying YouTube data to frontend...`)
    const copyResult = await staticAssets.copyYouTubeAssetsToFrontend(true, true) // Restart and build frontend
    if (copyResult.isOk()) {
      const stats = copyResult.unwrap()
      console.log(
        `[Cron] YouTube assets copied: ${stats.copied} files, ${stats.deleted} backend files deleted`
      )
    } else {
      console.warn(
        `[Cron] Failed to copy YouTube assets to frontend: ${copyResult.unwrapErr()}`
      )
      // Don't fail the sync if static asset copy fails
    }

    await cronStatus.markSuccess('youtubeSync')

    // Send success notification with details
    const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
    const successContext: Record<string, unknown> = {
      syncedChannels: `${syncData.syncedChannels}/${config.channels.length}`,
      totalVideos: syncData.totalVideos,
      duration: `${duration}s`,
      timestamp: new Date().toISOString(),
    }

    if (copyResult.isOk()) {
      const stats = copyResult.unwrap()
      successContext.youtubeFilesCopied = stats.copied
      successContext.youtubeFilesDeleted = stats.deleted
    }

    await discordService.sendSuccess(
      '✅ YouTube Sync Completed Successfully',
      `YouTube videos synchronized and static assets copied to frontend`,
      successContext
    )
  }, {
    timezone: 'Etc/UTC'
  })

  console.log('[Cron] YouTube sync scheduled: Every hour (0 min UTC)')
}
