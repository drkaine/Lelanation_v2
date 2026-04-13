import { prisma } from '../db.js'
import { findLatestPollerSummaryEntries, type ParsedUnifiedLogEntry } from '../logging/unifiedAppLog.js'
import { getRiotPollerStatus, type RiotPollerStatus } from '../worker/riotPoller.js'

/** No recent poller_30m / poller_hourly line ⇒ treat as inactive (override with POLLER_ADMIN_LOG_STALE_MS, min 90 min). */
const envStale = process.env.POLLER_ADMIN_LOG_STALE_MS
const envStaleMs = envStale != null && envStale !== '' ? parseInt(envStale, 10) : NaN
const UNIFIED_LOG_STALE_MS = Math.max(
  90 * 60 * 1000,
  Number.isFinite(envStaleMs) && envStaleMs > 0 ? envStaleMs : 3.5 * 60 * 60 * 1000
)

export type RiotPollerAdminPayload = {
  isRunning: boolean
  status: 'running' | 'stopped' | 'error'
  lastError: string | null
  lastLoopStartedAt: string | null
  lastLoopFinishedAt: string | null
  requestCount: number
  error429Count: number
  error400Count: number
  matchesFetched: number
  playersFetched: number
  playersPolled: number
  participantsFetched: number
  matchesRankFixed: number
  participantsRankFixed: number
  participantsRoleFixed: number
  requestsPerMinute: number | null
  requestsPer2Min: number | null
  latestPlayerLastSeenAt: string | null
  /** process = in-memory (API + poller same Node); unified_log = dernier résumé dans lelanation-unified.log */
  statusSource: 'process' | 'unified_log' | 'unified_log_stale'
  /** Horodatage du dernier résumé poller_30m / poller_hourly utilisé (ISO) */
  snapshotUpdatedAt: string | null
  snapshotAgeMs: number | null
  heartbeatStale: boolean
  pollerExternal: boolean
  /** Deltas du dernier résumé log (pas cumul global) */
  nearLimitPauseCount?: number
  http429PauseCount?: number
}

function ratesFromBase(
  base: Pick<RiotPollerStatus, 'requestCount' | 'lastLoopStartedAt'>
): { requestsPerMinute: number | null; requestsPer2Min: number | null } {
  const startedAt = base.lastLoopStartedAt ? new Date(base.lastLoopStartedAt).getTime() : 0
  const elapsedMin = startedAt > 0 ? (Date.now() - startedAt) / 60000 : 0
  const requestsPerMinute =
    elapsedMin >= 1 / 60 ? Math.round((base.requestCount / elapsedMin) * 10) / 10 : null
  const requestsPer2Min = requestsPerMinute != null ? Math.round(requestsPerMinute * 2 * 10) / 10 : null
  return { requestsPerMinute, requestsPer2Min }
}

function statusFromBase(
  isRunning: boolean,
  lastError: string | null
): 'running' | 'stopped' | 'error' {
  if (isRunning) return 'running'
  if (lastError) return 'error'
  return 'stopped'
}

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function pickNewerSummary(
  a: ParsedUnifiedLogEntry | null,
  b: ParsedUnifiedLogEntry | null
): ParsedUnifiedLogEntry | null {
  if (!a) return b
  if (!b) return a
  return a.atIso >= b.atIso ? a : b
}

