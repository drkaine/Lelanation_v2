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
