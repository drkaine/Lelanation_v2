import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { BackpressureMonitor } from '../../../src/poll-orchestration/BackpressureMonitor.js';
import { orchestrationLogger } from '../../../src/poll-orchestration/logger.js';

describe('BackpressureMonitor', () => {
  test('isOverloaded when total exceeds threshold', async () => {
    const queue = {
      getJobCounts: vi.fn().mockResolvedValue({ waiting: 400, active: 200, prioritized: 0, delayed: 0 }),
    };
    const monitor = new BackpressureMonitor(queue as never, 500, 10);
    const depth = await monitor.getDepth();
    expect(depth.total).toBe(600);
    expect(await monitor.isOverloaded()).toBe(true);
  });

  test('waitForHeadroom resolves immediately when not overloaded', async () => {
    const queue = {
      getJobCounts: vi.fn().mockResolvedValue({ waiting: 1, active: 0, prioritized: 0, delayed: 0 }),
    };
    const monitor = new BackpressureMonitor(queue as never, 500, 10);
    await monitor.waitForHeadroom();
    expect(queue.getJobCounts).toHaveBeenCalled();
  });

  test('isOverloaded false at threshold', async () => {
    const queue = {
      getJobCounts: vi.fn().mockResolvedValue({ waiting: 300, active: 200, prioritized: 0, delayed: 0 }),
    };
    const monitor = new BackpressureMonitor(queue as never, 500, 10);
    expect(await monitor.isOverloaded()).toBe(false);
  });

  test('getDepth sums waiting and active', async () => {
    const queue = {
      getJobCounts: vi.fn().mockResolvedValue({ waiting: 3, active: 7, prioritized: 0, delayed: 0 }),
    };
    const monitor = new BackpressureMonitor(queue as never, 500, 10);
    await expect(monitor.getDepth()).resolves.toEqual({ waiting: 3, active: 7, total: 10 });
  });

  describe('waitForHeadroom under overload', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test('polls until overload clears', async () => {
      let calls = 0;
      const queue = {
        getJobCounts: vi.fn().mockImplementation(async () => {
          calls += 1;
          return calls <= 2
            ? { waiting: 400, active: 200, prioritized: 0, delayed: 0 }
            : { waiting: 0, active: 0, prioritized: 0, delayed: 0 };
        }),
      };
      const monitor = new BackpressureMonitor(queue as never, 500, 100);
      const promise = monitor.waitForHeadroom();
      await vi.runAllTimersAsync();
      await promise;
      expect(calls).toBeGreaterThanOrEqual(3);
    });

    test('logs WARN at most every 30s while overloaded', async () => {
      const warnSpy = vi.spyOn(orchestrationLogger, 'warn').mockImplementation(() => undefined);
      const queue = {
        getJobCounts: vi.fn().mockResolvedValue({ waiting: 600, active: 0, prioritized: 0, delayed: 0 }),
      };
      const monitor = new BackpressureMonitor(queue as never, 500, 200);
      const promise = monitor.waitForHeadroom();

      await vi.advanceTimersByTimeAsync(25_000);
      expect(warnSpy.mock.calls.length).toBe(1);

      await vi.advanceTimersByTimeAsync(10_000);
      expect(warnSpy.mock.calls.length).toBe(2);

      vi.mocked(queue.getJobCounts).mockResolvedValue({ waiting: 0, active: 0, prioritized: 0, delayed: 0 });
      await vi.runAllTimersAsync();
      await promise;

      warnSpy.mockRestore();
    });
  });
});
