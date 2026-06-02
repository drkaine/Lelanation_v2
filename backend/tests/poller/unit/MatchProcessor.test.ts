import { beforeEach, describe, expect, test, vi } from 'vitest';
import { MatchProcessor } from '../../../src/poller/MatchProcessor.js';
import { ParticipantRankCache } from '../../../src/poller/ParticipantRankCache.js';
import { PollerEventBus } from '../../../src/poller/PollerEventBus.js';
import type { Player, PollConfig } from '../../../src/poller/types.js';

vi.mock('../../../src/poller/gatewayRoutes.js', () => ({
  fetchMatch: vi.fn(),
  fetchMatchTimeline: vi.fn(),
  fetchLeagueEntriesByPUUID: vi.fn(),
}));

import {
  fetchLeagueEntriesByPUUID,
  fetchMatch,
  fetchMatchTimeline,
} from '../../../src/poller/gatewayRoutes.js';

const player: Player = { puuid: 'player-1', platform: 'euw1' };
const config: PollConfig = {
  sinceTimestamp: 1,
  matchIdsPerPage: 100,
  maxConcurrentPlayers: 1,
  maxConcurrentMatchFetches: 2,
  resolveParticipantRanks: true,
  participantRankConcurrency: 3,
};

function buildMatch(puuids: string[]) {
  return {
    info: {
      participants: puuids.map((puuid) => ({ puuid })),
    },
  };
}

describe('MatchProcessor', () => {
  beforeEach(() => {
    vi.mocked(fetchMatch).mockReset();
    vi.mocked(fetchMatchTimeline).mockReset();
    vi.mocked(fetchLeagueEntriesByPUUID).mockReset();
  });

  test('fetches match and timeline concurrently and emits match:data', async () => {
    const puuids = Array.from({ length: 10 }, (_, i) => `p-${i}`);
    vi.mocked(fetchMatch).mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 30));
      return buildMatch(puuids);
    });
    vi.mocked(fetchMatchTimeline).mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return { info: { frames: [] } };
    });
    vi.mocked(fetchLeagueEntriesByPUUID).mockResolvedValue([{ tier: 'GOLD' }]);

    const bus = new PollerEventBus();
    const matchData: unknown[] = [];
    bus.on('match:data', (e) => matchData.push(e));

    const processor = new MatchProcessor(
      player,
      config,
      bus,
      new ParticipantRankCache(),
      's1',
      () => undefined,
      () => undefined,
      () => undefined,
    );

    await processor.process('EUW1_123');

    expect(fetchMatch).toHaveBeenCalledOnce();
    expect(fetchMatchTimeline).toHaveBeenCalledOnce();
    expect(matchData).toHaveLength(1);
  });

  test('deduplicates participant ranks via cache', async () => {
    const puuids = ['cached-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6', 'p-7', 'p-8', 'p-9', 'p-10'];
    vi.mocked(fetchMatch).mockResolvedValue(buildMatch(puuids));
    vi.mocked(fetchMatchTimeline).mockResolvedValue({ info: {} });
    vi.mocked(fetchLeagueEntriesByPUUID).mockResolvedValue([{ tier: 'SILVER' }]);

    const cache = new ParticipantRankCache();
    cache.set('cached-1', [{ tier: 'PLATINUM' }]);

    const bus = new PollerEventBus();
    const ranks: Array<{ fromCache: boolean }> = [];
    bus.on('participant:rank', (e) => ranks.push({ fromCache: e.fromCache }));

    const processor = new MatchProcessor(
      player,
      config,
      bus,
      cache,
      's1',
      () => undefined,
      () => undefined,
      () => undefined,
    );

    await processor.process('EUW1_999');
    expect(fetchLeagueEntriesByPUUID).toHaveBeenCalledTimes(9);
    expect(ranks.filter((r) => r.fromCache).length).toBe(1);
    expect(ranks.filter((r) => !r.fromCache).length).toBe(9);
  });

  test('PATH B disabled does not fetch participant ranks', async () => {
    vi.mocked(fetchMatch).mockResolvedValue(buildMatch(Array.from({ length: 10 }, (_, i) => `p-${i}`)));
    vi.mocked(fetchMatchTimeline).mockResolvedValue({ info: {} });
    vi.mocked(fetchLeagueEntriesByPUUID).mockResolvedValue([{ tier: 'GOLD' }]);

    const processor = new MatchProcessor(
      player,
      { ...config, resolveParticipantRanks: false },
      new PollerEventBus(),
      new ParticipantRankCache(),
      's1',
      () => undefined,
      () => undefined,
      () => undefined,
    );

    await processor.process('EUW1_200');
    expect(fetchLeagueEntriesByPUUID).not.toHaveBeenCalled();
  });

  test('PATH B enabled fetches participant ranks', async () => {
    vi.mocked(fetchMatch).mockResolvedValue(buildMatch(Array.from({ length: 10 }, (_, i) => `p-${i}`)));
    vi.mocked(fetchMatchTimeline).mockResolvedValue({ info: {} });
    vi.mocked(fetchLeagueEntriesByPUUID).mockResolvedValue([{ tier: 'GOLD' }]);

    const processor = new MatchProcessor(
      player,
      { ...config, resolveParticipantRanks: true },
      new PollerEventBus(),
      new ParticipantRankCache(),
      's1',
      () => undefined,
      () => undefined,
      () => undefined,
    );

    await processor.process('EUW1_201');
    expect(fetchLeagueEntriesByPUUID).toHaveBeenCalledTimes(10);
  });
});
