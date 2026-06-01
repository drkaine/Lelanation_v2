import type { Queue } from 'bullmq';
import type { RiotGateway } from '../../riot-gateway/gateway/RiotGateway.js';
import type { MetricsStore } from './MetricsStore.js';
import { pollerMetricsLogger } from './logger.js';
import { getLatestResolvedSince } from '../../poll-orchestration/sinceContext.js';
import type { ResolvedSince, TokenSnapshotEvent } from './types.js';

export function tokenBar(pct: number): string {
  const clamped = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
  const filled = Math.min(40, Math.round((clamped / 100) * 40));
  const empty = 40 - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

export class LiveTokenDisplay {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly gateway: RiotGateway,
    private readonly queue: Queue,
    private readonly store: MetricsStore,
    private readonly intervalMs = Number.parseInt(process.env.LIVE_TOKEN_DISPLAY_INTERVAL_MS ?? '5000', 10),
    private readonly getSinceResolved: () => ResolvedSince | null = getLatestResolvedSince,
  ) {}

  start(): void {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Exposed for tests and manual refresh. */
  async tick(): Promise<void> {
    const status = this.gateway.getStatus();
    const counts = await this.queue.getJobCounts('waiting', 'active');
    const waiting = counts.waiting ?? 0;
    const active = counts.active ?? 0;

    const app120 = status.buckets.find((b) => b.bucketId.startsWith('app:') && b.windowMs === 120_000);
    const app1s = status.buckets.find((b) => b.bucketId.startsWith('app:') && b.windowMs === 1_000);

    const used_120s = app120?.used ?? 0;
    const limit_120s = app120?.limit ?? 0;
    const used_1s = app1s?.used ?? 0;
    const limit_1s = app1s?.limit ?? 0;
    const pct_120s = limit_120s > 0 ? (used_120s / limit_120s) * 100 : 0;
    const pct_1s = limit_1s > 0 ? (used_1s / limit_1s) * 100 : 0;

    const resolved = this.getSinceResolved();
    const sinceMode = resolved?.mode ?? 'unknown';

    const snapshot: TokenSnapshotEvent = {
      ts: Date.now(),
      used_120s,
      limit_120s,
      used_1s,
      limit_1s,
      pct_120s,
      pct_1s,
      in_flight: status.inFlight.global,
      queue_depth: waiting + active,
      sinceMode,
    };
    this.store.pushTokenSnapshot(snapshot);

    pollerMetricsLogger.info({
      component: 'live-tokens',
      since_mode: sinceMode,
      since_date: resolved ? new Date(resolved.sinceTimestamp * 1000).toISOString() : null,
      tokens_120s: `${used_120s}/${limit_120s} ${tokenBar(pct_120s)} ${pct_120s.toFixed(1)}%`,
      tokens_1s: `${used_1s}/${limit_1s} ${tokenBar(pct_1s)} ${pct_1s.toFixed(1)}%`,
      in_flight: status.inFlight.global,
      queue_depth: waiting + active,
      rps_current: status.metrics.rps.current.toFixed(2),
      rps_avg_60s: status.metrics.rps.avg60s.toFixed(2),
      latency_p50: status.metrics.latency.p50,
      latency_p95: status.metrics.latency.p95,
    });
  }
}
