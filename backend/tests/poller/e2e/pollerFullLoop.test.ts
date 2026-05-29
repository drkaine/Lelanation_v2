import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PollerEngine } from '../../../src/poller/PollerEngine.js';
import type { Player, PollerEvents } from '../../../src/poller/types.js';

vi.mock('../../../src/poller/gatewayRoutes.js', () => ({
  fetchMatchIdsByPUUID: vi.fn(),
  fetchMatch: vi.fn(),
  fetchMatchTimeline: vi.fn(),
  fetchLeagueEntriesByPUUID: vi.fn(),
}));

import {
  fetchLeagueEntriesByPUUID,
  fetchMatch,
  fetchMatchIdsByPUUID,
  fetchMatchTimeline,
} from '../../../src/poller/gatewayRoutes.js';

function buildMatch(matchId: string, puuids: string[]) {
  return {
    metadata: { matchId },
    info: { participants: puuids.map((puuid) => ({ puuid })) },
  };
}

function collectEvents<T extends keyof PollerEvents>(bus: ReturnType<PollerEngine['getEventBus']>, event: T) {
  const items: PollerEvents[T][] = [];
  bus.on(event, (payload) => items.push(payload));
  return items;
}

describe('pollerFullLoop e2e', () => {
  beforeEach(async () => {
    await PollerEngine.resetInstance();
    vi.mocked(fetchLeagueEntriesByPUUID).mockReset();
    vi.mocked(fetchMatchIdsByPUUID).mockReset();
    vi.mocked(fetchMatch).mockReset();
    vi.mocked(fetchMatchTimeline).mockReset();

    vi.mocked(fetchLeagueEntriesByPUUID).mockResolvedValue([
      { queueType: 'RANKED_SOLO_5x5', tier: 'GOLD', rank: 'II', leaguePoints: 50 },
    ]);
  });

  test('nominal: 1 player, 5 matches', async () => {
    const matchIds = Array.from({ length: 5 }, (_, i) => `EUW1_1000${i}`);
    vi.mocked(fetchMatchIdsByPUUID).mockResolvedValueOnce(matchIds);
    vi.mocked(fetchMatch).mockImplementation(async (id) =>
      buildMatch(
        id,
        Array.from({ length: 10 }, (_, i) => `part-${id}-${i}`),
      ),
    );
    vi.mocked(fetchMatchTimeline).mockResolvedValue({ info: { frames: [] } });

    const engine = PollerEngine.getInstance();
    const playerRank = collectEvents(engine.getEventBus(), 'player:rank');
    const matchIdsEvents = collectEvents(engine.getEventBus(), 'match:ids');
    const matchData = collectEvents(engine.getEventBus(), 'match:data');
    const participantRank = collectEvents(engine.getEventBus(), 'participant:rank');
    const playerComplete = collectEvents(engine.getEventBus(), 'player:complete');
    const sessionComplete = collectEvents(engine.getEventBus(), 'session:complete');

    const player: Player = { puuid: 'main-player', platform: 'euw1' };
    const { stats } = await engine.poll([player], {
      sinceTimestamp: 1_700_000_000,
      maxConcurrentMatchFetches: 2,
      participantRankConcurrency: 3,
    });

    expect(playerRank).toHaveLength(1);
    expect(matchIdsEvents.length).toBeGreaterThanOrEqual(1);
    expect(matchData).toHaveLength(5);
    expect(participantRank).toHaveLength(50);
    expect(playerComplete).toHaveLength(1);
    expect(sessionComplete).toHaveLength(1);
    expect(sessionComplete[0]?.status).toBe('completed');
    expect(stats.matchesFetched).toBe(5);
  });

  test('deduplicates shared matches across duplicate players', async () => {
    const matchIds = ['EUW1_1', 'EUW1_2', 'EUW1_3'];
    vi.mocked(fetchMatchIdsByPUUID).mockResolvedValue(matchIds);
    vi.mocked(fetchMatch).mockImplementation(async (id) =>
      buildMatch(id, Array.from({ length: 10 }, (_, i) => `shared-${i}`)),
    );
    vi.mocked(fetchMatchTimeline).mockResolvedValue({ info: {} });

    const engine = PollerEngine.getInstance();
    const matchData = collectEvents(engine.getEventBus(), 'match:data');
    const player: Player = { puuid: 'dup-player', platform: 'euw1' };

    await engine.poll([player, player], { sinceTimestamp: 1 });

    const unique = new Set(matchData.map((e) => e.matchId));
    expect(unique.size).toBe(3);
    expect(matchData).toHaveLength(3);
  });

  test('resolveParticipantRanks=false skips participant events', async () => {
    vi.mocked(fetchMatchIdsByPUUID).mockResolvedValueOnce(['EUW1_9']);
    vi.mocked(fetchMatch).mockResolvedValue(buildMatch('EUW1_9', Array.from({ length: 10 }, (_, i) => `p-${i}`)));
    vi.mocked(fetchMatchTimeline).mockResolvedValue({ info: {} });

    const engine = PollerEngine.getInstance();
    const participantRank = collectEvents(engine.getEventBus(), 'participant:rank');
    const matchData = collectEvents(engine.getEventBus(), 'match:data');

    await engine.poll([{ puuid: 'solo', platform: 'euw1' }], {
      resolveParticipantRanks: false,
      sinceTimestamp: 1,
    });

    expect(matchData).toHaveLength(1);
    expect(participantRank).toHaveLength(0);
    expect(fetchLeagueEntriesByPUUID).toHaveBeenCalledTimes(1);
  });

  test('deduplicates shared matches across two players (A/B overlap)', async () => {
    const playerA: Player = { puuid: 'player-a', platform: 'euw1' };
    const playerB: Player = { puuid: 'player-b', platform: 'euw1' };
    const idsA = ['EUW1_M1', 'EUW1_M2', 'EUW1_M3', 'EUW1_M4', 'EUW1_M5'];
    const idsB = ['EUW1_M3', 'EUW1_M4', 'EUW1_M5', 'EUW1_M6', 'EUW1_M7'];

    vi.mocked(fetchMatchIdsByPUUID).mockImplementation(async (puuid) =>
      puuid === 'player-a' ? idsA : idsB,
    );
    vi.mocked(fetchMatch).mockImplementation(async (id) =>
      buildMatch(id, Array.from({ length: 10 }, (_, i) => `shared-${i}`)),
    );
    vi.mocked(fetchMatchTimeline).mockResolvedValue({ info: {} });

    const engine = PollerEngine.getInstance();
    const matchData = collectEvents(engine.getEventBus(), 'match:data');
    await engine.poll([playerA, playerB], { sinceTimestamp: 1, maxConcurrentPlayers: 2 });

    const uniqueIds = new Set(matchData.map((e) => e.matchId));
    expect(uniqueIds.size).toBe(7);
    expect(matchData).toHaveLength(7);
  });

  test('partial failures are non-fatal (chaos scenario)', async () => {
    const matchIds = Array.from({ length: 10 }, (_, i) => `EUW1_C${i}`);
    vi.mocked(fetchMatchIdsByPUUID).mockResolvedValueOnce(matchIds);
    vi.mocked(fetchMatch).mockImplementation(async (id) => {
      if (id === 'EUW1_C0' || id === 'EUW1_C1') throw new Error('404 match');
      return buildMatch(id, Array.from({ length: 10 }, (_, i) => `p-${id}-${i}`));
    });
    vi.mocked(fetchMatchTimeline).mockImplementation(async (id) => {
      if (id === 'EUW1_C2' || id === 'EUW1_C3' || id === 'EUW1_C4') throw new Error('500 timeline');
      return { info: {} };
    });
    vi.mocked(fetchLeagueEntriesByPUUID).mockImplementation(async (puuid) => {
      if (puuid.endsWith('-1')) throw new Error('rank fail');
      return [{ tier: 'GOLD' }];
    });

    const engine = PollerEngine.getInstance();
    const sessionComplete = collectEvents(engine.getEventBus(), 'session:complete');
    const participantRank = collectEvents(engine.getEventBus(), 'participant:rank');
    const { stats } = await engine.poll([{ puuid: 'chaos', platform: 'euw1' }], { sinceTimestamp: 1 });

    expect(sessionComplete[0]?.status).toBe('completed');
    expect(stats.matchesFetched).toBe(5);
    expect(stats.errors.length).toBeGreaterThan(0);
    expect(stats.errors.every((e) => !e.fatal)).toBe(true);
    expect(participantRank.length).toBeGreaterThan(0);
  });

  test('respects concurrency limits under load', async () => {
    let matchActive = 0;
    let matchPeak = 0;
    const matchIds = Array.from({ length: 15 }, (_, i) => `EUW1_L${i}`);
    vi.mocked(fetchMatchIdsByPUUID).mockResolvedValue(matchIds);
    vi.mocked(fetchMatch).mockImplementation(async (id) => {
      matchActive += 1;
      matchPeak = Math.max(matchPeak, matchActive);
      await new Promise((r) => setTimeout(r, 15));
      matchActive -= 1;
      return buildMatch(id, Array.from({ length: 10 }, (_, i) => `p-${i}`));
    });
    vi.mocked(fetchMatchTimeline).mockResolvedValue({ info: {} });

    const engine = PollerEngine.getInstance();
    await engine.poll(
      [
        { puuid: 'c1', platform: 'euw1' },
        { puuid: 'c2', platform: 'euw1' },
        { puuid: 'c3', platform: 'euw1' },
      ],
      {
        sinceTimestamp: 1,
        maxConcurrentPlayers: 2,
        maxConcurrentMatchFetches: 4,
        participantRankConcurrency: 3,
      },
    );

    expect(matchPeak).toBeLessThanOrEqual(4);
  });

  test('cancel mid-session completes gracefully', async () => {
    const matchIds = Array.from({ length: 20 }, (_, i) => `EUW1_X${i}`);
    vi.mocked(fetchMatchIdsByPUUID).mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 30));
      return matchIds;
    });
    vi.mocked(fetchMatch).mockImplementation(async (id) => {
      await new Promise((r) => setTimeout(r, 50));
      return buildMatch(id, Array.from({ length: 10 }, (_, i) => `p-${i}`));
    });
    vi.mocked(fetchMatchTimeline).mockResolvedValue({ info: {} });

    const { PollSession } = await import('../../../src/poller/PollSession.js');
    const { PollerEventBus } = await import('../../../src/poller/PollerEventBus.js');
    const bus = new PollerEventBus();
    const sessionComplete: Array<{ status: string }> = [];
    bus.on('session:complete', (e) => sessionComplete.push({ status: e.status }));

    const session = new PollSession(
      [
        { puuid: 'x1', platform: 'euw1' },
        { puuid: 'x2', platform: 'euw1' },
        { puuid: 'x3', platform: 'euw1' },
      ],
      { sinceTimestamp: 1, maxConcurrentPlayers: 1, maxConcurrentMatchFetches: 2 },
      bus,
    );

    const runPromise = session.run();
    await new Promise((r) => setTimeout(r, 200));
    session.cancel();
    const stats = await runPromise;

    expect(sessionComplete).toHaveLength(1);
    expect(sessionComplete[0]?.status).toBe('cancelled');
    expect(stats.playersCompleted).toBeGreaterThanOrEqual(0);
  });

  test('zero matches since sinceTimestamp', async () => {
    vi.mocked(fetchMatchIdsByPUUID).mockResolvedValueOnce([]);
    const engine = PollerEngine.getInstance();
    const playerRank = collectEvents(engine.getEventBus(), 'player:rank');
    const matchIds = collectEvents(engine.getEventBus(), 'match:ids');
    const matchData = collectEvents(engine.getEventBus(), 'match:data');
    const playerComplete = collectEvents(engine.getEventBus(), 'player:complete');
    const sessionComplete = collectEvents(engine.getEventBus(), 'session:complete');

    const { stats } = await engine.poll([{ puuid: 'inactive', platform: 'euw1' }], { sinceTimestamp: 1 });

    expect(playerRank).toHaveLength(1);
    expect(matchIds).toHaveLength(1);
    expect(matchIds[0]?.matchIds).toEqual([]);
    expect(matchData).toHaveLength(0);
    expect(playerComplete[0]?.stats.matchesFetched).toBe(0);
    expect(sessionComplete[0]?.status).toBe('completed');
    expect(stats.matchIdsDiscovered).toBe(0);
  });
});
