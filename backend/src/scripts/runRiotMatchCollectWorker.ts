/**
 * Long-running worker: crawl Riot match data + enrich summoner_name in a loop, respecting rate limits.
 * Retries: (1) 401/403 → retry once with Admin key; (2) other errors → retry with backoff then next cycle.
 * Run under PM2/systemd with autorestart so that process crash = restart.
 *
 * Usage: npm run riot:worker (from backend/) or cd backend && npx tsx src/scripts/runRiotMatchCollectWorker.ts
 * Stop: Ctrl+C (SIGINT) or kill (SIGTERM).
 *
 * Env:
 *   RIOT_MATCH_CYCLE_DELAY_MS     - Pause between cycles (default 60_000 = 1 min).
 *   RIOT_MATCH_RATE_LIMIT_PAUSE_MS - Pause when 429 rate limit (default 300_000 = 5 min).
 *   RIOT_MATCH_ENRICH_PASSES      - Enrich passes per cycle (default 1). Réduire le blocage avant le prochain crawl.
 *   RIOT_MATCH_ENRICH_PER_PASS    - Players to enrich per pass (default 50). 150 = ~1 min d’API en série.
 *   RIOT_MATCH_CRAWL_RETRIES      - Retries for crawl on transient error (default 3).
 *   RIOT_MATCH_CRAWL_BACKOFF_MS   - Initial backoff between retries (default 30_000).
 */
import { spawn } from 'child_process'
import { config } from 'dotenv'
import { promises as fs } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { createScriptLogger } from '../utils/ScriptLogger.js'
import { enrichPlayers, countPlayersMissingSummonerName, countParticipantsMissingRank, countParticipantsMissingRole } from '../services/StatsPlayersRefreshService.js'
import { prisma } from '../db.js'
import { getRiotApiService } from '../services/RiotApiService.js'
import { DiscordService } from '../services/DiscordService.js'
import { getRiotApiRequestsSince } from '../services/RiotApiStatsService.js'
import { writeProgress } from '../utils/ProcessProgressWriter.js'
import { updateScriptStatusFromWorker } from '../utils/riotScriptStatus.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '..', '.env') })

const backendRoot = join(__dirname, '..', '..')
const SCRIPT_ID = 'riot:worker'
const log = createScriptLogger(SCRIPT_ID)

/** Run a riot script as child process; update status file (running → stopped/failed). Returns exit code. */
function runChildScript(script: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    void updateScriptStatusFromWorker(script, {
      status: 'running',
      lastStartAt: new Date().toISOString(),
      args: args.length ? args : undefined,
    })
    const childArgs = ['run', script, ...(args.length ? ['--', ...args] : [])]
    const child = spawn('npm', childArgs, {
      cwd: backendRoot,
      stdio: 'inherit',
      env: process.env,
    })
    void updateScriptStatusFromWorker(script, {
      status: 'running',
      pid: child.pid ?? undefined,
      lastStartAt: new Date().toISOString(),
      args: args.length ? args : undefined,
    })
    child.on('close', (code, signal) => {
      const exitCode = code ?? (signal === 'SIGTERM' ? 143 : 1)
      void updateScriptStatusFromWorker(script, {
        status: exitCode === 0 ? 'stopped' : 'failed',
        pid: undefined,
        lastEndAt: new Date().toISOString(),
        lastExitCode: exitCode,
      })
      resolve(exitCode)
    })
  })
}

/** Normal mode: 2 min between cycles to refill rate limit (100 req/2 min). */
const CYCLE_DELAY_MS = Math.max(0, parseInt(process.env.RIOT_MATCH_CYCLE_DELAY_MS ?? '120000', 10) || 120000)
/** In fast mode (high backlog): shorter delay between cycles. Default 30s. */
const FAST_CYCLE_DELAY_MS = Math.max(0, parseInt(process.env.RIOT_MATCH_FAST_CYCLE_DELAY_MS ?? '30000', 10) || 30000)
const FAST_BACKLOG_THRESHOLD = Math.max(5000, parseInt(process.env.RIOT_MATCH_FAST_BACKLOG_THRESHOLD ?? '20000', 10) || 20000)
const ENRICH_PASSES_AFTER_CYCLE = Math.max(0, parseInt(process.env.RIOT_MATCH_ENRICH_PASSES ?? '1', 10) || 1)
const ENRICH_PER_PASS = Math.max(10, parseInt(process.env.RIOT_MATCH_ENRICH_PER_PASS ?? '50', 10) || 50)

