/**
 * Riot API rate limiter powered by Bottleneck.
 *
 * Reservoir: 98 requests per 120 s (Riot limit is 100; 2 kept as safety margin).
 * Max concurrent: 15 HTTP requests in flight at once.
 * On 429: drain the reservoir to 0, restore after Retry-After + buffer.
 *
 * Response headers are still parsed for monitoring / logging,
 * but the actual throttling is handled entirely by Bottleneck.
 */
import Bottleneck from 'bottleneck'

export const RIOT_HEADER_APP_120S_NEAR_LIMIT = 99
export const RIOT_HEADER_NEAR_LIMIT_COOLDOWN_MS = 100_000
export const RIOT_429_MIN_PENALTY_MS = 5_000

const MAX_429_PENALTY_MS = 120_000
const PENALTY_BUFFER_MS = 2_500
const RESERVOIR_SIZE = 98

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
  private penaltyTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.limiter = new Bottleneck({
      reservoir: RESERVOIR_SIZE,
      reservoirRefreshAmount: RESERVOIR_SIZE,
      reservoirRefreshInterval: 120_000,
      maxConcurrent: 15,
      minTime: 0,
    })
  }

  /**
   * Schedule a function to execute within Riot API rate limits.
   * Bottleneck manages the reservoir (98 req / 120 s) and concurrency (15 in-flight max).
   */
  schedule<T>(fn: () => Promise<T>): Promise<T> {
    return this.limiter.schedule(fn)
  }

  /**
   * After HTTP 429: drain the reservoir to stop new requests,
   * then restore after the Retry-After duration + buffer.
   */
  penalize429(retryAfterSec?: number): void {
    let ms = RIOT_429_MIN_PENALTY_MS
    if (retryAfterSec != null && Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
      ms = Math.ceil(retryAfterSec * 1000) + PENALTY_BUFFER_MS
    }
    ms = Math.min(ms, MAX_429_PENALTY_MS)
    this.http429PauseCount++
    void this.limiter.updateSettings({ reservoir: 0 })
    if (this.penaltyTimer) clearTimeout(this.penaltyTimer)
    this.penaltyTimer = setTimeout(() => {
      void this.limiter.updateSettings({ reservoir: RESERVOIR_SIZE })
      this.penaltyTimer = null
    }, ms)
  }

  /** @deprecated Prefer penalize429(). */
  penalize(durationMs: number): void {
    this.penalize429(durationMs / 1000)
  }

  /**
   * Read rate-limit headers from a successful response for monitoring/logging.
   * No longer triggers pauses — Bottleneck handles pacing.
   */
  syncFromResponseHeaders(headers: { get(name: string): string | null }): void {
    const now = Date.now()
    const appLimits = parseRiotLimitPairs(headers.get('x-app-rate-limit'))
    const appCounts = parseRiotLimitPairs(headers.get('x-app-rate-limit-count'))
    this.appBuckets = this.mergeBuckets(appLimits, appCounts, now)

    const methodLimits = parseRiotLimitPairs(headers.get('x-method-rate-limit'))
    const methodCounts = parseRiotLimitPairs(headers.get('x-method-rate-limit-count'))
    this.methodBuckets = this.mergeBuckets(methodLimits, methodCounts, now)
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
  async acquire(_bucketName?: string): Promise<void> {
    // Bottleneck handles pacing via schedule(); acquire is no longer needed.
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
