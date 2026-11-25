import cron from 'node-cron'
import { pollerSettingsFile } from '../poller/pollerSettings.js'
import { applyPendingPollerSettings, restartPollerDetached } from '../services/PollerSettingsAdminService.js'
import { createCronLogger } from '../utils/cronLogger.js'

export async function runPollerSettingsSwitchOnce(): Promise<void> {
  const log = createCronLogger('pollerSettingsSwitch')
  try {
    if (applyPendingPollerSettings(pollerSettingsFile(), restartPollerDetached)) {
      await log.info('Poller settings applied, poller restarting')
    }
  } catch (error) {
    await log.error('Poller settings switch failed', { error: String(error) })
  }
}

/** 00 h heure serveur, juste avant le balayage du jour (00:01, `sweepDay`). */
export function setupPollerSettingsSwitch(): void {
  cron.schedule('0 0 * * *', () => void runPollerSettingsSwitchOnce())
}
