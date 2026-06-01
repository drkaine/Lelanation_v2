import { describe, expect, test, vi } from 'vitest';
import { BackpressureMonitor } from '../../../src/poll-orchestration/BackpressureMonitor.js';

describe('backpressure discovery gate', () => {
  test('waits until overload clears before proceeding', async () => {
    let calls = 0;
    const queue = {
      getJobCounts: vi.fn().mockImplementation(async () => {
        calls += 1;
        if (calls <= 2) {
          return { waiting: 400, active: 200, prioritized: 0, delayed: 0 };
        }
        return { waiting: 10, active: 5, prioritized: 0, delayed: 0 };
      }),
    };

    const monitor = new BackpressureMonitor(queue as never, 500, 5);
    const started = Date.now();
    await monitor.waitForHeadroom();
    expect(Date.now() - started).toBeGreaterThanOrEqual(5);
    expect(calls).toBeGreaterThanOrEqual(3);
  });
});
