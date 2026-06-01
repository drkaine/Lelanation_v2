/**
 * Aggregate poller summary lines from lelanation-unified.log for admin charts.
 */
import { promises as fs } from 'fs'
import { parseUnifiedLogLine, getUnifiedLogPathResolved } from '../logging/unifiedAppLog.js'
import type { FullSnapshot } from '../observability/poller-metrics/types.js'

export type PollerLogSource =
  | 'poller_v3_10m'
  | 'poller_v3_30m'
  | 'poller_v3_1h'
  | 'poller_hourly'
  | 'poller_30m'

export type PollerMetricsBucket = {
  key: string
  periodStartIso: string
  requests: number
  error429: number
  error400: number
  matches: number
  matchesApiIngestComplete: number
  participants: number
  playersPolled: number
  newPlayers: number
  rateLimitRefreshPauses: number
  rateLimit429Pauses: number
  sampleCount: number
}

function bucketKey(atIso: string, granularity: 'hour' | 'day'): string {
  const d = new Date(atIso)
  if (Number.isNaN(d.getTime())) return atIso.slice(0, 10)
  const iso = d.toISOString()
  if (granularity === 'day') return iso.slice(0, 10)
  return iso.slice(0, 13)
}

function periodStartIso(key: string, granularity: 'hour' | 'day'): string {
  if (granularity === 'day') return `${key}T00:00:00.000Z`
  if (key.length >= 13) return `${key}:00:00.000Z`
  return key
}

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function metricsFromV3Snapshot(j: Record<string, unknown>): {
  requests: number
  error429: number
  error400: number
  matches: number
  matchesApiIngestComplete: number
  participants: number
  playersPolled: number
  newPlayers: number
} | null {
  const snap = j as Partial<FullSnapshot>
  if (snap.gateway && snap.poll && snap.ingestion) {
    return {
      requests: num(snap.gateway.total_requests),
      error429: num(snap.gateway.total_429s),
      error400: 0,
      matches: num(snap.ingestion.matches_ingested),
      matchesApiIngestComplete: num(snap.poll.matches_fetched_success),
      participants: 0,
      playersPolled: num(snap.poll.players_polled),
      newPlayers: num(snap.poll.players_new_added),
    }
  }
  return null
}

function metricsFromLegacyDelta(j: Record<string, unknown>): {
  requests: number
  error429: number
  error400: number
  matches: number
  matchesApiIngestComplete: number
  participants: number
  playersPolled: number
  newPlayers: number
} | null {
  const delta = j['delta'] as Record<string, unknown> | undefined
  if (!delta || typeof delta !== 'object') return null
  const api4xx = num(delta['api4xx'])
  const api429 = num(delta['api429'])
  return {
    requests: num(delta['apiRequests']) || num(delta['requests']),
    error429: api429,
    error400: Math.max(0, api4xx - api429),
    matches: num(delta['matchesIngested']) || num(delta['matches']),
    matchesApiIngestComplete: num(delta['matchesApiIngestComplete']),
    participants: num(delta['participantsIngested']) || num(delta['participants']),
    playersPolled: num(delta['playersPolled']),
    newPlayers: num(delta['playersAdded']) || num(delta['newPlayers']),
  }
}

export async function aggregatePollerMetricsFromUnifiedLog(options: {
  granularity: 'hour' | 'day'
  fromIso: string
  toIso: string
  sources: PollerLogSource[]
}): Promise<{ buckets: PollerMetricsBucket[]; logPath: string; linesScanned: number; matched: number }> {
  const file = getUnifiedLogPathResolved()
  let content: string
  try {
    content = await fs.readFile(file, 'utf-8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return { buckets: [], logPath: file, linesScanned: 0, matched: 0 }
    }
    throw e
  }

  const lines = content.split(/\r?\n/)
  const sourceSet = new Set(options.sources)
  const buckets = new Map<string, PollerMetricsBucket>()
  let matched = 0

  for (let i = 0; i < lines.length; i++) {
    const p = parseUnifiedLogLine(lines[i], i + 1)
    if (!p) continue
    if (!sourceSet.has(p.script as PollerLogSource)) continue
    if (p.atIso < options.fromIso || p.atIso > options.toIso) continue

    const j = p.json
    if (!j) continue

    const m = metricsFromV3Snapshot(j) ?? metricsFromLegacyDelta(j)
    if (!m) continue

    matched++
    const key = bucketKey(p.atIso, options.granularity)
    let b = buckets.get(key)
    if (!b) {
      b = {
        key,
        periodStartIso: periodStartIso(key, options.granularity),
        requests: 0,
        error429: 0,
        error400: 0,
        matches: 0,
        matchesApiIngestComplete: 0,
        participants: 0,
        playersPolled: 0,
        newPlayers: 0,
        rateLimitRefreshPauses: 0,
        rateLimit429Pauses: 0,
        sampleCount: 0,
      }
      buckets.set(key, b)
    }

    b.requests += m.requests
    b.error429 += m.error429
    b.error400 += m.error400
    b.matches += m.matches
    b.matchesApiIngestComplete += m.matchesApiIngestComplete
    b.participants += m.participants
    b.playersPolled += m.playersPolled
    b.newPlayers += m.newPlayers
    b.rateLimitRefreshPauses += num(j['rateLimitRefreshPauses'])
    b.rateLimit429Pauses += num(j['rateLimit429Pauses'])
    b.sampleCount += 1
  }

  const list = [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key))
  return { buckets: list, logPath: file, linesScanned: lines.length, matched }
}
