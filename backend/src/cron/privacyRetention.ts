import cron from 'node-cron'
import { join } from 'path'
import { contactFilePath, withContactLock } from '../routes/contact.js'
import { runPrivacyRetention } from '../services/privacyRetention.js'
import { createCronLogger } from '../utils/cronLogger.js'

const logDir = process.env.LOG_DIR ?? join(process.cwd(), '..', 'logs')

export async function runPrivacyRetentionOnce(): Promise<void> {
  const log = createCronLogger('privacyRetention')
  try {
    const result = await runPrivacyRetention({ contactFile: contactFilePath, logDir, withContactLock })
    await log.info('Privacy retention done', result)
  } catch (error) {
    await log.error('Privacy retention failed', { error: String(error) })
  }
}

/** Suppression quotidienne des messages de contact et journaux de plus de 12 mois. */
export function setupPrivacyRetention(): void {
  void runPrivacyRetentionOnce()
  cron.schedule('30 4 * * *', () => void runPrivacyRetentionOnce(), { timezone: 'Etc/UTC' })
}
