/**
 * Script Orchestrator
 *
 * Manages the lifecycle of all Riot data collection scripts.
 * Enforces the constraint that only ONE script runs at a time.
 *
 * Scripts:
 *   'poller'          — Main match data collection loop (riotPoller.ts)
 *   'puuid-migration' — Sync player PUUIDs after API key rotation (puuidMigrationScript.ts)
 *   'league-xp'       — Discover new players by Elo tier/division (leagueXpScript.ts)
 *
 * The poller is started automatically at app startup. The admin panel can stop
 * the current script and start a different one.
 *
 * Graceful shutdown: requestStop() signals the active script to finish its
 * current task before exiting. For the poller this means finishing the
 * current match fetch cycle; for the other scripts it means finishing the
 * current batch/page.
 */
import { isDatabaseConfigured } from '../db.js'
import {
  startRiotPoller,
  requestStopRiotPoller,
  isRiotPollerRunning,
  getRiotPollerStatus,
  getPollerLoopPromise,
  getAndClearTriggerPuuidMigrationOnPollerExit,
} from './riotPoller.js'
import {
  runPuuidMigrationScript,
  getPuuidMigrationStatus,
  type PuuidMigrationStatus,
} from './puuidMigrationScript.js'
import {
  runLeagueXpScript,
  getLeagueXpStatus,
  type LeagueXpOptions,
  type LeagueXpStatus,
} from './leagueXpScript.js'
export type { LeagueXpOptions }

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScriptName = 'poller' | 'puuid-migration' | 'league-xp'

export interface OrchestratorStatus {
  activeScript: ScriptName | null
  isRunning: boolean
  startedAt: string | null
  finishedAt: string | null
  lastError: string | null
  shouldStop: boolean
  /** Script-specific counters. Structure depends on which script is active. */
  counters: Record<string, unknown>
}

// ─── Mutable state ────────────────────────────────────────────────────────────

/** Tracks non-poller script runs (poller uses its own internal state). */
interface ActiveNonPollerState {
  name: 'puuid-migration' | 'league-xp'
  shouldStop: boolean
  startedAt: string
}

let activePoller = false  // mirrors isRiotPollerRunning() but we also track start intent
let activeNonPoller: ActiveNonPollerState | null = null
let lastFinishedScript: ScriptName | null = null
let lastFinishedAt: string | null = null
let lastError: string | null = null

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPollerActive(): boolean {
  return activePoller || isRiotPollerRunning()
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns true if any script is currently running. */
export function isAnyScriptRunning(): boolean {
  return isPollerActive() || activeNonPoller !== null
}

/** Returns the name of the currently active script, or null. */
export function getActiveScriptName(): ScriptName | null {
  if (isPollerActive()) return 'poller'
  if (activeNonPoller) return activeNonPoller.name
  return null
}

/**
 * Returns a unified status object for the current script.
 * For the poller, counters come from getRiotPollerStatus().
 * For other scripts, counters come from their own status getters.
 */
export function getOrchestratorStatus(): OrchestratorStatus {
  if (isPollerActive()) {
    const s = getRiotPollerStatus()
    return {
      activeScript: 'poller',
      isRunning: s.isRunning,
      startedAt: s.lastLoopStartedAt,
      finishedAt: s.lastLoopFinishedAt,
      lastError: s.lastError,
      shouldStop: s.shouldStop,
      counters: {
        requestCount: s.requestCount,
        error429Count: s.error429Count,
        error400Count: s.error400Count,
        matchesFetched: s.matchesFetched,
        playersFetched: s.playersFetched,
        participantsFetched: s.participantsFetched,
        matchesRankFixed: s.matchesRankFixed,
        participantsRankFixed: s.participantsRankFixed,
        participantsRoleFixed: s.participantsRoleFixed,
      },
    }
  }

  if (activeNonPoller?.name === 'puuid-migration') {
    const s: PuuidMigrationStatus = getPuuidMigrationStatus()
    return {
      activeScript: 'puuid-migration',
      isRunning: s.phase === 'running',
      startedAt: s.startedAt,
      finishedAt: s.finishedAt,
      lastError: s.lastError,
      shouldStop: activeNonPoller.shouldStop,
      counters: { phase: s.phase, requestCount: s.requestCount },
    }
  }

  if (activeNonPoller?.name === 'league-xp') {
    const s: LeagueXpStatus = getLeagueXpStatus()
    return {
      activeScript: 'league-xp',
      isRunning: s.phase === 'running',
      startedAt: s.startedAt,
      finishedAt: s.finishedAt,
      lastError: s.lastError,
      shouldStop: activeNonPoller.shouldStop,
      counters: {
        phase: s.phase,
        pagesProcessed: s.pagesProcessed,
        playersFound: s.playersFound,
        playersCreated: s.playersCreated,
        requestCount: s.requestCount,
        error429Count: s.error429Count,
        options: s.options,
      },
    }
  }

  return {
    activeScript: null,
    isRunning: false,
    startedAt: activeNonPoller?.startedAt ?? null,
    finishedAt: lastFinishedAt,
    lastError,
    shouldStop: false,
    counters: {},
  }
}

/**
 * Gracefully stop the currently running script.
 * The script will finish its current task (match fetch cycle / batch / page) before stopping.
 */
export function requestStop(): void {
  if (isPollerActive()) {
    requestStopRiotPoller()
  }
  if (activeNonPoller) {
    activeNonPoller.shouldStop = true
  }
}

/**
 * Start a script by name. Only one script may run at a time.
 * Returns { ok: false } with an error message if a script is already running.
 *
 * @param name    - 'poller' | 'puuid-migration' | 'league-xp'
 * @param options - LeagueXpOptions (only for 'league-xp')
 */
export async function startScript(
  name: ScriptName,
  options?: LeagueXpOptions
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isAnyScriptRunning()) {
    const current = getActiveScriptName()
    return { ok: false, error: `Script '${current}' is already running. Stop it first.` }
  }

  if (!isDatabaseConfigured()) {
    return { ok: false, error: 'DATABASE_URL not configured' }
  }

  if (name === 'poller') {
    activePoller = true
    startRiotPoller()
    // Clear activePoller flag once the loop finishes; if 400_decrypt triggered, start puuid-migration
    void (async () => {
      const loopPromise = getPollerLoopPromise()
      if (loopPromise) await loopPromise
      activePoller = false
      lastFinishedScript = 'poller'
      lastFinishedAt = new Date().toISOString()
      lastError = getRiotPollerStatus().lastError
      if (getAndClearTriggerPuuidMigrationOnPollerExit()) {
        const r = await startScript('puuid-migration')
        if (!r.ok) lastError = r.error
      }
    })()
    return { ok: true }
  }

  if (name === 'puuid-migration') {
    activeNonPoller = {
      name: 'puuid-migration',
      shouldStop: false,
      startedAt: new Date().toISOString(),
    }
    const ctx = activeNonPoller
    void runPuuidMigrationScript(
      () => ctx.shouldStop
    )
      .then(async () => {
        lastFinishedScript = 'puuid-migration'
        lastFinishedAt = new Date().toISOString()
        lastError = getPuuidMigrationStatus().lastError
        activeNonPoller = null
        // Requested behavior: restart poller automatically when migration is finished.
        if (!isAnyScriptRunning()) {
          const r = await startScript('poller')
          if (!r.ok) lastError = r.error
        }
      })
      .catch(async (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        lastFinishedScript = 'puuid-migration'
        lastFinishedAt = new Date().toISOString()
        lastError = msg
        activeNonPoller = null
        // Even on error, restart poller automatically unless another script was started.
        if (!isAnyScriptRunning()) {
          const r = await startScript('poller')
          if (!r.ok) lastError = r.error
        }
      })
    return { ok: true }
  }

  if (name === 'league-xp') {
    activeNonPoller = {
      name: 'league-xp',
      shouldStop: false,
      startedAt: new Date().toISOString(),
    }
    const ctx = activeNonPoller
    void runLeagueXpScript(
      options ?? {},
      () => ctx.shouldStop
    )
      .then(() => {
        lastFinishedScript = 'league-xp'
        lastFinishedAt = new Date().toISOString()
        lastError = getLeagueXpStatus().lastError
        activeNonPoller = null
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        lastFinishedScript = 'league-xp'
        lastFinishedAt = new Date().toISOString()
        lastError = msg
        activeNonPoller = null
      })
    return { ok: true }
  }

  return { ok: false, error: `Unknown script: ${name as string}` }
}

