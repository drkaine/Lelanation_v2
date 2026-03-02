/**
 * PM2 Riot Worker: orchestration des scripts de collecte de données Riot.
 * - Vérifie les manques (ranks, rôles) → backfill si besoin
 * - Puis collecte normale (matchs)
 * - Arrêt gracieux: attend la fin de la tâche en cours (pas le cycle complet)
 * - Logs détaillés, heartbeat, stats API
 *
 * Usage: PM2 lelanation-riot-worker ou npm run riot:worker
 */
import { config } from 'dotenv'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { promises as fs } from 'fs'
import { createScriptLogger } from '../utils/ScriptLogger.js'
import { writeProgress, clearProgressAndStopRequest } from '../utils/ProcessProgressWriter.js'
import {
  countParticipantsMissingRank,
  countParticipantsMissingRole,
  backfillParticipantRanks,
  backfillParticipantRoles,
  refreshMatchRanks,
} from '../services/StatsPlayersRefreshService.js'
import { runRiotMatchCollectOnce } from '../cron/riotMatchCollect.js'
import { getRiotApiStats } from '../services/RiotApiStatsService.js'

const SCRIPT_ID = 'riot:worker'
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '..', '.env') })

const log = createScriptLogger(SCRIPT_ID)

const RIOT_WORKER_STOP_FILE = join(process.cwd(), 'data', 'cron', 'riot-worker-stop-request.json')
const RIOT_WORKER_HEARTBEAT_FILE = join(process.cwd(), 'data', 'cron', 'riot-worker-heartbeat.json')
const PUUID_MIGRATION_REQUEST_FILE = join(process.cwd(), 'data', 'cron', 'puuid-migration-requested.json')

const RANK_LIMIT_PER_ROUND = Math.min(500, parseInt(process.env.RIOT_BACKFILL_RANK_LIMIT ?? '100', 10) || 100)
const ROLE_LIMIT_PER_ROUND = Math.min(500, parseInt(process.env.RIOT_BACKFILL_ROLE_MATCH_LIMIT ?? '200', 10) || 200)

async function isWorkerStopRequested(): Promise<boolean> {
  try {
    await fs.access(RIOT_WORKER_STOP_FILE)
    return true
  } catch {
    return false
  }
}

async function clearWorkerStopRequest(): Promise<void> {
  try {
    await fs.unlink(RIOT_WORKER_STOP_FILE)
  } catch {
    // ignore
  }
}

async function writeHeartbeat(extra?: Record<string, unknown>): Promise<void> {
  try {
    await fs.mkdir(dirname(RIOT_WORKER_HEARTBEAT_FILE), { recursive: true })
    await fs.writeFile(
      RIOT_WORKER_HEARTBEAT_FILE,
      JSON.stringify({ lastBeat: new Date().toISOString(), ...extra }, null, 0),
      'utf-8'
    )
  } catch {
    // ignore
  }
}

async function checkAndRunPuuidMigration(): Promise<boolean> {
  try {
    await fs.access(PUUID_MIGRATION_REQUEST_FILE)
  } catch {
    return false
  }
  await log.info('PUUID migration requested (Exception decrypting detected), running riot:migrate-puuid...')
  await writeProgress(SCRIPT_ID, {
    phase: 'migrate-puuid',
    metrics: { requested: true },
  })
  try {
    const { spawn } = await import('child_process')
    await new Promise<void>((resolve, reject) => {
      const child = spawn('npm', ['run', 'riot:migrate-puuid'], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      })
      if (child.stdout) child.stdout.on('data', (d) => process.stdout.write(String(d)))
      if (child.stderr) child.stderr.on('data', (d) => process.stderr.write(String(d)))
      child.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`migrate-puuid exited ${code}`))
      })
    })
    await fs.unlink(PUUID_MIGRATION_REQUEST_FILE).catch(() => {})
    await log.info('PUUID migration completed.')
    return true
  } catch (e) {
    await log.error('PUUID migration failed:', e)
    return false
  }
}

