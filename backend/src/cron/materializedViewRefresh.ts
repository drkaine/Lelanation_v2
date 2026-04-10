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

const DEFAULT_GROUP_CRONS = [
  '0 */4 * * *',
  '15 */4 * * *',
  '30 */4 * * *',
  '45 */4 * * *',
] as const

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
        void refreshMaterializedViewGroup(i).catch((err) =>
          console.error(`[Cron] MV refresh group ${i} failed:`, err)
        )
      },
      { timezone: 'Etc/UTC' }
    )
    console.log(`[Cron] Staggered MV refresh group ${i}: ${schedule} (override: ${envKey})`)
  }
}
