import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RiotRateLimiter } from './RiotRateLimiter.js'

test('RiotRateLimiter: acquire is immediate when no penalty', async () => {
  const limiter = new RiotRateLimiter()
  const t0 = Date.now()
  await limiter.acquire('app')
  await limiter.acquire('app')
  await limiter.acquire('app')
  const elapsed = Date.now() - t0
  assert.ok(elapsed < 50, 'No local per-second throttle: bursts allowed until headers say otherwise')
})

test('RiotRateLimiter: penalize429 without Retry-After blocks ~5s', async () => {
  const limiter = new RiotRateLimiter()
  limiter.penalize429()
  const t0 = Date.now()
  await limiter.acquire()
  const elapsed = Date.now() - t0
  assert.ok(elapsed >= 4_500, `Acquire after 429 should wait ~5s, got ${elapsed}ms`)
  assert.ok(elapsed < 10_000, `Should not wait more than 10s without Retry-After, got ${elapsed}ms`)
})

test('RiotRateLimiter: penalize429 with Retry-After uses it + buffer', async () => {
  const limiter = new RiotRateLimiter()
  limiter.penalize429(3)
  const t0 = Date.now()
  await limiter.acquire()
  const elapsed = Date.now() - t0
  assert.ok(elapsed >= 4_500, `Retry-After 3s + buffer should wait ~5.5s, got ${elapsed}ms`)
  assert.ok(elapsed < 10_000, `Should not overshoot, got ${elapsed}ms`)
})

test('RiotRateLimiter: 98/100 on 120s bucket does NOT pause', async () => {
  const limiter = new RiotRateLimiter()
  const headers = new Headers({
    'x-app-rate-limit': '20:1,100:120',
    'x-app-rate-limit-count': '1:1,98:120',
  })
  limiter.syncFromResponseHeaders(headers)
  const t0 = Date.now()
  await limiter.acquire()
  assert.ok(Date.now() - t0 < 100, '98 of 100 should not trigger a pause')
})

test('RiotRateLimiter: 99/100 on 120s bucket schedules a pause', async () => {
  const limiter = new RiotRateLimiter()
  const headers = new Headers({
    'x-app-rate-limit': '20:1,100:120',
    'x-app-rate-limit-count': '1:1,99:120',
  })
  limiter.syncFromResponseHeaders(headers)
  const stats = limiter.getStats()
  assert.equal(stats.nearLimitPauseCount, 1, 'Should have recorded 1 near-limit pause')
  assert.ok(stats.appBuckets.length === 2, 'Should track both app buckets')

  const bucket120 = stats.appBuckets.find((b) => b.windowSec === 120)
  assert.ok(bucket120, 'Should have a 120s bucket')
  assert.equal(bucket120!.count, 99)
  assert.equal(bucket120!.limit, 100)
})

test('RiotRateLimiter: method rate limit near-limit triggers pause', () => {
  const limiter = new RiotRateLimiter()
  const headers = new Headers({
    'x-app-rate-limit': '20:1,100:120',
    'x-app-rate-limit-count': '5:1,50:120',
    'x-method-rate-limit': '2000:60',
    'x-method-rate-limit-count': '1999:60',
  })
  limiter.syncFromResponseHeaders(headers)
  const stats = limiter.getStats()
  assert.equal(stats.nearLimitPauseCount, 1, 'Method bucket at limit should trigger pause')
  assert.ok(stats.methodBuckets.length === 1, 'Should track method bucket')
  assert.equal(stats.methodBuckets[0].count, 1999)
  assert.equal(stats.methodBuckets[0].limit, 2000)
})

test('RiotRateLimiter: 1s app bucket near-limit triggers pause', () => {
  const limiter = new RiotRateLimiter()
  const headers = new Headers({
    'x-app-rate-limit': '20:1,100:120',
    'x-app-rate-limit-count': '19:1,50:120',
  })
  limiter.syncFromResponseHeaders(headers)
  const stats = limiter.getStats()
  assert.equal(stats.nearLimitPauseCount, 1, '1s bucket at 19/20 should trigger pause')
})

test('RiotRateLimiter: penalize429 + near-limit: highest penalty wins', () => {
  const limiter = new RiotRateLimiter()
  limiter.penalize429(2)
  const headers = new Headers({
    'x-app-rate-limit': '100:120',
    'x-app-rate-limit-count': '99:120',
  })
  limiter.syncFromResponseHeaders(headers)
  const stats = limiter.getStats()
  assert.equal(stats.http429PauseCount, 1)
  assert.equal(stats.nearLimitPauseCount, 1)
})
