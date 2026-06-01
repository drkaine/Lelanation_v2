import { describe, expect, test } from 'vitest';
import { LimitChangeDetector } from '../../../src/tuner/LimitChangeDetector.js';

describe('LimitChangeDetector', () => {
  test('T1 first call returns null', () => {
    const detector = new LimitChangeDetector();
    expect(detector.check(99, 19)).toBeNull();
  });

  test('T2 same values returns null', () => {
    const detector = new LimitChangeDetector();
    detector.check(99, 19);
    expect(detector.check(99, 19)).toBeNull();
  });

  test('T3 change under 5% returns null', () => {
    const detector = new LimitChangeDetector();
    detector.check(100, 20);
    expect(detector.check(103, 20)).toBeNull();
  });

  test('T4 change >5% on 120s returns event', () => {
    const detector = new LimitChangeDetector();
    detector.check(100, 20);
    const event = detector.check(120, 20);
    expect(event).not.toBeNull();
    expect(event?.current120s).toBe(120);
  });

  test('T5 change >5% on 1s only returns event', () => {
    const detector = new LimitChangeDetector();
    detector.check(100, 20);
    const event = detector.check(100, 25);
    expect(event).not.toBeNull();
    expect(event?.current1s).toBe(25);
  });

  test('T6 ratio computed correctly', () => {
    const detector = new LimitChangeDetector();
    detector.check(100, 20);
    const event = detector.check(200, 20);
    expect(event?.ratio).toBe(2);
  });

  test('T7 history capped at 10', () => {
    const detector = new LimitChangeDetector();
    detector.check(100, 20);
    for (let i = 0; i < 15; i += 1) {
      detector.check(100 + (i + 1) * 20, 20);
    }
    expect(detector.getHistory().length).toBeLessThanOrEqual(10);
  });

  test('T8 production scale-up ratio', () => {
    const detector = new LimitChangeDetector();
    detector.check(99, 19);
    const event = detector.check(29_999, 499);
    expect(event?.ratio).toBeCloseTo(29_999 / 99, 0);
  });

  test('T9 downgrade ratio below 1', () => {
    const detector = new LimitChangeDetector();
    detector.check(200, 20);
    const event = detector.check(100, 20);
    expect(event?.ratio).toBeLessThan(1);
  });
});
