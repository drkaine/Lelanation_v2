import cron from 'node-cron'
import { DiscordService } from '../services/DiscordService.js'
import { CronStatusService } from '../services/CronStatusService.js'
import {
  checkDiskSpaceAlert,
  formatBytes,
  saveDiskAlertState,
} from '../services/diskSpaceMonitor.js'
import {
  DISK_EMERGENCY_CLEANUP_THRESHOLD,
  runDiskEmergencyCleanup,
  shouldRunDiskEmergencyCleanup,
  type DiskEmergencyCleanupResult,
} from '../services/diskSpaceEmergencyCleanup.js'
import { createCronLogger } from '../utils/cronLogger.js'

async function maybeRunEmergencyCleanup(
  usagePercent: number,
  alertThreshold: number | null,
  lastCleanupAtThreshold: number
): Promise<DiskEmergencyCleanupResult | null> {
  if (
    !shouldRunDiskEmergencyCleanup({
      usagePercent,
      alertThreshold,
      lastCleanupAtThreshold,
    })
  ) {
    return null
  }
  return runDiskEmergencyCleanup()
}

export async function runDiskSpaceAlertOnce(): Promise<{
  ok: boolean
  alerted: boolean
  cleaned: boolean
  usagePercent: number
  alertThreshold: number | null
}> {
  const log = createCronLogger('diskSpaceAlert')
  const discordService = new DiscordService()
  const cronStatus = new CronStatusService()

  await cronStatus.markStart('diskSpaceAlert')
  await log.info('START disk space check')

  try {
    const result = await checkDiskSpaceAlert()
    const { snapshot, shouldAlert, alertThreshold, previousThreshold } = result

    const cleanup = await maybeRunEmergencyCleanup(
      snapshot.usagePercent,
      alertThreshold,
      result.state.lastCleanupAtThreshold
    )

    if (cleanup && !cleanup.skipped) {
      await saveDiskAlertState({
        ...result.state,
        lastCleanupAtThreshold: alertThreshold ?? DISK_EMERGENCY_CLEANUP_THRESHOLD,
        lastEmergencyCleanupAt: new Date().toISOString(),
      })

      await log.warn('Disk emergency cleanup executed', {
        deletedMatchAggregated: cleanup.deletedMatchAggregated,
        deletedRankHistory: cleanup.deletedRankHistory,
        rankHistoryCutoffDate: cleanup.rankHistoryCutoffDate,
      })

      await discordService.sendInfo(
        '🧹 Nettoyage disque d’urgence (≥ 95 %)',
        'Purge automatique : `match_aggregated` vidée et ancien `player_rank_history` supprimé.',
        {
          usage: `${snapshot.usagePercent}%`,
          matchAggregatedDeleted: cleanup.deletedMatchAggregated,
          rankHistoryDeleted: cleanup.deletedRankHistory,
          rankHistoryCutoff: cleanup.rankHistoryCutoffDate,
        }
      )
    }

    await log.info('Disk space checked', {
      mount: snapshot.mountPath,
      usagePercent: snapshot.usagePercent,
      alertThreshold,
      lastAlertedThreshold: previousThreshold,
      shouldAlert,
      emergencyCleanup: cleanup?.skipped === false,
    })

    if (shouldAlert && alertThreshold != null) {
      const severity =
        alertThreshold >= 90 ? 'critical' : alertThreshold >= 80 ? 'high' : 'warning'

      await discordService.sendAlert(
        `💾 Espace disque — ${alertThreshold}% atteint`,
        `Le volume \`${snapshot.mountPath}\` dépasse le seuil d'alerte (${alertThreshold}%).`,
        undefined,
        {
          usage: `${snapshot.usagePercent}%`,
          threshold: `${alertThreshold}%`,
          used: formatBytes(snapshot.usedBytes),
          free: formatBytes(snapshot.freeBytes),
          total: formatBytes(snapshot.totalBytes),
          mount: snapshot.mountPath,
          severity,
          previousThreshold:
            previousThreshold > 0 ? `${previousThreshold}%` : 'none',
          ...(cleanup && !cleanup.skipped
            ? {
                emergencyCleanup: 'yes',
                matchAggregatedDeleted: cleanup.deletedMatchAggregated,
                rankHistoryDeleted: cleanup.deletedRankHistory,
              }
            : {}),
        }
      )

      await cronStatus.markFailure(
        'diskSpaceAlert',
        new Error(`Disk usage ${snapshot.usagePercent}% (threshold ${alertThreshold}%)`)
      )
      await log.warn('Disk space threshold crossed', {
        usagePercent: snapshot.usagePercent,
        alertThreshold,
      })

      return {
        ok: false,
        alerted: true,
        cleaned: Boolean(cleanup && !cleanup.skipped),
        usagePercent: snapshot.usagePercent,
        alertThreshold,
      }
    }

    await cronStatus.markSuccess('diskSpaceAlert')
    return {
      ok: true,
      alerted: false,
      cleaned: Boolean(cleanup && !cleanup.skipped),
      usagePercent: snapshot.usagePercent,
      alertThreshold,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await cronStatus.markFailure('diskSpaceAlert', error)
    await log.error('Disk space check failed', { error: message })
    throw error
  }
}

export function setupDiskSpaceAlert(): void {
  if (process.env.DISK_SPACE_ALERT_DISABLED === '1') return

  const schedule = process.env.DISK_SPACE_ALERT_CRON ?? '*/15 * * * *'
  cron.schedule(schedule, () => void runDiskSpaceAlertOnce(), {
    timezone: 'Etc/UTC',
  })
}
