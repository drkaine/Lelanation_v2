import type { MetricsStore } from '../observability/poller-metrics/MetricsStore.js';
import { percentileOf } from '../observability/poller-metrics/math.js';
import type { RiotGateway } from '../riot-gateway/gateway/RiotGateway.js';
import type { SessionStats } from '../poller/types.js';
import type { SessionFeedback } from '../tuner/types.js';

export function avgMatchLatencyMsForWindow(
  store: MetricsStore,
  startedAt: number,
  endedAt: number,
): number {
  const latencies = store.matchFetch
    .inWindow(endedAt - startedAt)
    .filter((e) => e.ts >= startedAt && e.success)
    .map((e) => e.latencyMs);
  if (latencies.length === 0) return 0;
  return percentileOf(latencies, 0.5);
}

export function buildSessionFeedback(
  stats: SessionStats,
  requestsUsed: number,
  avgMatchLatencyMs: number,
  wasGatewayQueueCongested: boolean,
): SessionFeedback {
  return {
    playersCompleted: stats.playersCompleted,
    totalGatewayRequests: requestsUsed,
    sessionDurationMs: stats.elapsedMs ?? 0,
    matchesFetched: stats.matchesFetched,
    matchesSkipped: stats.matchIdsSkipped,
    participantRanksFetched: stats.participantRanksFetched,
    participantRanksFromCache: stats.participantRanksFromCache,
    avgMatchLatencyMs,
    wasGatewayQueueCongested,
  };
}

export function getTokenPct120s(gateway: RiotGateway): number {
  const util = gateway
    .getStatus()
    .metrics.tokenUtilization.find((b) => b.bucketId.includes('120000'));
  return util?.pct ?? 0;
}