async function runBackfillPhase(): Promise<{ ranksUpdated: number; rolesUpdated: number }> {
  let ranksUpdated = 0
  let rolesUpdated = 0

  const missingRanks = await countParticipantsMissingRank()
  const missingRoles = await countParticipantsMissingRole()

  if (missingRanks > 0) {
    await log.info(`Backfill ranks: ${missingRanks} participants sans rank`)
    await writeProgress(SCRIPT_ID, {
      phase: 'backfill-ranks',
      metrics: { participantsMissingData: missingRanks },
    })
    const { updated } = await backfillParticipantRanks(RANK_LIMIT_PER_ROUND, {
      shouldStop: () => isWorkerStopRequested(),
    })
    ranksUpdated = updated
    await log.info(`Backfill ranks: ${updated} mis à jour`)
  }

  if (await isWorkerStopRequested()) return { ranksUpdated, rolesUpdated }

  if (missingRoles > 0) {
    await log.info(`Backfill rôles: ${missingRoles} participants sans rôle`)
    await writeProgress(SCRIPT_ID, {
      phase: 'backfill-roles',
      metrics: { participantsMissingData: missingRoles },
    })
    const { updated } = await backfillParticipantRoles(ROLE_LIMIT_PER_ROUND, {
      shouldStop: () => isWorkerStopRequested(),
    })
    rolesUpdated = updated
    await log.info(`Backfill rôles: ${updated} mis à jour`)
  }

  if (ranksUpdated > 0 || rolesUpdated > 0) {
    await refreshMatchRanks()
  }

  return { ranksUpdated, rolesUpdated }
}

async function main(): Promise<void> {
  await log.start([])
  await writeProgress(SCRIPT_ID, {
    pid: process.pid,
    phase: 'starting',
    metrics: {},
  })

  if (await isWorkerStopRequested()) {
    await log.info('Stop requested before start, exiting.')
    await clearWorkerStopRequest()
    await clearProgressAndStopRequest(SCRIPT_ID)
    await log.end(0)
    return
  }

  // Check for PUUID migration request (e.g. after "Exception decrypting" from Riot)
  const migrationRan = await checkAndRunPuuidMigration()
  if (migrationRan && (await isWorkerStopRequested())) {
    await clearWorkerStopRequest()
    await clearProgressAndStopRequest(SCRIPT_ID)
    await log.end(0)
    return
  }

  while (true) {
    if (await isWorkerStopRequested()) {
      await log.info('Stop requested, exiting gracefully.')
      await clearWorkerStopRequest()
      await clearProgressAndStopRequest(SCRIPT_ID)
      await log.end(0)
      return
    }

    const missingRanks = await countParticipantsMissingRank()
    const missingRoles = await countParticipantsMissingRole()

    if (missingRanks > 0 || missingRoles > 0) {
      await runBackfillPhase()
      if (await isWorkerStopRequested()) {
        await clearWorkerStopRequest()
        await clearProgressAndStopRequest(SCRIPT_ID)
        await log.end(0)
        return
      }
      continue
    }

    // Normal collect
    await writeProgress(SCRIPT_ID, {
      phase: 'collect',
      metrics: {},
    })
    await log.info('Starting match collection...')
    const statsBefore = await getRiotApiStats()

    try {
      const result = await runRiotMatchCollectOnce({
        shouldStop: () => isWorkerStopRequested(),
      })
      const statsAfter = await getRiotApiStats()

      await writeHeartbeat({
        cyclePhase: 'collect',
        matchesCollectedThisCycle: result.collected,
        requestsThisCycle: statsAfter.requestsLastHour - statsBefore.requestsLastHour,
      })
      await writeProgress(SCRIPT_ID, {
        phase: 'done',
        metrics: {
          matchesCollected: result.collected,
          errors: result.errors,
          requestsLastMinute: statsAfter.requestsLastMinute,
          count429: statsAfter.count429Total,
        },
      })

      await log.info(
        `Collect done: ${result.collected} matchs, ${result.errors} erreurs. ` +
          `API: ${statsAfter.requestsLastMinute} req/min, ${statsAfter.count429Total}×429`
      )

      if (result.authError) {
        await log.warn('Auth error (401/403) - check API key')
        break
      }

      if (result.rateLimitHit) {
        await log.warn('Rate limit (429) hit - sleeping 60s before next cycle')
        await new Promise((r) => setTimeout(r, 60_000))
      }

      if (result.serverError5xx) {
        await log.warn('Too many 5xx - sleeping 120s before next cycle')
        await new Promise((r) => setTimeout(r, 120_000))
      }
    } catch (e) {
      await log.error('Collect failed:', e)
      await writeProgress(SCRIPT_ID, {
        phase: 'error',
        metrics: { error: String(e) },
      })
      await new Promise((r) => setTimeout(r, 30_000))
    }

    const delayMs = parseInt(process.env.RIOT_WORKER_CYCLE_DELAY_MS ?? '60000', 10) || 60_000
    await log.info(`Next cycle in ${delayMs / 1000}s`)
    await new Promise((r) => setTimeout(r, delayMs))
  }

  await clearProgressAndStopRequest(SCRIPT_ID)
  await log.end(0)
}

main().catch(async (err) => {
  await log.error('Fatal:', err)
  await clearProgressAndStopRequest(SCRIPT_ID)
  await log.end(1)
  process.exit(1)
})
