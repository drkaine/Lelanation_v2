import { riotConfig } from '../config/riotConfig.js';
import { gatewayLogger } from '../logger.js';
import type { TokenUtilizationSnapshot } from '../types.js';
import { observabilityBus } from './ObservabilityBus.js';
import type { RateLimitTracker } from './RateLimitTracker.js';

type MetricEvent = 'success' | 'error' | 'retry' | '429';

interface TimestampedSample {
  at: number;
  latencyMs?: number;
  event: MetricEvent;
}

export class MetricsCollector {
  private readonly samples: TimestampedSample[] = [];
  private readonly maxSamples = 1000;
  private snapshotTimer: NodeJS.Timeout | null = null;
  private totals = {
    requests: 0,
    success: 0,
    errors: 0,
    retries: 0,
    r429: 0,
  };

  record(event: MetricEvent, latencyMs?: number): void {
    this.samples.push({ at: Date.now(), latencyMs, event });
    if (this.samples.length > this.maxSamples) {
      this.samples.splice(0, this.samples.length - this.maxSamples);
    }

    if (event === 'success' || event === 'error' || event === '429') {
      this.totals.requests += 1;
    }
    if (event === 'success') this.totals.success += 1;
    if (event === 'error') this.totals.errors += 1;
    if (event === 'retry') this.totals.retries += 1;
    if (event === '429') this.totals.r429 += 1;
  }

  getRPS(now = Date.now()): { current: number; avg60s: number } {
    const currentWindow = this.countRequests(now - 5_000, now);
    const avg60Window = this.countRequests(now - 60_000, now);
    return {
      current: currentWindow / 5,
      avg60s: avg60Window / 60,
    };
  }

  getLatencyPercentiles(): { p50: number; p95: number; p99: number } {
    const latencies = this.samples
      .map((sample) => sample.latencyMs)
      .filter((value): value is number => typeof value === 'number')
      .sort((a, b) => a - b);
    if (latencies.length === 0) return { p50: 0, p95: 0, p99: 0 };
    return {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
    };
  }

  getTokenUtilization(tracker: RateLimitTracker): TokenUtilizationSnapshot[] {
    return tracker.getAllBucketStates().map((bucket) => ({
      bucketId: bucket.bucketId,
      used: bucket.used,
      limit: bucket.limit,
      safeLimit: bucket.safeLimit,
      pct: bucket.pctUsed,
      resetInMs: bucket.resetInMs,
    }));
  }

  getTotals(): { requests: number; success: number; errors: number; retries: number; r429: number } {
    return { ...this.totals };
  }

  getWindowStats(windowMs: number, now = Date.now()): Record<string, number> {
    const from = now - windowMs;
    const windowSamples = this.samples.filter((sample) => sample.at >= from);
    return {
      requests: windowSamples.filter((s) => s.event === 'success' || s.event === 'error' || s.event === '429').length,
      success: windowSamples.filter((s) => s.event === 'success').length,
      errors: windowSamples.filter((s) => s.event === 'error').length,
      retries: windowSamples.filter((s) => s.event === 'retry').length,
      rateLimit429s: windowSamples.filter((s) => s.event === '429').length,
    };
  }

  startPeriodicSnapshot(intervalMs = 5_000, tracker?: RateLimitTracker, queueDepth = () => 0, inFlight = () => 0): void {
    this.stop();
    this.snapshotTimer = setInterval(() => {
      const rps = this.getRPS();
      const latency = this.getLatencyPercentiles();
      const payload = {
        window_5s: this.getWindowStats(5_000),
        rps_current: rps.current,
        rps_avg_60s: rps.avg60s,
        latency_p50_ms: latency.p50,
        latency_p95_ms: latency.p95,
        latency_p99_ms: latency.p99,
        queue_depth: queueDepth(),
        in_flight: inFlight(),
        token_utilization_per_window: tracker ? this.getTokenUtilization(tracker) : [],
        total_since_start: this.getTotals(),
      };
      gatewayLogger.debug({ component: 'MetricsCollector', event: 'snapshot', ...payload }, 'Metrics snapshot');
      observabilityBus.emitEvent('metrics:snapshot', payload);
    }, intervalMs);
  }

  stop(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
  }

  private countRequests(fromMs: number, toMs: number): number {
    return this.samples.filter(
      (sample) =>
        sample.at >= fromMs &&
        sample.at <= toMs &&
        (sample.event === 'success' || sample.event === 'error' || sample.event === '429'),
    ).length;
  }
}

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[index] ?? 0;
}

export function detectThroughputAnomaly(current: number, avg60s: number): boolean {
  if (avg60s <= 0) return false;
  return current < avg60s * 0.8;
}

export const NEAR_LIMIT_RATIO = 0.8;

export function isNearLimit(used: number, safeLimit: number): boolean {
  return safeLimit > 0 && used >= safeLimit * NEAR_LIMIT_RATIO;
}

export function expectedAverageRps(): number {
  const fallback = riotConfig.fallbackLimits[riotConfig.apiKeyType].app[0];
  const safe = Math.max(1, Math.floor(fallback.limit * (1 - riotConfig.safetyMargin)));
  return safe / (fallback.windowMs / 1000);
}
