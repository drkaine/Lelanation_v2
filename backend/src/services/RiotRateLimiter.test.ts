import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RiotRateLimiter } from './RiotRateLimiter.js'

test('RiotRateLimiter: schedule paces requests via token drip', async () => {
  const limiter = new RiotRateLimiter()
  const t0 = Date.now()
  await limiter.schedule(async () => 'a')
  await limiter.schedule(async () => 'b')
  const elapsed = Date.now() - t0
  // First call uses initial token, second waits ~1263 ms for next drip (95/120 s target)
  assert.ok(elapsed >= 1_000, `Second call should wait for token drip, got ${elapsed}ms`)
  assert.ok(elapsed < 4_000, `Should not wait too long, got ${elapsed}ms`)
})

test('RiotRateLimiter: penalize429 blocks schedule for retry-after duration', async () => {
  const limiter = new RiotRateLimiter()
  await limiter.schedule(async () => 'init')
  limiter.penalize429(2) // 2 s retry + 2.5 s buffer = 4.5 s penalty
  const t0 = Date.now()
  await limiter.schedule(async () => 'ok')
  const elapsed = Date.now() - t0
  // Wait penalty (4.5 s) + token drip (~1.21 s)
  assert.ok(elapsed >= 4_000, `Should wait for penalty + drip, got ${elapsed}ms`)
  assert.ok(elapsed < 10_000, `Should not wait too long, got ${elapsed}ms`)
})

test('RiotRateLimiter: concurrent penalize429 keeps longest penalty', () => {
  const limiter = new RiotRateLimiter()
  limiter.penalize429(2)
  assert.equal(limiter.getStats().http429PauseCount, 1)

  limiter.penalize429(60) // longer — replaces
  assert.equal(limiter.getStats().http429PauseCount, 2)

  limiter.penalize429(1) // shorter — no-op on timing, still counted
  assert.equal(limiter.getStats().http429PauseCount, 3)
})

test('RiotRateLimiter: syncFromResponseHeaders applies breath when 120s bucket has one slot left', async () => {
  const limiter = new RiotRateLimiter()
  await limiter.schedule(async () => 'init')
  const headers = new Headers({
    'x-app-rate-limit': '20:1,100:120',
    'x-app-rate-limit-count': '99:120',
  })
  limiter.syncFromResponseHeaders(headers)
  const t0 = Date.now()
  await limiter.schedule(async () => 'after')
  const elapsed = Date.now() - t0
  assert.ok(elapsed >= 2_350, `Should wait header breath (2.5s) + token refill, got ${elapsed}ms`)
  assert.ok(elapsed < 10_000)
  assert.equal(limiter.getStats().nearLimitPauseCount, 1)
})

test('RiotRateLimiter: syncFromResponseHeaders tracks buckets', () => {
  const limiter = new RiotRateLimiter()
  const headers = new Headers({
    'x-app-rate-limit': '20:1,100:120',
    'x-app-rate-limit-count': '5:1,42:120',
    'x-method-rate-limit': '2000:10',
    'x-method-rate-limit-count': '123:10',
  })
  limiter.syncFromResponseHeaders(headers)
  const stats = limiter.getStats()
  assert.equal(stats.appBuckets.length, 2)
  assert.equal(stats.appBuckets.find((b) => b.windowSec === 120)!.count, 42)
  assert.equal(stats.methodBuckets[0].count, 123)
  assert.equal(stats.maxApp120CountObserved, 42)
})

test('RiotRateLimiter: disconnect unblocks pending schedule calls', async () => {
  const limiter = new RiotRateLimiter()
  limiter.penalize429(120)
  const t0 = Date.now()
  const promise = limiter.schedule(async () => 'fail').catch(() => 'rejected')
  // Disconnect immediately — should unblock
  await limiter.disconnect()
  const result = await promise
  assert.equal(result, 'rejected')
  assert.ok(Date.now() - t0 < 2_000, 'Should unblock quickly')
})
