/**
 * Riot API rate limiter powered by Bottleneck.
 *
 * Two Riot rate limits to respect:
 *   - App 120 s bucket: 100 req / 120 s
 *   - App 1 s bucket:    20 req / 1 s
 *
 * Strategy: token-drip via reservoirIncreaseInterval targeting ~99 uses / 120 s
 * (120_000 / 99 ≈ 1.21 s between tokens), with a small burst buffer so parallel
 * producers do not stall when idle. This is as close as practical to the cap
 * under a fixed drip; `syncFromResponseHeaders` applies short pauses when
 * `x-app-rate-limit-count` for the 120 s bucket reaches the near-limit threshold
 * so in-flight parallelism does not push over 100.
 *
 * minTime: 65 ms (~15 req/s) keeps us under the 20 req/1 s bucket.
 *
 * On 429: schedule() blocks until Retry-After + buffer expires.
 * Concurrent penalize429 calls only extend (never shorten) the wait.
 */
import Bottleneck from 'bottleneck'

/**
 * Standard development application limit is 100 / 120 s; breathing triggers at `limit - 1`
 * (i.e. count ≥ 99). Kept as a named constant for metrics and docs.
 */
export const RIOT_HEADER_APP_120S_NEAR_LIMIT = 99
/** If headers report count ≥ limit (should be rare on 200), pause ~until bucket rolls. */
export const RIOT_HEADER_NEAR_LIMIT_COOLDOWN_MS = 100_000
/** Short pause when at the 120 s near-limit, to drain parallel requests. */
export const RIOT_HEADER_APP_120S_BREATH_MS = 2_500
/** At most one breath every N ms while headers stay hot (avoids stalling every response). */
export const RIOT_HEADER_APP_120S_BREATH_MIN_INTERVAL_MS = 5_000
export const RIOT_429_MIN_PENALTY_MS = 5_000

const MAX_429_PENALTY_MS = 120_000
const PENALTY_BUFFER_MS = 2_500

/** Target sustained app throughput: ~99 requests per 120 s rolling budget. */
const TARGET_APP_REQUESTS_PER_120S = 99
const TOKEN_DRIP_INTERVAL_MS = Math.floor(120_000 / TARGET_APP_REQUESTS_PER_120S)
/** Small burst when idle; header-based breath prevents overshoot with parallel fetches. */
const RESERVOIR_MAX = 4

/** Parse `"20:1,100:120"` → `[{ value: 20, windowSec: 1 }, { value: 100, windowSec: 120 }]` */
function parseRiotLimitPairs(
  header: string | null
): { value: number; windowSec: number }[] {
  if (!header?.trim()) return []
  const result: { value: number; windowSec: number }[] = []
  for (const part of header.split(',')) {
    const [a, b] = part.trim().split(':')
    const value = Number(a)
    const windowSec = Number(b)
    if (Number.isFinite(value) && Number.isFinite(windowSec) && windowSec > 0) {
      result.push({ value, windowSec })
    }
  }
  return result
}

type BucketSnapshot = {
  limit: number
  count: number
  windowSec: number
  recordedAt: number
}

export class RiotRateLimiter {
  private limiter: Bottleneck
  private nearLimitPauseCount = 0
  private http429PauseCount = 0
  private appBuckets: BucketSnapshot[] = []
  private methodBuckets: BucketSnapshot[] = []
  /** Timestamp (ms) until which all requests are blocked. Only extends, never shortens. */
  private penaltyUntil = 0
  /** Last time we applied a 120 s near-limit breath (debounce). */
  private lastApp120BreathAtMs = 0
  private stopped = false

  constructor() {
    this.limiter = new Bottleneck({
      reservoir: 1,
      reservoirIncreaseAmount: 1,
      reservoirIncreaseInterval: TOKEN_DRIP_INTERVAL_MS,
      reservoirIncreaseMaximum: RESERVOIR_MAX,
      maxConcurrent: 10,
      minTime: 65,
    })
  }

