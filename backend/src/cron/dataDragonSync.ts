import cron from 'node-cron'
import { join } from 'path'
import { DataDragonService } from '../services/DataDragonService.js'
import { VersionService } from '../services/VersionService.js'
import { DiscordService } from '../services/DiscordService.js'
import { retryWithBackoff } from '../utils/retry.js'
import { CronStatusService } from '../services/CronStatusService.js'
import { StaticAssetsService } from '../services/StaticAssetsService.js'
import { appendUnifiedLog } from '../logging/unifiedAppLog.js'
import { createCronLogger } from '../utils/cronLogger.js'
import { ensureActivePatchVersion, syncActivePatchesFromConfigAndCounts } from '../services/ActivePatchService.js'
import { FileManager } from '../utils/fileManager.js'
import { TheorycraftDataBuilderService } from '../services/TheorycraftDataBuilderService.js'
import { scrapePatchNotesIfNeeded } from '../services/PatchNotesScraperService.js'
import { refreshApiRiotFixturesOnPatchChange } from '../services/ApiRiotFixturesService.js'
import {
  notifyDataDragonSynced,
  notifyNewVersionDetected,
} from '../services/gameDataSyncAlerts.js'
import { syncChampionRegions } from '../services/ChampionRegionSyncService.js'
import { runCommunityDragonSyncOnce } from './communityDragonSync.js'

/**
 * Run Data Dragon sync once (used by cron schedule and manual trigger).
 */
