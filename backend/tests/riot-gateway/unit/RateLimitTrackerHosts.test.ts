import { describe, expect, test } from 'vitest';
import type { QueuedRequest } from '../../../src/riot-gateway/types.js';

process.env.RIOT_API_KEY = 'RGAPI-test-key-for-unit-tests';
process.env.API_KEY_TYPE = 'personal';
process.env.LOG_LEVEL = 'fatal';

const { RateLimitTracker } = await import('../../../src/riot-gateway/gateway/RateLimitTracker.js');
const { RequestQueue } = await import('../../../src/riot-gateway/gateway/RequestQueue.js');

const EUROPE = 'https://europe.api.riotgames.com';
const EUW1 = 'https://euw1.api.riotgames.com';

describe('RateLimitTracker per routing host', () => {
  test('app headers of one host leave the other host buckets untouched', () => {
    const tracker = new RateLimitTracker(0);
    tracker.updateFromHeaders('GET /m', { 'x-app-rate-limit': '100:120', 'x-app-rate-limit-count': '90:120' }, EUROPE);
    tracker.updateFromHeaders('GET /l', { 'x-app-rate-limit': '100:120', 'x-app-rate-limit-count': '3:120' }, EUW1);
    expect(tracker.getAppBucketStates(EUROPE)[0]?.used).toBe(90);
    expect(tracker.getAppBucketStates(EUW1)[0]?.used).toBe(3);
  });

  test('app saturation on one host does not block the other host', () => {
    const tracker = new RateLimitTracker(0);
    tracker.saturate('GET /m', Date.now() + 5_000, true, EUROPE);
    expect(tracker.canDispatch('GET /m', EUROPE).allowed).toBe(false);
    expect(tracker.canDispatch('GET /l', EUW1).allowed).toBe(true);
  });

  test('host key ignores trailing slash and path', () => {
    const tracker = new RateLimitTracker(0);
    tracker.saturate('GET /m', Date.now() + 5_000, true, `${EUROPE}/`);
    expect(tracker.canDispatch('GET /x', EUROPE).allowed).toBe(false);
  });
});

describe('RequestQueue.dequeueFirst', () => {
  test('takes the first request matching the predicate and keeps order', () => {
    const queue = new RequestQueue();
    const make = (id: string, baseUrl: string): QueuedRequest => ({
      id,
      baseUrl,
      priority: 'normal',
      methodKey: 'GET /x',
      path: '/x',
      retries: 0,
      maxRetries: 0,
      resolve: () => undefined,
      reject: () => undefined,
      enqueuedAt: 0,
      abortController: new AbortController(),
    });
    queue.enqueue(make('a', EUROPE));
    queue.enqueue(make('b', EUW1));
    queue.enqueue(make('c', EUROPE));
    expect(queue.dequeueFirst((r) => r.baseUrl === EUW1)?.id).toBe('b');
    expect(queue.snapshot().map((r) => r.id)).toEqual(['a', 'c']);
    expect(queue.dequeueFirst(() => false)).toBeUndefined();
  });
});
