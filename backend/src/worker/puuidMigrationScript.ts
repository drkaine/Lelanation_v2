/**
 * Script 1: PUUID Key Migration
 *
 * Syncs all players whose puuidKeyVersion != current clefType by positional
 * matching against existing match history. Intended to be run after an API key
 * rotation. Can be triggered from the admin panel.
 *
 * Runs once (not a loop) and exits when all players are synced.
 */
import { appendUnifiedLog } from '../logging/unifiedAppLog.js'
import { isDatabaseConfigured } from '../db/query.js'
import { createRiotPollerLogger } from '../utils/riotPollerLogger.js'
import { initRiotClientForPuuidMigration, runPuuidKeySyncPhase2 } from './puuidKeySyncPhase2.js'

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

  await appendUnifiedLog({
    section: 'back',
    type: 'debut',
    script: 'puuid_migration',
    message: 'Script migration PUUID démarré',
  })

  const logger = createRiotPollerLogger('puuid_migration')

  try {
    const init = await initRiotClientForPuuidMigration()
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

    const { client, clefType, requestCountRef } = init

    await runPuuidKeySyncPhase2(client, logger, clefType, isShouldStop, requestCountRef)

    _status = {
      ..._status,
      phase: 'done',
      finishedAt: new Date().toISOString(),
      requestCount: requestCountRef.n,
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
