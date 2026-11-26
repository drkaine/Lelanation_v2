import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/db/client.js', () => ({ sql: vi.fn() }));
vi.mock('../../../../src/redis/client.js', () => ({ redis: {} }));
vi.mock('../../../../src/services/matchIngestionPayload.js', () => ({ buildIngestionPayloadFromMatchData: vi.fn() }));
vi.mock('../../../../src/config/index.js', () => ({ config: {} }));
vi.mock('../../../../src/observability/poller-metrics/timedDbOp.js', () => ({ timedDbOp: (_op: string, fn: () => unknown) => fn() }));
vi.mock('../../../../src/queues/index.js', () => ({ ingestionQueue: { add: vi.fn() } }));
vi.mock('../../../../src/services/normalizedMatchPersistence.js', () => ({ persistNormalizedMatch: vi.fn() }));
vi.mock('../../../../src/observability/poller-metrics/instrumentation.js', () => ({
  recordIngestionQueue: vi.fn(),
  recordPlayer: vi.fn(),
  recordRank: vi.fn(),
}));

const { PollerDbConsumer } = await import('../../../../src/poll-orchestration/PollerDbConsumer.js');
const { PollerEventBus } = await import('../../../../src/poller/PollerEventBus.js');

const completeEvent = {
  player: { puuid: 'p1', region: 'euw1' },
  stats: { matchesFetched: 0, matchIdsDiscovered: 0, errors: [] },
};

function setup(updateLastSeen: () => Promise<void>) {
  const bus = new PollerEventBus();
  const consumer = new PollerDbConsumer({}, { updateLastSeen }, {}, bus);
  consumer.subscribe();
  return { bus, consumer };
}

describe('PollerDbConsumer.drain : arrêt propre sans couper les écritures en vol', () => {
  it('attend les handlers en cours avant de rendre la main (sinon sql.end → CONNECTION_ENDED)', async () => {
    let release = () => {};
    const write = new Promise<void>((r) => (release = r));
    const done = vi.fn();
    const { bus, consumer } = setup(async () => {
      await write;
      done();
    });
    bus.emit('player:complete', completeEvent);
    consumer.unsubscribe();
    const drained = consumer.drain(1000);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    release();
    await drained;
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('borné : un handler bloqué ne retient pas l’arrêt au-delà du délai', async () => {
    const { bus, consumer } = setup(() => new Promise<void>(() => {}));
    bus.emit('player:complete', completeEvent);
    const start = Date.now();
    await expect(consumer.drain(50)).resolves.toBe(false);
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it('rien en vol : rend la main tout de suite', async () => {
    const { consumer } = setup(async () => {});
    await expect(consumer.drain(1000)).resolves.toBe(true);
  });
});
