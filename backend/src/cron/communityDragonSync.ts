import cron from 'node-cron'
import { CommunityDragonService } from '../services/CommunityDragonService.js'
import { DiscordService } from '../services/DiscordService.js'
import { retryWithBackoff } from '../utils/retry.js'
import { CronStatusService } from '../services/CronStatusService.js'
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

  await cronStatus.markStart('communityDragonSync')

  await log.step('Syncing all champions')

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
    await log.error('Community Dragon sync failed after retries:', error)
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
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }

  const syncData = syncResult.unwrap()

  await log.info('Community Dragon sync completed. Synced:', syncData.synced, 'Failed:', syncData.failed, 'Skipped:', syncData.skipped)

  await log.step('Syncing ranked emblems')
  const emblemResult = await communityDragonService.syncRankedEmblems()
  if (emblemResult.isErr()) {
    await log.warn('Ranked emblems sync failed:', emblemResult.unwrapErr())
  } else {
    const emblemData = emblemResult.unwrap()
    await log.info('Ranked emblems:', emblemData.synced, 'synced,', emblemData.failed, 'failed')
  }

  await log.step('Syncing scoreboard objective icons')
  const objectiveIconsResult = await communityDragonService.syncScoreboardObjectiveIcons()
  if (objectiveIconsResult.isErr()) {
    await log.warn('Scoreboard objective icons sync failed:', objectiveIconsResult.unwrapErr())
  } else {
    const objectiveIconsData = objectiveIconsResult.unwrap()
    await log.info(
      'Scoreboard objective icons:',
      objectiveIconsData.synced,
      'synced,',
      objectiveIconsData.failed,
      'failed'
    )
  }

  await cronStatus.markSuccess('communityDragonSync')

  const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
  await log.step('Done', {
    synced: syncData.synced,
    failed: syncData.failed,
    skipped: syncData.skipped,
    duration: `${duration}s`
  })

  if (syncData.failed > 0) {
    const successContext: Record<string, unknown> = {
      synced: syncData.synced,
      failed: syncData.failed,
      skipped: syncData.skipped,
      duration: `${duration}s`,
      timestamp: new Date().toISOString(),
    }
    if (syncData.errors.length > 0) {
      successContext.errors = syncData.errors.slice(0, 10)
      if (syncData.errors.length > 10) {
        successContext.moreErrors = `${syncData.errors.length - 10} more errors...`
      }
    }
    await discordService.sendAlert(
      '⚠️ Community Dragon Sync Completed with Errors',
      `Sync completed but some champions failed to sync`,
      new Error(`${syncData.failed} champions failed to sync`),
      successContext
    )
  }

  return {
    ok: true,
    synced: syncData.synced,
    failed: syncData.failed,
    skipped: syncData.skipped,
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
