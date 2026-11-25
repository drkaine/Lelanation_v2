import { beforeEach, describe, expect, test } from 'vitest';
import { AggregateComputer } from '../../../../src/observability/poller-metrics/AggregateComputer.js';
import { MetricsStore } from '../../../../src/observability/poller-metrics/MetricsStore.js';

describe('résumé poller — pause du balayage', () => {
  beforeEach(() => MetricsStore.resetInstance());

  test('sweep_hold faux par défaut, vrai quand le poller est en pause balayage', () => {
    const store = MetricsStore.getInstance();
    const computer = new AggregateComputer(store);
    expect(computer.computeFull('10m', 99, 19, []).sweep_hold).toBe(false);
    store.setSweepHold(true);
    expect(computer.computeFull('10m', 99, 19, []).sweep_hold).toBe(true);
  });
});
