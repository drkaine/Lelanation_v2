import { describe, expect, test } from 'vitest';
import { asyncPool } from '../../../src/poller/utils/asyncPool.js';

describe('asyncPool', () => {
  test('respects max concurrency', async () => {
    let active = 0;
    let peak = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);
    await asyncPool(3, items, async (item) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 20));
      active -= 1;
      return item;
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
  });

  test('collects errors without stopping pool', async () => {
    const results = await asyncPool(2, [1, 2, 3, 4, 5], async (item) => {
      if (item === 2 || item === 4) throw new Error(`fail-${item}`);
      return item * 2;
    });
    expect(results).toHaveLength(5);
    expect(results.filter((r) => r.error).length).toBe(2);
    expect(results.filter((r) => r.result === 6).length).toBe(1);
  });

  test('returns empty array for empty input', async () => {
    const results = await asyncPool(3, [], async () => 1);
    expect(results).toEqual([]);
  });

  test('task timeout does not block other items', async () => {
    const results = await asyncPool(
      2,
      [1, 2, 3],
      async (item) => {
        if (item === 2) await new Promise(() => undefined);
        return item;
      },
      200,
    );
    expect(results).toHaveLength(3);
    expect(results.find((r) => r.item === 2)?.error).toBeDefined();
    expect(results.find((r) => r.item === 1)?.result).toBe(1);
  });
});
