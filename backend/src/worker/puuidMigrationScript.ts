/**
 * Script 1: PUUID Key Migration
 *
 * Syncs all players whose puuidKeyVersion != current clefType by positional
 * matching against existing match history. Intended to be run after an API key
 * rotation. Can be triggered from the admin panel or auto-triggered on 400-decrypt
 * errors in the main poller.
 *
 * Runs once (not a loop) and exits when all players are synced.
 */
import { isDatabaseConfigured } from '../db.js'
import { createRiotPollerLogger } from '../utils/riotPollerLogger.js'
import { initRiotPoller } from './riotPoller.js'
import { runPhase2 } from './riotPoller.js'

export interface PuuidMigrationStatus {
  phase: 'init' | 'running' | 'done' | 'error'
  startedAt: string | null
  finishedAt: string | null
  lastError: string | null
  requestCount: number
}

let _status: PuuidMigrationStatus = {
  phase: 'init',
  startedAt: null,
  finishedAt: null,
  lastError: null,
  requestCount: 0,
}

export function getPuuidMigrationStatus(): PuuidMigrationStatus {
  return { ..._status }
}

/**
 * Run the PUUID migration once.
 * @param isShouldStop - function that returns true when the script should stop gracefully
 * @param onUpdate     - optional callback invoked after each status update
 */
export async function runPuuidMigrationScript(
  isShouldStop: () => boolean,
  onUpdate?: (status: PuuidMigrationStatus) => void
): Promise<void> {
  if (!isDatabaseConfigured()) {
    _status = {
      ..._status,
      phase: 'error',
      lastError: 'DATABASE_URL not set',
      finishedAt: new Date().toISOString(),
    }
    onUpdate?.(_status)
    return
  }

  _status = {
    phase: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    lastError: null,
    requestCount: 0,
  }
  onUpdate?.(_status)

  const logger = createRiotPollerLogger()

  try {
    const init = await initRiotPoller()
    if (!init.ok) {
      _status = {
        ..._status,
        phase: 'error',
        lastError: 'Failed to init Riot client (check API key)',
        finishedAt: new Date().toISOString(),
      }
      onUpdate?.(_status)
      return
    }

    const { client, clefType } = init

    // Wrap shouldStop to also track request count via the client callbacks
    await runPhase2(client, logger, clefType, isShouldStop)

    _status = {
      ..._status,
      phase: 'done',
      finishedAt: new Date().toISOString(),
    }
    onUpdate?.(_status)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    _status = {
      ..._status,
      phase: 'error',
      lastError: msg,
      finishedAt: new Date().toISOString(),
    }
    onUpdate?.(_status)
    throw err
  }
}