const HEARTBEAT_FILE = join(process.cwd(), 'data', 'cron', 'riot-worker-heartbeat.json')
const STOP_REQUEST_FILE = join(process.cwd(), 'data', 'cron', 'riot-worker-stop-request.json')

type HeartbeatPayload = {
  lastBeat: string
  cyclePhase: 'crawl' | 'enrich' | 'sleep'
  matchesCollectedThisCycle: number
  requestsThisCycle: number
}

async function writeHeartbeat(payload: HeartbeatPayload): Promise<void> {
  try {
    const dir = join(process.cwd(), 'data', 'cron')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(HEARTBEAT_FILE, JSON.stringify(payload, null, 0), 'utf-8')
  } catch {
    // ignore
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main(): Promise<void> {
  getRiotApiService().setKeyPreference(false)
  const discordService = new DiscordService()

  let running = true
  const onStop = () => {
    void log.info('Stop requested, finishing current cycle then exit.')
    running = false
  }
  process.on('SIGINT', onStop)
  process.on('SIGTERM', onStop)

  await log.start()
  await log.info(
    `Starting worker: backfill (if data null) or collect (with PID). Cycle delay=${CYCLE_DELAY_MS}ms, enrich after collect. Stop with Ctrl+C or admin "Stopper le poller".`
  )

  let cycle = 0
  while (running) {
    try {
      await fs.access(STOP_REQUEST_FILE)
      await fs.unlink(STOP_REQUEST_FILE)
      await log.info('Stop requested from admin, exiting after this cycle.')
      running = false
      break
    } catch {
      // no stop file, continue
    }

    cycle++
    const cycleStart = Date.now()
    let collected = 0
    const missingRanks = await countParticipantsMissingRank()
    const missingRoles = await countParticipantsMissingRole()
    const needsBackfill = missingRanks > 0 || missingRoles > 0

    if (needsBackfill) {
      await log.info(`Cycle ${cycle}: backfill prioritaire (missingRanks=${missingRanks} missingRoles=${missingRoles}), lancement riot:backfill-until-done`)
      await runChildScript('riot:backfill-until-done', [])
    } else {
      await log.info(`Cycle ${cycle}: pas de backfill à faire, lancement riot:collect`)
      await runChildScript('riot:collect', [])
      if (!running) break
      const missingSummonerName = await countPlayersMissingSummonerName()
      if (missingSummonerName > 0) {
        for (let p = 0; p < ENRICH_PASSES_AFTER_CYCLE && running; p++) {
          try {
            const { enriched } = await enrichPlayers(ENRICH_PER_PASS)
            if (enriched === 0) break
          } catch (e) {
            await log.warn('Enrich pass failed:', e)
          }
        }
      }
    }

    const unpoledCount = await prisma.player.count({ where: { lastSeen: null } }).catch(() => 0)
    const cycleDelayMs = unpoledCount >= FAST_BACKLOG_THRESHOLD ? FAST_CYCLE_DELAY_MS : CYCLE_DELAY_MS
    const elapsed = Math.round((Date.now() - cycleStart) / 1000)
    const requestsThisCycle = await getRiotApiRequestsSince(cycleStart)
    await log.jobResult('cycle', {
      success: true,
      cycle,
      elapsedSec: elapsed,
      collected,
      requestsThisCycle,
      sleepSec: cycleDelayMs / 1000,
    })
    await writeHeartbeat({
      lastBeat: new Date().toISOString(),
      cyclePhase: 'sleep',
      matchesCollectedThisCycle: collected,
      requestsThisCycle,
    })
    await writeProgress(SCRIPT_ID, {
      pid: process.pid,
      phase: 'sleep',
      metrics: {
        matchesCollected: collected,
        requestsUsed: requestsThisCycle,
      },
    })
    await sleep(cycleDelayMs)
  }

  await log.info(`Stopped after ${cycle} cycle(s).`)
  await log.end(0)
  await discordService.sendAlert(
    '🛑 Poller Riot – Arrêt',
    `Le worker de collecte Riot a été arrêté après ${cycle} cycle(s) (SIGINT/SIGTERM). Relancez-le manuellement ou via l’admin.`,
    undefined,
    { cycles: cycle, timestamp: new Date().toISOString() }
  )
}

main().catch(async (err) => {
  await log.error('Fatal:', err)
  await log.end(1)
  process.exit(1)
})
