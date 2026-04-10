/**
 * Standalone PM2 entry point for the Riot poller.
 *
 * Runs independently of the backend API server so that code-change restarts
 * (tsx watch) on the backend do NOT interrupt match ingestion.
 *
 * Lifecycle:
 *   1. Wait RIOT_POLLER_STARTUP_DELAY_MS (default 10 s, configurable).
 *   2. Run the poller loop (initRiotPoller → runLoop).
 *   3. If the poller exits due to 400_decrypt, run puuid-migration automatically.
 *   4. Restart the poller loop after puuid-migration completes.
 *   5. On SIGTERM/SIGINT: signal the poller to stop, the pipeline drains its
 *      queue (all already-fetched match data is ingested), then the process exits.
 *
 * Restart safety:
 *   - lastSeen is only updated after ALL matches for a player are ingested.
 *   - upsertMatchAndParticipants is idempotent (skips existing matches).
 *   - On ungraceful kill, the same players are re-polled on next startup
 *     (ordered by lastSeen ASC NULLS FIRST). A few API calls may be re-spent
 *     but data consistency is guaranteed.
 */
import 'dotenv/config'
import {
  startRiotPoller,
  requestStopRiotPoller,
  getPollerLoopPromise,
  getAndClearTriggerPuuidMigrationOnPollerExit,
  getRiotPollerStatus,
} from './riotPoller.js'
import { runPuuidMigrationScript } from './puuidMigrationScript.js'
import { appendUnifiedLog } from '../logging/unifiedAppLog.js'

const STARTUP_DELAY_MS = Math.max(
  0,
  parseInt(process.env.RIOT_POLLER_STARTUP_DELAY_MS ?? '10000', 10) || 10_000
)

let shutdownRequested = false

function requestShutdown(signal: string): void {
  if (shutdownRequested) return
  shutdownRequested = true
  console.log(`[PollerProcess] ${signal} — draining pipeline then exiting…`)
  void appendUnifiedLog({
    section: 'back',
    type: 'info',
    script: 'poller_process',
    message: `${signal} reçu — drain du pipeline en cours`,
  })
  requestStopRiotPoller()
}

process.on('SIGTERM', () => requestShutdown('SIGTERM'))
process.on('SIGINT', () => requestShutdown('SIGINT'))

async function main(): Promise<void> {
  console.log('[PollerProcess] Standalone poller starting')

  if (STARTUP_DELAY_MS > 0) {
    console.log(`[PollerProcess] Startup delay: ${STARTUP_DELAY_MS} ms`)
    await new Promise(r => setTimeout(r, STARTUP_DELAY_MS))
  }

  if (shutdownRequested) {
    console.log('[PollerProcess] Shutdown requested during startup delay — exiting')
    return
  }

  while (!shutdownRequested) {
    startRiotPoller()

    const loopPromise = getPollerLoopPromise()
    if (loopPromise) await loopPromise

    const status = getRiotPollerStatus()

    if (getAndClearTriggerPuuidMigrationOnPollerExit() && !shutdownRequested) {
      console.log('[PollerProcess] 400_decrypt — running puuid migration before restarting poller')
      void appendUnifiedLog({
        section: 'back',
        type: 'info',
        script: 'poller_process',
        message: '400_decrypt détecté — lancement migration PUUID',
      })
      await runPuuidMigrationScript(() => shutdownRequested)
      console.log('[PollerProcess] puuid migration done — restarting poller')
      continue
    }

    if (status.lastError && !shutdownRequested) {
      console.warn(`[PollerProcess] Poller stopped with error: ${status.lastError}`)
      void appendUnifiedLog({
        section: 'back',
        type: 'warning',
        script: 'poller_process',
        message: `Poller arrêté avec erreur, redémarrage dans 30 s`,
        json: { error: status.lastError },
      })
      await new Promise(r => setTimeout(r, 30_000))
      continue
    }

    if (!shutdownRequested) {
      await new Promise(r => setTimeout(r, 5_000))
    }
  }

  console.log('[PollerProcess] Shutdown complete')
  void appendUnifiedLog({
    section: 'back',
    type: 'info',
    script: 'poller_process',
    message: 'Processus poller arrêté proprement',
  })
}

void main().catch(err => {
  console.error('[PollerProcess] Fatal:', err)
  process.exit(1)
})
