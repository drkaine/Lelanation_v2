import cron from 'node-cron'
import { promises as fs } from 'fs'
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
import {
  DATA_DRAGON_MAX_CATCH_UP_ATTEMPTS,
  planDataDragonCatchUp,
  runTheorycraftWorker,
  type DataDragonCatchUpPlan,
  type DataDragonPendingRun,
} from './dataDragonSyncRecovery.js'
import { scrapePatchNotesIfNeeded } from '../services/PatchNotesScraperService.js'
import { refreshApiRiotFixturesOnPatchChange } from '../services/ApiRiotFixturesService.js'
import {
  notifyDataDragonSynced,
  notifyNewVersionDetected,
} from '../services/gameDataSyncAlerts.js'
import { syncChampionRegions } from '../services/ChampionRegionSyncService.js'
import { runCommunityDragonSyncOnce } from './communityDragonSync.js'
import { watchWikiGlobalRules } from '../services/WikiGlobalRulesWatchService.js'
import { runMatchupGuideLinkCheck } from '../services/MatchupGuideLinkCheckService.js'


type CronLog = ReturnType<typeof createCronLogger>
type CopyAssetsStats = {
  dataCopied: number
  imagesCopied: number
  imagesSkipped: number
  patchNotesMoved: number
  theorycraftCacheDeleted: boolean
}

let syncRunning = false

function pendingRunPath(): string {
  return join(process.cwd(), 'data', 'cron', 'dataDragonSync-pending.json')
}

async function readPendingRun(): Promise<DataDragonPendingRun | null> {
  const res = await FileManager.readJson<DataDragonPendingRun>(pendingRunPath())
  if (res.isErr()) return null
  const v = res.unwrap()
  return v && typeof v.version === 'string' ? v : null
}

async function writePendingRun(run: DataDragonPendingRun): Promise<void> {
  await FileManager.writeJson(pendingRunPath(), run)
}

async function clearPendingRun(): Promise<void> {
  await fs.rm(pendingRunPath(), { force: true })
}

async function readFrontendPublishState(): Promise<{ gameVersion: string | null; patchVersions: string[] }> {
  const publicDir = join(process.cwd(), '..', 'frontend', 'public', 'data')
  const patchDir = process.env.PATCH_FRONTEND_DIR?.trim() || join(publicDir, 'patch-notes')
  const game = await FileManager.readJson<{ currentVersion?: string }>(join(publicDir, 'game', 'version.json'))
  const index = await FileManager.readJson<{ patches?: Array<{ version?: string }> }>(join(patchDir, 'index.json'))
  return {
    gameVersion: game.isOk() ? String(game.unwrap().currentVersion ?? '').trim() || null : null,
    patchVersions: index.isOk()
      ? (index.unwrap().patches ?? []).map((p) => String(p.version ?? '')).filter(Boolean)
      : [],
  }
}

/**
 * Steps 3-6 of a new-version sync: patch notes, theorycraft (child process), wiki watch, copy to frontend.
 * Clears the pending marker only when assets reached the frontend.
 */
