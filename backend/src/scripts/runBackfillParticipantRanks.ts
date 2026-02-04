/**
 * Backfill participant rank (rankTier, rankDivision, rankLp) from Riot League API,
 * then recompute Match.rank for all matches.
 * Usage: npm run riot:backfill-ranks (from backend/) or npm run riot:backfill-ranks -- 200
 * Env: RIOT_BACKFILL_RANK_LIMIT (default 200) = max distinct puuids to process per run.
 */
import { config } from 'dotenv'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { backfillParticipantRanks, refreshMatchRanks } from '../services/StatsPlayersRefreshService.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '..', '.env') })

async function main(): Promise<void> {
  const limitArg = process.argv[2]
  const limitEnv = process.env.RIOT_BACKFILL_RANK_LIMIT
  const limit = limitArg ? parseInt(limitArg, 10) : (limitEnv ? parseInt(limitEnv, 10) : 200)
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 200

  console.log('[riot:backfill-ranks] Backfilling participant ranks (limit=%d)...', safeLimit)
  const { updated, errors } = await backfillParticipantRanks(safeLimit)
  console.log('[riot:backfill-ranks] Participants updated: %d, errors: %d', updated, errors)

  console.log('[riot:backfill-ranks] Refreshing Match.rank...')
  const { matchesUpdated } = await refreshMatchRanks()
  console.log('[riot:backfill-ranks] Matches rank updated: %d', matchesUpdated)
  console.log('[riot:backfill-ranks] Done.')
}

main().catch((err) => {
  console.error('[riot:backfill-ranks]', err)
  process.exit(1)
})
