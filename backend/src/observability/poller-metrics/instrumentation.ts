import type { BucketState } from '../../riot-gateway/types.js';
import { MetricsStore } from './MetricsStore.js';
import type { IngestionCompletedReason, IngestionSkipReason, RankEvent } from './types.js';

function appLimits(buckets: BucketState[]): {
  used120: number;
  limit120: number;
  used1: number;
  limit1: number;
} {
  const app120 = buckets.find((b) => b.bucketId.startsWith('app:') && b.windowMs === 120_000);
  const app1 = buckets.find((b) => b.bucketId.startsWith('app:') && b.windowMs === 1_000);
  return {
    used120: app120?.used ?? 0,
    limit120: app120?.limit ?? 0,
    used1: app1?.used ?? 0,
    limit1: app1?.limit ?? 0,
  };
}

export function recordGatewayRequest(params: {
  latencyMs: number;
  methodKey: string;
  statusCode: number;
  buckets: BucketState[];
}): void {
  const { used120, limit120, used1, limit1 } = appLimits(params.buckets);
  MetricsStore.getInstance().pushGatewayRequest({
    ts: Date.now(),
    latencyMs: params.latencyMs,
    methodKey: params.methodKey,
    statusCode: params.statusCode,
    is429: params.statusCode === 429,
    isError: params.statusCode >= 400,
    tokensUsed_120s: used120,
    tokensUsed_1s: used1,
    limit_120s: limit120,
    limit_1s: limit1,
  });
}

export function recordSaturation(params: {
  windowMs: number;
  methodKey: string;
  waitMs: number;
}): void {
  MetricsStore.getInstance().pushSaturation({
    ts: Date.now(),
    windowMs: params.windowMs,
    methodKey: params.methodKey,
    waitMs: params.waitMs,
  });
}

export function recordPollSession(params: {
  sessionId: string;
  durationMs: number;
  playersPolled: number;
  playersCompleted: number;
  playersFailed: number;
}): void {
  MetricsStore.getInstance().pushPollSession({ ts: Date.now(), ...params });
}

export function recordPlayer(params: { type: 'polled' | 'new_added'; puuid: string; platform: string }): void {
  MetricsStore.getInstance().pushPlayer({ ts: Date.now(), ...params });
}

export function recordRank(params: Omit<RankEvent, 'ts'>): void {
  MetricsStore.getInstance().pushRank({ ts: Date.now(), ...params });
}

export function recordMatchDiscovery(params: {
  puuid: string;
  matchId: string;
  type: 'new' | 'skipped_memory' | 'skipped_db';
}): void {
  MetricsStore.getInstance().pushMatchDiscovery({ ts: Date.now(), ...params });
}

export function recordMatchFetch(params: {
  matchId: string;
  patch: string;
  success: boolean;
  latencyMs: number;
  errorType?: 'match_fetch' | 'timeline_fetch' | 'both';
}): void {
  MetricsStore.getInstance().pushMatchFetch({ ts: Date.now(), ...params });
}

export function recordIngestionQueue(params: {
  matchId: string;
  patch: string;
  rank: string;
  type: 'queued' | 'skipped';
  skipReason?: IngestionSkipReason;
}): void {
  MetricsStore.getInstance().pushIngestionQueue({ ts: Date.now(), ...params });
}

export function recordIngestionWorker(params: {
  matchId: string;
  patch: string;
  rank: string;
  type: 'started' | 'completed' | 'failed';
  durationMs?: number;
  completedReason?: IngestionCompletedReason;
  errorMessage?: string;
  tablesWritten?: Record<string, number>;
}): void {
  MetricsStore.getInstance().pushIngestionWorker({ ts: Date.now(), ...params });
}
