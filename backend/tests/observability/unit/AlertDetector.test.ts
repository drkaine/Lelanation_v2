import { beforeEach, describe, expect, test } from 'vitest';
import { AlertDetector } from '../../../src/observability/poller-metrics/AlertDetector.js';
import { AggregateComputer } from '../../../src/observability/poller-metrics/AggregateComputer.js';
import { MetricsStore } from '../../../src/observability/poller-metrics/MetricsStore.js';
import { PollerTuner } from '../../../src/tuner/PollerTuner.js';

describe('AlertDetector', () => {
  beforeEach(() => {
    MetricsStore.resetInstance();
    PollerTuner.resetInstance();
  });

  test('T1 too_many_429s fires and clears', () => {
    const store = MetricsStore.getInstance();
    const detector = new AlertDetector(store);
    const computer = new AggregateComputer(store);

    store.pushGatewayRequest({
      ts: Date.now(),
      latencyMs: 1,
      methodKey: 'm',
      statusCode: 429,
      is429: true,
      isError: true,
      tokensUsed_120s: 0,
      tokensUsed_1s: 0,
      limit_120s: 99,
      limit_1s: 19,
    });

    const snap = computer.computeFull('10m', 99, 19, []);
    snap.gateway.total_429s = 1;
    detector.check(snap);
    expect(detector.getActive().some((a) => a.type === 'too_many_429s')).toBe(true);

    snap.gateway.total_429s = 0;
    detector.check(snap);
    expect(detector.getActive().some((a) => a.type === 'too_many_429s')).toBe(false);
  });

  test('T3 alert clears when condition resolves', () => {
    const store = MetricsStore.getInstance();
    const detector = new AlertDetector(store);
    const computer = new AggregateComputer(store);
    let snap = computer.computeFull('10m', 99, 19, []);
    snap.gateway.total_429s = 1;
    detector.check(snap);
    expect(detector.getActive().some((a) => a.type === 'too_many_429s')).toBe(true);
    snap = computer.computeFull('10m', 99, 19, []);
    snap.gateway.total_429s = 0;
    detector.check(snap);
    expect(detector.getActive().some((a) => a.type === 'too_many_429s')).toBe(false);
  });

  test('T4 token_underutilized does not fire during warmup', () => {
    const store = MetricsStore.getInstance();
    const detector = new AlertDetector(store);
    const computer = new AggregateComputer(store);
    const snap = computer.computeFull('10m', 99, 19, []);
    snap.gateway.avg_token_pct_120s = 10;
    detector.check(snap);
    expect(detector.getActive().some((a) => a.type === 'token_underutilized')).toBe(false);
  });

  test('T6 poll_stall fires without recent session', () => {
    const store = MetricsStore.getInstance();
    const detector = new AlertDetector(store);
    const snap = new AggregateComputer(store).computeFull('10m', 99, 19, []);
    detector.check(snap);
    expect(detector.getActive().some((a) => a.type === 'poll_stall')).toBe(true);
  });

  test('T7 db_slow WARN at 1000ms ERROR at 2000ms', () => {
    const store = MetricsStore.getInstance();
    const detector = new AlertDetector(store);
    const computer = new AggregateComputer(store);
    const now = Date.now();
    for (let i = 0; i < 5; i += 1) {
      store.pushDbOperation({ ts: now, operation: 'heavy_query', durationMs: 1500, success: true });
    }
    detector.check(computer.computeFull('10m', 99, 19, []));
    expect(detector.getActive().find((a) => a.type === 'db_slow')?.severity).toBe('warn');

    MetricsStore.resetInstance();
    const store2 = MetricsStore.getInstance();
    const detector2 = new AlertDetector(store2);
    for (let i = 0; i < 10; i += 1) {
      store2.pushDbOperation({ ts: now, operation: 'heavy_query', durationMs: 2500, success: true });
    }
    detector2.check(new AggregateComputer(store2).computeFull('10m', 99, 19, []));
    expect(detector2.getActive().find((a) => a.type === 'db_slow')?.severity).toBe('error');
  });

  test('T8 ingestion_missing_data includes skip breakdown', () => {
    const store = MetricsStore.getInstance();
    const detector = new AlertDetector(store);
    const computer = new AggregateComputer(store);
    const now = Date.now();
    store.pushIngestionQueue({
      ts: now,
      matchId: 'M1',
      patch: '16.11',
      rank: 'GOLD',
      type: 'skipped',
      skipReason: 'missing_rank',
    });
    const snap = computer.computeFull('10m', 99, 19, []);
    detector.check(snap);
    const alert = detector.getActive().find((a) => a.type === 'ingestion_missing_data');
    expect(alert?.data.skip_breakdown).toMatchObject({ missing_rank: 1 });
  });

  test('T2 alert fires once while condition holds', () => {
    const store = MetricsStore.getInstance();
    const detector = new AlertDetector(store);
    const computer = new AggregateComputer(store);
    const snap = computer.computeFull('10m', 99, 19, []);
    snap.gateway.total_429s = 2;

    detector.check(snap);
    detector.check(snap);
    expect(detector.getActive().filter((a) => a.type === 'too_many_429s')).toHaveLength(1);
  });
});
