/**
 * Backfill participant rank (rankTier, rankDivision, rankLp) from Riot League API,
 * then recompute Match.rank for all matches.
 * Use this to fix many participants/matches with null rank (e.g. after fast mode or API failures).
 *
 * Usage: npm run riot:backfill-ranks (from backend/) or npm run riot:backfill-ranks -- 2000
 * Env: RIOT_BACKFILL_RANK_LIMIT (default 200) = max distinct puuids to process per run.
 */
import { config } from 'dotenv'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { createScriptLogger } from '../utils/ScriptLogger.js'
import {
  backfillParticipantRanks,
  refreshMatchRanks,
  countParticipantsMissingRank,
} from '../services/StatsPlayersRefreshService.js'
import {
  writeProgress,
  isStopRequested,
  clearProgressAndStopRequest,
} from '../utils/ProcessProgressWriter.js'

const SCRIPT_ID = 'riot:backfill-ranks'
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '..', '.env') })

const log = createScriptLogger(SCRIPT_ID)

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  await log.start(args)
  await writeProgress(SCRIPT_ID, {
    pid: process.pid,
    phase: 'starting',
    metrics: {},
  })

  if (await isStopRequested(SCRIPT_ID)) {
    await log.info('Stop requested before start, exiting.')
    await clearProgressAndStopRequest(SCRIPT_ID)
    await log.end(0)
    return
  }

  const missingCount = await countParticipantsMissingRank()
  if (missingCount === 0) {
    await log.info('Rien à faire : 0 participant sans rank. Refresh Match.rank uniquement.')
    await writeProgress(SCRIPT_ID, { phase: 'refresh-match-ranks', metrics: { participantsMissingData: 0 } })
  } else {
    const limitArg = process.argv[2]
    const limitEnv = process.env.RIOT_BACKFILL_RANK_LIMIT
    const limit = limitArg ? parseInt(limitArg, 10) : (limitEnv ? parseInt(limitEnv, 10) : 200)
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 5000) : 200

    await writeProgress(SCRIPT_ID, {
      phase: 'backfill-ranks',
      metrics: { participantsMissingData: missingCount },
    })
    await log.info(`Backfilling participant ranks (limit=${safeLimit}, ${missingCount} manquants)...`)
    const { updated, errors } = await backfillParticipantRanks(safeLimit, {
      shouldStop: () => isStopRequested(SCRIPT_ID),
    })
    await writeProgress(SCRIPT_ID, {
      phase: 'backfill-ranks-done',
      metrics: {
        participantsProcessed: missingCount,
        participantsMissingData: missingCount,
        errors,
        updated,
      },
    })
    await log.jobResult('backfill-ranks', {
      success: errors === 0,
      processed: missingCount,
      updated,
      errors,
      allFetched: errors === 0,
    })
  }

  if (await isStopRequested(SCRIPT_ID)) {
    await log.info('Stop requested, skipping refresh Match.rank.')
    await clearProgressAndStopRequest(SCRIPT_ID)
    await log.end(0)
    return
  }

  await writeProgress(SCRIPT_ID, { phase: 'refresh-match-ranks' })
  await log.info('Refreshing Match.rank...')
  const { matchesUpdated } = await refreshMatchRanks()
  await writeProgress(SCRIPT_ID, {
    phase: 'done',
    metrics: { matchesCollected: matchesUpdated },
  })
  await log.jobResult('refresh-match-ranks', { success: true, matchesUpdated })
  await log.info('Done.')
  await clearProgressAndStopRequest(SCRIPT_ID)
  await log.end(0)
}

main().catch(async (err) => {
  await log.error('Fatal:', err)
  await log.end(1)
  process.exit(1)
})
