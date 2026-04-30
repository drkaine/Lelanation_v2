import cron from 'node-cron'
import { CronStatusService } from '../services/CronStatusService.js'
import { runLiveAggArchiveCheckpointOnce } from '../services/LiveAggArchiveCheckpointService.js'

const CRON_SCHEDULE = process.env.LIVE_AGG_ARCHIVE_CHECKPOINT_CRON_SCHEDULE ?? '*/10 * * * *'

export async function runLiveAggArchiveCheckpointCronOnce(): Promise<{
  ok: boolean
  error?: string
  livePatches?: string[]
  copiedTables?: string[]
  deletedRawRows?: number
}> {
  const cronStatus = new CronStatusService()
  await cronStatus.markStart('liveAggArchiveCheckpoint')
  try {
    const result = await runLiveAggArchiveCheckpointOnce()
    await cronStatus.markSuccess('liveAggArchiveCheckpoint')
    return {
      ok: true,
      livePatches: result.livePatches,
      copiedTables: result.copiedTables,
      deletedRawRows: result.deletedRawRows,
    }
  } catch (error) {
    await cronStatus.markFailure('liveAggArchiveCheckpoint', error)
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export function setupLiveAggArchiveCheckpoint(): void {
  cron.schedule(CRON_SCHEDULE, () => void runLiveAggArchiveCheckpointCronOnce(), {
    timezone: 'Etc/UTC',
  })
}
