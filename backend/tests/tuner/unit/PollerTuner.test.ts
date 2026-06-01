import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { PollerTuner } from '../../../src/tuner/PollerTuner.js';
import type { SessionFeedback } from '../../../src/tuner/types.js';
import { buildGatewayStatus, expectedTargetRps } from '../helpers/gatewayFixtures.js';

const ctx = (status: ReturnType<typeof buildGatewayStatus>, availablePlayers: number, queueDepth = 0) => ({
  gatewayStatus: status,
  queueDepth,
  availablePlayers,
});

function feedback(overrides: Partial<SessionFeedback> = {}): SessionFeedback {
  return {
    playersCompleted: 1,
    totalGatewayRequests: 20,
    sessionDurationMs: 30_000,
    matchesFetched: 2,
    matchesSkipped: 0,
    participantRanksFetched: 5,
    participantRanksFromCache: 5,
    ...overrides,
  };
}

describe('PollerTuner', () => {
  beforeEach(() => {
    PollerTuner.resetInstance();
  });

  afterEach(() => {
    PollerTuner.resetInstance();
  });

  test('T1 no buckets uses fallback limits', () => {
    const tuner = PollerTuner.getInstance();
    const params = tuner.compute({
      gatewayStatus: buildGatewayStatus(99, 19, 0, []),
      queueDepth: 0,
      availablePlayers: 20,
    });
    expect(params.detectedLimit120s).toBe(99);
    expect(params.detectedLimit1s).toBe(19);
  });

  test('T2 buckets present uses bucket limits', () => {
    const tuner = PollerTuner.getInstance();
    const params = tuner.compute(ctx(buildGatewayStatus(500, 50), 20));
    expect(params.detectedLimit120s).toBe(500);
    expect(params.detectedLimit1s).toBe(50);
  });

  test('T3 targetRps follows 120s window when it is the bottleneck', () => {
    const tuner = PollerTuner.getInstance();
    const tight = tuner.compute(ctx(buildGatewayStatus(12, 500), 20));
    const loose = tuner.compute(ctx(buildGatewayStatus(120, 500), 20));
    expect(tight.targetRps).toBeCloseTo(expectedTargetRps(12, 500), 5);
    expect(loose.targetRps).toBeGreaterThan(tight.targetRps);
    expect(loose.targetRps).toBeCloseTo(expectedTargetRps(120, 500), 5);
  });

  test('T4 targetRps follows 1s window when it is the bottleneck', () => {
    const tuner = PollerTuner.getInstance();
    const tight = tuner.compute(ctx(buildGatewayStatus(30_000, 2), 20));
    const loose = tuner.compute(ctx(buildGatewayStatus(30_000, 20), 20));
    expect(tight.targetRps).toBeCloseTo(expectedTargetRps(30_000, 2), 5);
    expect(loose.targetRps).toBeGreaterThan(tight.targetRps);
    expect(loose.targetRps).toBeCloseTo(expectedTargetRps(30_000, 20), 5);
  });

  test('T5 batchSize capped to availablePlayers', () => {
    const tuner = PollerTuner.getInstance();
    const params = tuner.compute({
      gatewayStatus: buildGatewayStatus(29_999, 499),
      queueDepth: 0,
      availablePlayers: 3,
    });
    expect(params.batchSize).toBeLessThanOrEqual(3);
  });

  test('T6 batchSize never below 1', () => {
    const tuner = PollerTuner.getInstance();
    const params = tuner.compute({
      gatewayStatus: buildGatewayStatus(1, 1, 99),
      queueDepth: 0,
      availablePlayers: 0,
    });
    expect(params.batchSize).toBeGreaterThanOrEqual(1);
  });

  test('T7 batchSize never exceeds MAX_BATCH_SIZE (200)', () => {
    const tuner = PollerTuner.getInstance();
    for (let i = 0; i < 5; i += 1) {
      tuner.recordSession(feedback({ totalGatewayRequests: 1, playersCompleted: 1 }));
    }
    const params = tuner.compute(ctx(buildGatewayStatus(29_999, 499), 500));
    expect(params.batchSize).toBeLessThanOrEqual(200);
  });

  test('T8 warmup halves batchSize vs post-warmup', () => {
    const tuner = PollerTuner.getInstance();
    const warmed = tuner.compute(ctx(buildGatewayStatus(29_999, 499), 200));
    expect(warmed.warmupActive).toBe(true);

    for (let i = 0; i < 5; i += 1) {
      tuner.recordSession(feedback({ playersCompleted: 1, totalGatewayRequests: 20 }));
    }

    const afterWarmup = tuner.compute(ctx(buildGatewayStatus(29_999, 499), 200));
    expect(afterWarmup.warmupActive).toBe(false);
    expect(afterWarmup.batchSize).toBeGreaterThanOrEqual(warmed.batchSize * 2 - 1);
  });

  test('T10 maxConcurrentPlayers never exceeds MAX_CONCURRENT_PLAYERS', () => {
    const tuner = PollerTuner.getInstance();
    for (let i = 0; i < 5; i += 1) {
      tuner.recordSession(feedback({ totalGatewayRequests: 1, playersCompleted: 1 }));
    }
    const params = tuner.compute(ctx(buildGatewayStatus(29_999, 499), 200));
    expect(params.maxConcurrentPlayers).toBeLessThanOrEqual(20);
  });

  test('T11 maxConcurrentMatchFetches never exceeds MAX_CONCURRENT_MATCHES', () => {
    const tuner = PollerTuner.getInstance();
    for (let i = 0; i < 5; i += 1) {
      tuner.recordSession(feedback({ totalGatewayRequests: 1, playersCompleted: 1 }));
    }
    const params = tuner.compute(ctx(buildGatewayStatus(29_999, 499), 200));
    expect(params.maxConcurrentMatchFetches).toBeLessThanOrEqual(20);
  });

  test('T12 higher cache hit rate lowers participantRankConcurrency', () => {
    const lowHit = PollerTuner.getInstance();
    for (let i = 0; i < 5; i += 1) {
      lowHit.recordSession(feedback({ playersCompleted: 1, totalGatewayRequests: 20 }));
    }
    for (let i = 0; i < 8; i += 1) {
      lowHit.recordSession(
        feedback({ participantRanksFetched: 10, participantRanksFromCache: 0, playersCompleted: 1 }),
      );
    }
    const lowParams = lowHit.compute(ctx(buildGatewayStatus(29_999, 499), 20));

    PollerTuner.resetInstance();
    const highHit = PollerTuner.getInstance();
    for (let i = 0; i < 5; i += 1) {
      highHit.recordSession(feedback({ playersCompleted: 1, totalGatewayRequests: 20 }));
    }
    for (let i = 0; i < 8; i += 1) {
      highHit.recordSession(
        feedback({ participantRanksFetched: 0, participantRanksFromCache: 10, playersCompleted: 1 }),
      );
    }
    const highParams = highHit.compute(ctx(buildGatewayStatus(29_999, 499), 20));

    expect(highHit.getSnapshot().ema.cacheHitRate).toBeGreaterThan(0.8);
    expect(lowHit.getSnapshot().ema.cacheHitRate).toBeLessThan(0.2);
    expect(highParams.participantRankConcurrency).toBeLessThan(lowParams.participantRankConcurrency);
  });

  test('T9 maxConcurrentPlayers never exceeds batchSize', () => {
    const tuner = PollerTuner.getInstance();
    const params = tuner.compute({
      gatewayStatus: buildGatewayStatus(99, 19),
      queueDepth: 0,
      availablePlayers: 2,
    });
    expect(params.maxConcurrentPlayers).toBeLessThanOrEqual(params.batchSize);
  });

  test('T14 utilization 75% sets 1000ms interval', () => {
    const tuner = PollerTuner.getInstance();
    const params = tuner.compute(ctx(buildGatewayStatus(99, 19, 75), 10));
    expect(params.discoveryIntervalMs).toBe(1000);
  });

  test('T13 high utilization sets 3000ms interval', () => {
    const tuner = PollerTuner.getInstance();
    const params = tuner.compute({
      gatewayStatus: buildGatewayStatus(99, 19, 95),
      queueDepth: 0,
      availablePlayers: 10,
    });
    expect(params.discoveryIntervalMs).toBe(3000);
  });

  test('T15 low utilization and queue gives 0 interval', () => {
    const tuner = PollerTuner.getInstance();
    const params = tuner.compute({
      gatewayStatus: buildGatewayStatus(99, 19, 50),
      queueDepth: 0,
      availablePlayers: 10,
    });
    expect(params.discoveryIntervalMs).toBe(0);
  });

  test('T16 deep queue sets 2000ms interval', () => {
    const tuner = PollerTuner.getInstance();
    const params = tuner.compute({
      gatewayStatus: buildGatewayStatus(99, 19, 50),
      queueDepth: 450,
      availablePlayers: 10,
    });
    expect(params.discoveryIntervalMs).toBe(2000);
  });

  test('T18 queueDepth zero leaves targetRps unchanged', () => {
    const tuner = PollerTuner.getInstance();
    const a = tuner.compute(ctx(buildGatewayStatus(99, 19), 20, 0));
    const b = tuner.compute(ctx(buildGatewayStatus(99, 19), 20, 0));
    expect(b.targetRps).toBeCloseTo(a.targetRps, 10);
  });

  test('T17 queue pressure reduces targetRps', () => {
    const tuner = PollerTuner.getInstance();
    const baseline = tuner.compute({
      gatewayStatus: buildGatewayStatus(99, 19),
      queueDepth: 0,
      availablePlayers: 20,
    });
    PollerTuner.resetInstance();
    const pressured = PollerTuner.getInstance().compute({
      gatewayStatus: buildGatewayStatus(99, 19),
      queueDepth: 300,
      availablePlayers: 20,
    });
    expect(pressured.targetRps).toBeLessThan(baseline.targetRps);
  });

  test('T19 playersCompleted=0 does not update session count', () => {
    const tuner = PollerTuner.getInstance();
    tuner.recordSession(feedback({ playersCompleted: 0 }));
    expect(tuner.getSnapshot().sessionCount).toBe(0);
  });

  test('T20 recordSession updates reqPerPlayer EMA', () => {
    const tuner = PollerTuner.getInstance();
    for (let i = 0; i < 10; i += 1) {
      tuner.recordSession(feedback({ totalGatewayRequests: 20, playersCompleted: 1 }));
    }
    expect(tuner.getSnapshot().ema.reqPerPlayer).toBeGreaterThan(15);
  });

  test('T21 recordSession updates cacheHitRate EMA', () => {
    const tuner = PollerTuner.getInstance();
    for (let i = 0; i < 5; i += 1) {
      tuner.recordSession(
        feedback({ participantRanksFetched: 0, participantRanksFromCache: 10, playersCompleted: 1 }),
      );
    }
    expect(tuner.getSnapshot().ema.cacheHitRate).toBeGreaterThan(0.85);
  });

  test('T22 sessionCount increments after recordSession', () => {
    const tuner = PollerTuner.getInstance();
    tuner.recordSession(feedback());
    tuner.recordSession(feedback());
    expect(tuner.getSnapshot().sessionCount).toBe(2);
  });

  test('T23 warmupActive true when sessionCount below WARMUP_SESSIONS', () => {
    const tuner = PollerTuner.getInstance();
    expect(tuner.compute(ctx(buildGatewayStatus(99, 19), 10)).warmupActive).toBe(true);
  });

  test('T24 warmupActive false after WARMUP_SESSIONS', () => {
    const tuner = PollerTuner.getInstance();
    for (let i = 0; i < 5; i += 1) {
      tuner.recordSession(feedback());
    }
    expect(tuner.compute(ctx(buildGatewayStatus(99, 19), 10)).warmupActive).toBe(false);
  });

  test('T26 moderate limit change does not reset EMA to seed', () => {
    const tuner = PollerTuner.getInstance();
    tuner.compute(ctx(buildGatewayStatus(100, 20), 20));
    for (let i = 0; i < 6; i += 1) {
      tuner.recordSession(feedback({ totalGatewayRequests: 10, playersCompleted: 1 }));
    }
    const emaBefore = tuner.getSnapshot().ema.reqPerPlayer;
    expect(emaBefore).toBeLessThan(20);

    tuner.compute(ctx(buildGatewayStatus(150, 20), 20));
    const emaAfter = tuner.getSnapshot().ema.reqPerPlayer;
    expect(emaAfter).toBeCloseTo(emaBefore, 0);
    expect(emaAfter).not.toBe(25);
  });

  test('T27 warmupActive remains true after dramatic limit change during warmup', () => {
    const tuner = PollerTuner.getInstance();
    tuner.compute(ctx(buildGatewayStatus(99, 19), 50));
    tuner.compute(ctx(buildGatewayStatus(29_999, 499), 50));
    expect(tuner.getSnapshot().sessionCount).toBe(0);
    expect(tuner.compute(ctx(buildGatewayStatus(29_999, 499), 50)).warmupActive).toBe(true);
  });

  test('T28 EMA converges toward observed reqPerPlayer', () => {
    const tuner = PollerTuner.getInstance();
    for (let i = 0; i < 10; i += 1) {
      tuner.recordSession(feedback({ totalGatewayRequests: 20, playersCompleted: 1 }));
    }
    expect(tuner.getSnapshot().ema.reqPerPlayer).toBeCloseTo(20, 0);
  });

  test('T29 personal then production increases batchSize', () => {
    const tuner = PollerTuner.getInstance();
    tuner.compute(ctx(buildGatewayStatus(99, 19), 50));
    for (let i = 0; i < 5; i += 1) {
      tuner.recordSession(feedback({ totalGatewayRequests: 20, playersCompleted: 1 }));
    }
    const personal = tuner.compute(ctx(buildGatewayStatus(99, 19), 50));
    const production = tuner.compute(ctx(buildGatewayStatus(29_999, 499), 50));
    expect(production.batchSize).toBeGreaterThan(personal.batchSize);
    expect(tuner.getSnapshot().limitHistory.length).toBeGreaterThanOrEqual(1);
  });

  test('T25 dramatic limit change resets EMA and records history', () => {
    const tuner = PollerTuner.getInstance();
    tuner.compute({
      gatewayStatus: buildGatewayStatus(99, 19),
      queueDepth: 0,
      availablePlayers: 50,
    });
    for (let i = 0; i < 3; i += 1) {
      tuner.recordSession(feedback({ totalGatewayRequests: 5, playersCompleted: 1 }));
    }

    tuner.compute({
      gatewayStatus: buildGatewayStatus(29_999, 499),
      queueDepth: 0,
      availablePlayers: 50,
    });

    const snapshot = tuner.getSnapshot();
    expect(snapshot.limitHistory.length).toBeGreaterThanOrEqual(1);
    expect(snapshot.ema.reqPerPlayer).toBeCloseTo(25, 0);
  });

  test('getSnapshot returns JSON-serializable object', () => {
    const tuner = PollerTuner.getInstance();
    tuner.compute({
      gatewayStatus: buildGatewayStatus(99, 19),
      queueDepth: 0,
      availablePlayers: 5,
    });
    expect(() => JSON.stringify(tuner.getSnapshot())).not.toThrow();
  });
});
