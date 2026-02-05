import cron from 'node-cron'
import { CommunityDragonService } from '../services/CommunityDragonService.js'
import { StaticAssetsService } from '../services/StaticAssetsService.js'
import { DiscordService } from '../services/DiscordService.js'
import { retryWithBackoff } from '../utils/retry.js'
import { CronStatusService } from '../services/CronStatusService.js'

/**
 * Community Dragon synchronization cron job
 * Runs daily at 03:00 (3 AM) - after Data Dragon sync
 */
export function setupCommunityDragonSync(): void {
  const communityDragonService = new CommunityDragonService()
  const staticAssetsService = new StaticAssetsService()
  const discordService = new DiscordService()
  const cronStatus = new CronStatusService()

  // Schedule daily sync at 03:00 (after Data Dragon sync at 02:00)
  cron.schedule('0 3 * * *', async () => {
    const startTime = new Date()
    console.log('[Cron] Starting Community Dragon synchronization...')

    // Send start notification
    // await discordService.sendSuccess(
    //   '🔄 Community Dragon Sync Started',
    //   'The daily synchronization cron job has started',
    //   {
    //     startedAt: startTime.toISOString(),
    //     scheduledTime: '03:00 UTC',
    //   }
    // )

    await cronStatus.markStart('communityDragonSync')

    // Sync with retry logic
    const syncResult = await retryWithBackoff(
      () => communityDragonService.syncAllChampions(),
      {
        maxRetries: 3,
        initialDelay: 5000,
        maxDelay: 30000,
        multiplier: 2,
      }
    )

    if (syncResult.isErr()) {
      const error = syncResult.unwrapErr()
      console.error('[Cron] Community Dragon sync failed after retries:', error)
      await cronStatus.markFailure('communityDragonSync', error)

      const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
      await discordService.sendAlert(
        '❌ Community Dragon Sync Failed',
        `Failed to synchronize Community Dragon data after 3 retry attempts`,
        error,
        {
          duration: `${duration}s`,
          retries: '3',
          timestamp: new Date().toISOString(),
        }
      )
      return
    }

    const syncData = syncResult.unwrap()

    console.log(
      `[Cron] Community Dragon sync completed. Synced: ${syncData.synced}, Failed: ${syncData.failed}, Skipped: ${syncData.skipped}`
    )

    // Copy to frontend and delete from backend so data does not accumulate in backend
    const copyResult = await staticAssetsService.copyCommunityDragonDataToFrontend()
    if (copyResult.isErr()) {
      console.warn(
        `[Cron] Community Dragon: failed to copy to frontend / delete from backend: ${copyResult.unwrapErr()}`
      )
    } else {
      const { copied, deleted } = copyResult.unwrap()
      console.log(`[Cron] Community Dragon: ${copied} files copied to frontend, ${deleted} deleted from backend`)
    }

    await cronStatus.markSuccess('communityDragonSync')

    // Send success notification with details
    const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
    const successContext: Record<string, unknown> = {
      synced: syncData.synced,
      failed: syncData.failed,
      skipped: syncData.skipped,
      duration: `${duration}s`,
      timestamp: new Date().toISOString(),
    }

    // Include errors if any
    if (syncData.errors.length > 0) {
      successContext.errors = syncData.errors.slice(0, 10) // Limit to first 10 errors
      if (syncData.errors.length > 10) {
        successContext.moreErrors = `${syncData.errors.length - 10} more errors...`
      }
    }

    if (syncData.failed > 0) {
      await discordService.sendAlert(
        '⚠️ Community Dragon Sync Completed with Errors',
        `Sync completed but some champions failed to sync`,
        new Error(`${syncData.failed} champions failed to sync`),
        successContext
      )
    } else {
      // await discordService.sendSuccess(
      //   '✅ Community Dragon Sync Completed Successfully',
      //   `All champion data synchronized from Community Dragon`,
      //   successContext
      // )
    }
  }, {
    timezone: 'Etc/UTC'
  })

  console.log('[Cron] Community Dragon sync scheduled: Daily at 03:00 UTC')
}
