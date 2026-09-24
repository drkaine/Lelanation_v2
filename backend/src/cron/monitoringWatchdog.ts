import cron from 'node-cron'
import { getMonitoringService } from '../monitoring/monitoringRuntime.js'

/** Health check every 5 min (critical → Discord now) + daily recap at 9:00 Paris time. */
export function setupMonitoringWatchdog(): void {
  if (process.env.MONITORING_DISABLED === '1') return

  const service = getMonitoringService()
  cron.schedule(process.env.MONITORING_CHECK_CRON ?? '*/5 * * * *', () => {
    service.runCheck().catch((e) => console.error('[Monitoring] check failed:', e))
  })
  cron.schedule(
    process.env.MONITORING_RECAP_CRON ?? '0 9 * * *',
    () => {
      service.runDailyRecap().catch((e) => console.error('[Monitoring] daily recap failed:', e))
    },
    { timezone: 'Europe/Paris' }
  )
}
