import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { PollerTuner } from '../../../src/tuner/PollerTuner.js';
import type { SessionFeedback } from '../../../src/tuner/types.js';
import { withApiKeyType } from '../helpers/apiKeyType.js';
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
    withApiKeyType('production', () => {
      const tuner = PollerTuner.getInstance();
      const tight = tuner.compute(ctx(buildGatewayStatus(12, 500), 20));
      const loose = tuner.compute(ctx(buildGatewayStatus(120, 500), 20));
      expect(tight.targetRps).toBeCloseTo(expectedTargetRps(12, 500), 5);
      expect(loose.targetRps).toBeGreaterThan(tight.targetRps);
      expect(loose.targetRps).toBeCloseTo(expectedTargetRps(120, 500), 5);
    });
  });

  test('T4 targetRps follows 1s window when it is the bottleneck', () => {
    withApiKeyType('production', () => {
      const tuner = PollerTuner.getInstance();
      const tight = tuner.compute(ctx(buildGatewayStatus(30_000, 2), 20));
      const loose = tuner.compute(ctx(buildGatewayStatus(30_000, 20), 20));
      expect(tight.targetRps).toBeCloseTo(expectedTargetRps(30_000, 2), 5);
      expect(loose.targetRps).toBeGreaterThan(tight.targetRps);
      expect(loose.targetRps).toBeLessThanOrEqual(expectedTargetRps(30_000, 20));
    });
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

  test('personal key applies anti-burst caps', () => {
    const tuner = PollerTuner.getInstance();
    for (let i = 0; i < 5; i += 1) {
      tuner.recordSession(feedback({ totalGatewayRequests: 1, playersCompleted: 1 }));
    }
    const params = tuner.compute(ctx(buildGatewayStatus(99, 19), 200));
    expect(params.targetRps).toBeCloseTo(Math.floor(99 * 0.95) / 120, 5);
    expect(params.targetRps).toBeLessThanOrEqual(1);
    expect(params.maxConcurrentPlayers).toBeLessThanOrEqual(1);
    expect(params.maxConcurrentMatchFetches).toBeLessThanOrEqual(1);
    expect(params.participantRankConcurrency).toBeLessThanOrEqual(1);
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
    expect(highParams.participantRankConcurrency).toBeLessThanOrEqual(lowParams.participantRankConcurrency);
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
    withApiKeyType('production', () => {
      const tuner = PollerTuner.getInstance();
      const params = tuner.compute(ctx(buildGatewayStatus(99, 19, 75), 10));
      expect(params.discoveryIntervalMs).toBe(1000);
    });
  });

  test('T13 high utilization sets 3000ms interval', () => {
    withApiKeyType('production', () => {
      const tuner = PollerTuner.getInstance();
      const params = tuner.compute({
        gatewayStatus: buildGatewayStatus(99, 19, 95),
        queueDepth: 0,
        availablePlayers: 10,
      });
      expect(params.discoveryIntervalMs).toBe(3000);
    });
  });

  test('personal high utilization throttles discovery only above 96%', () => {
    const tuner = PollerTuner.getInstance();
    expect(tuner.compute(ctx(buildGatewayStatus(99, 19, 75), 10)).discoveryIntervalMs).toBe(0);
    expect(tuner.compute(ctx(buildGatewayStatus(99, 19, 97), 10)).discoveryIntervalMs).toBe(1000);
    expect(tuner.compute(ctx(buildGatewayStatus(99, 19, 99), 10)).discoveryIntervalMs).toBe(3000);
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

  test('T29 tight personal limits then high production limits increases batchSize', () => {
    const personal = withApiKeyType('personal', () => {
      const tuner = PollerTuner.getInstance();
      tuner.compute(ctx(buildGatewayStatus(99, 19), 50));
      for (let i = 0; i < 5; i += 1) {
        tuner.recordSession(feedback({ totalGatewayRequests: 20, playersCompleted: 1 }));
      }
      return tuner.compute(ctx(buildGatewayStatus(99, 19), 50));
    });
    const production = withApiKeyType('production', () => {
      const tuner = PollerTuner.getInstance();
      for (let i = 0; i < 5; i += 1) {
        tuner.recordSession(feedback({ totalGatewayRequests: 20, playersCompleted: 1 }));
      }
      return tuner.compute(ctx(buildGatewayStatus(29_999, 499), 50));
    });
    expect(production.batchSize).toBeGreaterThan(personal.batchSize);
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

  test('T_warmup_concurrency_1 maxConcurrentMatchFetches is scaled by warmup multiplier', () => {
    const tuner = PollerTuner.getInstance();
    const warmupParams = tuner.compute(ctx(buildGatewayStatus(100, 20), 20));
    expect(warmupParams.warmupActive).toBe(true);

    for (let i = 0; i < 5; i += 1) {
      tuner.recordSession(feedback());
    }
    const fullParams = tuner.compute(ctx(buildGatewayStatus(100, 20), 20));
    expect(warmupParams.maxConcurrentMatchFetches).toBeLessThanOrEqual(
      Math.ceil(fullParams.maxConcurrentMatchFetches * 0.5) + 1,
    );
    expect(warmupParams.maxConcurrentMatchFetches).toBeLessThanOrEqual(fullParams.maxConcurrentMatchFetches);
  });

  test('T_warmup_concurrency_2 participantRankConcurrency is scaled by warmup multiplier', () => {
    const tightCtx = ctx(buildGatewayStatus(12, 2), 1);
    const warmupTuner = PollerTuner.getInstance();
    const warmupParams = warmupTuner.compute(tightCtx);

    PollerTuner.resetInstance();
    const fullTuner = PollerTuner.getInstance();
    for (let i = 0; i < 5; i += 1) {
      fullTuner.recordSession(feedback());
    }
    const fullParams = fullTuner.compute(tightCtx);
    expect(warmupParams.participantRankConcurrency).toBeLessThanOrEqual(
      Math.ceil(fullParams.participantRankConcurrency * 0.5) + 1,
    );
    expect(warmupParams.participantRankConcurrency).toBeLessThanOrEqual(
      fullParams.participantRankConcurrency,
    );
  });

  test('T_warmup_concurrency_3 after warmup concurrencies return to full computed value', () => {
    const tuner = PollerTuner.getInstance();
    const warmupParams = tuner.compute(ctx(buildGatewayStatus(100, 20), 20));

    for (let i = 0; i < 5; i += 1) {
      tuner.recordSession(feedback());
    }
    const fullParams = tuner.compute(ctx(buildGatewayStatus(100, 20), 20));
    expect(fullParams.maxConcurrentMatchFetches).toBeGreaterThanOrEqual(
      warmupParams.maxConcurrentMatchFetches,
    );
  });

  test('T_warmup_concurrency_4 MIN_CONCURRENT respected with warmup multiplier', () => {
    const tuner = PollerTuner.getInstance();
    const params = tuner.compute(ctx(buildGatewayStatus(1, 1, 99), 1));
    expect(params.maxConcurrentMatchFetches).toBeGreaterThanOrEqual(1);
    expect(params.participantRankConcurrency).toBeGreaterThanOrEqual(1);
    expect(params.maxConcurrentPlayers).toBeGreaterThanOrEqual(1);
  });

  test('T_ratchet_1 onRateLimitHit increases effectiveSafetyMargin by RATCHET_STEP', () => {
    withApiKeyType('production', () => {
      const tuner = PollerTuner.getInstance();
      const floor = tuner.getSnapshot().ratchet.configuredFloor;
      const before = tuner.compute(ctx(buildGatewayStatus(100, 20), 20)).targetRps;
      tuner.onRateLimitHit();
      expect(tuner.getSnapshot().ratchet.effectiveSafetyMargin).toBeCloseTo(floor + 0.02, 5);
      const after = tuner.compute(ctx(buildGatewayStatus(100, 20), 20)).targetRps;
      expect(after).toBeLessThan(before);
    });
  });

  test('T_ratchet_2 effectiveSafetyMargin never exceeds RATCHET_MAX (0.20)', () => {
    withApiKeyType('production', () => {
      const tuner = PollerTuner.getInstance();
      for (let i = 0; i < 20; i += 1) {
        tuner.onRateLimitHit();
      }
      expect(tuner.getSnapshot().ratchet.effectiveSafetyMargin).toBe(0.2);
    });
  });

  test('T_ratchet_3 margin decays after RATCHET_DECAY_SESSIONS sessions without 429', () => {
    withApiKeyType('production', () => {
      const tuner = PollerTuner.getInstance();
      const floor = tuner.getSnapshot().ratchet.configuredFloor;
      tuner.onRateLimitHit();
      expect(tuner.getSnapshot().ratchet.effectiveSafetyMargin).toBeCloseTo(floor + 0.02, 5);

      for (let i = 0; i < 10; i += 1) {
        tuner.recordSession(feedback());
      }
      expect(tuner.getSnapshot().ratchet.effectiveSafetyMargin).toBeCloseTo(floor, 5);
    });
  });

  test('T_ratchet_4 margin never decays below configured floor', () => {
    withApiKeyType('production', () => {
      const tuner = PollerTuner.getInstance();
      const floor = tuner.getSnapshot().ratchet.configuredFloor;
      tuner.onRateLimitHit();
      for (let i = 0; i < 100; i += 1) {
        tuner.recordSession(feedback());
      }
      expect(tuner.getSnapshot().ratchet.effectiveSafetyMargin).toBeGreaterThanOrEqual(floor);
    });
  });

  test('T_ratchet_5 ratchetActive reflects margin vs floor', () => {
    withApiKeyType('production', () => {
      const tuner = PollerTuner.getInstance();
      expect(tuner.getSnapshot().ratchet.ratchetActive).toBe(false);
      tuner.onRateLimitHit();
      expect(tuner.getSnapshot().ratchet.ratchetActive).toBe(true);
      for (let i = 0; i < 10; i += 1) {
        tuner.recordSession(feedback());
      }
      expect(tuner.getSnapshot().ratchet.ratchetActive).toBe(false);
    });
  });

  test('T_ratchet_6 compute uses effectiveSafetyMargin not config floor', () => {
    withApiKeyType('production', () => {
      const tuner = PollerTuner.getInstance();
      const floorRps = tuner.compute(ctx(buildGatewayStatus(100, 20), 20)).targetRps;
      tuner.onRateLimitHit();
      tuner.onRateLimitHit();
      const ratchetedRps = tuner.compute(ctx(buildGatewayStatus(100, 20), 20)).targetRps;
      expect(ratchetedRps).toBeLessThan(floorRps);
    });
  });
});
