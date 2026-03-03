/**
 * One-shot backup script to preserve players / participants data
 * before running PUUID/id migrations.
 *
 * Usage:
 *   npm run db:backup-pre-puuid-migration   (to be added in package.json)
 *
 * It creates two backup tables if they don't already exist:
 *   - players_backup_before_puuid_migration  (full copy of players)
 *   - participants_backup_before_puuid_migration (id, match_id, puuid)
 *
 * This ensures we keep:
 *   - all existing summoner_name values
 *   - all participants.puuid values
 */
import { config } from 'dotenv'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { prisma, isDatabaseConfigured } from '../db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '..', '.env') })

async function main(): Promise<void> {
  if (!isDatabaseConfigured()) {
    // eslint-disable-next-line no-console
    console.error('[backup-pre-puuid-migration] DATABASE_URL not set')
    process.exit(1)
  }

  // eslint-disable-next-line no-console
  console.log('[backup-pre-puuid-migration] Starting backup of players and participants…')

  // 1) Backup players (full row, including summoner_name, region, etc.)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS players_backup_before_puuid_migration AS
    SELECT * FROM players
  `)

  // 2) Backup participants PUUID mapping (minimal set of columns to keep puuid reference)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS participants_backup_before_puuid_migration AS
    SELECT id, match_id, puuid
    FROM participants
  `)

  // eslint-disable-next-line no-console
  console.log('[backup-pre-puuid-migration] Backup tables created (if they did not exist already).')
  process.exit(0)
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[backup-pre-puuid-migration] Fatal error:', err)
  process.exit(1)
})

