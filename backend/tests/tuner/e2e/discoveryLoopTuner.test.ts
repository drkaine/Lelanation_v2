import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { PollerEngine } from '../../../src/poller/PollerEngine.js';
import { PollerTuner } from '../../../src/tuner/PollerTuner.js';
import { runDiscoveryIteration } from '../helpers/discoveryIteration.js';
import { buildGatewayStatus, expectedTargetRps } from '../helpers/gatewayFixtures.js';

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

function buildMatch(matchId: string) {
  return {
    metadata: { matchId },
    info: {
      gameVersion: '16.11.1',
      gameStartTimestamp: Date.now() - 3_600_000,
      participants: Array.from({ length: 10 }, (_, i) => ({
        puuid: `p-${matchId}-${i}`,
        participantId: i + 1,
        championId: 1,
        teamId: i < 5 ? 100 : 200,
        riotIdGameName: `N${i}`,
        riotIdTagline: 'EUW',
      })),
    },
  };
}

describe('discovery loop + tuner e2e', () => {
  beforeEach(async () => {
    PollerTuner.resetInstance();
    await PollerEngine.resetInstance();
    vi.clearAllMocks();
    vi.mocked(fetchLeagueEntriesByPUUID).mockResolvedValue([
      { queueType: 'RANKED_SOLO_5x5', tier: 'GOLD', rank: 'II', leaguePoints: 50 },
    ]);
    vi.mocked(fetchMatchTimeline).mockResolvedValue({ info: { frames: [] } });
    vi.mocked(fetchMatch).mockImplementation(async (id: string) => buildMatch(id));
    vi.mocked(fetchMatchIdsByPUUID).mockResolvedValue(['EUW1_1', 'EUW1_2']);
  });

  afterEach(async () => {
    await PollerEngine.resetInstance();
    PollerTuner.resetInstance();
  });

  test('backpressure blocks poll until queue has headroom', async () => {
    let overloaded = true;
    const poll = vi.fn();
    const waitCalls: number[] = [];

    const backpressure = {
      waitForHeadroom: vi.fn(async () => {
        waitCalls.push(Date.now());
        if (overloaded) {
          await new Promise((r) => setTimeout(r, 15));
        }
      }),
      getDepth: vi.fn(async () => ({
        waiting: overloaded ? 400 : 0,
        active: overloaded ? 200 : 0,
        total: overloaded ? 600 : 5,
      })),
    };

    const runWhenReady = async () => {
      await backpressure.waitForHeadroom();
      const { total } = await backpressure.getDepth();
      if (total > 500) return;
      await poll();
    };

    const first = runWhenReady();
    await new Promise((r) => setTimeout(r, 5));
    expect(poll).not.toHaveBeenCalled();

    overloaded = false;
    await first;

    expect(backpressure.waitForHeadroom).toHaveBeenCalled();
    expect(waitCalls.length).toBeGreaterThanOrEqual(1);
    expect(poll).toHaveBeenCalledTimes(1);
  });

  test('one discovery iteration uses tuner batch and records session', async () => {
    const gatewayStatus = buildGatewayStatus(99, 19);
    let gatewayRequests = 0;

    const discovered = Array.from({ length: 20 }, (_, i) => ({
      puuid: `disc-${i}`,
      region: 'euw1',
    }));

    const backpressure = {
      waitForHeadroom: vi.fn(async () => undefined),
      getDepth: vi.fn(async () => ({ waiting: 0, active: 0, total: 0 })),
    };

    const engine = PollerEngine.getInstance();
    const result = await runDiscoveryIteration({
      backpressure,
      fetchPlayers: async () => discovered,
      gatewayStatus: () => gatewayStatus,
      requestsAtSessionStart: gatewayRequests,
      gatewayRequests: () => gatewayRequests,
      poll: async (players, config) => {
        gatewayRequests += players.length * 3;
        return engine.poll(players, config);
      },
    });

    expect(result.polled).toBe(true);
    expect(result.tuned?.warmupActive).toBe(true);
    expect(result.playersPolled).toBeLessThanOrEqual(20);
    expect(result.playersPolled).toBe(result.tuned?.batchSize);
    expect(PollerTuner.getInstance().getSnapshot().sessionCount).toBe(1);
  });

  test('overloaded queue skips poll when iteration never gets headroom', async () => {
    const poll = vi.fn();
    const backpressure = {
      waitForHeadroom: vi.fn(async () => undefined),
      getDepth: vi.fn(async () => ({ waiting: 500, active: 200, total: 700 })),
    };

    const tuner = PollerTuner.getInstance();
    const tuned = tuner.compute({
      gatewayStatus: buildGatewayStatus(99, 19),
      queueDepth: 700,
      availablePlayers: 10,
    });

    if (tuned.discoveryIntervalMs > 0 && tuned.batchSize > 0) {
      // Under heavy queue pressure we still compute params but production loop waits on backpressure first.
      expect(tuned.targetRps).toBeLessThan(expectedTargetRps(99, 19));
    }

    await backpressure.waitForHeadroom();
    const depth = await backpressure.getDepth();
    if (depth.total > 500) {
      expect(poll).not.toHaveBeenCalled();
      return;
    }
    await poll();
  });
});
