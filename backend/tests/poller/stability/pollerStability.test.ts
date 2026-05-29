import { afterAll, describe, expect, test, vi } from 'vitest';
import { PollerEngine } from '../../../src/poller/PollerEngine.js';
import type { PollerEvents } from '../../../src/poller/types.js';

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

const SESSIONS = Number.parseInt(process.env.STABILITY_SESSIONS ?? '10', 10);

describe('pollerStability', () => {
  afterAll(async () => {
    await PollerEngine.resetInstance();
  });

  test('repeated sessions without runaway heap growth', async () => {
    vi.mocked(fetchLeagueEntriesByPUUID).mockResolvedValue([{ queueType: 'RANKED_SOLO_5x5', tier: 'GOLD' }]);
    vi.mocked(fetchMatchIdsByPUUID).mockResolvedValue(['EUW1_1', 'EUW1_2']);
    vi.mocked(fetchMatch).mockImplementation(async (id) =>
      buildMatch(id, Array.from({ length: 10 }, (_, i) => `p-${id}-${i}`)),
    );
    vi.mocked(fetchMatchTimeline).mockResolvedValue({ info: {} });

    const heap0 = process.memoryUsage().heapUsed;
    const engine = PollerEngine.getInstance();

    for (let i = 0; i < SESSIONS; i += 1) {
      const { stats } = await engine.poll([{ puuid: `s-${i}`, platform: 'euw1' }], { sinceTimestamp: 1 });
      expect(stats.matchesFetched).toBe(2);
    }

    if (global.gc) global.gc();
    const heapFinal = process.memoryUsage().heapUsed;
    expect(heapFinal).toBeLessThan(heap0 * 2.5);
    expect(PollerEngine.getInstance()).toBe(engine);
  }, 120_000);

  test('asyncPool task timeout prevents session stall', async () => {
    const { asyncPool } = await import('../../../src/poller/utils/asyncPool.js');
    const items = [1, 2, 3, 4, 5];
    const started = Date.now();
    const results = await asyncPool(
      2,
      items,
      async (item) => {
        if (item === 3) await new Promise(() => undefined);
        return item;
      },
      500,
    );
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(results).toHaveLength(5);
    expect(results.find((r) => r.item === 3)?.error).toBeDefined();
  });

  test('no duplicate match:data per session across repeated runs', async () => {
    vi.mocked(fetchLeagueEntriesByPUUID).mockResolvedValue([{ tier: 'GOLD' }]);
    vi.mocked(fetchMatchIdsByPUUID).mockResolvedValue(['EUW1_A', 'EUW1_B']);
    vi.mocked(fetchMatch).mockImplementation(async (id) => buildMatch(id, Array.from({ length: 10 }, (_, i) => `u-${i}`)));
    vi.mocked(fetchMatchTimeline).mockResolvedValue({ info: {} });

    const engine = PollerEngine.getInstance();
    for (let i = 0; i < 5; i += 1) {
      const events: PollerEvents['match:data'][] = [];
      engine.getEventBus().on('match:data', (e) => events.push(e));
      await engine.poll([{ puuid: 'stable', platform: 'euw1' }], { sinceTimestamp: 1 });
      const counts = new Map<string, number>();
      for (const e of events) counts.set(e.matchId, (counts.get(e.matchId) ?? 0) + 1);
      for (const count of counts.values()) expect(count).toBe(1);
    }
  });
});
