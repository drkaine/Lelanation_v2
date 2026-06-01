import type { GatewayStatus } from '../../../src/riot-gateway/types.js';

export function buildGatewayStatus(
  limit120s: number,
  limit1s: number,
  utilizationPct = 0,
  bucketsOverride?: GatewayStatus['buckets'],
): GatewayStatus {
  const buckets =
    bucketsOverride ??
    [
      {
        bucketId: 'app:120000',
        limit: limit120s,
        used: Math.floor((utilizationPct / 100) * limit120s),
        inFlight: 0,
        available: limit120s,
        safeLimit: Math.floor(limit120s * 0.95),
        windowMs: 120_000,
        resetInMs: 60_000,
        pctUsed: utilizationPct,
      },
      {
        bucketId: 'app:1000',
        limit: limit1s,
        used: 0,
        inFlight: 0,
        available: limit1s,
        safeLimit: Math.floor(limit1s * 0.95),
        windowMs: 1_000,
        resetInMs: 500,
        pctUsed: utilizationPct,
      },
    ];

  return {
    uptime_ms: 1000,
    queue: { size: 0, highPriority: 0 },
    inFlight: { global: 0, byMethod: {} },
    buckets,
    metrics: {
      rps: { current: 0, avg60s: 0 },
      latency: { p50: 0, p95: 0, p99: 0 },
      totals: { requests: 0, success: 0, errors: 0, retries: 0, r429: 0 },
      tokenUtilization: buckets.map((b) => ({
        bucketId: b.bucketId,
        used: b.used,
        limit: b.limit,
        safeLimit: b.safeLimit,
        pct: b.pctUsed,
        resetInMs: b.resetInMs,
      })),
    },
    config: { apiKeyType: 'personal', maxConcurrency: 10, safetyMargin: 0.05 },
  };
}

/** Mirrors PollerTuner targetRps math (no queue pressure). */
export function expectedTargetRps(limit120s: number, limit1s: number, safety = 0.05): number {
  const safeTokens120s = Math.floor(limit120s * (1 - safety));
  const safeTokens1s = Math.floor(limit1s * (1 - safety));
  return Math.min(safeTokens120s / 120, safeTokens1s);
}
