import { CommunityDragonService } from '../services/CommunityDragonService.js'
import { CronStatusService } from '../services/CronStatusService.js'
import { VersionService } from '../services/VersionService.js'
import { appendUnifiedLog } from '../logging/unifiedAppLog.js'
import { createCronLogger } from '../utils/cronLogger.js'
import { notifyCommunityDragonSynced } from '../services/gameDataSyncAlerts.js'

export type CommunityDragonSyncOptions = {
  /** Bypass version gate (manual admin trigger or post–Data Dragon sync). */
  force?: boolean
  triggeredBy?: string
}

/**
 * Run Community Dragon sync once (manual trigger or after a new game version from Data Dragon).
 */
export async function runCommunityDragonSyncOnce(
  options: CommunityDragonSyncOptions = {},
): Promise<
  { ok: true; synced: number; failed: number; skipped: number; updated?: boolean } | { ok: false; error: string }
> {
  const communityDragonService = new CommunityDragonService()
  const cronStatus = new CronStatusService()
  const versionService = new VersionService()
  const log = createCronLogger('communityDragonSync')
  const triggeredBy = options.triggeredBy ?? 'communityDragonSync'

  if (!options.force) {
    const versionCheckResult = await versionService.checkForNewVersion()
    if (versionCheckResult.isErr()) {
      const error = versionCheckResult.unwrapErr()
      await log.error('Failed to check game version:', error)
      await cronStatus.markFailure('communityDragonSync', error)
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }

    const versionInfo = versionCheckResult.unwrap()
    if (!versionInfo.hasNew && versionInfo.current) {
      await log.info('No new game version — Community Dragon sync skipped. Current:', versionInfo.current)
      await cronStatus.markSuccess('communityDragonSync')
      await appendUnifiedLog({
        section: 'back',
        type: 'fin',
        script: 'community_dragon',
        message: 'Community Dragon sync ignoré (pas de nouvelle version)',
        json: { updated: false, currentVersion: versionInfo.current },
      })
      return { ok: true, synced: 0, failed: 0, skipped: 0, updated: false }
    }
  }

  const startTime = new Date()
  await log.info('START Community Dragon synchronization')
  await appendUnifiedLog({
    section: 'back',
    type: 'debut',
    script: 'community_dragon',
    message: 'Community Dragon sync démarré',
  })

  await cronStatus.markStart('communityDragonSync')

  await log.step('Syncing ranked emblems')
  const emblemResult = await communityDragonService.syncRankedEmblems()

  await log.step('Syncing scoreboard objective icons')
  const objectiveIconsResult = await communityDragonService.syncScoreboardObjectiveIcons()

  await log.step('Syncing minimap ping icons')
  const pingIconsResult = await communityDragonService.syncMinimapPingIcons()

  await log.step('Syncing map planner assets')
  const mapPlannerResult = await communityDragonService.syncMapPlannerAssets()

  await log.step('Syncing Kayn HUD transform images')
  const kaynHudResult = await communityDragonService.syncKaynHudImages()

  if (
    emblemResult.isErr() ||
    objectiveIconsResult.isErr() ||
    pingIconsResult.isErr() ||
    mapPlannerResult.isErr() ||
    kaynHudResult.isErr()
  ) {
    const firstError = emblemResult.isErr()
      ? emblemResult.unwrapErr()
      : objectiveIconsResult.isErr()
        ? objectiveIconsResult.unwrapErr()
        : pingIconsResult.isErr()
          ? pingIconsResult.unwrapErr()
          : mapPlannerResult.isErr()
            ? mapPlannerResult.unwrapErr()
            : kaynHudResult.unwrapErr()
    await log.error('Community Dragon assets sync failed:', firstError)
    await cronStatus.markFailure('communityDragonSync', firstError)
    return { ok: false, error: firstError instanceof Error ? firstError.message : String(firstError) }
  }

  const emblemData = emblemResult.unwrap()
  const objectiveIconsData = objectiveIconsResult.unwrap()
  const pingIconsData = pingIconsResult.unwrap()
  const mapPlannerData = mapPlannerResult.unwrap()
  const kaynHudData = kaynHudResult.unwrap()
  const synced =
    emblemData.synced +
    objectiveIconsData.synced +
    pingIconsData.synced +
    mapPlannerData.synced +
    kaynHudData.synced
  const failed =
    emblemData.failed +
    objectiveIconsData.failed +
    pingIconsData.failed +
    mapPlannerData.failed +
    kaynHudData.failed

  await log.info('Ranked emblems:', emblemData.synced, 'synced,', emblemData.failed, 'failed')
  await log.info(
    'Scoreboard objective icons:',
    objectiveIconsData.synced,
    'synced,',
    objectiveIconsData.failed,
    'failed'
  )
  await log.info(
    'Minimap ping icons:',
    pingIconsData.synced,
    'synced,',
    pingIconsData.failed,
    'failed'
  )
  await log.info(
    'Map planner assets:',
    mapPlannerData.synced,
    'synced,',
    mapPlannerData.failed,
    'failed'
  )
  await log.info('Kayn HUD images:', kaynHudData.synced, 'synced,', kaynHudData.failed, 'failed')

  await cronStatus.markSuccess('communityDragonSync')

  const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
  await log.step('Done', {
    synced,
    failed,
    skipped: 0,
    duration: `${duration}s`
  })

  await notifyCommunityDragonSynced({
    synced,
    failed,
    emblemsSynced: emblemData.synced,
    objectiveIconsSynced: objectiveIconsData.synced,
    pingIconsSynced: pingIconsData.synced,
    mapPlannerSynced: mapPlannerData.synced,
    kaynHudSynced: kaynHudData.synced,
    durationSeconds: duration,
    triggeredBy,
  })

  await appendUnifiedLog({
    section: 'back',
    type: 'fin',
    script: 'community_dragon',
    message: 'Community Dragon sync terminé',
    json: {
      synced,
      failed,
      skipped: 0,
      updated: true,
      durationSeconds: duration,
    },
  })

  return {
    ok: true,
    synced,
    failed,
    skipped: 0,
    updated: true,
  }
}

/**
 * Community Dragon assets sync is version-gated: triggered by Data Dragon on patch change
 * (`runDataDragonSyncOnce`) or manually via admin. No standalone daily schedule.
 */
export function setupCommunityDragonSync(): void {
  // Intentionally empty — see dataDragonSync.ts
}
