import { beforeEach, describe, expect, test, vi } from 'vitest';
import { LiveTokenDisplay, tokenBar } from '../../../src/observability/poller-metrics/LiveTokenDisplay.js';
import { MetricsStore } from '../../../src/observability/poller-metrics/MetricsStore.js';
import type { RiotGateway } from '../../../src/riot-gateway/gateway/RiotGateway.js';
import type { Queue } from 'bullmq';

describe('LiveTokenDisplay', () => {
  beforeEach(() => {
    MetricsStore.resetInstance();
  });

  test('T1 tick pushes TokenSnapshotEvent to store', async () => {
    const store = MetricsStore.getInstance();
    const gateway = {
      getStatus: () => ({
        buckets: [
          { bucketId: 'app:global', windowMs: 120_000, used: 10, limit: 99, remaining: 89 },
          { bucketId: 'app:global', windowMs: 1_000, used: 2, limit: 19, remaining: 17 },
        ],
        inFlight: { global: 3 },
        metrics: { rps: { current: 1, avg60s: 0.5 }, latency: { p50: 10, p95: 20 } },
      }),
    } as unknown as RiotGateway;

    const queue = {
      getJobCounts: vi.fn().mockResolvedValue({ waiting: 4, active: 2 }),
    } as unknown as Queue;

    const display = new LiveTokenDisplay(gateway, queue, store, 60_000);
    await display.tick();

    expect(store.tokenSnap.size).toBe(1);
    const snap = store.tokenSnap.latest();
    expect(snap?.used_120s).toBe(10);
    expect(snap?.limit_120s).toBe(99);
    expect(snap?.queue_depth).toBe(6);
    expect(snap?.sinceMode).toBe('unknown');
  });

  test('T2 token bar renders 0%, 50%, 100%', () => {
    expect(tokenBar(0)).toMatch(/^\[░{40}\]$/);
    expect(tokenBar(50)).toContain('█');
    expect(tokenBar(50)).toContain('░');
    expect(tokenBar(100)).toMatch(/^\[█{40}\]$/);
  });
});
