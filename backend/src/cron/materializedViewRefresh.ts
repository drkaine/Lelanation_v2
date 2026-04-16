/**
 * Refresh des vues matérialisées par groupes décalés (charge DB étalée).
 * Les créneaux par défaut : même période (toutes les 4 h UTC), minutes 0 / 15 / 30 / 45.
 */
import cron from 'node-cron'
import { isDatabaseConfigured } from '../db.js'
import {
  MV_REFRESH_GROUPS,
  refreshMaterializedViewGroup,
} from '../services/MaterializedViewService.js'
import { appendUnifiedLog } from '../logging/unifiedAppLog.js'
import { countMatchIngestQueueFiles } from '../worker/matchIngestQueue.js'
import {
  countRawIngestByStatus,
  isRawIngestQueueEnabled,
} from '../worker/matchIngestRawQueue.js'

const DEFAULT_GROUP_CRONS = [
  '0 */4 * * *',
  '15 */4 * * *',
  '30 */4 * * *',
  '45 */4 * * *',
] as const

function getMvRefreshQueueGateThreshold(): number {
  const raw = parseInt(process.env.MV_REFRESH_QUEUE_GATE_THRESHOLD ?? '', 10)
  if (!Number.isFinite(raw) || raw < 0) return 200
  return Math.min(500_000, raw)
}

async function shouldSkipMvRefreshDueToIngestBacklog(groupIndex: number): Promise<boolean> {
  const threshold = getMvRefreshQueueGateThreshold()
  if (threshold <= 0) return false

  let pending = 0
  let processing = 0
  let error = 0
  if (isRawIngestQueueEnabled()) {
    const raw = await countRawIngestByStatus()
    pending = raw.pending
    processing = raw.processing
    error = raw.error
  } else {
    pending = await countMatchIngestQueueFiles()
  }

  const backlog = pending + processing + error
  if (backlog < threshold) return false

  const message = `MV refresh groupe ${groupIndex} ignoré (ingest backlog=${backlog} >= seuil ${threshold})`
  console.log(`[Cron] ${message}`)
  await appendUnifiedLog({
    section: 'db',
    type: 'info',
    script: 'mv_refresh',
    message,
    json: {
      groupIndex,
      threshold,
      backlog,
      pending,
      processing,
      error,
      rawQueueEnabled: isRawIngestQueueEnabled(),
    },
  })
  return true
}

export function setupMaterializedViewStaggeredRefresh(): void {
  if (!isDatabaseConfigured()) return
  if (process.env.MV_STAGGERED_REFRESH_DISABLED === '1') {
    console.log('[Cron] Staggered MV refresh disabled (MV_STAGGERED_REFRESH_DISABLED=1)')
    return
  }

  const n = MV_REFRESH_GROUPS.length
  for (let i = 0; i < n; i++) {
    const envKey = `MV_REFRESH_GROUP_${i}_CRON` as const
    const schedule =
      process.env[envKey] ?? DEFAULT_GROUP_CRONS[i] ?? DEFAULT_GROUP_CRONS[0]
    cron.schedule(
      schedule,
      () => {
        void (async () => {
          if (await shouldSkipMvRefreshDueToIngestBacklog(i)) return
          await refreshMaterializedViewGroup(i)
        })().catch((err) => console.error(`[Cron] MV refresh group ${i} failed:`, err))
      },
      { timezone: 'Etc/UTC' }
    )
    console.log(`[Cron] Staggered MV refresh group ${i}: ${schedule} (override: ${envKey})`)
  }
}
