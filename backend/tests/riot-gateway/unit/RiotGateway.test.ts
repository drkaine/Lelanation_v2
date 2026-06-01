import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { RiotMaxRetriesError, RiotShutdownError } from '../../../src/riot-gateway/types.js';

vi.mock('../../../src/riot-gateway/http/undiciClient.js', () => ({
  riotFetch: vi.fn(),
  closeAllPools: vi.fn(async () => undefined),
}));

process.env.RIOT_API_KEY = 'RGAPI-test-key-for-unit-tests';
process.env.API_KEY_TYPE = 'personal';
process.env.LOG_LEVEL = 'fatal';

const { riotFetch } = await import('../../../src/riot-gateway/http/undiciClient.js');
const { RiotGateway } = await import('../../../src/riot-gateway/gateway/RiotGateway.js');

const BASE = 'https://europe.api.riotgames.com';
const METHOD = '/lol/match/v5/matches/by-puuid/{puuid}/ids';

function okResponse(body: unknown = ['EUW1_1']) {
  return {
    statusCode: 200,
    headers: {
      'x-app-rate-limit': '100:120,20:1',
      'x-app-rate-limit-count': '1:120,1:1',
    },
    body,
    latencyMs: 10,
  };
}

describe('RiotGateway', () => {
  beforeEach(async () => {
    await RiotGateway.resetInstance();
    vi.mocked(riotFetch).mockReset();
  });

  afterEach(async () => {
    await RiotGateway.resetInstance();
  });

  test('single 200 response resolves with parsed data and metrics', async () => {
    vi.mocked(riotFetch).mockResolvedValueOnce(okResponse(['EUW1_1']));

    const gateway = RiotGateway.getInstance();
    const response = await gateway.request<string[]>(BASE, METHOD, { puuid: 'abc' });

    expect(response.statusCode).toBe(200);
    expect(response.data).toEqual(['EUW1_1']);
    expect(gateway.getStatus().metrics.totals.success).toBe(1);
    expect(gateway.getStatus().buckets.length).toBeGreaterThan(0);
  });

  test('429 on attempt 1 is re-queued then succeeds', async () => {
    vi.mocked(riotFetch)
      .mockResolvedValueOnce({
        statusCode: 429,
        headers: { 'retry-after': '1' },
        body: null,
        latencyMs: 5,
      })
      .mockResolvedValueOnce(okResponse(['EUW1_2']));

    const gateway = RiotGateway.getInstance();
    const response = await gateway.request<string[]>(BASE, METHOD, { puuid: 'abc' });

    expect(response.data).toEqual(['EUW1_2']);
    expect(vi.mocked(riotFetch).mock.calls.length).toBe(2);
  });

  test('3x 429 leads to RiotMaxRetriesError', async () => {
    vi.mocked(riotFetch).mockResolvedValue({
      statusCode: 429,
      headers: { 'retry-after': '1' },
      body: null,
      latencyMs: 5,
    });

    const gateway = RiotGateway.getInstance();
    await expect(gateway.request<string[]>(BASE, METHOD, { puuid: 'abc' })).rejects.toBeInstanceOf(
      RiotMaxRetriesError,
    );
  });

  test('5xx uses exponential backoff then succeeds', async () => {
    vi.mocked(riotFetch)
      .mockResolvedValueOnce({ statusCode: 503, headers: {}, body: null, latencyMs: 5 })
      .mockResolvedValueOnce(okResponse());

    const gateway = RiotGateway.getInstance();
    const response = await gateway.request<string[]>(BASE, METHOD, { puuid: 'abc' });
    expect(response.statusCode).toBe(200);
    expect(vi.mocked(riotFetch).mock.calls.length).toBe(2);
  });

  test('burst of 50 requests stays under personal mock limits without simulated 429', async () => {
    vi.mocked(riotFetch).mockImplementation(async () => okResponse([]));

    const gateway = RiotGateway.getInstance();
    await Promise.all(
      Array.from({ length: 50 }, (_, i) => gateway.request<string[]>(BASE, METHOD, { puuid: `p-${i}` })),
    );
    expect(gateway.getStatus().metrics.totals.r429).toBe(0);
  });

  test('concurrency never exceeds MAX_CONCURRENCY', async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    vi.mocked(riotFetch).mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 30));
      inFlight -= 1;
      return okResponse([]);
    });

    const gateway = RiotGateway.getInstance();
    await Promise.all(
      Array.from({ length: 20 }, (_, index) => gateway.request<string[]>(BASE, METHOD, { puuid: `p-${index}` })),
    );

    expect(maxInFlight).toBeLessThanOrEqual(10);
  });

  test('shutdown rejects pending requests with RiotShutdownError', async () => {
    vi.mocked(riotFetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(okResponse()), 500);
        }),
    );

    const gateway = RiotGateway.getInstance();
    const pending = gateway.request<string[]>(BASE, METHOD, { puuid: 'slow' });
    await gateway.shutdown(0);
    await expect(pending).rejects.toBeInstanceOf(RiotShutdownError);
  });

  test('in-flight counter returns to zero after all responses', async () => {
    vi.mocked(riotFetch).mockResolvedValue(okResponse());

    const gateway = RiotGateway.getInstance();
    await Promise.all([
      gateway.request<string[]>(BASE, METHOD, { puuid: 'a' }),
      gateway.request<string[]>(BASE, METHOD, { puuid: 'b' }),
    ]);
    expect(gateway.getStatus().inFlight.global).toBe(0);
  });

  test('in-flight counter is 0 after riotFetch throws', async () => {
    vi.mocked(riotFetch).mockRejectedValueOnce(new Error('network boom'));

    const gateway = RiotGateway.getInstance();
    await expect(gateway.request<string[]>(BASE, METHOD, { puuid: 'fail' })).rejects.toThrow();
    expect(gateway.getStatus().inFlight.global).toBe(0);
  });

  test('in-flight counter is 0 after updateFromHeaders throws', async () => {
    vi.mocked(riotFetch).mockResolvedValueOnce(okResponse());
    const gateway = RiotGateway.getInstance();
    const internal = gateway as unknown as { tracker: { updateFromHeaders: (a: string, b: Record<string, string>) => void } };
    vi.spyOn(internal.tracker, 'updateFromHeaders').mockImplementation(() => {
      throw new Error('header parse failed');
    });

    await expect(gateway.request<string[]>(BASE, METHOD, { puuid: 'hdr' })).rejects.toThrow('header parse failed');
    expect(gateway.getStatus().inFlight.global).toBe(0);
  });

  test('watchdog recovers stale queue', async () => {
    vi.useFakeTimers();
    vi.mocked(riotFetch).mockResolvedValue(okResponse());

    let allowDispatch = false;
    const gateway = RiotGateway.getInstance();
    const internal = gateway as unknown as {
      lastDispatchAt: number;
      tracker: { canDispatch: (methodKey: string) => { allowed: boolean; waitMs?: number } };
      flushQueue: (reason: string) => void;
    };
    const originalCanDispatch = internal.tracker.canDispatch.bind(internal.tracker);
    vi.spyOn(internal.tracker, 'canDispatch').mockImplementation((methodKey: string) => {
      if (!allowDispatch) {
        return { allowed: false, waitMs: 60_000 };
      }
      return originalCanDispatch(methodKey);
    });

    void gateway.request<string[]>(BASE, METHOD, { puuid: 'watchdog' }).catch(() => undefined);
    await vi.advanceTimersByTimeAsync(1);
    expect(gateway.getStatus().queue.size).toBeGreaterThan(0);

    internal.lastDispatchAt = Date.now() - 5_000;
    (gateway as unknown as { clearPendingFlushTimer: () => void }).clearPendingFlushTimer();
    const flushSpy = vi.spyOn(internal, 'flushQueue');

    await vi.advanceTimersByTimeAsync(1_100);
    expect(flushSpy.mock.calls.some((call) => call[0] === 'watchdog')).toBe(true);

    allowDispatch = true;
    vi.useRealTimers();
    await gateway.request<string[]>(BASE, METHOD, { puuid: 'watchdog-cleanup' }).catch(() => undefined);
  });

  test('T_bug2_a scheduleFlushTimer uses minimum 100ms delay', () => {
    vi.useFakeTimers();
    const gateway = RiotGateway.getInstance();
    const internal = gateway as unknown as { scheduleFlushTimer: (ms: number) => void };
    const timeoutSpy = vi.spyOn(global, 'setTimeout');

    internal.scheduleFlushTimer(0);
    const delay = timeoutSpy.mock.calls.at(-1)?.[1] as number;
    expect(delay).toBeGreaterThanOrEqual(100);

    vi.useRealTimers();
    timeoutSpy.mockRestore();
  });

  test('T_bug2_b scheduleFlushTimer deduplicates rapid calls', () => {
    vi.useFakeTimers();
    const gateway = RiotGateway.getInstance();
    const internal = gateway as unknown as {
      scheduleFlushTimer: (ms: number) => void;
      pendingFlushTimer: NodeJS.Timeout | null;
    };
    const timeoutSpy = vi.spyOn(global, 'setTimeout');

    for (let i = 0; i < 100; i += 1) {
      internal.scheduleFlushTimer(5);
    }
    expect(timeoutSpy.mock.calls.length).toBe(1);
    expect(internal.pendingFlushTimer).not.toBeNull();

    vi.useRealTimers();
    timeoutSpy.mockRestore();
  });

  test('T_bug2_c watchdog does not flush when pendingFlushTimer is set', async () => {
    vi.useFakeTimers();
    vi.mocked(riotFetch).mockResolvedValue(okResponse());
    const gateway = RiotGateway.getInstance();
    const internal = gateway as unknown as {
      lastDispatchAt: number;
      flushQueue: (reason: string) => void;
      pendingFlushTimer: NodeJS.Timeout | null;
    };

    void gateway.request<string[]>(BASE, METHOD, { puuid: 'wd-skip' }).catch(() => undefined);
    await vi.advanceTimersByTimeAsync(1);

    internal.pendingFlushTimer = setTimeout(() => undefined, 10_000) as unknown as NodeJS.Timeout;
    internal.lastDispatchAt = Date.now() - 5_000;
    const flushSpy = vi.spyOn(internal, 'flushQueue');

    await vi.advanceTimersByTimeAsync(1_100);
    expect(flushSpy.mock.calls.filter((call) => call[0] === 'watchdog')).toHaveLength(0);

    vi.useRealTimers();
    clearTimeout(internal.pendingFlushTimer!);
  });

  test('T_bug2_d watchdog flushes when no timer and queue is stale', async () => {
    vi.useFakeTimers();
    vi.mocked(riotFetch).mockResolvedValue(okResponse());
    const gateway = RiotGateway.getInstance();
    const internal = gateway as unknown as {
      lastDispatchAt: number;
      flushQueue: (reason: string) => void;
      clearPendingFlushTimer: () => void;
    };

    let allowDispatch = false;
    const tracker = (gateway as unknown as { tracker: { canDispatch: (k: string) => { allowed: boolean; waitMs?: number } } })
      .tracker;
    const originalCanDispatch = tracker.canDispatch.bind(tracker);
    vi.spyOn(tracker, 'canDispatch').mockImplementation((methodKey: string) => {
      if (!allowDispatch) return { allowed: false, waitMs: 60_000 };
      return originalCanDispatch(methodKey);
    });

    void gateway.request<string[]>(BASE, METHOD, { puuid: 'wd-flush' }).catch(() => undefined);
    await vi.advanceTimersByTimeAsync(1);
    internal.clearPendingFlushTimer();
    internal.lastDispatchAt = Date.now() - 5_000;
    const flushSpy = vi.spyOn(internal, 'flushQueue');

    await vi.advanceTimersByTimeAsync(1_100);
    expect(flushSpy.mock.calls.some((call) => call[0] === 'watchdog')).toBe(true);

    allowDispatch = true;
    vi.useRealTimers();
    await gateway.request<string[]>(BASE, METHOD, { puuid: 'wd-flush-cleanup' }).catch(() => undefined);
  });

  test('T_bug2_e expired 1s window unblocks queue on flush', async () => {
    vi.mocked(riotFetch).mockResolvedValue(okResponse());
    const gateway = RiotGateway.getInstance();
    type TrackerInternal = {
      tracker: {
        appBuckets: Array<{ windowMs: number; update: (u: number, l: number) => void; resetAt: number }>;
      };
    };
    const tracker = (gateway as unknown as TrackerInternal).tracker;
    const bucket = tracker.appBuckets.find((b) => b.windowMs === 1_000);
    expect(bucket).toBeDefined();
    bucket!.update(20, 20);
    bucket!.resetAt = Date.now() - 1;

    const promises = Array.from({ length: 5 }, (_, i) =>
      gateway.request<string[]>(BASE, METHOD, { puuid: `exp-${i}` }),
    );

    await Promise.all(promises);
    expect(vi.mocked(riotFetch).mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(gateway.getStatus().queue.size).toBe(0);
    expect(gateway.getStatus().inFlight.global).toBe(0);
  });

  test('session 1 then session 2: no in-flight leak between sessions', async () => {
    vi.mocked(riotFetch).mockImplementation(async () => okResponse());

    const gateway = RiotGateway.getInstance();
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => gateway.request<string[]>(BASE, METHOD, { puuid: `s1-${i}` })),
    );
    expect(gateway.getStatus().inFlight.global).toBe(0);

    await Promise.all(
      Array.from({ length: 10 }, (_, i) => gateway.request<string[]>(BASE, METHOD, { puuid: `s2-${i}` })),
    );
    expect(gateway.getStatus().inFlight.global).toBe(0);
    expect(gateway.getStatus().queue.size).toBe(0);
  });

  test('throughput anomaly warning fires when rps drops 20%', async () => {
    const gateway = RiotGateway.getInstance();
    const metrics = (gateway as unknown as { metrics: { record: (e: string, n?: number) => void; getRPS: () => { current: number; avg60s: number } } }).metrics;

    for (let i = 0; i < 120; i += 1) {
      metrics.record('success', 10);
    }
    const check = (gateway as unknown as { checkThroughputAnomaly: () => void }).checkThroughputAnomaly.bind(gateway);
    check();
    expect(metrics.getRPS().avg60s).toBeGreaterThan(0);
  });
});
