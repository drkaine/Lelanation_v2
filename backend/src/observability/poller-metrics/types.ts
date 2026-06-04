import type { ResolvedSince, SinceMode } from '../../poll-orchestration/SinceTimestampResolver.js';
import type { TunerSnapshot } from '../../tuner/types.js';

export type { ResolvedSince, SinceMode };

export interface GatewayRequestEvent {
  ts: number;
  latencyMs: number;
  methodKey: string;
  statusCode: number;
  is429: boolean;
  isError: boolean;
  tokensUsed_120s: number;
  tokensUsed_1s: number;
  limit_120s: number;
  limit_1s: number;
}

export interface TokenSnapshotEvent {
  ts: number;
  used_120s: number;
  limit_120s: number;
  used_1s: number;
  limit_1s: number;
  pct_120s: number;
  pct_1s: number;
  in_flight: number;
  queue_depth: number;
  sinceMode: SinceMode | 'unknown';
}

export interface RateLimitSaturationEvent {
  ts: number;
  windowMs: number;
  methodKey: string;
  waitMs: number;
}

export interface PollSessionEvent {
  ts: number;
  sessionId: string;
  durationMs: number;
  playersPolled: number;
  playersCompleted: number;
  playersFailed: number;
}

export interface PlayerEvent {
  ts: number;
  type: 'polled' | 'new_added';
  puuid: string;
  platform: string;
}

export interface RankEvent {
  ts: number;
  type: 'fetched' | 'skipped_db' | 'skipped_cache' | 'failed';
  puuid: string;
  platform: string;
  tier?: string;
}

export interface MatchDiscoveryEvent {
  ts: number;
  puuid: string;
  matchId: string;
  type: 'new' | 'skipped_memory' | 'skipped_db';
}

export interface MatchFetchEvent {
  ts: number;
  matchId: string;
  patch: string;
  success: boolean;
  latencyMs: number;
  errorType?: 'match_fetch' | 'timeline_fetch' | 'both';
}

export type IngestionSkipReason =
  | 'missing_rank'
  | 'missing_participants'
  | 'missing_timeline'
  | 'conflict_already_done'
  | 'queue_add_failed';

export const INGESTION_SKIP_REASONS: IngestionSkipReason[] = [
  'missing_rank',
  'missing_participants',
  'missing_timeline',
  'conflict_already_done',
  'queue_add_failed',
];

export type IngestionRankSource =
  | 'player_cache'
  | 'participant_cache'
  | 'db_fallback'
  | 'unranked_fallback';

export interface IngestionQueueEvent {
  ts: number;
  matchId: string;
  patch: string;
  rank: string;
  type: 'queued' | 'skipped';
  skipReason?: IngestionSkipReason;
  rankSource?: IngestionRankSource;
}

export type IngestionCompletedReason = 'processed' | 'already_done';

export interface IngestionWorkerEvent {
  ts: number;
  matchId: string;
  patch: string;
  rank: string;
  type: 'started' | 'completed' | 'failed';
  durationMs?: number;
  completedReason?: IngestionCompletedReason;
  errorMessage?: string;
  tablesWritten?: Record<string, number>;
}

export interface DbOperationEvent {
  ts: number;
  operation: string;
  durationMs: number;
  rowsAffected?: number;
  success: boolean;
  errorMessage?: string;
}

export interface QueueDepthEvent {
  ts: number;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  total: number;
}

export type WindowLabel = '10m' | '30m' | '1h' | '6h' | '12h' | '24h';

export const WINDOW_MS: Record<WindowLabel, number> = {
  '10m': 10 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

export interface GatewayAggregate {
  window: WindowLabel;
  avg_req_per_120s: number;
  peak_req_per_120s: number;
  total_requests: number;
  times_limit_reached: number;
  total_429s: number;
  total_wait_ms_from_429: number;
  latency_p50_ms: number;
  latency_p95_ms: number;
  latency_p99_ms: number;
  avg_token_pct_120s: number;
  avg_token_pct_1s: number;
}

export interface SessionPoolEvent {
  ts: number;
  type: 'session_started' | 'session_completed' | 'pool_exhausted' | 'pool_recovered';
  activeSessions: number;
  maxSessions: number;
  queueSize: number;
  sessionId?: string;
}

export interface PollAggregate {
  window: WindowLabel;
  concurrent_sessions_avg: number;
  concurrent_sessions_peak: number;
  pool_exhausted_count: number;
  players_polled: number;
  players_new_added: number;
  ranks_fetched: number;
  ranks_skipped_db: number;
  ranks_skipped_cache: number;
  ranks_failed: number;
  rank_skip_rate_pct: number;
  match_ids_discovered: number;
  match_ids_skipped_memory: number;
  match_ids_skipped_db: number;
  match_ids_new: number;
  match_skip_rate_pct: number;
  matches_fetched_success: number;
  matches_fetched_failed: number;
  match_fetch_latency_p50_ms: number;
  match_fetch_latency_p95_ms: number;
}

export interface IngestionAggregate {
  window: WindowLabel;
  matches_queued: number;
  matches_skipped_total: number;
  skip_breakdown: Record<IngestionSkipReason, number>;
  queue_skip_rate_pct: number;
  matches_ingested: number;
  ingested_processed: number;
  ingested_already_done: number;
  matches_failed: number;
  /** BullMQ retry attempts; may exceed terminal failures. */
  matches_failed_attempts: number;
  /** Failed matchIds with no successful completion in window. */
  matches_failed_terminal: number;
  failure_top_errors: Array<{ message: string; count: number }>;
  ingestion_success_rate_pct: number;
  ingestion_latency_p50_ms: number;
  ingestion_latency_p95_ms: number;
  ingestion_latency_p99_ms: number;
  db_op_latency_p50_ms: number;
  db_op_latency_p95_ms: number;
  slowest_db_ops: Array<{ operation: string; p95_ms: number }>;
  queue_depth_avg: number;
  queue_depth_peak: number;
  rank_resolved_from_db: number;
  rank_unranked_fallback: number;
}

export interface FullSnapshot {
  ts: number;
  uptime_ms: number;
  window: WindowLabel;
  /** Dernier mode `since` connu au moment du rapport (discovery). */
  since?: {
    mode: SinceMode | 'unknown';
    sinceTimestamp: number;
    reason: string;
  };
  gateway: GatewayAggregate;
  poll: PollAggregate;
  ingestion: IngestionAggregate;
  ratios: {
    matches_ingested_vs_fetched_pct: number;
    matches_skipped_vs_discovered_pct: number;
    ranks_coverage_pct: number;
    token_efficiency_pct: number;
  };
  active_alerts: Alert[];
}

export type AlertSeverity = 'warn' | 'error' | 'fatal';

export type AlertType =
  | 'too_many_429s'
  | 'ingestion_lag'
  | 'rank_gap'
  | 'token_underutilized'
  | 'token_near_limit'
  | 'ingestion_failure_rate'
  | 'db_slow'
  | 'match_skip_rate_high'
  | 'poll_stall'
  | 'no_new_players'
  | 'ema_not_converging'
  | 'ingestion_missing_data';

export interface Alert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  since: number;
  data: Record<string, unknown>;
}

export type { TunerSnapshot };

export function emptySkipBreakdown(): Record<IngestionSkipReason, number> {
  return {
    missing_rank: 0,
    missing_participants: 0,
    missing_timeline: 0,
    conflict_already_done: 0,
    queue_add_failed: 0,
  };
}
