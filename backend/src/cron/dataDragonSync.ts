import cron from 'node-cron'
import { DataDragonService } from '../services/DataDragonService.js'
import { VersionService } from '../services/VersionService.js'
import { DiscordService } from '../services/DiscordService.js'
import { retryWithBackoff } from '../utils/retry.js'
import { CronStatusService } from '../services/CronStatusService.js'
import { StaticAssetsService } from '../services/StaticAssetsService.js'

/**
 * Data Dragon synchronization cron job
 * Runs daily at 02:00 (2 AM)
 */
export function setupDataDragonSync(): void {
  const dataDragonService = new DataDragonService()
  const versionService = new VersionService()
  const discordService = new DiscordService()
  const cronStatus = new CronStatusService()
  const staticAssets = new StaticAssetsService()

  // Schedule daily sync at 02:00
  cron.schedule('0 2 * * *', async () => {
    console.log('[Cron] Starting Data Dragon synchronization...')
    await cronStatus.markStart('dataDragonSync')

    // Check for new version first
    const versionCheckResult = await versionService.checkForNewVersion()
    if (versionCheckResult.isErr()) {
      console.error('[Cron] Failed to check version:', versionCheckResult.unwrapErr())
      await cronStatus.markFailure('dataDragonSync', versionCheckResult.unwrapErr())
      await discordService.sendAlert(
        'Data Dragon Sync - Version Check Failed',
        'Failed to check for new game version',
        versionCheckResult.unwrapErr()
      )
      return
    }

    const versionInfo = versionCheckResult.unwrap()
    const versionToSync = versionInfo.latest

    // If no new version and we already have data, skip sync
    if (!versionInfo.hasNew && versionInfo.current) {
      console.log(`[Cron] No new version available. Current: ${versionInfo.current}`)
      return
    }

    console.log(`[Cron] Syncing game data for version: ${versionToSync}`)

    // Sync with retry logic
    const syncResult = await retryWithBackoff(
      () => dataDragonService.syncGameData(versionToSync),
      {
        maxRetries: 10,
        initialDelay: 1000,
        maxDelay: 30000,
        multiplier: 2
      }
    )

    if (syncResult.isErr()) {
      const error = syncResult.unwrapErr()
      console.error('[Cron] Data Dragon sync failed after retries:', error)
      await cronStatus.markFailure('dataDragonSync', error)

      await discordService.sendAlert(
        'Data Dragon Sync Failed',
        `Failed to synchronize game data after 10 retry attempts`,
        error,
        {
          version: versionToSync,
          timestamp: new Date().toISOString()
        }
      )
      return
    }

    const syncData = syncResult.unwrap()

    // Update version info
    const updateResult = await versionService.updateVersion(syncData.version)
    if (updateResult.isErr()) {
      console.error('[Cron] Failed to update version info:', updateResult.unwrapErr())
      // Don't fail the sync if version update fails
    }

    console.log(
      `[Cron] Data Dragon sync completed successfully. Version: ${syncData.version}, Synced at: ${syncData.syncedAt.toISOString()}`
    )

    // Copy static assets to frontend (for faster, scalable serving)
    console.log(`[Cron] Copying static assets to frontend...`)
    const copyResult = await staticAssets.copyAllAssetsToFrontend(
      syncData.version,
      ['fr_FR', 'en_US'],
      true // Restart frontend PM2 after copying
    )
    if (copyResult.isOk()) {
      const stats = copyResult.unwrap()
      console.log(
        `[Cron] Static assets copied: ${stats.dataCopied} data files, ${stats.imagesCopied} images (${stats.imagesSkipped} skipped)`
      )
    } else {
      console.warn(
        `[Cron] Failed to copy static assets to frontend: ${copyResult.unwrapErr()}`
      )
      // Don't fail the sync if static asset copy fails
    }

    await cronStatus.markSuccess('dataDragonSync')

    // Optional: Send success notification (can be disabled if too noisy)
    // await discordService.sendSuccess(
    //   'Data Dragon Sync Success',
    //   `Successfully synchronized game data`,
    //   {
    //     version: syncData.version,
    //     syncedAt: syncData.syncedAt.toISOString()
    //   }
    // )
  })

  console.log('[Cron] Data Dragon sync scheduled: Daily at 02:00')
}
