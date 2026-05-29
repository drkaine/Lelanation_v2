import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.hoisted(() => {
  process.env.ENV = 'dev';
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  process.env.DATABASE_URL = 'postgresql://lelanation:lelanation@localhost:5434/lelanation_statistiques';
  process.env.RIOT_API_KEY = 'RGAPI-test-key';
});

vi.mock('../../../src/db/queries/ranks.js', () => ({
  insertRankHistory: vi.fn(),
}));

vi.mock('../../../src/db/queries/players.js', () => ({
  updatePlayerLastSeen: vi.fn(),
}));

vi.mock('../../../src/queues/index.js', () => ({
  ingestionQueue: { add: vi.fn() },
}));

vi.mock('../../../src/services/matchIngestionPayload.js', () => ({
  isMatchAlreadyIngested: vi.fn(),
  buildIngestionPayloadFromMatchData: vi.fn(),
}));

import { PollerEventBus } from '../../../src/poller/PollerEventBus.js';
import { insertRankHistory } from '../../../src/db/queries/ranks.js';
import { ingestionQueue } from '../../../src/queues/index.js';
import {
  buildIngestionPayloadFromMatchData,
  isMatchAlreadyIngested,
} from '../../../src/services/matchIngestionPayload.js';

async function loadConsumer() {
  const mod = await import('../../../src/poller/consumer/PollerDbConsumer.js');
  return mod.PollerDbConsumer;
}

describe('PollerDbConsumer', () => {
  beforeEach(() => {
    vi.mocked(insertRankHistory).mockReset().mockResolvedValue(undefined);
    vi.mocked(ingestionQueue.add).mockReset().mockResolvedValue({} as never);
    vi.mocked(isMatchAlreadyIngested).mockReset().mockResolvedValue(false);
    vi.mocked(buildIngestionPayloadFromMatchData).mockReset();
  });

  test('persists player rank and enqueues match when ranks disabled', async () => {
    vi.mocked(buildIngestionPayloadFromMatchData).mockResolvedValue({
      participants: [{ puuid: 'p1', matchId: 'EUW1_1' } as never],
      teamStats: { matchId: 'EUW1_1', rankTier: 'GOLD' } as never,
    });

    const PollerDbConsumer = await loadConsumer();
    const bus = new PollerEventBus();
    const consumer = new PollerDbConsumer({ resolveParticipantRanks: false });
    consumer.attach(bus);

    bus.emit('player:rank', {
      sessionId: 's1',
      player: { puuid: 'seed', platform: 'euw1' },
      entries: [{ queueType: 'RANKED_SOLO_5x5', tier: 'GOLD', rank: 'II', leaguePoints: 50 }],
      fetchedAt: Date.now(),
    });

    bus.emit('match:data', {
      sessionId: 's1',
      player: { puuid: 'seed', platform: 'euw1' },
      matchId: 'EUW1_1',
      match: { metadata: { matchId: 'EUW1_1' }, info: { participants: [{ puuid: 'p1' }] } },
      timeline: { info: {} },
      fetchedAt: Date.now(),
    });

    await vi.waitFor(() => {
      expect(ingestionQueue.add).toHaveBeenCalledTimes(1);
    });

    expect(insertRankHistory).toHaveBeenCalled();
    expect(ingestionQueue.add).toHaveBeenCalledWith(
      'ingest-match',
      expect.objectContaining({ teamStats: expect.objectContaining({ matchId: 'EUW1_1' }) }),
      expect.objectContaining({ jobId: 'ingest:EUW1_1' }),
    );
  });

  test('buffers match until participant ranks arrive', async () => {
    vi.mocked(buildIngestionPayloadFromMatchData).mockResolvedValue({
      participants: [{ puuid: 'p1', matchId: 'EUW1_2' } as never],
      teamStats: { matchId: 'EUW1_2', rankTier: 'GOLD' } as never,
    });

    const PollerDbConsumer = await loadConsumer();
    const bus = new PollerEventBus();
    const consumer = new PollerDbConsumer({ resolveParticipantRanks: true });
    consumer.attach(bus);

    bus.emit('match:data', {
      sessionId: 's1',
      player: { puuid: 'seed', platform: 'euw1' },
      matchId: 'EUW1_2',
      match: { metadata: { matchId: 'EUW1_2' }, info: { participants: [{ puuid: 'p1' }] } },
      timeline: { info: {} },
      fetchedAt: Date.now(),
    });

    await Promise.resolve();
    expect(ingestionQueue.add).not.toHaveBeenCalled();

    bus.emit('participant:rank', {
      sessionId: 's1',
      triggerMatchId: 'EUW1_2',
      participant: { puuid: 'p1', platform: 'euw1' },
      entries: [{ queueType: 'RANKED_SOLO_5x5', tier: 'GOLD' }],
      fromCache: false,
      fetchedAt: Date.now(),
    });

    await vi.waitFor(() => {
      expect(ingestionQueue.add).toHaveBeenCalledTimes(1);
    });
  });
});
