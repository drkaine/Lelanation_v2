/**
 * Cron horaire : remplit les tables stats pré-calculées (stats_precomputed_*).
 * Permet des réponses rapides à la première visite pour tous les filtres rank_tier.
 */
import cron from 'node-cron'
import { refreshPrecomputedStats } from '../services/StatsPrecomputedService.js'
import { isDatabaseConfigured } from '../db.js'

const CRON_SCHEDULE = process.env.STATS_PRECOMPUTED_CRON_SCHEDULE ?? '0 * * * *' // every hour at :00

export async function runStatsPrecomputedRefreshOnce(): Promise<{ ok: boolean; error?: string; refreshed?: string[] }> {
  if (!isDatabaseConfigured()) return { ok: true, refreshed: [] }
  return refreshPrecomputedStats()
}

export function setupStatsPrecomputedRefresh(): void {
  if (!isDatabaseConfigured()) {
    console.log('[Cron] Stats precomputed refresh: skipped (no DB)')
    return
  }
  cron.schedule(CRON_SCHEDULE, async () => {
    try {
      const result = await runStatsPrecomputedRefreshOnce()
      if (result.ok && result.refreshed?.length) {
        console.log('[Cron] Stats precomputed refreshed:', result.refreshed.length, 'entries')
      } else if (!result.ok) {
        console.warn('[Cron] Stats precomputed refresh failed:', result.error)
      }
    } catch (err) {
      console.error('[Cron] Stats precomputed refresh error:', err)
    }
  })
  console.log('[Cron] Stats precomputed refresh scheduled:', CRON_SCHEDULE)
}
