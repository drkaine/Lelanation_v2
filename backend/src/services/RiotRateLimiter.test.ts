import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RiotRateLimiter } from './RiotRateLimiter.js'

test('RiotRateLimiter: schedule paces requests via token drip', async () => {
  const limiter = new RiotRateLimiter()
  const t0 = Date.now()
  await limiter.schedule(async () => 'a')
  await limiter.schedule(async () => 'b')
  const elapsed = Date.now() - t0
  // First call uses initial token, second waits ~1200 ms for next drip (default 100/120 s target)
  assert.ok(elapsed >= 900, `Second call should wait for token drip, got ${elapsed}ms`)
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
  process.env.RIOT_APP_120S_BREATH_REMAINING_MAX = '1'
  process.env.RIOT_APP_120S_HARD_STOP_REMAINING_MAX = '0'
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
  delete process.env.RIOT_APP_120S_BREATH_REMAINING_MAX
  delete process.env.RIOT_APP_120S_HARD_STOP_REMAINING_MAX
})

test('RiotRateLimiter: syncFromResponseHeaders hard-stops near 120s cap', async () => {
  process.env.RIOT_APP_120S_HARD_STOP_REMAINING_MAX = '1'
  process.env.RIOT_APP_120S_HARD_STOP_MS = '1500'
  process.env.RIOT_APP_120S_BREATH_REMAINING_MAX = '0'
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
  assert.ok(elapsed >= 1_400, `Should wait for hard-stop window, got ${elapsed}ms`)
  assert.ok(elapsed < 8_000)
  assert.equal(limiter.getStats().headerHardStopPauseCount, 1)
  delete process.env.RIOT_APP_120S_HARD_STOP_REMAINING_MAX
  delete process.env.RIOT_APP_120S_HARD_STOP_MS
  delete process.env.RIOT_APP_120S_BREATH_REMAINING_MAX
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

test('RiotRateLimiter: auto-tuning decreases and increases adaptive target from app 120s headers', () => {
  process.env.RIOT_APP_120S_AUTOTUNE_ENABLED = '1'
  process.env.RIOT_APP_TARGET_PER_120S = '95'
  process.env.RIOT_APP_120S_AUTOTUNE_MIN_TARGET_PER_120S = '80'
  process.env.RIOT_APP_120S_AUTOTUNE_MAX_TARGET_PER_120S = '95'
  process.env.RIOT_APP_120S_AUTOTUNE_COOLDOWN_MS = '0'
  process.env.RIOT_APP_120S_AUTOTUNE_DOWN_HARD_REMAINING_MAX = '2'
  process.env.RIOT_APP_120S_AUTOTUNE_DOWN_SOFT_REMAINING_MAX = '6'
  process.env.RIOT_APP_120S_AUTOTUNE_STEP_DOWN_HARD = '5'
  process.env.RIOT_APP_120S_AUTOTUNE_STEP_DOWN_SOFT = '2'
  process.env.RIOT_APP_120S_AUTOTUNE_UP_REMAINING_MIN = '20'
  process.env.RIOT_APP_120S_AUTOTUNE_UP_STREAK_REQUIRED = '2'
  process.env.RIOT_APP_120S_AUTOTUNE_STEP_UP = '1'
  try {
    const limiter = new RiotRateLimiter()
    const nearCap = new Headers({
      'x-app-rate-limit': '20:1,100:120',
      'x-app-rate-limit-count': '98:120',
    })
    limiter.syncFromResponseHeaders(nearCap)
    assert.equal(limiter.getStats().adaptiveTargetPer120s, 90)

    const plentyHeadroom = new Headers({
      'x-app-rate-limit': '20:1,100:120',
      'x-app-rate-limit-count': '70:120',
    })
    limiter.syncFromResponseHeaders(plentyHeadroom)
    limiter.syncFromResponseHeaders(plentyHeadroom)
    const stats = limiter.getStats()
    assert.equal(stats.adaptiveTargetPer120s, 91)
    assert.equal(stats.autoTuneAdjustDownCount, 1)
    assert.equal(stats.autoTuneAdjustUpCount, 1)
  } finally {
    delete process.env.RIOT_APP_120S_AUTOTUNE_ENABLED
    delete process.env.RIOT_APP_TARGET_PER_120S
    delete process.env.RIOT_APP_120S_AUTOTUNE_MIN_TARGET_PER_120S
    delete process.env.RIOT_APP_120S_AUTOTUNE_MAX_TARGET_PER_120S
    delete process.env.RIOT_APP_120S_AUTOTUNE_COOLDOWN_MS
    delete process.env.RIOT_APP_120S_AUTOTUNE_DOWN_HARD_REMAINING_MAX
    delete process.env.RIOT_APP_120S_AUTOTUNE_DOWN_SOFT_REMAINING_MAX
    delete process.env.RIOT_APP_120S_AUTOTUNE_STEP_DOWN_HARD
    delete process.env.RIOT_APP_120S_AUTOTUNE_STEP_DOWN_SOFT
    delete process.env.RIOT_APP_120S_AUTOTUNE_UP_REMAINING_MIN
    delete process.env.RIOT_APP_120S_AUTOTUNE_UP_STREAK_REQUIRED
    delete process.env.RIOT_APP_120S_AUTOTUNE_STEP_UP
  }
})

test('RiotRateLimiter: auto-tuning also reduces target after HTTP 429', () => {
  process.env.RIOT_APP_120S_AUTOTUNE_ENABLED = '1'
  process.env.RIOT_APP_TARGET_PER_120S = '95'
  process.env.RIOT_APP_120S_AUTOTUNE_MIN_TARGET_PER_120S = '80'
  process.env.RIOT_APP_120S_AUTOTUNE_STEP_DOWN_HARD = '5'
  try {
    const limiter = new RiotRateLimiter()
    limiter.penalize429(1)
    const stats = limiter.getStats()
    assert.equal(stats.adaptiveTargetPer120s, 90)
    assert.equal(stats.autoTuneAdjustDownCount, 1)
  } finally {
    delete process.env.RIOT_APP_120S_AUTOTUNE_ENABLED
    delete process.env.RIOT_APP_TARGET_PER_120S
    delete process.env.RIOT_APP_120S_AUTOTUNE_MIN_TARGET_PER_120S
    delete process.env.RIOT_APP_120S_AUTOTUNE_STEP_DOWN_HARD
  }
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
