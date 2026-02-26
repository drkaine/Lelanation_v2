import cron from 'node-cron'
import { DataDragonService } from '../services/DataDragonService.js'
import { VersionService } from '../services/VersionService.js'
import { DiscordService } from '../services/DiscordService.js'
import { retryWithBackoff } from '../utils/retry.js'
import { CronStatusService } from '../services/CronStatusService.js'
import { StaticAssetsService } from '../services/StaticAssetsService.js'
import { createCronLogger } from '../utils/cronLogger.js'

/**
 * Run Data Dragon sync once (used by cron schedule and manual trigger).
 */
export async function runDataDragonSyncOnce(): Promise<{ ok: true; version?: string } | { ok: false; error: string }> {
  const dataDragonService = new DataDragonService()
  const versionService = new VersionService()
  const discordService = new DiscordService()
  const cronStatus = new CronStatusService()
  const staticAssets = new StaticAssetsService()
  const log = createCronLogger('dataDragonSync')

  const startTime = new Date()
  await log.info('START Data Dragon synchronization')

  try {
    await cronStatus.markStart('dataDragonSync')

    // Step 1: Check for new version
    await log.step('Step 1/4: Checking for new version')

    const versionCheckResult = await versionService.checkForNewVersion()
    if (versionCheckResult.isErr()) {
      const error = versionCheckResult.unwrapErr()
      await log.error('Failed to check version:', error)
      await cronStatus.markFailure('dataDragonSync', error)

      const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
      await discordService.sendAlert(
        '❌ Data Dragon Sync - Échec Étape 1/4',
        'Échec de la vérification de version. Synchronisation annulée.',
        error,
        {
          step: '1/4',
          duration: `${duration}s`,
          timestamp: new Date().toISOString()
        }
      )
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }

    const versionInfo = versionCheckResult.unwrap()
    const versionToSync = versionInfo.latest

    // If no new version and we already have data, skip sync
    if (!versionInfo.hasNew && versionInfo.current) {
      await log.info('No new version available. Current:', versionInfo.current)
      await cronStatus.markSuccess('dataDragonSync')
      return { ok: true }
    }

    await log.step('Step 2/4: Syncing game data', { version: versionToSync })

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
      await log.error('Data Dragon sync failed after retries:', error)
      await cronStatus.markFailure('dataDragonSync', error)

      const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
      await discordService.sendAlert(
        '❌ Data Dragon Sync - Échec Étape 2/4',
        `Échec de la synchronisation après 10 tentatives`,
        error,
        {
          step: '2/4',
          version: versionToSync,
          duration: `${duration}s`,
          retries: '10',
          timestamp: new Date().toISOString()
        }
      )
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }

    const syncData = syncResult.unwrap()

    // Update version info
    const updateResult = await versionService.updateVersion(syncData.version)
    if (updateResult.isErr()) {
      await log.warn('Failed to update version info:', updateResult.unwrapErr())
    }

    await log.info('Data Dragon sync completed. Version:', syncData.version, 'Synced at:', syncData.syncedAt.toISOString())

    // Step 3: Copy static assets to frontend
    await log.step('Step 3/4: Copying static assets to frontend', { version: syncData.version })

    const copyResult = await staticAssets.copyAllAssetsToFrontend(
      syncData.version,
      ['fr_FR', 'en_US'],
      true,
      true
    )

    let assetsStats = null
    if (copyResult.isOk()) {
      assetsStats = copyResult.unwrap()
      await log.info('Static assets copied:', assetsStats.dataCopied, 'data files,', assetsStats.imagesCopied, 'images,', assetsStats.imagesSkipped, 'skipped')
    } else {
      const copyError = copyResult.unwrapErr()
      await log.warn('Failed to copy static assets to frontend:', copyError)
      await discordService.sendAlert(
        '⚠️ Data Dragon Sync - Avertissement Étape 3/4',
        'Synchronisation terminée mais échec de la copie des assets statiques',
        copyError,
        {
          step: '3/4',
          version: syncData.version,
          timestamp: new Date().toISOString()
        }
      )
    }

    await cronStatus.markSuccess('dataDragonSync')

    const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
    await log.step('Step 4/4: Done', {
      version: syncData.version,
      duration: `${duration}s`,
      ...(assetsStats && { dataFiles: assetsStats.dataCopied, imagesCopied: assetsStats.imagesCopied, imagesSkipped: assetsStats.imagesSkipped })
    })

    return { ok: true, version: syncData.version }
  } catch (error) {
    await log.error('Unexpected error in Data Dragon sync:', error)
    await cronStatus.markFailure('dataDragonSync', error)
    const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
    await discordService.sendAlert(
      '❌ Data Dragon Sync - Erreur inattendue',
      'Une erreur inattendue s\'est produite pendant la synchronisation',
      error,
      {
        duration: `${duration}s`,
        timestamp: new Date().toISOString()
      }
    )
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Data Dragon synchronization cron job
 * Runs daily at 02:00 (2 AM)
 */
export function setupDataDragonSync(): void {
  cron.schedule('0 2 * * *', () => void runDataDragonSyncOnce(), {
    timezone: 'Etc/UTC'
  })

  console.log('[Cron] Data Dragon sync scheduled: Daily at 02:00 UTC')
}
