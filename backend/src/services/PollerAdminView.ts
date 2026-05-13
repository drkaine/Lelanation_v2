import { prisma, isDatabaseConfigured } from '../db.js'
import { getStatistiquesPool, isStatistiquesDatabaseConfigured } from '../drizzle/statistiquesDb.js'
import {
  findLatestPollerSummaryEntries,
  type ParsedUnifiedLogEntry,
} from '../logging/unifiedAppLog.js'

/** No recent poller summary line ⇒ treat as inactive (override with POLLER_ADMIN_LOG_STALE_MS, min 90 min). */
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
  /** Ingestion runs in PM2 (`lelanation-poller-v2`); this payload is always from unified log summaries. */
  statusSource: 'unified_log' | 'unified_log_stale'
  snapshotUpdatedAt: string | null
  snapshotAgeMs: number | null
  heartbeatStale: boolean
  pollerExternal: boolean
  nearLimitPauseCount?: number
  http429PauseCount?: number
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

/** Résumés poller-v2 (delta + dbWindow) sans bloc `totals` legacy — aligné sur `poller-v2-observability`. */
function totalsFromV2Delta(d: Record<string, unknown>): Record<string, unknown> {
  const api4xx = num(d['api4xx'])
  const api429 = num(d['api429'])
  return {
    httpRequests: num(d['apiRequests']),
    requests: num(d['apiRequests']),
    error429: api429,
    error400: Math.max(0, api4xx - api429),
    matchesInsertedDb: num(d['matchesIngested']),
    matches: num(d['matchesIngested']),
    newPlayers: num(d['playersAdded']),
    playersPolled: num(d['playersPolled']),
    participants: num(d['participantsIngested']),
  }
}

function resolvePollerSummaryJson(j: Record<string, unknown>): {
  totals: Record<string, unknown>
  winStart: string | null
  winEnd: string | null
  requestsPerHour: number
} {
  const rawTotals = (j['totals'] as Record<string, unknown>) ?? {}
  const hasLegacyHttp = num(rawTotals['httpRequests']) + num(rawTotals['requests']) > 0
  let totals: Record<string, unknown> = { ...rawTotals }
  if (!hasLegacyHttp && j['delta'] && typeof j['delta'] === 'object' && j['delta'] !== null) {
    totals = totalsFromV2Delta(j['delta'] as Record<string, unknown>)
  }
  const db = (j['dbWindow'] as Record<string, unknown>) ?? {}
  const winStart =
    typeof j['windowStartIso'] === 'string'
      ? j['windowStartIso']
      : typeof db['windowStartIso'] === 'string'
        ? (db['windowStartIso'] as string)
        : null
  const winEnd =
    typeof j['windowEndIso'] === 'string'
      ? j['windowEndIso']
      : typeof db['windowEndIso'] === 'string'
        ? (db['windowEndIso'] as string)
        : null
  let requestsPerHour = num(j['requestsPerHour'])
  if (requestsPerHour <= 0) {
    const http = num(totals['httpRequests']) || num(totals['requests'])
    const win = j['window']
    const hours = win === '1h' ? 1 : win === '30m' ? 0.5 : 0
    if (hours > 0 && http > 0) {
      requestsPerHour = Math.round((http / hours) * 100) / 100
    }
  }
  return { totals, winStart, winEnd, requestsPerHour }
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
  latestPlayerLastSeenAt: string | null
): RiotPollerAdminPayload {
  const j = (e.json ?? {}) as Record<string, unknown>
  const { totals, winStart, winEnd, requestsPerHour } = resolvePollerSummaryJson(j)
  const requestsPerMinute =
    requestsPerHour > 0 ? Math.round((requestsPerHour / 60) * 10) / 10 : null
  const requestsPer2Min =
    requestsPerHour > 0 ? Math.round((requestsPerHour / 30) * 10) / 10 : null

  const atMs = new Date(e.atIso).getTime()
  const ageMs = Number.isFinite(atMs) ? now - atMs : Infinity
  const fresh = ageMs < UNIFIED_LOG_STALE_MS

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
    pollerExternal: true,
    nearLimitPauseCount: num(j['rateLimitRefreshPauses']),
    http429PauseCount: num(j['rateLimit429Pauses']),
  }
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
    const latestPlayerSeen = await prisma.player
      .findFirst({
        where: { lastSeen: { not: null } },
        orderBy: { lastSeen: 'desc' },
        select: { lastSeen: true },
      })
      .catch(() => null)
    latestPlayerLastSeenAt = latestPlayerSeen?.lastSeen?.toISOString() ?? null
  } else if (isStatistiquesDatabaseConfigured()) {
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
  if (!e) return emptyPayload(latestPlayerLastSeenAt)
  return payloadFromUnifiedLogEntry(e, now, latestPlayerLastSeenAt)
}
