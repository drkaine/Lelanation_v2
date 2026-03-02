/**
 * Run backfill (ranks + roles) in a loop until there is nothing left to backfill.
 * Single process, one PID; supports stop-request for graceful stop.
 *
 * Usage: npm run riot:backfill-until-done (from backend/)
 */
import { config } from 'dotenv'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { createScriptLogger } from '../utils/ScriptLogger.js'
import {
  backfillParticipantRanks,
  backfillParticipantRoles,
  refreshMatchRanks,
  countParticipantsMissingRank,
  countParticipantsMissingRole,
} from '../services/StatsPlayersRefreshService.js'
import {
  writeProgress,
  isStopRequested,
  clearProgressAndStopRequest,
} from '../utils/ProcessProgressWriter.js'

const SCRIPT_ID = 'riot:backfill-until-done'
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '..', '.env') })

const log = createScriptLogger(SCRIPT_ID)

const RANK_LIMIT_PER_ROUND = Math.min(5000, parseInt(process.env.RIOT_BACKFILL_RANK_LIMIT ?? '100', 10) || 100)
const ROLE_LIMIT_PER_ROUND = Math.min(500, parseInt(process.env.RIOT_BACKFILL_ROLE_MATCH_LIMIT ?? '200', 10) || 200)

async function main(): Promise<void> {
  await log.start([])
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

  let round = 0
  let totalRanksUpdated = 0
  let totalRolesUpdated = 0

  while (true) {
    if (await isStopRequested(SCRIPT_ID)) {
      await log.info('Stop requested, exiting.')
      await clearProgressAndStopRequest(SCRIPT_ID)
      await log.end(0)
      return
    }

    const missingRanks = await countParticipantsMissingRank()
    const missingRoles = await countParticipantsMissingRole()

    if (missingRanks === 0 && missingRoles === 0) {
      await log.info('Rien à backfill (ranks et rôles à jour). Refresh Match.rank final.')
      const { matchesUpdated } = await refreshMatchRanks()
      await writeProgress(SCRIPT_ID, {
        phase: 'done',
        metrics: {
          rounds: round,
          totalRanksUpdated,
          totalRolesUpdated,
          matchesUpdated,
        },
      })
      await log.info(`Done. Rounds=${round} totalRanksUpdated=${totalRanksUpdated} totalRolesUpdated=${totalRolesUpdated} matchesUpdated=${matchesUpdated}`)
      await clearProgressAndStopRequest(SCRIPT_ID)
      await log.end(0)
      return
    }

    round++
    await log.info(`Round ${round}: missingRanks=${missingRanks} missingRoles=${missingRoles}`)

    if (missingRanks > 0) {
      await writeProgress(SCRIPT_ID, {
        phase: 'backfill-ranks',
        metrics: { round, participantsMissingData: missingRanks, totalRanksUpdated, totalRolesUpdated },
      })
      const { updated, errors } = await backfillParticipantRanks(RANK_LIMIT_PER_ROUND, {
        shouldStop: () => isStopRequested(SCRIPT_ID),
      })
      totalRanksUpdated += updated
      await log.info(`Backfill ranks round ${round}: updated=${updated} errors=${errors}`)
      if (await isStopRequested(SCRIPT_ID)) {
        await clearProgressAndStopRequest(SCRIPT_ID)
        await log.end(0)
        return
      }
    }

    if (missingRoles > 0) {
      await writeProgress(SCRIPT_ID, {
        phase: 'backfill-roles',
        metrics: { round, participantsMissingData: missingRoles, totalRanksUpdated, totalRolesUpdated },
      })
      const { updated, errors } = await backfillParticipantRoles(ROLE_LIMIT_PER_ROUND, {
        shouldStop: () => isStopRequested(SCRIPT_ID),
      })
      totalRolesUpdated += updated
      await log.info(`Backfill roles round ${round}: updated=${updated} errors=${errors}`)
      if (await isStopRequested(SCRIPT_ID)) {
        await clearProgressAndStopRequest(SCRIPT_ID)
        await log.end(0)
        return
      }
    }

    await refreshMatchRanks()
  }
}

main().catch(async (err) => {
  await log.error('Fatal:', err)
  await log.end(1)
  process.exit(1)
})
