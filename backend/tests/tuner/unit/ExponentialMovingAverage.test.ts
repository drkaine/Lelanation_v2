import { describe, expect, test } from 'vitest';
import { ExponentialMovingAverage } from '../../../src/tuner/ExponentialMovingAverage.js';

describe('ExponentialMovingAverage', () => {
  test('T1 value returns initial before update', () => {
    const ema = new ExponentialMovingAverage(0.3, 25);
    expect(ema.value).toBe(25);
    expect(ema.sampleCount).toBe(0);
  });

  test('T2 single update', () => {
    const ema = new ExponentialMovingAverage(0.3, 10);
    const next = ema.update(20);
    expect(next).toBeCloseTo(0.3 * 20 + 0.7 * 10);
  });

  test('T3 converges when feeding same sample', () => {
    const ema = new ExponentialMovingAverage(0.3, 0);
    for (let i = 0; i < 50; i += 1) {
      ema.update(20);
    }
    expect(ema.value).toBeCloseTo(20, 1);
  });

  test('T4 alpha=1 tracks last sample', () => {
    const ema = new ExponentialMovingAverage(1, 10);
    ema.update(5);
    ema.update(99);
    expect(ema.value).toBe(99);
  });

  test('T5 alpha=0 stays at initial', () => {
    const ema = new ExponentialMovingAverage(0, 10);
    ema.update(99);
    expect(ema.value).toBe(10);
  });

  test('T6 reset clears sample count', () => {
    const ema = new ExponentialMovingAverage(0.3, 10);
    ema.update(20);
    ema.reset(5);
    expect(ema.value).toBe(5);
    expect(ema.sampleCount).toBe(0);
  });

  test('T7 sampleCount increments', () => {
    const ema = new ExponentialMovingAverage(0.3, 10);
    ema.update(1);
    ema.update(2);
    expect(ema.sampleCount).toBe(2);
  });
});
