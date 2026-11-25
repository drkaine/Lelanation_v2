import cron from 'node-cron'
import { refreshPlayerDuos } from '../poll-orchestration/DuoRefresh.js'
import { createCronLogger } from '../utils/cronLogger.js'

export async function runDuoRefreshOnce(): Promise<void> {
  const log = createCronLogger('duoRefresh')
  try {
    const result = await refreshPlayerDuos()
    await log.info('Duo refresh done', result)
  } catch (error) {
    await log.error('Duo refresh failed', { error: String(error) })
  }
}

/** Recalcul quotidien des duos (requête lourde sur participants : pas de lancement au démarrage). */
export function setupDuoRefresh(): void {
  cron.schedule('15 3 * * *', () => void runDuoRefreshOnce(), { timezone: 'Etc/UTC' })
}
