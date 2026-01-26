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
    const startTime = new Date()
    console.log('[Cron] Starting Data Dragon synchronization...')
    
    // Send start notification
    await discordService.sendSuccess(
      '🔄 Data Dragon Sync Started',
      'The daily synchronization cron job has started',
      {
        startedAt: startTime.toISOString(),
        scheduledTime: '02:00 UTC'
      }
    )
    
    await cronStatus.markStart('dataDragonSync')

    // Check for new version first
    const versionCheckResult = await versionService.checkForNewVersion()
    if (versionCheckResult.isErr()) {
      const error = versionCheckResult.unwrapErr()
      console.error('[Cron] Failed to check version:', error)
      await cronStatus.markFailure('dataDragonSync', error)
      
      const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
      await discordService.sendAlert(
        '❌ Data Dragon Sync - Version Check Failed',
        'Failed to check for new game version. Sync aborted.',
        error,
        {
          duration: `${duration}s`,
          timestamp: new Date().toISOString()
        }
      )
      return
    }

    const versionInfo = versionCheckResult.unwrap()
    const versionToSync = versionInfo.latest

    // If no new version and we already have data, skip sync
    if (!versionInfo.hasNew && versionInfo.current) {
      console.log(`[Cron] No new version available. Current: ${versionInfo.current}`)
      
      const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
      await discordService.sendSuccess(
        '✅ Data Dragon Sync - No Update Needed',
        `Current version is up to date. No synchronization needed.`,
        {
          currentVersion: versionInfo.current,
          latestVersion: versionInfo.latest,
          duration: `${duration}s`,
          timestamp: new Date().toISOString()
        }
      )
      return
    }

    console.log(`[Cron] Syncing game data for version: ${versionToSync}`)
    
    // Send notification about version update
    await discordService.sendSuccess(
      '🔄 Data Dragon Sync - New Version Detected',
      `Starting synchronization for new game version`,
      {
        currentVersion: versionInfo.current || 'None',
        newVersion: versionToSync,
        timestamp: new Date().toISOString()
      }
    )

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

      const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
      await discordService.sendAlert(
        '❌ Data Dragon Sync Failed',
        `Failed to synchronize game data after 10 retry attempts`,
        error,
        {
          version: versionToSync,
          duration: `${duration}s`,
          retries: '10',
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
      true, // Restart frontend PM2 after copying
      true  // Build frontend before restarting
    )
    
    let assetsStats = null
    if (copyResult.isOk()) {
      assetsStats = copyResult.unwrap()
      console.log(
        `[Cron] Static assets copied: ${assetsStats.dataCopied} data files, ${assetsStats.imagesCopied} images (${assetsStats.imagesSkipped} skipped)`
      )
    } else {
      const copyError = copyResult.unwrapErr()
      console.warn(
        `[Cron] Failed to copy static assets to frontend: ${copyError}`
      )
      // Send warning but don't fail the sync
      await discordService.sendAlert(
        '⚠️ Data Dragon Sync - Asset Copy Warning',
        'Sync completed but failed to copy static assets to frontend',
        copyError,
        {
          version: syncData.version,
          timestamp: new Date().toISOString()
        }
      )
    }

    await cronStatus.markSuccess('dataDragonSync')

    // Send success notification with details
    const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
    const successContext: Record<string, unknown> = {
      version: syncData.version,
      syncedAt: syncData.syncedAt.toISOString(),
      duration: `${duration}s`
    }
    
    if (assetsStats) {
      successContext.dataFiles = assetsStats.dataCopied
      successContext.imagesCopied = assetsStats.imagesCopied
      successContext.imagesSkipped = assetsStats.imagesSkipped
    }
    
    await discordService.sendSuccess(
      '✅ Data Dragon Sync Completed Successfully',
      `Game data synchronized and static assets copied to frontend`,
      successContext
    )
  })

  console.log('[Cron] Data Dragon sync scheduled: Daily at 02:00')
}
