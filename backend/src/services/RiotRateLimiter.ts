/**
 * Riot API rate limiter driven by response headers.
 *
 * Strategy: fire requests at full speed, read every response's
 * `X-App-Rate-Limit-Count` / `X-Method-Rate-Limit-Count` headers,
 * and pause **just long enough** for the window to roll over when
 * the count nears the limit.
 *
 * Buckets tracked (from headers):
 *   - App-level:    e.g. `X-App-Rate-Limit: 20:1,100:120`
 *   - Method-level: e.g. `X-Method-Rate-Limit: 2000:60`
 *
 * Safety margin: we stop sending at `limit - 1` (i.e. 99 of 100)
 * and wait for the remaining window seconds + a small buffer.
 */

/** How many requests below the limit we consider "safe". */
const SAFETY_MARGIN = 1
/** Extra buffer (ms) added after computed window wait to absorb clock drift. */
const WINDOW_BUFFER_MS = 2_500
/** Minimum pause when we approach a limit, even if window math says 0. */
const MIN_NEAR_LIMIT_PAUSE_MS = 1_000
/** Maximum pause from a single near-limit event (sanity cap). */
const MAX_NEAR_LIMIT_PAUSE_MS = 125_000

/** Default 429 penalty when no Retry-After header is provided. */
const DEFAULT_429_PENALTY_MS = 5_000
/** Cap on 429 penalty so we don't sleep forever on a stale Retry-After. */
const MAX_429_PENALTY_MS = 120_000

// ────────────────────────────────────────────────────────────────────────────

export const RIOT_HEADER_APP_120S_NEAR_LIMIT = 99
export const RIOT_HEADER_NEAR_LIMIT_COOLDOWN_MS = 100_000
export const RIOT_429_MIN_PENALTY_MS = DEFAULT_429_PENALTY_MS

/** Parse `"20:1,100:120"` → `[{ limit: 20, windowSec: 1 }, { limit: 100, windowSec: 120 }]` */
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
  private penaltyUntil = 0
  private chain: Promise<void> = Promise.resolve()
  private nearLimitPauseCount = 0
  private http429PauseCount = 0

  private appBuckets: BucketSnapshot[] = []
  private methodBuckets: BucketSnapshot[] = []

  /**
   * After HTTP 429: block for `Retry-After` seconds (or a default).
   * Much smaller than the old 120s floor — Riot tells us exactly how long to wait.
   */
  penalize429(retryAfterSec?: number): void {
    let ms = DEFAULT_429_PENALTY_MS
    if (retryAfterSec != null && Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
      ms = Math.ceil(retryAfterSec * 1000) + WINDOW_BUFFER_MS
    }
    ms = Math.min(ms, MAX_429_PENALTY_MS)
    const until = Date.now() + ms
    if (until > this.penaltyUntil) {
      this.http429PauseCount += 1
      this.penaltyUntil = until
    }
  }

  /** @deprecated Prefer penalize429(). */
  penalize(durationMs: number): void {
    this.penaltyUntil = Math.max(this.penaltyUntil, Date.now() + durationMs)
  }

  /**
   * Read all rate-limit headers from a successful response.
   * If ANY bucket (app or method, any window) is at `limit - SAFETY_MARGIN`,
   * compute the minimum time until that window rolls over and pause accordingly.
   */
  syncFromResponseHeaders(headers: { get(name: string): string | null }): void {
    const now = Date.now()

    const appLimits = parseRiotLimitPairs(headers.get('x-app-rate-limit'))
    const appCounts = parseRiotLimitPairs(headers.get('x-app-rate-limit-count'))
    this.appBuckets = this.mergeBuckets(appLimits, appCounts, now)

    const methodLimits = parseRiotLimitPairs(headers.get('x-method-rate-limit'))
    const methodCounts = parseRiotLimitPairs(headers.get('x-method-rate-limit-count'))
    this.methodBuckets = this.mergeBuckets(methodLimits, methodCounts, now)

    this.applyNearLimitPause(now)
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
   * Serialise acquire() calls so only one request proceeds at a time.
   * Waits for any active penalty to expire before releasing.
   */
  async acquire(_bucketName?: string): Promise<void> {
    let release!: () => void
    const prev = this.chain
    const next = new Promise<void>((res) => {
      release = res
    })
    this.chain = next

    await prev

    try {
      for (;;) {
        const wait = this.penaltyUntil - Date.now()
        if (wait > 0) {
          await new Promise((r) => setTimeout(r, wait))
          continue
        }
        break
      }
    } finally {
      release()
    }
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

  /**
   * For each tracked bucket: if `count >= limit - SAFETY_MARGIN`, compute
   * how long until the window resets and set penaltyUntil accordingly.
   *
   * The window reset time is estimated as `recordedAt + windowSec * 1000`
   * (Riot counts reset at the end of the rolling window).
   */
  private applyNearLimitPause(now: number): void {
    let neededPauseMs = 0

    const allBuckets = [...this.appBuckets, ...this.methodBuckets]
    for (const b of allBuckets) {
      const threshold = b.limit - SAFETY_MARGIN
      if (threshold <= 0) continue
      if (b.count < threshold) continue

      const windowEndMs = b.recordedAt + b.windowSec * 1000
      const remainingMs = windowEndMs - now
      const pauseMs = Math.max(MIN_NEAR_LIMIT_PAUSE_MS, remainingMs + WINDOW_BUFFER_MS)
      const capped = Math.min(pauseMs, MAX_NEAR_LIMIT_PAUSE_MS)
      neededPauseMs = Math.max(neededPauseMs, capped)
    }

    if (neededPauseMs > 0) {
      const until = now + neededPauseMs
      if (until > this.penaltyUntil) {
        this.nearLimitPauseCount += 1
        this.penaltyUntil = until
      }
    }
  }
}
