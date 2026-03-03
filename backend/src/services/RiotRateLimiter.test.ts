import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RiotRateLimiter } from './RiotRateLimiter.js'

test('RiotRateLimiter respects limit per window', async () => {
  const config = {
    buckets: [
      {
        name: 'test',
        limits: [
          { count: 2, windowSeconds: 1 },
          { count: 10, windowSeconds: 10 },
        ],
      },
    ],
  }
  const limiter = new RiotRateLimiter(config)
  const now = Date.now()

  await limiter.acquire('test')
  await limiter.acquire('test')
  const t0 = Date.now()
  await limiter.acquire('test')
  const elapsed = Date.now() - t0
  assert.ok(elapsed >= 900, 'Third acquire should wait ~1s to respect 2/1s limit')
})

test('RiotRateLimiter unknown bucket does not block', async () => {
  const config = { buckets: [{ name: 'known', limits: [{ count: 1, windowSeconds: 1 }] }] }
  const limiter = new RiotRateLimiter(config)
  await limiter.acquire('unknown')
  await limiter.acquire('unknown')
})
