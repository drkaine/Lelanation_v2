import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ParticipantRankCache } from '../../../src/poller/ParticipantRankCache.js';
import { PlayerPoller } from '../../../src/poller/PlayerPoller.js';
import { PollerEventBus } from '../../../src/poller/PollerEventBus.js';
import type { Player, PollConfig } from '../../../src/poller/types.js';

const mocks = vi.hoisted(() => ({
  fetchAllMock: vi.fn<() => Promise<string[]>>(),
  processMock: vi.fn<(matchId: string) => Promise<void>>(),
}));

vi.mock('../../../src/poller/MatchIdPaginator.js', () => ({
  MatchIdPaginator: class {
    fetchAll = mocks.fetchAllMock;
  },
}));

vi.mock('../../../src/poller/MatchProcessor.js', () => ({
  MatchProcessor: class {
    process = mocks.processMock;
  },
}));

vi.mock('../../../src/poller/gatewayRoutes.js', () => ({
  fetchLeagueEntriesByPUUID: vi.fn(),
}));

import { fetchLeagueEntriesByPUUID } from '../../../src/poller/gatewayRoutes.js';

const player: Player = { puuid: 'player-main', platform: 'euw1' };
const baseConfig: PollConfig = {
  sinceTimestamp: 1,
  matchIdsPerPage: 100,
  maxConcurrentPlayers: 1,
  maxConcurrentMatchFetches: 3,
  resolveParticipantRanks: true,
  participantRankConcurrency: 5,
};

function createPoller(
  processed = new Set<string>(),
  options?: { resolveParticipantRanks?: boolean; rankKnownToday?: boolean },
) {
  const bus = new PollerEventBus();
  const cache = new ParticipantRankCache();
  const sessionErrors: unknown[] = [];
  const config: PollConfig = {
    ...baseConfig,
    resolveParticipantRanks: options?.resolveParticipantRanks ?? baseConfig.resolveParticipantRanks,
    rankFilter: () => options?.rankKnownToday ?? false,
  };
  const poller = new PlayerPoller(
    player,
    config,
    bus,
    cache,
    processed,
    'session-1',
    (e) => sessionErrors.push(e),
    () => undefined,
    () => false,
  );
  return { poller, bus, cache, sessionErrors };
}

describe('PlayerPoller', () => {
  beforeEach(() => {
    vi.mocked(fetchLeagueEntriesByPUUID).mockReset();
    mocks.fetchAllMock.mockReset();
    mocks.processMock.mockReset();
    vi.mocked(fetchLeagueEntriesByPUUID).mockResolvedValue([
      { queueType: 'RANKED_SOLO_5x5', tier: 'GOLD', rank: 'II', leaguePoints: 10 },
    ]);
    mocks.fetchAllMock.mockResolvedValue(Array.from({ length: 20 }, (_, i) => `EUW1_${i}`));
    mocks.processMock.mockResolvedValue(undefined);
  });

  test('runs rank fetch before match id pagination and match processing', async () => {
    const order: string[] = [];
    vi.mocked(fetchLeagueEntriesByPUUID).mockImplementation(async () => {
      order.push('rank');
      return [{ queueType: 'RANKED_SOLO_5x5' }];
    });
    mocks.fetchAllMock.mockImplementation(async () => {
      order.push('matchIds');
      return ['EUW1_1', 'EUW1_2'];
    });
    mocks.processMock.mockImplementation(async (id) => {
      order.push(`process:${id}`);
    });

    const { poller } = createPoller();
    await poller.run();

    expect(order[0]).toBe('rank');
    expect(order[1]).toBe('matchIds');
    expect(order.filter((x) => x.startsWith('process:'))).toHaveLength(2);
  });

  test('reserves player puuid in rank cache before pagination', async () => {
    const { poller, cache } = createPoller();
    let reservedBeforeMatchIds = false;
    mocks.fetchAllMock.mockImplementation(async () => {
      reservedBeforeMatchIds = cache.has(player.puuid);
      return ['EUW1_1'];
    });

    await poller.run();
    expect(reservedBeforeMatchIds).toBe(true);
    expect(cache.get(player.puuid)).not.toBeNull();
  });

  test('deduplicates against processedMatchIds before processing', async () => {
    const processed = new Set(['EUW1_0', 'EUW1_1', 'EUW1_2', 'EUW1_3', 'EUW1_4', 'EUW1_5', 'EUW1_6', 'EUW1_7']);
    mocks.fetchAllMock.mockResolvedValue(Array.from({ length: 20 }, (_, i) => `EUW1_${i}`));

    const { poller } = createPoller(processed);
    const stats = await poller.run();

    expect(mocks.processMock).toHaveBeenCalledTimes(12);
    expect(processed.size).toBe(20);
    expect(stats.matchIdsSkipped).toBe(8);
    expect(stats.matchIdsDiscovered).toBe(20);
  });

  test('adds match ids to processedMatchIds before first process call', async () => {
    mocks.fetchAllMock.mockResolvedValue(['EUW1_A', 'EUW1_B']);
    const processed = new Set<string>();
    mocks.processMock.mockImplementation(async () => {
      expect(processed.size).toBe(2);
    });

    const { poller } = createPoller(processed);
    await poller.run();
    expect(processed.size).toBe(2);
  });

  test('rank failure is non-fatal and match ids still fetched', async () => {
    vi.mocked(fetchLeagueEntriesByPUUID).mockRejectedValue(new Error('rank down'));
    mocks.fetchAllMock.mockResolvedValue(['EUW1_1']);

    const { poller, bus } = createPoller();
    const complete = collect(bus, 'player:complete');
    const stats = await poller.run();

    expect(mocks.fetchAllMock).toHaveBeenCalledOnce();
    expect(mocks.processMock).toHaveBeenCalledOnce();
    expect(complete).toHaveLength(1);
    expect(stats.errors.some((e) => e.stage === 'player_rank')).toBe(true);
  });

  test('PATH A rank fetch remains active when resolveParticipantRanks=false', async () => {
    mocks.fetchAllMock.mockResolvedValue([]);
    const { poller } = createPoller(new Set<string>(), { resolveParticipantRanks: false, rankKnownToday: false });
    await poller.run();
    expect(fetchLeagueEntriesByPUUID).toHaveBeenCalledWith(player.puuid, player.platform, 'high');
  });

  test('PATH A rank fetch is skipped when rankFilter says known today', async () => {
    mocks.fetchAllMock.mockResolvedValue([]);
    const { poller } = createPoller(new Set<string>(), { resolveParticipantRanks: false, rankKnownToday: true });
    await poller.run();
    expect(fetchLeagueEntriesByPUUID).not.toHaveBeenCalledWith(player.puuid, player.platform, 'high');
  });

  test('zero match ids still emits player:complete', async () => {
    mocks.fetchAllMock.mockResolvedValue([]);
    const { poller, bus } = createPoller();
    const complete = collect(bus, 'player:complete');

    const stats = await poller.run();
    expect(complete).toHaveLength(1);
    expect(stats.matchesFetched).toBe(0);
    expect(stats.matchIdsDiscovered).toBe(0);
    expect(mocks.processMock).not.toHaveBeenCalled();
  });
});

function collect(bus: PollerEventBus, event: 'player:complete') {
  const items: unknown[] = [];
  bus.on(event, (p) => items.push(p));
  return items;
}