async function runPublishSteps(
  version: string,
  patch: string,
  log: CronLog,
  discordService: DiscordService,
  staticAssets: StaticAssetsService
): Promise<{ assetsStats: CopyAssetsStats | null; theorycraftChampions: number | undefined }> {
  // Step 3: Scrape patch notes for new version (non-blocking, keeps previous patches)
  await log.step('Step 3/7: Scraping patch notes', { version: version })
  const patchScrapeResult = await scrapePatchNotesIfNeeded(version, 'dataDragonSync')
  if (!patchScrapeResult.ok) {
    await log.warn('Patch notes scrape failed (non-blocking):', patchScrapeResult.error)
  } else if (patchScrapeResult.scraped) {
    await log.info('Patch notes scraped', { patchVersion: patchScrapeResult.patchVersion })
  } else {
    await log.info('Patch notes scrape skipped', { reason: patchScrapeResult.reason })
  }

  // Step 4: Build theorycraft-ready static datasets
  await log.step('Step 4/7: Building theorycraft datasets', { version: version })
  const theorycraftBuild = await runTheorycraftWorker()
  let theorycraftChampions: number | undefined
  if (!theorycraftBuild.ok) {
    await log.warn('Theorycraft dataset generation failed:', theorycraftBuild.error)
  } else {
    const tc = theorycraftBuild.result
    theorycraftChampions = tc.champions
    await log.info('Theorycraft datasets built', { champions: tc.champions })
    if (tc.validationIssues > 0) {
      await log.warn('Theorycraft data validation issues detected', { count: tc.validationIssues })
    }
  }

  // Step 5: Watch wiki for global stats not present in Data Dragon
  await log.step('Step 5/7: Wiki global rules watch', { version: version })
  const wikiWatchResult = await watchWikiGlobalRules({
    patch: patch || version,
    triggeredBy: 'dataDragonSync',
  })
  if (!wikiWatchResult.ok) {
    await log.warn('Wiki global rules watch failed (non-blocking):', wikiWatchResult.error)
  } else if (wikiWatchResult.driftCount > 0 || wikiWatchResult.errorCount > 0) {
    await log.warn('Wiki global rules drift detected', {
      driftCount: wikiWatchResult.driftCount,
      errorCount: wikiWatchResult.errorCount,
      issues: wikiWatchResult.rules
        .filter((rule) => rule.status !== 'ok')
        .slice(0, 10),
    })
  } else {
    await log.info('Wiki global rules match hardcoded constants', {
      rulesChecked: wikiWatchResult.rules.length,
    })
  }

  // Step 6: Copy static assets to frontend
  await log.step('Step 6/7: Copying static assets to frontend', { version: version })

  const copyResult = await staticAssets.copyAllAssetsToFrontend(
    version,
    ['fr_FR', 'en_US'],
    true,
    true,
    patch
  )

  let assetsStats: CopyAssetsStats | null = null
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
        version: version,
        timestamp: new Date().toISOString()
      }
    )
  }

  if (assetsStats) await clearPendingRun()
  return { assetsStats, theorycraftChampions }
}

/**
 * No new Data Dragon version: replay the publish steps if the previous run died before the frontend copy
 * (pending marker) or the frontend lags behind (game data / patch notes index). Alerts Discord.
 */
async function runCatchUpIfNeeded(
  currentVersion: string,
  log: CronLog,
  discordService: DiscordService,
  staticAssets: StaticAssetsService
): Promise<DataDragonCatchUpPlan> {
  const pending = await readPendingRun()
  const front = await readFrontendPublishState()
  const plan = planDataDragonCatchUp({
    pending,
    currentVersion,
    frontendGameVersion: front.gameVersion,
    frontendPatchVersions: front.patchVersions,
  })
  if (plan.reasons.length === 0) {
    if (pending) await clearPendingRun()
    return plan
  }

  const attempts = (pending?.attempts ?? 0) + (plan.resume ? 1 : 0)
  const context = {
    version: currentVersion,
    reasons: plan.reasons.join(', '),
    attempts: `${attempts}/${DATA_DRAGON_MAX_CATCH_UP_ATTEMPTS}`,
    previousStartAt: pending?.startedAt ?? 'n/a',
    frontendGameVersion: front.gameVersion ?? 'absent',
    timestamp: new Date().toISOString(),
  }

  if (plan.gaveUp) {
    if (!pending?.gaveUpAlerted) {
      await log.error('Data Dragon catch-up abandoned', context)
      await discordService.sendAlert(
        '❌ Data Dragon Sync - Rattrapage abandonné',
        `Publication de v${currentVersion} vers le frontend toujours incomplète après ${DATA_DRAGON_MAX_CATCH_UP_ATTEMPTS} tentatives. Action manuelle : npm run build:theorycraft-data && npm run copy:assets (backend), puis make deploy-frontend.`,
        new Error(plan.reasons.join(', ')),
        context
      )
      await writePendingRun({ ...(pending as DataDragonPendingRun), gaveUpAlerted: true })
    }
    return plan
  }

  await log.warn('Data Dragon publish incomplete, catching up', context)
  await discordService.sendAlert(
    plan.interrupted
      ? '⚠️ Data Dragon Sync - Exécution précédente interrompue'
      : '⚠️ Data Dragon Sync - Frontend en retard',
    plan.interrupted
      ? `La sync de v${pending?.version} s'est arrêtée avant l'étape 7/7 (process tué ?). Reprise des étapes 3 à 6.`
      : `Le frontend ne sert pas encore v${currentVersion}. Reprise des étapes 3 à 6.`,
    new Error(plan.reasons.join(', ')),
    context
  )
  await writePendingRun({
    version: currentVersion,
    startedAt: new Date().toISOString(),
    attempts,
  })
  const patch = currentVersion.split('.').slice(0, 2).join('.')
  const result = await runPublishSteps(currentVersion, patch, log, discordService, staticAssets)
  await appendUnifiedLog({
    section: 'back',
    type: result.assetsStats ? 'fin' : 'erreur',
    script: 'datadragon',
    message: result.assetsStats
      ? `Rattrapage Data Dragon terminé — v${currentVersion}`
      : `Rattrapage Data Dragon échoué — v${currentVersion}`,
    json: { ...context, assets: result.assetsStats },
  })
  return plan
}

