/**
 * Backfill participant role for rows where role is null, by reading Riot match payloads.
 * Usage: npm run riot:backfill-roles (from backend/) or npm run riot:backfill-roles -- 100
 * Env: RIOT_BACKFILL_ROLE_MATCH_LIMIT (default 50)
 */
import { config } from 'dotenv'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { createScriptLogger } from '../utils/ScriptLogger.js'
import {
  backfillParticipantRoles,
  countParticipantsMissingRole,
} from '../services/StatsPlayersRefreshService.js'
import {
  writeProgress,
  isStopRequested,
  clearProgressAndStopRequest,
} from '../utils/ProcessProgressWriter.js'

const SCRIPT_ID = 'riot:backfill-roles'
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

  const missingCount = await countParticipantsMissingRole()
  if (missingCount === 0) {
    await log.info('Rien à faire : 0 participant sans role.')
    await clearProgressAndStopRequest(SCRIPT_ID)
    await log.end(0)
    return
  }
  const limitArg = process.argv[2]
  const limitEnv = process.env.RIOT_BACKFILL_ROLE_MATCH_LIMIT
  const limit = limitArg ? parseInt(limitArg, 10) : (limitEnv ? parseInt(limitEnv, 10) : 50)
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 50

  await writeProgress(SCRIPT_ID, {
    phase: 'backfill-roles',
    metrics: { participantsMissingData: missingCount },
  })
  await log.info(`Backfilling participant roles (matches=${safeLimit}, ${missingCount} participants manquants)...`)
  const { updated, errors, matches } = await backfillParticipantRoles(safeLimit, {
    shouldStop: () => isStopRequested(SCRIPT_ID),
  })
  await writeProgress(SCRIPT_ID, {
    phase: 'done',
    metrics: {
      participantsProcessed: missingCount,
      participantsMissingData: missingCount,
      updated,
      errors,
      matchesCollected: matches,
    },
  })
  await log.jobResult('backfill-roles', {
    success: errors === 0,
    matches,
    updated,
    errors,
    allFetched: errors === 0,
  })
  await log.info('Done.')
  await clearProgressAndStopRequest(SCRIPT_ID)
  await log.end(0)
}

main().catch(async (err) => {
  await log.error('Fatal:', err)
  await log.end(1)
  process.exit(1)
})
