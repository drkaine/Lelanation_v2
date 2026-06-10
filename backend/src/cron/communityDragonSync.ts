import cron from 'node-cron'
import { CommunityDragonService } from '../services/CommunityDragonService.js'
import { DiscordService } from '../services/DiscordService.js'
import { CronStatusService } from '../services/CronStatusService.js'
import { appendUnifiedLog } from '../logging/unifiedAppLog.js'
import { createCronLogger } from '../utils/cronLogger.js'

/**
 * Run Community Dragon sync once (used by cron schedule and manual trigger).
 */
export async function runCommunityDragonSyncOnce(): Promise<
  { ok: true; synced: number; failed: number; skipped: number } | { ok: false; error: string }
> {
  const communityDragonService = new CommunityDragonService()
  const discordService = new DiscordService()
  const cronStatus = new CronStatusService()
  const log = createCronLogger('communityDragonSync')

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

  if (failed > 0) {
    const allErrors = [
      ...emblemData.errors,
      ...objectiveIconsData.errors,
      ...pingIconsData.errors,
      ...mapPlannerData.errors,
      ...kaynHudData.errors,
    ]
    const successContext: Record<string, unknown> = {
      synced,
      failed,
      skipped: 0,
      duration: `${duration}s`,
      timestamp: new Date().toISOString(),
    }
    if (allErrors.length > 0) {
      successContext.errors = allErrors.slice(0, 10)
      if (allErrors.length > 10) {
        successContext.moreErrors = `${allErrors.length - 10} more errors...`
      }
    }
    await discordService.sendAlert(
      '⚠️ Community Dragon Assets Sync Completed with Errors',
      'Sync completed but some Community Dragon assets failed to sync',
      new Error(`${failed} assets failed to sync`),
      successContext
    )
  }

  await appendUnifiedLog({
    section: 'back',
    type: 'fin',
    script: 'community_dragon',
    message: 'Community Dragon sync terminé',
    json: {
      synced,
      failed,
      skipped: 0,
      durationSeconds: duration,
    },
  })

  return {
    ok: true,
    synced,
    failed,
    skipped: 0,
  }
}

/**
 * Community Dragon synchronization cron job
 * Runs daily at 03:00 (3 AM) - after Data Dragon sync
 */
export function setupCommunityDragonSync(): void {
  cron.schedule('0 3 * * *', () => void runCommunityDragonSyncOnce(), {
    timezone: 'Etc/UTC'
  })
}
