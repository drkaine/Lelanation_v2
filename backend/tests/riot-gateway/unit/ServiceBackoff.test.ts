import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../src/riot-gateway/http/undiciClient.js', () => ({
  riotFetch: vi.fn(),
  closeAllPools: vi.fn(async () => undefined),
}));

process.env.RIOT_API_KEY = 'RGAPI-test-key-for-unit-tests';
process.env.API_KEY_TYPE = 'personal';
process.env.LOG_LEVEL = 'fatal';
process.env.PERSONAL_MIN_DISPATCH_INTERVAL_MS = '1';

const { riotFetch } = await import('../../../src/riot-gateway/http/undiciClient.js');
const { RiotGateway } = await import('../../../src/riot-gateway/gateway/RiotGateway.js');
const { getServiceBackoffMs } = await import('../../../src/riot-gateway/gateway/RetryHandler.js');

const BASE = 'https://europe.api.riotgames.com';
const METHOD = '/lol/match/v5/matches/by-puuid/{puuid}/ids';
const OK = {
  statusCode: 200,
  headers: { 'x-app-rate-limit': '100:120,20:1', 'x-app-rate-limit-count': '1:120,1:1' },
  body: [],
  latencyMs: 10,
};

describe('getServiceBackoffMs', () => {
  test('service_backoff_doubles_when_streak_grows', () => {
    expect([1, 2, 3, 4].map((streak) => getServiceBackoffMs(streak, 0))).toEqual([2_000, 4_000, 8_000, 16_000]);
  });

  test('service_backoff_is_capped_when_streak_is_long', () => {
    expect(getServiceBackoffMs(20, 0)).toBe(60_000);
  });

  test('service_backoff_honours_retry_after_when_it_is_longer', () => {
    expect(getServiceBackoffMs(1, 10_000)).toBe(10_000);
  });
});

describe('RiotGateway service 429', () => {
  beforeEach(async () => {
    await RiotGateway.resetInstance();
    vi.mocked(riotFetch).mockReset();
  });

  afterEach(async () => {
    await RiotGateway.resetInstance();
  });

  test('method_is_paused_when_service_429_is_received', async () => {
    vi.mocked(riotFetch)
      .mockResolvedValueOnce({ statusCode: 429, headers: { 'retry-after': '1' }, body: null, latencyMs: 5 })
      .mockResolvedValueOnce(OK);
    const gateway = RiotGateway.getInstance();
    const scopes: Array<{ scope: string; methodKey?: string }> = [];
    gateway.getObservabilityBus().on('ratelimit:saturated', (e: { scope: string; methodKey?: string }) => scopes.push(e));

    await gateway.request<string[]>(BASE, METHOD, { puuid: 'abc' });

    expect(scopes).toEqual([expect.objectContaining({ scope: 'method', methodKey: METHOD })]);
  }, 15_000);
});
