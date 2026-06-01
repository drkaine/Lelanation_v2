export type StageName =
  | 'PlayerSource'
  | 'RankFetcher'
  | 'MatchListFetcher'
  | 'MatchFilter'
  | 'MatchDataFetcher'
  | 'ParticipantHandler'
  | 'AggregateWriter'
  | 'Gateway'

export interface RateLimitEvent {
  region: string
  path: string
  status: number
  durationMs: number
  windowCount: number
  windowLimit: number
}

export interface RateLimitSyncEvent {
  appCount: number
  appLimit: number
  windowMs: number
}

export interface RateLimit429Event {
  region: string
  path: string
  retryAfterMs: number
}

export interface StageItemEvent {
  stage: StageName
  success: boolean
  durationMs: number
}

export interface QueueDepthEvent {
  stage: StageName
  depth: number
}

export interface DBWriteEvent {
  table: string
  rows: number
  durationMs: number
}

export interface DBErrorEvent {
  table: string
  error: Error
}

export interface ObsErrorEvent {
  stage?: StageName
  error: Error
  context?: Record<string, unknown>
  matchId?: string
  puuid?: string
}

export interface ActiveAlert {
  level: 'warn' | 'error'
  code: string
  message: string
  since: number
}

export type WindowSnapshot = {
  ts: number
  windowStart: number
  windowEnd: number
  requestsSent: number
  requestsTarget: number
  requestsLimit: number
  count429: number
  headerSyncs: number
  avgQueueDepth: number
  headroomMin: number
}

export type StageItemSample = {
  ts: number
  durationMs: number
  success: boolean
}

export type QueueDepthSample = {
  ts: number
  stage: StageName
  depth: number
}

export type DBWriteSample = {
  ts: number
  table: string
  rows: number
  durationMs: number
  ok: boolean
}

export type ErrorSample = {
  ts: number
  stage?: StageName
  errorType: string
  message: string
  context?: Record<string, unknown>
  matchId?: string
  puuid?: string
}

export type HourlySummary = {
  hourStart: number
  apiRequests: number
  total429s: number
  matchesProcessed: number
  playersUpdated: number
  ranksFetched: number
  dbRowsWritten: number
  errors: number
  avgRequestsPer120s: number
  minRequestsPer120s: number
  maxRequestsPer120s: number
  headroomAvg: number
}

export interface MetricsSnapshot {
  ts: number
  rateLimitCurrent: {
    windowStart: number
    requestsSent: number
    target: number
    limit: number
    headroom: number
    count429: number
    queueDepth: number
  }
  windows120s: Array<{
    start: number
    sent: number
    count429: number
    headroomMin: number
  }>
  stages: Record<
    StageName,
    {
      itemsLast60s: number
      failuresLast60s: number
      avgDurationMs: number
      p95DurationMs: number
      queueDepth: number
    }
  >
  hourly: {
    apiRequests: number
    matchesProcessed: number
    playersUpdated: number
    rankseFetched: number
    dbRowsWritten: number
    errors: number
    avgRequestsPer120s: number
  }
  alerts: ActiveAlert[]
}

/** Re-export for dashboards — live token snapshots use poller-metrics TokenSnapshotEvent.sinceMode */
export type { SinceMode } from '../poll-orchestration/SinceTimestampResolver.js';
