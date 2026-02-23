/**
 * Précharge les caches stats en arrière-plan pour limiter 504/502 et premières requêtes lentes.
 * Lance après le démarrage du serveur (décalé) ; exécute les appels un par un avec délai pour ne pas surcharger la DB.
 */
import { isDatabaseConfigured } from '../db.js'
import { RiotStatsAggregator } from './RiotStatsAggregator.js'
import {
  getOverviewDetailStats,
  getOverviewDurationWinrateStats,
  getOverviewSidesStats,
} from './StatsOverviewService.js'
import { getOverviewAbandons } from './StatsAbandonsService.js'

const PREWARM_DELAY_MS = 20_000
const PREWARM_STEP_DELAY_MS = 3_000

const RANK_TIERS = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER'] as const

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function scheduleStatsPrewarm(): void {
  if (!isDatabaseConfigured()) return
  setTimeout(() => {
    runStatsPrewarm().catch((e) => {
      console.warn('[StatsPrewarm]', e instanceof Error ? e.message : e)
    })
  }, PREWARM_DELAY_MS)
  console.log('[StatsPrewarm] Scheduled in', PREWARM_DELAY_MS / 1000, 's')
}

async function runStatsPrewarm(): Promise<void> {
  if (!isDatabaseConfigured()) return
  const aggregator = new RiotStatsAggregator()
  let done = 0
  let failed = 0

  const run = async <T>(name: string, fn: () => Promise<T | null>): Promise<void> => {
    try {
      const result = await fn()
      if (result != null) {
        done++
        console.log('[StatsPrewarm]', name, 'ok')
      }
    } catch (e) {
      failed++
      console.warn('[StatsPrewarm]', name, 'failed:', e instanceof Error ? e.message : e)
    }
    await delay(PREWARM_STEP_DELAY_MS)
  }

  console.log('[StatsPrewarm] Starting...')

  // Overview-detail par rank (évite 504 sur onglet Détail avec filtre)
  for (const rank of RANK_TIERS) {
    await run(`overview-detail(rank=${rank}, smite=false)`, () =>
      getOverviewDetailStats(null, rank, false)
    )
    await run(`overview-detail(rank=${rank}, smite=true)`, () =>
      getOverviewDetailStats(null, rank, true)
    )
  }

  // Champions par rank (évite 15s au premier clic sur un rank dans la tier list)
  for (const rank of RANK_TIERS) {
    await run(`champions(rank=${rank})`, () => aggregator.load({ rankTier: rank, role: null }))
  }

  // Sans filtre (complément au warm déjà fait pour overview-detail null,null)
  await run('overview-duration-winrate(null)', () =>
    getOverviewDurationWinrateStats(null, null)
  )
  await run('overview-abandons(null)', () => getOverviewAbandons(null, null))
  await run('overview-sides(null)', () => getOverviewSidesStats(null, null))

  console.log('[StatsPrewarm] Done.', done, 'warmed,', failed, 'failed')
}
