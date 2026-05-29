import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PollSession } from '../../../src/poller/PollSession.js';
import { PollerEventBus } from '../../../src/poller/PollerEventBus.js';
import type { Player, PlayerPollStats } from '../../../src/poller/types.js';

const mocks = vi.hoisted(() => ({
  runMock: vi.fn<() => Promise<PlayerPollStats>>(),
}));

vi.mock('../../../src/poller/PlayerPoller.js', () => ({
  PlayerPoller: class {
    run = mocks.runMock;
  },
}));

const players: Player[] = [
  { puuid: 'p1', platform: 'euw1' },
  { puuid: 'p2', platform: 'euw1' },
  { puuid: 'p3', platform: 'euw1' },
  { puuid: 'p4', platform: 'euw1' },
  { puuid: 'p5', platform: 'euw1' },
];

function playerStats(matchesFetched: number): PlayerPollStats {
  return {
    matchIdsDiscovered: matchesFetched,
    matchIdsSkipped: 0,
    matchesFetched,
    participantRanksFetched: 0,
    elapsedMs: 1,
    errors: [],
  };
}

describe('PollSession', () => {
  beforeEach(() => {
    mocks.runMock.mockReset();
    mocks.runMock.mockImplementation(async () => playerStats(2));
  });

  test('limits concurrent PlayerPollers to maxConcurrentPlayers', async () => {
    let active = 0;
    let peak = 0;
    mocks.runMock.mockImplementation(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 30));
      active -= 1;
      return playerStats(1);
    });

    const bus = new PollerEventBus();
    const session = new PollSession(players, { maxConcurrentPlayers: 2, sinceTimestamp: 1 }, bus);
    await session.run();

    expect(peak).toBeLessThanOrEqual(2);
    expect(mocks.runMock).toHaveBeenCalledTimes(5);
  });

  test('emits session:complete exactly once with aggregated stats', async () => {
    mocks.runMock
      .mockResolvedValueOnce(playerStats(3))
      .mockResolvedValueOnce(playerStats(5));

    const bus = new PollerEventBus();
    const completed: unknown[] = [];
    bus.on('session:complete', (e) => completed.push(e));

    const session = new PollSession(
      players.slice(0, 2),
      { maxConcurrentPlayers: 2, sinceTimestamp: 1 },
      bus,
    );
    const stats = await session.run();

    expect(completed).toHaveLength(1);
    expect(stats.playersCompleted).toBe(2);
    expect(stats.playersTotal).toBe(2);
  });

  test('cancel stops unstarted players but lets in-flight finish', async () => {
    mocks.runMock.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 80));
      return playerStats(1);
    });

    const bus = new PollerEventBus();
    const session = new PollSession(players.slice(0, 3), { maxConcurrentPlayers: 1, sinceTimestamp: 1 }, bus);
    const completed: Array<{ status: string }> = [];
    bus.on('session:complete', (e) => completed.push({ status: e.status }));

    const runPromise = session.run();
    await new Promise((r) => setTimeout(r, 120));
    session.cancel();
    const stats = await runPromise;

    expect(completed).toHaveLength(1);
    expect(completed[0]?.status).toBe('cancelled');
    expect(stats.playersCompleted).toBeGreaterThanOrEqual(1);
    expect(mocks.runMock.mock.calls.length).toBeLessThanOrEqual(3);
  });

  test('continues session when one player poller returns fatal error', async () => {
    mocks.runMock
      .mockResolvedValueOnce({
        ...playerStats(0),
        errors: [{ ts: 1, stage: 'match_ids', error: 'boom', retried: false, fatal: true }],
      })
      .mockResolvedValueOnce(playerStats(2));

    const bus = new PollerEventBus();
    const session = new PollSession(players.slice(0, 2), { maxConcurrentPlayers: 2, sinceTimestamp: 1 }, bus);
    const stats = await session.run();

    expect(stats.playersFailed).toBe(1);
    expect(stats.playersCompleted).toBe(1);
  });
});
