import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { PollerEngine } from '../../../src/poller/PollerEngine.js';
import { PollerTuner } from '../../../src/tuner/PollerTuner.js';
import { tunerLogger } from '../../../src/tuner/TuningLogger.js';
import { buildGatewayStatus } from '../helpers/gatewayFixtures.js';

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

describe('tunerIntegration e2e', () => {
  beforeEach(async () => {
    PollerTuner.resetInstance();
    await PollerEngine.resetInstance();
    vi.clearAllMocks();
    vi.mocked(fetchLeagueEntriesByPUUID).mockResolvedValue([
      { queueType: 'RANKED_SOLO_5x5', tier: 'GOLD', rank: 'II', leaguePoints: 50 },
    ]);
    vi.mocked(fetchMatchTimeline).mockResolvedValue({ info: { frames: [] } });
    vi.mocked(fetchMatch).mockImplementation(async (id: string) => buildMatch(id));
  });

  afterEach(async () => {
    await PollerEngine.resetInstance();
    PollerTuner.resetInstance();
  });

  test('T1 fresh start warmup active with fallback limits', () => {
    const tuner = PollerTuner.getInstance();
    const params = tuner.compute({
      gatewayStatus: buildGatewayStatus(99, 19, 0, []),
      queueDepth: 0,
      availablePlayers: 20,
    });
    expect(params.warmupActive).toBe(true);
    expect(params.batchSize).toBeGreaterThanOrEqual(1);

    PollerTuner.resetInstance();
    const afterWarmupEstimator = PollerTuner.getInstance();
    for (let i = 0; i < 5; i += 1) {
      afterWarmupEstimator.recordSession({
        playersCompleted: 1,
        totalGatewayRequests: 20,
        sessionDurationMs: 30_000,
        matchesFetched: 2,
        matchesSkipped: 0,
        participantRanksFetched: 0,
        participantRanksFromCache: 0,
        avgMatchLatencyMs: 2600,
      });
    }
    const fullBatch = afterWarmupEstimator.compute({
      gatewayStatus: buildGatewayStatus(99, 19, 0, []),
      queueDepth: 0,
      availablePlayers: 20,
    });
    expect(params.batchSize).toBeLessThanOrEqual(Math.ceil(fullBatch.batchSize * 0.5) + 1);
  });

  test('T2 after 5 sessions warmup inactive and batch closer to optimal', () => {
    const tuner = PollerTuner.getInstance();
    const warmupBatch = tuner.compute({
      gatewayStatus: buildGatewayStatus(99, 19),
      queueDepth: 0,
      availablePlayers: 20,
    }).batchSize;

    for (let i = 0; i < 5; i += 1) {
      tuner.recordSession({
        playersCompleted: 1,
        totalGatewayRequests: 20,
        sessionDurationMs: 30_000,
        matchesFetched: 2,
        matchesSkipped: 0,
        participantRanksFetched: 0,
        participantRanksFromCache: 10,
        avgMatchLatencyMs: 2600,
      });
    }
    const params = tuner.compute({
      gatewayStatus: buildGatewayStatus(99, 19),
      queueDepth: 0,
      availablePlayers: 20,
    });
    expect(params.warmupActive).toBe(false);
    expect(params.batchSize).toBeGreaterThanOrEqual(warmupBatch);
  });

  test('T3 limit change mid-run increases batch and resets EMA path', () => {
    const tuner = PollerTuner.getInstance();
    const personal = tuner.compute({
      gatewayStatus: buildGatewayStatus(99, 19),
      queueDepth: 0,
      availablePlayers: 50,
    });

    const prod = tuner.compute({
      gatewayStatus: buildGatewayStatus(29_999, 499),
      queueDepth: 0,
      availablePlayers: 50,
    });

    expect(prod.batchSize).toBeGreaterThan(personal.batchSize);
    expect(tuner.getSnapshot().limitHistory.length).toBeGreaterThanOrEqual(1);
  });

  test('T4 queue pressure reduces batch and sets interval', () => {
    const tuner = PollerTuner.getInstance();
    for (let i = 0; i < 5; i += 1) {
      tuner.recordSession({
        playersCompleted: 1,
        totalGatewayRequests: 20,
        sessionDurationMs: 30_000,
        matchesFetched: 2,
        matchesSkipped: 0,
        participantRanksFetched: 0,
        participantRanksFromCache: 0,
        avgMatchLatencyMs: 2600,
      });
    }
    const baseline = tuner.compute({
      gatewayStatus: buildGatewayStatus(99, 19, 50),
      queueDepth: 0,
      availablePlayers: 20,
    });
    PollerTuner.resetInstance();
    const pressuredTuner = PollerTuner.getInstance();
    for (let i = 0; i < 5; i += 1) {
      pressuredTuner.recordSession({
        playersCompleted: 1,
        totalGatewayRequests: 20,
        sessionDurationMs: 30_000,
        matchesFetched: 2,
        matchesSkipped: 0,
        participantRanksFetched: 0,
        participantRanksFromCache: 0,
        avgMatchLatencyMs: 2600,
      });
    }
    const pressured = pressuredTuner.compute({
      gatewayStatus: buildGatewayStatus(99, 19, 50),
      queueDepth: 410,
      availablePlayers: 20,
    });
    expect(pressured.targetRps).toBeLessThan(baseline.targetRps);
    expect(pressured.batchSize).toBeLessThanOrEqual(baseline.batchSize);
    expect(pressured.discoveryIntervalMs).toBe(0);
  });

  test('T5 one poll iteration with tuner feedback', async () => {
    const infoSpy = vi.spyOn(tunerLogger, 'info');
    const tuner = PollerTuner.getInstance();
    vi.mocked(fetchMatchIdsByPUUID).mockResolvedValue(['EUW1_1', 'EUW1_2']);

    const tuned = tuner.compute({
      gatewayStatus: buildGatewayStatus(99, 19),
      queueDepth: 0,
      availablePlayers: 5,
    });

    expect(
      infoSpy.mock.calls.some((call) => call[1] === 'tuning params applied'),
    ).toBe(true);

    const engine = PollerEngine.getInstance();

    const { stats } = await engine.poll(
      Array.from({ length: Math.min(5, tuned.batchSize) }, (_, i) => ({
        puuid: `player-${i}`,
        platform: 'euw1' as const,
      })),
      {
        sinceTimestamp: 1_700_000_000,
        maxConcurrentPlayers: tuned.maxConcurrentPlayers,
        maxConcurrentMatchFetches: tuned.maxConcurrentMatchFetches,
        participantRankConcurrency: tuned.participantRankConcurrency,
      },
    );

    tuner.recordSession({
      playersCompleted: stats.playersCompleted,
      totalGatewayRequests: Math.max(1, stats.matchesFetched * 3),
      sessionDurationMs: stats.elapsedMs ?? 1,
      matchesFetched: stats.matchesFetched,
      matchesSkipped: stats.matchIdsSkipped,
      participantRanksFetched: stats.participantRanksFetched,
      participantRanksFromCache: stats.participantRanksFromCache,
    });

    expect(tuner.getSnapshot().sessionCount).toBe(1);
    expect(tuner.getSnapshot().ema.reqPerPlayer).toBeGreaterThan(0);
    expect(stats.playersCompleted).toBeGreaterThanOrEqual(1);

    infoSpy.mockRestore();
  });
});
