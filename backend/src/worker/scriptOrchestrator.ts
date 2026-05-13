/**
 * Script Orchestrator
 *
 * Manages the lifecycle of admin-triggered Riot maintenance scripts.
 * Enforces the constraint that only ONE script runs at a time.
 *
 * Scripts:
 *   'puuid-migration' — Sync player PUUIDs after API key rotation (puuidMigrationScript.ts)
 *   'league-xp'       — Discover new players by Elo tier/division (leagueXpScript.ts)
 *
 * Match ingestion runs in the separate PM2 process `lelanation-poller-v2` (backend/src/main.ts),
 * not in this API process.
 *
 * Graceful shutdown: requestStop() signals the active script to finish its current batch/page.
 */
import { isDatabaseConfigured } from '../db.js'
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

export type ScriptName = 'puuid-migration' | 'league-xp'

export interface OrchestratorStatus {
  activeScript: ScriptName | null
  isRunning: boolean
  startedAt: string | null
  finishedAt: string | null
  lastError: string | null
  shouldStop: boolean
  counters: Record<string, unknown>
}

interface ActiveState {
  name: ScriptName
  shouldStop: boolean
  startedAt: string
}

let active: ActiveState | null = null
let lastFinishedScript: ScriptName | null = null
let lastFinishedAt: string | null = null
let lastError: string | null = null

export function isAnyScriptRunning(): boolean {
  return active !== null
}

export function getActiveScriptName(): ScriptName | null {
  return active?.name ?? null
}

export function getOrchestratorStatus(): OrchestratorStatus {
  if (active?.name === 'puuid-migration') {
    const s: PuuidMigrationStatus = getPuuidMigrationStatus()
    return {
      activeScript: 'puuid-migration',
      isRunning: s.phase === 'running',
      startedAt: s.startedAt,
      finishedAt: s.finishedAt,
      lastError: s.lastError,
      shouldStop: active.shouldStop,
      counters: { phase: s.phase, requestCount: s.requestCount },
    }
  }

  if (active?.name === 'league-xp') {
    const s: LeagueXpStatus = getLeagueXpStatus()
    return {
      activeScript: 'league-xp',
      isRunning: s.phase === 'running',
      startedAt: s.startedAt,
      finishedAt: s.finishedAt,
      lastError: s.lastError,
      shouldStop: active.shouldStop,
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
    startedAt: active?.startedAt ?? null,
    finishedAt: lastFinishedAt,
    lastError,
    shouldStop: false,
    counters: {},
  }
}

export function requestStop(): void {
  if (active) active.shouldStop = true
}

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

  if (name === 'puuid-migration') {
    active = {
      name: 'puuid-migration',
      shouldStop: false,
      startedAt: new Date().toISOString(),
    }
    const ctx = active
    void runPuuidMigrationScript(() => ctx.shouldStop)
      .then(() => {
        lastFinishedScript = 'puuid-migration'
        lastFinishedAt = new Date().toISOString()
        lastError = getPuuidMigrationStatus().lastError
        active = null
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        lastFinishedScript = 'puuid-migration'
        lastFinishedAt = new Date().toISOString()
        lastError = msg
        active = null
      })
    return { ok: true }
  }

  if (name === 'league-xp') {
    active = {
      name: 'league-xp',
      shouldStop: false,
      startedAt: new Date().toISOString(),
    }
    const ctx = active
    void runLeagueXpScript(options ?? {}, () => ctx.shouldStop)
      .then(() => {
        lastFinishedScript = 'league-xp'
        lastFinishedAt = new Date().toISOString()
        lastError = getLeagueXpStatus().lastError
        active = null
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        lastFinishedScript = 'league-xp'
        lastFinishedAt = new Date().toISOString()
        lastError = msg
        active = null
      })
    return { ok: true }
  }

  return { ok: false, error: `Unknown script: ${name as string}` }
}

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
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  const started = await startScript(name, options)
  if (!started.ok) return started
  return { ok: true, previousScript }
}

/** @deprecated In-process poller removed; nothing to auto-start in the API process. */
export function startDefaultScript(): void {
  // no-op
}

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
