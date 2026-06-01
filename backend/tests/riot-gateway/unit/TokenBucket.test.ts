import { afterEach, describe, expect, test, vi } from 'vitest';
import { TokenBucket } from '../../../src/riot-gateway/gateway/TokenBucket.js';

describe('TokenBucket', () => {
  test('available subtracts in-flight tokens with safety margin', () => {
    const bucket = new TokenBucket('app:1000', 100, 1_000, 50);
    expect(bucket.available(0, 0.05)).toBe(45);
    expect(bucket.available(5, 0.05)).toBe(40);
  });

  test('safetyMargin applied correctly', () => {
    const bucket = new TokenBucket('app:1000', 100, 1_000, 0);
    expect(bucket.safeLimit(0.05)).toBe(95);
    expect(bucket.safeLimit(0)).toBe(100);
  });

  test('saturate blocks dispatch until expiry', () => {
    const bucket = new TokenBucket('app:1000', 100, 1_000, 0);
    bucket.saturate(Date.now() + 500);
    expect(bucket.isBlocked()).toBe(true);
    expect(bucket.available(0, 0)).toBe(0);
  });

  test('stale saturatedUntil in the past does not block dispatch', () => {
    const bucket = new TokenBucket('app:1000', 100, 1_000, 0);
    bucket.saturate(Date.now() - 1);
    expect(bucket.isBlocked()).toBe(false);
    expect(bucket.saturatedUntil).toBeUndefined();
    expect(bucket.available(0, 0)).toBeGreaterThan(0);
  });

  test('saturate unblocks after ms', async () => {
    const bucket = new TokenBucket('app:1000', 100, 1_000, 0);
    bucket.saturate(Date.now() + 50);
    expect(bucket.isBlocked()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(bucket.isBlocked()).toBe(false);
  });

  test('update detects sliding window rollover', () => {
    const bucket = new TokenBucket('app:1000', 100, 1_000, 80);
    const beforeReset = bucket.resetAt;
    const { slidOver } = bucket.update(10, 100);
    expect(slidOver).toBe(true);
    expect(bucket.resetAt).toBeGreaterThanOrEqual(beforeReset);
  });

  test('T_bug1_a available returns safeLimit when resetAt is in the past', () => {
    const bucket = new TokenBucket('app:1000', 20, 1_000, 20);
    bucket.resetAt = Date.now() - 1;
    const safe = bucket.safeLimit(0.05);
    expect(bucket.available(0, 0.05)).toBe(safe);
    expect(bucket.available(0, 0.05)).toBeGreaterThan(0);
  });

  test('T_bug1_b available uses actual used when window is still active', () => {
    const bucket = new TokenBucket('app:1000', 20, 1_000, 15);
    bucket.resetAt = Date.now() + 5_000;
    expect(bucket.available(0, 0.05)).toBe(bucket.safeLimit(0.05) - 15);
  });

  test('T_bug1_c msUntilReset never returns negative', () => {
    const bucket = new TokenBucket('app:1000', 100, 1_000, 0, Date.now() - 5_000);
    expect(bucket.msUntilReset()).toBe(0);
  });

  test('T_bug1_d msUntilReset returns correct positive value', () => {
    const bucket = new TokenBucket('app:1000', 100, 1_000, 0, Date.now() + 1_000);
    const ms = bucket.msUntilReset();
    expect(ms).toBeGreaterThan(900);
    expect(ms).toBeLessThanOrEqual(1_000);
  });

  test('available unblocks after header update when window had expired locally', () => {
    const bucket = new TokenBucket('app:1000', 100, 1_000, 99, Date.now() - 1);
    expect(bucket.available(0, 0.05)).toBeGreaterThan(0);
    bucket.update(5, 100);
    expect(bucket.available(0, 0.05)).toBeGreaterThan(0);
  });
});
