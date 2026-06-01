import { describe, expect, test, vi } from 'vitest';
import { CircularBuffer } from '../../../src/observability/poller-metrics/CircularBuffer.js';

type Ev = { ts: number; v: number };

describe('CircularBuffer', () => {
  test('T1 push respects capacity', () => {
    const buf = new CircularBuffer<Ev>(3);
    buf.push({ ts: 1, v: 1 });
    buf.push({ ts: 2, v: 2 });
    buf.push({ ts: 3, v: 3 });
    buf.push({ ts: 4, v: 4 });
    expect(buf.size).toBe(3);
    expect(buf.inWindow(10_000, 4).map((e) => e.v)).toEqual([4, 3, 2]);
  });

  test('T2 inWindow filters by timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const buf = new CircularBuffer<Ev>(10);
    buf.push({ ts: 1000, v: 1 });
    buf.push({ ts: 9000, v: 2 });
    buf.push({ ts: 9500, v: 3 });
    expect(buf.inWindow(2000).map((e) => e.v)).toEqual([3, 2]);
    vi.useRealTimers();
  });

  test('T3 inWindow zero returns empty', () => {
    const buf = new CircularBuffer<Ev>(5);
    buf.push({ ts: Date.now(), v: 1 });
    expect(buf.inWindow(0)).toEqual([]);
  });

  test('T4 inWindow newest first', () => {
    const buf = new CircularBuffer<Ev>(5);
    buf.push({ ts: 1, v: 1 });
    buf.push({ ts: 2, v: 2 });
    expect(buf.inWindow(10_000, 2)[0]?.v).toBe(2);
  });

  test('T6 empty buffer inWindow and latest', () => {
    const buf = new CircularBuffer<Ev>(5);
    expect(buf.inWindow(10_000)).toEqual([]);
    expect(buf.latest()).toBeNull();
  });

  test('T5 latest returns last pushed', () => {
    const buf = new CircularBuffer<Ev>(5);
    expect(buf.latest()).toBeNull();
    buf.push({ ts: 1, v: 9 });
    expect(buf.latest()?.v).toBe(9);
  });
});