  /**
   * Schedule a function to execute within Riot API rate limits.
   *
   * If a 429 penalty is active, waits until it expires before handing
   * the job to Bottleneck for pacing.
   */
  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    // Wait for any active 429 penalty to expire
    while (!this.stopped) {
      const wait = this.penaltyUntil - Date.now()
      if (wait <= 0) break
      await new Promise<void>((r) => setTimeout(r, Math.min(wait + 50, 1_000)))
    }
    if (this.stopped) throw new Error('RiotRateLimiter stopped')
    return this.limiter.schedule(fn)
  }

  /**
   * After HTTP 429: block all future schedule() calls until
   * Retry-After + buffer has elapsed.
   *
   * Concurrent 429 calls only extend the penalty (never shorten it).
   */
  penalize429(retryAfterSec?: number): void {
    let ms = RIOT_429_MIN_PENALTY_MS
    if (retryAfterSec != null && Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
      ms = Math.ceil(retryAfterSec * 1000) + PENALTY_BUFFER_MS
    }
    ms = Math.min(ms, MAX_429_PENALTY_MS)
    this.http429PauseCount++

    const newUntil = Date.now() + ms
    if (newUntil > this.penaltyUntil) {
      this.penaltyUntil = newUntil
    }
  }

  /** @deprecated Prefer penalize429(). */
  penalize(durationMs: number): void {
    this.penaltyUntil = Math.max(this.penaltyUntil, Date.now() + durationMs)
  }

  /**
   * Read rate-limit headers from a successful response for monitoring/logging.
   */
  syncFromResponseHeaders(headers: { get(name: string): string | null }): void {
    const now = Date.now()
    const appLimits = parseRiotLimitPairs(headers.get('x-app-rate-limit'))
    const appCounts = parseRiotLimitPairs(headers.get('x-app-rate-limit-count'))
    this.appBuckets = this.mergeBuckets(appLimits, appCounts, now)

    const methodLimits = parseRiotLimitPairs(headers.get('x-method-rate-limit'))
    const methodCounts = parseRiotLimitPairs(headers.get('x-method-rate-limit-count'))
    this.methodBuckets = this.mergeBuckets(methodLimits, methodCounts, now)

    const app120 = this.appBuckets.find((b) => b.windowSec === 120)
    if (app120 && app120.limit > 0) {
      // remaining120 <= 1 ⟺ count >= limit - 1 (e.g. ≥ RIOT_HEADER_APP_120S_NEAR_LIMIT when limit is 100).
      const remaining120 = app120.limit - app120.count
      if (remaining120 <= 0) {
        this.nearLimitPauseCount++
        this.penaltyUntil = Math.max(this.penaltyUntil, now + RIOT_HEADER_NEAR_LIMIT_COOLDOWN_MS)
      } else if (
        remaining120 <= 1 &&
        now - this.lastApp120BreathAtMs >= RIOT_HEADER_APP_120S_BREATH_MIN_INTERVAL_MS
      ) {
        this.lastApp120BreathAtMs = now
        this.nearLimitPauseCount++
        this.penaltyUntil = Math.max(this.penaltyUntil, now + RIOT_HEADER_APP_120S_BREATH_MS)
      }
    }
  }

  getStats(): {
    nearLimitPauseCount: number
    http429PauseCount: number
    appBuckets: BucketSnapshot[]
    methodBuckets: BucketSnapshot[]
  } {
    return {
      nearLimitPauseCount: this.nearLimitPauseCount,
      http429PauseCount: this.http429PauseCount,
      appBuckets: [...this.appBuckets],
      methodBuckets: [...this.methodBuckets],
    }
  }

  /**
   * @deprecated No-op kept for backward compatibility. Use schedule() instead.
   */
  async acquire(_bucketName?: string): Promise<void> {}

  /**
   * Stop the limiter and unblock all pending schedule() calls.
   * Call when the poller is shutting down.
   */
  async disconnect(): Promise<void> {
    this.stopped = true
    this.penaltyUntil = 0
    await this.limiter.stop({ dropWaitingJobs: true })
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private mergeBuckets(
    limits: { value: number; windowSec: number }[],
    counts: { value: number; windowSec: number }[],
    now: number
  ): BucketSnapshot[] {
    const countByWindow = new Map<number, number>()
    for (const c of counts) countByWindow.set(c.windowSec, c.value)

    return limits.map((l) => ({
      limit: l.value,
      count: countByWindow.get(l.windowSec) ?? 0,
      windowSec: l.windowSec,
      recordedAt: now,
    }))
  }
}
