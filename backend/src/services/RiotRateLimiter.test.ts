import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RiotRateLimiter } from './RiotRateLimiter.js'

test('RiotRateLimiter: app bucket 2/s waits ~1s before 3rd request', async () => {
  const config = {
    buckets: [
      {
        name: 'app',
        limits: [
          { count: 2, windowSeconds: 1 },
          { count: 100, windowSeconds: 120 },
        ],
      },
    ],
  }
  const limiter = new RiotRateLimiter(config)
  await limiter.acquire('app')
  await limiter.acquire('app')
  const t0 = Date.now()
  await limiter.acquire('app')
  const elapsed = Date.now() - t0
  assert.ok(elapsed >= 900, 'Third acquire should wait ~1s to respect 2/1s limit')
})

test('RiotRateLimiter: any bucket name shares global budget', async () => {
  const config = {
    buckets: [
      {
        name: 'app',
        limits: [
          { count: 2, windowSeconds: 1 },
          { count: 100, windowSeconds: 120 },
        ],
      },
    ],
  }
  const limiter = new RiotRateLimiter(config)
  await limiter.acquire('match-v5-detail')
  await limiter.acquire('match-v5-timeline')
  const t0 = Date.now()
  await limiter.acquire('unknown-label')
  const elapsed = Date.now() - t0
  assert.ok(elapsed >= 900, 'Third acquire on different label still uses global 2/1s')
})

test('RiotRateLimiter: penalize429 blocks ~10s', async () => {
  const config = {
    buckets: [{ name: 'app', limits: [{ count: 100, windowSeconds: 1 }, { count: 10000, windowSeconds: 120 }] }],
  }
  const limiter = new RiotRateLimiter(config)
  limiter.penalize429()
  const t0 = Date.now()
  await limiter.acquire()
  const elapsed = Date.now() - t0
  assert.ok(elapsed >= 9_000, 'Acquire after 429 should wait ~10s')
})

test('RiotRateLimiter: penalize429 uses max(10s, Retry-After)', async () => {
  const config = {
    buckets: [{ name: 'app', limits: [{ count: 100, windowSeconds: 1 }, { count: 10000, windowSeconds: 120 }] }],
  }
  const limiter = new RiotRateLimiter(config)
  limiter.penalize429(15)
  const t0 = Date.now()
  await limiter.acquire()
  const elapsed = Date.now() - t0
  assert.ok(elapsed >= 14_000, 'Retry-After 15s should extend cooldown beyond 10s minimum')
})