/**
 * Stop any running script gracefully, wait until idle, then start target script.
 * This is used by admin actions where a new script should replace current one.
 */
export async function switchToScript(
  name: ScriptName,
  options?: LeagueXpOptions
): Promise<{ ok: true; previousScript: ScriptName | null } | { ok: false; error: string }> {
  const previousScript = getActiveScriptName()
  if (isAnyScriptRunning()) {
    requestStop()
    const deadline = Date.now() + 10 * 60 * 1000
    while (isAnyScriptRunning()) {
      if (Date.now() >= deadline) {
        return { ok: false, error: 'Timed out waiting for running script to stop.' }
      }
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  const started = await startScript(name, options)
  if (!started.ok) return started
  return { ok: true, previousScript }
}

/** Delay before starting the Riot poller after a backend process start (avoids hammering Riot right after deploy). Default 2 min; set to 0 to disable. */
const RIOT_POLLER_STARTUP_DELAY_MS = Math.max(
  0,
  parseInt(process.env.RIOT_POLLER_STARTUP_DELAY_MS ?? '120000', 10) || 120_000
)

/**
 * Auto-start the default script (poller) at app startup.
 * Waits {@link RIOT_POLLER_STARTUP_DELAY_MS} first (post-restart cooldown); does not apply when the poller is started later from admin or after another script.
 * Idempotent: does nothing if a script is already running before or after the delay.
 */
export function startDefaultScript(): void {
  if (isAnyScriptRunning()) return

  void (async () => {
    if (RIOT_POLLER_STARTUP_DELAY_MS > 0) {
      await new Promise((r) => setTimeout(r, RIOT_POLLER_STARTUP_DELAY_MS))
    }
    if (!isAnyScriptRunning()) {
      const r = await startScript('poller')
      if (!r.ok) console.warn('[Orchestrator] Default poller did not start:', r.error)
    }
  })()
}

/** Convenience: get last finished script info (for admin panel display). */
export function getLastFinishedInfo(): {
  script: ScriptName | null
  finishedAt: string | null
  lastError: string | null
} {
  return {
    script: lastFinishedScript,
    finishedAt: lastFinishedAt,
    lastError,
  }
}
