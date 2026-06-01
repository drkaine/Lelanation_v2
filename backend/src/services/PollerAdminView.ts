import { isDatabaseConfigured } from '../db/query.js'
import { getStatistiquesPool } from '../drizzle/statistiquesDb.js'
import {
  findLatestPollerSummaryEntries,
  type ParsedUnifiedLogEntry,
} from '../logging/unifiedAppLog.js'
import type { FullSnapshot } from '../observability/poller-metrics/types.js'

const envStale = process.env.POLLER_ADMIN_LOG_STALE_MS
const envStaleMs = envStale != null && envStale !== '' ? parseInt(envStale, 10) : NaN
const UNIFIED_LOG_STALE_MS = Math.max(
  90 * 60 * 1000,
  Number.isFinite(envStaleMs) && envStaleMs > 0 ? envStaleMs : 3.5 * 60 * 60 * 1000,
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
  statusSource: 'unified_log' | 'unified_log_stale'
  snapshotUpdatedAt: string | null
  snapshotAgeMs: number | null
  heartbeatStale: boolean
  pollerExternal: boolean
}

function statusFromBase(isRunning: boolean, lastError: string | null): 'running' | 'stopped' | 'error' {
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

function windowHours(script: string): number {
  if (script.endsWith('_1h') || script === 'poller_hourly') return 1
  if (script.endsWith('_30m') || script === 'poller_30m') return 0.5
  if (script.endsWith('_10m')) return 10 / 60
  return 1
}

function payloadFromV3Snapshot(
  snap: FullSnapshot,
  atIso: string,
  now: number,
  latestPlayerLastSeenAt: string | null,
  script: string,
): RiotPollerAdminPayload {
  const gw = snap.gateway
  const poll = snap.poll
  const ing = snap.ingestion
  const hours = windowHours(script)
  const requests = num(gw.total_requests)
  const requestsPerHour = hours > 0 ? Math.round((requests / hours) * 100) / 100 : 0
  const requestsPerMinute =
    requestsPerHour > 0 ? Math.round((requestsPerHour / 60) * 10) / 10 : null
  const requestsPer2Min =
    requestsPerHour > 0 ? Math.round((requestsPerHour / 30) * 10) / 10 : null

  const atMs = new Date(atIso).getTime()
  const ageMs = Number.isFinite(atMs) ? now - atMs : Infinity
  const fresh = ageMs < UNIFIED_LOG_STALE_MS

  return {
    isRunning: fresh,
    status: statusFromBase(fresh, null),
    lastError: null,
    lastLoopStartedAt: new Date(snap.ts - snap.uptime_ms).toISOString(),
    lastLoopFinishedAt: new Date(snap.ts).toISOString(),
    requestCount: requests,
    error429Count: num(gw.total_429s),
    error400Count: 0,
    matchesFetched: num(ing.matches_ingested),
    playersFetched: num(poll.players_new_added),
    playersPolled: num(poll.players_polled),
    participantsFetched: 0,
    matchesRankFixed: 0,
    participantsRankFixed: 0,
    participantsRoleFixed: 0,
    requestsPerMinute,
    requestsPer2Min,
    latestPlayerLastSeenAt,
    statusSource: fresh ? 'unified_log' : 'unified_log_stale',
    snapshotUpdatedAt: atIso,
    snapshotAgeMs: Number.isFinite(ageMs) ? ageMs : null,
    heartbeatStale: !fresh,
    pollerExternal: true,
  }
}

function pickNewerSummary(
  a: ParsedUnifiedLogEntry | null,
  b: ParsedUnifiedLogEntry | null,
): ParsedUnifiedLogEntry | null {
  if (!a) return b
  if (!b) return a
  return a.atIso >= b.atIso ? a : b
}

function emptyPayload(latestPlayerLastSeenAt: string | null): RiotPollerAdminPayload {
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
    pollerExternal: true,
  }
}

export async function buildRiotPollerAdminPayload(): Promise<RiotPollerAdminPayload> {
  const now = Date.now()

  let latestPlayerLastSeenAt: string | null = null
  if (isDatabaseConfigured()) {
    try {
      const pool = getStatistiquesPool()
      const r = await pool.query<{ d: Date | null }>(`SELECT MAX(last_seen) AS d FROM players`)
      latestPlayerLastSeenAt = r.rows[0]?.d?.toISOString() ?? null
    } catch {
      latestPlayerLastSeenAt = null
    }
  }

  const { last30m, lastHourly } = await findLatestPollerSummaryEntries()
  const e = pickNewerSummary(last30m, lastHourly)
  if (!e?.json) return emptyPayload(latestPlayerLastSeenAt)

  const j = e.json as Record<string, unknown>
  if (j.gateway && j.poll && j.ingestion) {
    return payloadFromV3Snapshot(j as unknown as FullSnapshot, e.atIso, now, latestPlayerLastSeenAt, e.script)
  }

  return emptyPayload(latestPlayerLastSeenAt)
}
