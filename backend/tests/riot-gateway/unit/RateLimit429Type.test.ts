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
const { classifyRateLimitType } = await import('../../../src/riot-gateway/gateway/RetryHandler.js');
const { MetricsStore } = await import('../../../src/observability/poller-metrics/MetricsStore.js');
const { AggregateComputer } = await import('../../../src/observability/poller-metrics/AggregateComputer.js');

const BASE = 'https://europe.api.riotgames.com';
const METHOD = '/lol/match/v5/matches/by-puuid/{puuid}/ids';
const OK = {
  statusCode: 200,
  headers: { 'x-app-rate-limit': '100:120,20:1', 'x-app-rate-limit-count': '1:120,1:1' },
  body: [],
  latencyMs: 10,
};

function r429(headers: Record<string, string>) {
  return { statusCode: 429, headers: { 'retry-after': '1', ...headers }, body: null, latencyMs: 5 };
}

describe('classifyRateLimitType', () => {
  test('missing_header_means_service_429', () => {
    expect(classifyRateLimitType({})).toBe('service');
  });

  test('reads_application_and_method_case_insensitively', () => {
    expect(classifyRateLimitType({ 'x-rate-limit-type': 'Application' })).toBe('application');
    expect(classifyRateLimitType({ 'x-rate-limit-type': 'method' })).toBe('method');
    expect(classifyRateLimitType({ 'x-rate-limit-type': 'service' })).toBe('service');
  });
});

describe('RiotGateway 429 by limit type', () => {
  beforeEach(async () => {
    await RiotGateway.resetInstance();
    MetricsStore.resetInstance();
    vi.mocked(riotFetch).mockReset();
  });

  afterEach(async () => {
    await RiotGateway.resetInstance();
  });

  async function runWith429(headers: Record<string, string>) {
    vi.mocked(riotFetch).mockResolvedValueOnce(r429(headers)).mockResolvedValueOnce(OK);
    const gateway = RiotGateway.getInstance();
    const events: Array<{ limitType?: string }> = [];
    gateway.getObservabilityBus().on('ratelimit:429', (e: { limitType?: string }) => events.push(e));
    await gateway.request<string[]>(BASE, METHOD, { puuid: 'abc' });
    return { events, agg: new AggregateComputer(MetricsStore.getInstance()).computeGateway('10m', 100) };
  }

  test('service_429_is_emitted_as_service_and_not_counted_as_own_limit', async () => {
    const { events, agg } = await runWith429({});

    expect(events.map((e) => e.limitType)).toEqual(['service']);
    expect(agg.total_429s).toBe(0);
    expect(agg.total_429s_service).toBe(1);
    expect(agg.times_limit_reached).toBe(0);
  });

  test('application_429_counts_as_own_limit_and_saturates', async () => {
    const { events, agg } = await runWith429({
      'x-rate-limit-type': 'application',
      'x-app-rate-limit': '100:120,20:1',
      'x-app-rate-limit-count': '50:120,1:1',
      'x-method-rate-limit': '2000:10',
      'x-method-rate-limit-count': '1:10',
    });

    expect(events.map((e) => e.limitType)).toEqual(['application']);
    expect(agg.total_429s).toBe(1);
    expect(agg.total_429s_service).toBe(0);
    expect(agg.times_limit_reached).toBe(1);
  });
});
