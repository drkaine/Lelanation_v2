import { describe, expect, test } from 'vitest';
import { ParticipantRankCache } from '../../../src/poller/ParticipantRankCache.js';

describe('ParticipantRankCache', () => {
  test('reserve and set lifecycle', () => {
    const cache = new ParticipantRankCache();
    expect(cache.has('a')).toBe(false);
    cache.reserve('a');
    expect(cache.has('a')).toBe(true);
    expect(cache.get('a')).toBeNull();
    cache.set('a', [{ tier: 'GOLD' }]);
    expect(cache.get('a')).toEqual([{ tier: 'GOLD' }]);
  });

  test('empty set keeps has true', () => {
    const cache = new ParticipantRankCache();
    cache.reserve('x');
    cache.set('x', []);
    expect(cache.has('x')).toBe(true);
    expect(cache.get('x')).toEqual([]);
  });

  test('miss and hit counters', () => {
    const cache = new ParticipantRankCache();
    cache.reserve('a');
    expect(cache.missCount).toBe(1);
    cache.set('a', []);
    cache.has('a');
    expect(cache.hitCount).toBeGreaterThanOrEqual(1);
  });
});
