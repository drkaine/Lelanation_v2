import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RiotRateLimiter } from './RiotRateLimiter.js'

test('RiotRateLimiter: schedule resolves immediately when reservoir available', async () => {
  const limiter = new RiotRateLimiter()
  const t0 = Date.now()
  await limiter.schedule(async () => 'a')
  await limiter.schedule(async () => 'b')
  await limiter.schedule(async () => 'c')
  const elapsed = Date.now() - t0
  assert.ok(elapsed < 200, `Three schedule calls should be near-instant, got ${elapsed}ms`)
})

test('RiotRateLimiter: penalize429 drains reservoir so schedule waits', async () => {
  const limiter = new RiotRateLimiter()
  limiter.penalize429(1)
  const t0 = Date.now()
  await limiter.schedule(async () => 'ok')
  const elapsed = Date.now() - t0
  assert.ok(elapsed >= 2_500, `Schedule after 429 (1s + buffer) should wait, got ${elapsed}ms`)
  assert.ok(elapsed < 10_000, `Should not wait too long, got ${elapsed}ms`)
})

test('RiotRateLimiter: syncFromResponseHeaders tracks buckets for monitoring', () => {
  const limiter = new RiotRateLimiter()
  const headers = new Headers({
    'x-app-rate-limit': '20:1,100:120',
    'x-app-rate-limit-count': '1:1,98:120',
  })
  limiter.syncFromResponseHeaders(headers)
  const stats = limiter.getStats()
  assert.ok(stats.appBuckets.length === 2, 'Should track both app buckets')
  const bucket120 = stats.appBuckets.find((b) => b.windowSec === 120)
  assert.ok(bucket120, 'Should have a 120s bucket')
  assert.equal(bucket120!.count, 98)
  assert.equal(bucket120!.limit, 100)
})

test('RiotRateLimiter: getStats tracks 429 pause count', () => {
  const limiter = new RiotRateLimiter()
  limiter.penalize429(2)
  const stats = limiter.getStats()
  assert.equal(stats.http429PauseCount, 1)
})

test('RiotRateLimiter: method rate limit headers are tracked', () => {
  const limiter = new RiotRateLimiter()
  const headers = new Headers({
    'x-app-rate-limit': '20:1,100:120',
    'x-app-rate-limit-count': '5:1,50:120',
    'x-method-rate-limit': '2000:60',
    'x-method-rate-limit-count': '1999:60',
  })
  limiter.syncFromResponseHeaders(headers)
  const stats = limiter.getStats()
  assert.ok(stats.methodBuckets.length === 1, 'Should track method bucket')
  assert.equal(stats.methodBuckets[0].count, 1999)
  assert.equal(stats.methodBuckets[0].limit, 2000)
})
