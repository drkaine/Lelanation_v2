import { describe, expect, test } from 'vitest';
import { parseRateLimitHeader } from '../../../src/riot-gateway/gateway/TokenBucket.js';
import { RateLimitTracker } from '../../../src/riot-gateway/gateway/RateLimitTracker.js';

describe('RateLimitTracker', () => {
  test('parseHeader("100:120,20:1") produces 2 windows', () => {
    expect(parseRateLimitHeader('100:120,20:1')).toHaveLength(2);
  });

  test('parseHeader("2000:10") produces 1 window', () => {
    expect(parseRateLimitHeader('2000:10')).toHaveLength(1);
  });

  test('parseHeader pairs produce multiple windows', () => {
    const tracker = new RateLimitTracker(0.05);
    tracker.updateFromHeaders('GET /lol/match/v5/matches/{matchId}', {
      'x-app-rate-limit': '100:120,20:1',
      'x-app-rate-limit-count': '57:120,3:1',
      'x-method-rate-limit': '2000:10',
      'x-method-rate-limit-count': '134:10',
    });
    const states = tracker.getAllBucketStates();
    expect(states.length).toBeGreaterThanOrEqual(3);
  });

  test('canDispatch is false when any window is saturated', () => {
    const tracker = new RateLimitTracker(0);
    tracker.updateFromHeaders('GET /lol/match/v5/matches/{matchId}', {
      'x-app-rate-limit': '20:1',
      'x-app-rate-limit-count': '20:1',
    });
    const check = tracker.canDispatch('GET /lol/match/v5/matches/{matchId}');
    expect(check.allowed).toBe(false);
    expect(check.waitMs).toBeGreaterThan(0);
  });

  test('waitMs is minimum across saturated windows', () => {
    const tracker = new RateLimitTracker(0);
    tracker.saturate('GET /a', Date.now() + 500, true);
    tracker.saturate('GET /a', Date.now() + 2_000, false);
    const waitMs = tracker.getWaitMs('GET /a');
    expect(waitMs).toBeGreaterThan(0);
    expect(waitMs).toBeLessThanOrEqual(501);
  });

  test('fallback limits apply before first headers arrive', () => {
    const tracker = new RateLimitTracker(0.05);
    const check = tracker.canDispatch('GET /lol/match/v5/matches/{matchId}');
    expect(check.allowed).toBe(true);
    expect(check.appWindows.length).toBeGreaterThan(0);
  });

  test('updateFromHeaders triggers window reset detection', () => {
    const tracker = new RateLimitTracker(0.05);
    tracker.updateFromHeaders('GET /a', {
      'x-app-rate-limit': '100:120',
      'x-app-rate-limit-count': '90:120',
    });
    tracker.updateFromHeaders('GET /a', {
      'x-app-rate-limit': '100:120',
      'x-app-rate-limit-count': '5:120',
    });
    expect(tracker.getAppBucketStates()[0]?.used).toBe(5);
  });

  test('method saturation does not block other methods', () => {
    const tracker = new RateLimitTracker(0);
    tracker.updateFromHeaders('GET /a', {
      'x-method-rate-limit': '1:10',
      'x-method-rate-limit-count': '1:10',
    });
    tracker.saturate('GET /a', Date.now() + 5_000, false);
    expect(tracker.canDispatch('GET /b').allowed).toBe(true);
    expect(tracker.canDispatch('GET /a').allowed).toBe(false);
  });

  test('app saturation blocks all methods', () => {
    const tracker = new RateLimitTracker(0);
    tracker.updateFromHeaders('GET /a', {
      'x-app-rate-limit': '1:10',
      'x-app-rate-limit-count': '1:10',
    });
    expect(tracker.canDispatch('GET /b').allowed).toBe(false);
  });
});