function payloadFromUnifiedLogEntry(
  e: ParsedUnifiedLogEntry,
  now: number,
  latestPlayerLastSeenAt: string | null,
  pollerExternal: boolean
): RiotPollerAdminPayload {
  const j = e.json ?? {}
  const totals = (j['totals'] as Record<string, unknown>) ?? {}
  const requestsPerHour = num(j['requestsPerHour'])
  const requestsPerMinute =
    requestsPerHour > 0 ? Math.round((requestsPerHour / 60) * 10) / 10 : null
  const requestsPer2Min =
    requestsPerHour > 0 ? Math.round((requestsPerHour / 30) * 10) / 10 : null

  const atMs = new Date(e.atIso).getTime()
  const ageMs = Number.isFinite(atMs) ? now - atMs : Infinity
  const fresh = ageMs < UNIFIED_LOG_STALE_MS

  const winStart = typeof j['windowStartIso'] === 'string' ? j['windowStartIso'] : null
  const winEnd = typeof j['windowEndIso'] === 'string' ? j['windowEndIso'] : null

  return {
    isRunning: fresh,
    status: statusFromBase(fresh, null),
    lastError: null,
    lastLoopStartedAt: winStart,
    lastLoopFinishedAt: winEnd,
    requestCount:
      typeof totals['httpRequests'] === 'number' ? num(totals['httpRequests']) : num(totals['requests']),
    error429Count: num(totals['error429']),
    error400Count: num(totals['error400']),
    matchesFetched:
      typeof totals['matchesInsertedDb'] === 'number'
        ? num(totals['matchesInsertedDb'])
        : num(totals['matches']),
    playersFetched: num(totals['newPlayers']),
    playersPolled: num(totals['playersPolled']),
    participantsFetched: num(totals['participants']),
    matchesRankFixed: 0,
    participantsRankFixed: 0,
    participantsRoleFixed: 0,
    requestsPerMinute,
    requestsPer2Min,
    latestPlayerLastSeenAt,
    statusSource: fresh ? 'unified_log' : 'unified_log_stale',
    snapshotUpdatedAt: e.atIso,
    snapshotAgeMs: Number.isFinite(ageMs) ? ageMs : null,
    heartbeatStale: !fresh,
    pollerExternal,
    nearLimitPauseCount: num(j['rateLimitRefreshPauses']),
    http429PauseCount: num(j['rateLimit429Pauses']),
  }
}

function emptyExternalPayload(
  latestPlayerLastSeenAt: string | null,
  pollerExternal: boolean
): RiotPollerAdminPayload {
  return {
    isRunning: false,
    status: 'stopped',
    lastError: null,
    lastLoopStartedAt: null,
    lastLoopFinishedAt: null,
    requestCount: 0,
    error429Count: 0,
    error400Count: 0,
    matchesFetched: 0,
    playersFetched: 0,
    playersPolled: 0,
    participantsFetched: 0,
    matchesRankFixed: 0,
    participantsRankFixed: 0,
    participantsRoleFixed: 0,
    requestsPerMinute: null,
    requestsPer2Min: null,
    latestPlayerLastSeenAt,
    statusSource: 'unified_log_stale',
    snapshotUpdatedAt: null,
    snapshotAgeMs: null,
    heartbeatStale: true,
    pollerExternal,
  }
}

export async function buildRiotPollerAdminPayload(): Promise<RiotPollerAdminPayload> {
  const memory = getRiotPollerStatus()
  const now = Date.now()
  const pollerExternal = !!process.env.POLLER_EXTERNAL

  const latestPlayerSeen = await prisma.player.findFirst({
    where: { lastSeen: { not: null } },
    orderBy: { lastSeen: 'desc' },
    select: { lastSeen: true },
  }).catch(() => null)

  const latestPlayerLastSeenAt = latestPlayerSeen?.lastSeen?.toISOString() ?? null

  if (pollerExternal) {
    const { last30m, lastHourly } = await findLatestPollerSummaryEntries()
    const e = pickNewerSummary(last30m, lastHourly)
    if (!e) return emptyExternalPayload(latestPlayerLastSeenAt, pollerExternal)
    return payloadFromUnifiedLogEntry(e, now, latestPlayerLastSeenAt, pollerExternal)
  }

  const { requestsPerMinute, requestsPer2Min } = ratesFromBase(memory)
  return {
    isRunning: memory.isRunning,
    status: statusFromBase(memory.isRunning, memory.lastError),
    lastError: memory.lastError,
    lastLoopStartedAt: memory.lastLoopStartedAt,
    lastLoopFinishedAt: memory.lastLoopFinishedAt,
    requestCount: memory.requestCount,
    error429Count: memory.error429Count,
    error400Count: memory.error400Count,
    matchesFetched: memory.matchesFetched,
    playersFetched: memory.playersFetched,
    playersPolled: memory.playersPolled,
    participantsFetched: memory.participantsFetched,
    matchesRankFixed: memory.matchesRankFixed,
    participantsRankFixed: memory.participantsRankFixed,
    participantsRoleFixed: memory.participantsRoleFixed,
    requestsPerMinute,
    requestsPer2Min,
    latestPlayerLastSeenAt,
    statusSource: 'process',
    snapshotUpdatedAt: null,
    snapshotAgeMs: null,
    heartbeatStale: false,
    pollerExternal,
  }
}