export async function runDataDragonSyncOnce(): Promise<{ ok: true; version?: string } | { ok: false; error: string }> {
  const dataDragonService = new DataDragonService()
  const versionService = new VersionService()
  const discordService = new DiscordService()
  const cronStatus = new CronStatusService()
  const staticAssets = new StaticAssetsService()
  const theorycraftBuilder = new TheorycraftDataBuilderService()
  const log = createCronLogger('dataDragonSync')

  const startTime = new Date()
  await log.info('START Data Dragon synchronization')
  await appendUnifiedLog({
    section: 'back',
    type: 'debut',
    script: 'datadragon',
    message: 'Data Dragon sync démarré',
  })

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

    if (versionInfo.hasNew) {
      await notifyNewVersionDetected({
        previousVersion: versionInfo.current,
        latestVersion: versionToSync,
        triggeredBy: 'dataDragonSync',
      })
    }

    // If no new version and we already have data, skip sync
    if (!versionInfo.hasNew && versionInfo.current) {
      await syncActivePatchesFromConfigAndCounts().catch(() => undefined)

      await log.info('No new version available. Current:', versionInfo.current)
      await cronStatus.markSuccess('dataDragonSync')
      await appendUnifiedLog({
        section: 'back',
        type: 'fin',
        script: 'datadragon',
        message: 'Aucune mise à jour Data Dragon',
        json: { updated: false, currentVersion: versionInfo.current },
      })
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
    const patch = syncData.version.split('.').slice(0, 2).join('.')
    if (patch) {
      await ensureActivePatchVersion(patch).catch(() => undefined)
      await syncActivePatchesFromConfigAndCounts().catch(() => undefined)
      await log.info('Active patches synced after Data Dragon update', { patch })
    }

    // Update version info
    let releaseDateOverride: string | undefined = undefined
    try {
      const recap = await FileManager.readJson<{ versions?: Array<{ version: string; releaseDate: string; patchLabel: string }> }>(
        join(process.cwd(), 'data', 'game', 'versions.json')
      )
      if (recap.isOk()) {
        const label = patch
        const entry = (recap.unwrap().versions ?? []).find((v) => v.patchLabel === label || v.version === syncData.version)
        if (entry?.releaseDate) releaseDateOverride = entry.releaseDate
      }
    } catch {
      // ignore; fallback handled by VersionService
    }
    const updateResult = await versionService.updateVersion(syncData.version, releaseDateOverride)
    if (updateResult.isErr()) {
      await log.warn('Failed to update version info:', updateResult.unwrapErr())
    }

    await log.info('Data Dragon sync completed. Version:', syncData.version, 'Synced at:', syncData.syncedAt.toISOString())

    if (patch) {
      try {
        const fixtureResult = await refreshApiRiotFixturesOnPatchChange(patch)
        if (fixtureResult.refreshed) {
          await log.info('API Riot reference fixtures refreshed', {
            patch: fixtureResult.patch,
            matchId: fixtureResult.matchId,
            fieldDiff: fixtureResult.fieldDiff,
          })
        } else {
          await log.info('API Riot fixtures refresh skipped', {
            patch: fixtureResult.patch,
            reason: fixtureResult.reason,
          })
        }
      } catch (fixtureError) {
        const message = fixtureError instanceof Error ? fixtureError.message : String(fixtureError)
        await log.warn('API Riot fixtures refresh failed (non-blocking):', message)
      }
    }

    // Step 3: Scrape patch notes for new version (non-blocking, keeps previous patches)
    await log.step('Step 3/6: Scraping patch notes', { version: syncData.version })
    const patchScrapeResult = await scrapePatchNotesIfNeeded(syncData.version, 'dataDragonSync')
    if (!patchScrapeResult.ok) {
      await log.warn('Patch notes scrape failed (non-blocking):', patchScrapeResult.error)
    } else if (patchScrapeResult.scraped) {
      await log.info('Patch notes scraped', { patchVersion: patchScrapeResult.patchVersion })
    } else {
      await log.info('Patch notes scrape skipped', { reason: patchScrapeResult.reason })
    }

    // Step 4: Build theorycraft-ready static datasets
    await log.step('Step 4/6: Building theorycraft datasets', { version: syncData.version })
    const theorycraftBuild = await theorycraftBuilder.build(syncData.version)
    if (theorycraftBuild.isErr()) {
      await log.warn('Theorycraft dataset generation failed:', theorycraftBuild.unwrapErr())
    } else {
      const tc = theorycraftBuild.unwrap()
      await log.info('Theorycraft datasets built', { champions: tc.champions })
    }

    // Step 5: Copy static assets to frontend
    await log.step('Step 5/6: Copying static assets to frontend', { version: syncData.version })

    const copyResult = await staticAssets.copyAllAssetsToFrontend(
      syncData.version,
      ['fr_FR', 'en_US'],
      true,
      true,
      patch
    )

    let assetsStats = null
    if (copyResult.isOk()) {
      assetsStats = copyResult.unwrap()
      await log.info(
        'Static assets copied:',
        assetsStats.dataCopied,
        'data files,',
        assetsStats.imagesCopied,
        'images,',
        assetsStats.imagesSkipped,
        'skipped,',
        assetsStats.patchNotesMoved,
        'patch files moved,',
        'theorycraft-cache deleted:',
        assetsStats.theorycraftCacheDeleted
      )
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
    await log.step('Step 6/6: Done', {
      version: syncData.version,
      duration: `${duration}s`,
      ...(assetsStats && { dataFiles: assetsStats.dataCopied, imagesCopied: assetsStats.imagesCopied, imagesSkipped: assetsStats.imagesSkipped })
    })

    await appendUnifiedLog({
      section: 'back',
      type: 'fin',
      script: 'datadragon',
      message: `Data Dragon mis à jour — v${syncData.version}`,
      json: {
        updated: true,
        version: syncData.version,
        durationSeconds: duration,
        assets: assetsStats
          ? {
              dataFiles: assetsStats.dataCopied,
              imagesCopied: assetsStats.imagesCopied,
              imagesSkipped: assetsStats.imagesSkipped,
            }
          : null,
      },
    })

    await notifyDataDragonSynced({
      version: syncData.version,
      previousVersion: versionInfo.current,
      syncedAt: syncData.syncedAt.toISOString(),
      durationSeconds: duration,
      theorycraftChampions: theorycraftBuild.isOk() ? theorycraftBuild.unwrap().champions : undefined,
      assetsDataFiles: assetsStats?.dataCopied,
      assetsImagesCopied: assetsStats?.imagesCopied,
      triggeredBy: 'dataDragonSync',
    })

    // Champion regions vs LoL Universe: only when a new game version was synced.
    await log.step('Champion regions check (new patch)')
    const regionSyncResult = await syncChampionRegions({ triggeredBy: 'dataDragonSync' })
    if (!regionSyncResult.ok) {
      await log.warn('Champion region sync failed (non-blocking):', regionSyncResult.error)
    } else if (regionSyncResult.fileUpdated) {
      await log.info('Champion regions updated from Universe', {
        applied: regionSyncResult.applied.length,
      })
    }

    await log.step('Community Dragon assets sync (new patch)')
    const communityDragonResult = await runCommunityDragonSyncOnce({
      force: true,
      triggeredBy: 'dataDragonSync',
    })
    if (!communityDragonResult.ok) {
      await log.warn('Community Dragon sync failed (non-blocking):', communityDragonResult.error)
    } else if (communityDragonResult.updated) {
      await log.info('Community Dragon assets synced', {
        synced: communityDragonResult.synced,
        failed: communityDragonResult.failed,
      })
    }

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
 * Runs every hour at :00.
 * - Checks latest game version.
 * - If unchanged, exits quickly (no sync, no champion-region check).
 * - If new version, fetches Data Dragon, updates version.json, copies assets,
 *   then compares champion regions with LoL Universe.
 */
export function setupDataDragonSync(): void {
  cron.schedule('0 * * * *', () => void runDataDragonSyncOnce(), {
    timezone: 'Etc/UTC'
  })
}
