import { beforeEach, describe, expect, test, vi } from 'vitest';
import { MatchIdPaginator } from '../../../src/poller/MatchIdPaginator.js';
import { PollerEventBus } from '../../../src/poller/PollerEventBus.js';
import type { Player, PollConfig } from '../../../src/poller/types.js';

vi.mock('../../../src/poller/gatewayRoutes.js', () => ({
  fetchMatchIdsByPUUID: vi.fn(),
}));

import { fetchMatchIdsByPUUID } from '../../../src/poller/gatewayRoutes.js';

const player: Player = { puuid: 'puuid-1', platform: 'euw1' };
const config: PollConfig = {
  sinceTimestamp: 1_700_000_000,
  matchIdsPerPage: 100,
  maxConcurrentPlayers: 1,
  maxConcurrentMatchFetches: 1,
  resolveParticipantRanks: true,
  participantRankConcurrency: 1,
};

describe('MatchIdPaginator', () => {
  beforeEach(() => {
    vi.mocked(fetchMatchIdsByPUUID).mockReset();
  });

  test('stops after short page', async () => {
    vi.mocked(fetchMatchIdsByPUUID).mockResolvedValueOnce(['EUW1_1', 'EUW1_2']);
    const bus = new PollerEventBus();
    const events: unknown[] = [];
    bus.on('match:ids', (e) => events.push(e));

    const paginator = new MatchIdPaginator(player, config, bus, 'session-1');
    const ids = await paginator.fetchAll();

    expect(ids).toEqual(['EUW1_1', 'EUW1_2']);
    expect(fetchMatchIdsByPUUID).toHaveBeenCalledTimes(1);
    expect(fetchMatchIdsByPUUID).toHaveBeenCalledWith('puuid-1', 'euw1', {
      start: 0,
      count: 100,
      startTime: config.sinceTimestamp,
    });
    expect(events).toHaveLength(1);
  });

  test('paginates full pages', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => `EUW1_${i}`);
    vi.mocked(fetchMatchIdsByPUUID)
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(['EUW1_100']);

    const paginator = new MatchIdPaginator(player, config, new PollerEventBus(), 's');
    const ids = await paginator.fetchAll();
    expect(ids).toHaveLength(101);
    expect(fetchMatchIdsByPUUID).toHaveBeenCalledTimes(2);
    expect(fetchMatchIdsByPUUID).toHaveBeenLastCalledWith('puuid-1', 'euw1', {
      start: 100,
      count: 100,
      startTime: config.sinceTimestamp,
    });
  });

  test('returns partial results when later page fails', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => `EUW1_${i}`);
    vi.mocked(fetchMatchIdsByPUUID)
      .mockResolvedValueOnce(page1)
      .mockRejectedValueOnce(new Error('page 2 fail'));

    const paginator = new MatchIdPaginator(player, config, new PollerEventBus(), 's');
    const ids = await paginator.fetchAll();
    expect(ids).toHaveLength(100);
  });

  test('stops when page has 99 items', async () => {
    const page = Array.from({ length: 99 }, (_, i) => `EUW1_${i}`);
    vi.mocked(fetchMatchIdsByPUUID).mockResolvedValueOnce(page);
    const ids = await new MatchIdPaginator(player, config, new PollerEventBus(), 's').fetchAll();
    expect(ids).toHaveLength(99);
    expect(fetchMatchIdsByPUUID).toHaveBeenCalledTimes(1);
  });

  test('stops early when maxMatchesToProcess is set', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => `EUW1_${i}`);
    vi.mocked(fetchMatchIdsByPUUID).mockResolvedValueOnce(page1);

    const capped = { ...config, maxMatchesToProcess: 5 };
    const ids = await new MatchIdPaginator(player, capped, new PollerEventBus(), 's').fetchAll();

    expect(ids).toHaveLength(5);
    expect(ids).toEqual(page1.slice(0, 5));
    expect(fetchMatchIdsByPUUID).toHaveBeenCalledTimes(1);
  });
});
