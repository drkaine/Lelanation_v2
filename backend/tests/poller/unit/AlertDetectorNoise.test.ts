import { beforeEach, describe, expect, test } from 'vitest';
import { AlertDetector } from '../../../src/observability/poller-metrics/AlertDetector.js';
import { AggregateComputer } from '../../../src/observability/poller-metrics/AggregateComputer.js';
import { MetricsStore } from '../../../src/observability/poller-metrics/MetricsStore.js';
import { PollerTuner } from '../../../src/tuner/PollerTuner.js';

const MIN = 60_000;

function check(detector: AlertDetector, store: MetricsStore): string[] {
  detector.check(new AggregateComputer(store).computeFull('10m', 99, 19, []));
  return detector.getActive().map((a) => a.type);
}

describe('AlertDetector noise', () => {
  beforeEach(() => {
    MetricsStore.resetInstance();
    PollerTuner.resetInstance();
  });

  test('poll_stall_is_not_raised_right_after_startup', () => {
    const store = MetricsStore.getInstance();

    expect(check(new AlertDetector(store, Date.now()), store)).not.toContain('poll_stall');
  });

  test('poll_stall_is_raised_when_no_session_since_startup_threshold', () => {
    const store = MetricsStore.getInstance();

    expect(check(new AlertDetector(store, Date.now() - 6 * MIN), store)).toContain('poll_stall');
  });

  test('db_slow_ignores_observability_own_queries', () => {
    const store = MetricsStore.getInstance();
    for (let i = 0; i < 10; i += 1) {
      store.pushDbOperation({ ts: Date.now(), operation: 'obs_player_pool_stats', durationMs: 2500, success: true });
    }

    expect(check(new AlertDetector(store), store)).not.toContain('db_slow');
  });

  test('db_slow_still_raised_for_ingestion_queries', () => {
    const store = MetricsStore.getInstance();
    for (let i = 0; i < 10; i += 1) {
      store.pushDbOperation({ ts: Date.now(), operation: 'insert_match', durationMs: 2500, success: true });
    }

    expect(check(new AlertDetector(store), store)).toContain('db_slow');
  });
});
