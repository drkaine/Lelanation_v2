/**
 * Backfill participant role for rows where role is null, by reading Riot match payloads.
 * Usage: npm run riot:backfill-roles (from backend/) or npm run riot:backfill-roles -- 100
 * Env: RIOT_BACKFILL_ROLE_MATCH_LIMIT (default 50)
 */
import { config } from 'dotenv'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  backfillParticipantRoles,
  countParticipantsMissingRole,
} from '../services/StatsPlayersRefreshService.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '..', '.env') })

async function main(): Promise<void> {
  const missingCount = await countParticipantsMissingRole()
  if (missingCount === 0) {
    console.log('[riot:backfill-roles] Rien à faire : 0 participant sans role.')
    return
  }
  const limitArg = process.argv[2]
  const limitEnv = process.env.RIOT_BACKFILL_ROLE_MATCH_LIMIT
  const limit = limitArg ? parseInt(limitArg, 10) : (limitEnv ? parseInt(limitEnv, 10) : 50)
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 50

  console.log('[riot:backfill-roles] Backfilling participant roles (matches=%d, %d participants manquants)...', safeLimit, missingCount)
  const { updated, errors, matches } = await backfillParticipantRoles(safeLimit)
  console.log('[riot:backfill-roles] Matches processed: %d, participants updated: %d, errors: %d', matches, updated, errors)
  console.log('[riot:backfill-roles] Done.')
}

main().catch((err) => {
  console.error('[riot:backfill-roles]', err)
  process.exit(1)
})