/**
 * Run Data Dragon sync once (used by cron schedule and manual trigger).
 */
export async function runDataDragonSyncOnce(): Promise<{ ok: true; version?: string } | { ok: false; error: string }> {
  if (syncRunning) return { ok: true }
  syncRunning = true
  try {
    return await runDataDragonSyncUnguarded()
  } finally {
    syncRunning = false
  }
}

async function runDataDragonSyncUnguarded(): Promise<{ ok: true; version?: string } | { ok: false; error: string }> {
  const dataDragonService = new DataDragonService()
  const versionService = new VersionService()
  const discordService = new DiscordService()
  const cronStatus = new CronStatusService()
  const staticAssets = new StaticAssetsService()
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
      await runCatchUpIfNeeded(versionInfo.current, log, discordService, staticAssets)
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
            typeParamAdded: fixtureResult.typeParamCheck?.added ?? [],
          })
        } else {
          await log.info('API Riot fixtures refresh skipped', {
            patch: fixtureResult.patch,
            reason: fixtureResult.reason,
            typeParamValues: fixtureResult.typeParamCheck?.values ?? [],
          })
        }
      } catch (fixtureError) {
        const message = fixtureError instanceof Error ? fixtureError.message : String(fixtureError)
        await log.warn('API Riot fixtures refresh failed (non-blocking):', message)
      }
    }

    await writePendingRun({ version: syncData.version, startedAt: startTime.toISOString(), attempts: 1 })
    const publish = await runPublishSteps(syncData.version, patch, log, discordService, staticAssets)
    const assetsStats = publish.assetsStats

    await cronStatus.markSuccess('dataDragonSync')

    const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
    await log.step('Step 7/7: Done', {
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
      theorycraftChampions: publish.theorycraftChampions,
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

    await log.step('Matchup guide links check (new patch)')
    try {
      const links = await runMatchupGuideLinkCheck(syncData.version)
      await log.info('Matchup guide links checked', {
        checked: links.checked,
        dead: links.dead.length,
        unknown: links.unknown.length,
      })
      if (links.dead.length > 0) {
        await discordService.sendInfo(
          '🔗 Guides matchups - liens morts retirés du site',
          `${links.dead.length} lien(s) mort(s) sur ${links.checked}, retirés de /guides/champion. À supprimer aussi du Google Sheet :\n${links.dead.slice(0, 20).join('\n')}`,
          { version: syncData.version }
        )
      }
    } catch (linkError) {
      const message = linkError instanceof Error ? linkError.message : String(linkError)
      await log.warn('Matchup guide links check failed (non-blocking):', message)
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
