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

test('RiotRateLimiter: penalize429 blocks ~10s', async () => {
  const limiter = new RiotRateLimiter()
  limiter.penalize429()
  const t0 = Date.now()
  await limiter.acquire()
  const elapsed = Date.now() - t0
  assert.ok(elapsed >= 9_000, 'Acquire after 429 should wait ~10s')
})

test('RiotRateLimiter: penalize429 uses max(10s, Retry-After)', async () => {
  const limiter = new RiotRateLimiter()
  limiter.penalize429(15)
  const t0 = Date.now()
  await limiter.acquire()
  const elapsed = Date.now() - t0
  assert.ok(elapsed >= 14_000, 'Retry-After 15s should extend cooldown beyond 10s minimum')
})

test('RiotRateLimiter: 98/120s does not enqueue long cooldown', async () => {
  const limiter = new RiotRateLimiter()
  const headers = new Headers({
    'x-app-rate-limit': '20:1,100:120',
    'x-app-rate-limit-count': '1:1,98:120',
  })
  limiter.syncFromResponseHeaders(headers)
  const t0 = Date.now()
  await limiter.acquire()
  assert.ok(Date.now() - t0 < 100)
})
