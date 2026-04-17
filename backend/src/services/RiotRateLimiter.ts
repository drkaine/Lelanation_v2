/**
 * Riot API rate limiter powered by Bottleneck.
 *
 * Two Riot rate limits to respect:
 *   - App 120 s bucket: 100 req / 120 s
 *   - App 1 s bucket:    20 req / 1 s
 *
 * Strategy: token-drip via reservoirIncreaseInterval targeting 100 uses / 120 s by default
 * (`RIOT_APP_TARGET_PER_120S`), with a burst buffer (`RIOT_RESERVOIR_MAX`) so parallel
 * producers do not stall when idle.
 *
 * Optional header "breath": when `RIOT_APP_120S_BREATH_REMAINING_MAX` is 1, a short pause
 * applies if the 120 s bucket has at most that many slots left (e.g. 99/100). Default is 0
 * (disabled) so sustained throughput stays closer to the drip target; set to 1 for the
 * old conservative behaviour.
 *
 * minTime: 50 ms (20 req/s) uses the 1 s bucket fully; do not lower further.
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
/** Default short pause when at the 120 s near-limit, to drain parallel requests. */
export const RIOT_HEADER_APP_120S_BREATH_MS_DEFAULT = 2_500
/** Default debounce for near-limit breath pauses. */
export const RIOT_HEADER_APP_120S_BREATH_MIN_INTERVAL_MS_DEFAULT = 5_000
/** Hard-stop threshold on remaining slots for app 120s bucket (e.g. 1 => stop at 99/100). */
export const RIOT_HEADER_APP_120S_HARD_STOP_REMAINING_MAX_DEFAULT = 1
/** Hard-stop cooldown when threshold is hit (gives time for 120s window to drain). */
export const RIOT_HEADER_APP_120S_HARD_STOP_MS_DEFAULT = 40_000
export const RIOT_429_MIN_PENALTY_MS = 5_000

const MAX_429_PENALTY_MS = 120_000
const PENALTY_BUFFER_MS = 2_500

function readTargetAppRequestsPer120s(): number {
  const raw = Number.parseInt(process.env.RIOT_APP_TARGET_PER_120S ?? '', 10)
  if (!Number.isFinite(raw)) return 100
  return Math.min(100, Math.max(1, raw))
}

/** Exported for poller summaries / budget lines (reads env each time). */
export function getRiotAppTargetPer120s(): number {
  return readTargetAppRequestsPer120s()
}

function readReservoirMax(): number {
  const raw = Number.parseInt(process.env.RIOT_RESERVOIR_MAX ?? '', 10)
  if (!Number.isFinite(raw)) return 12
  return Math.min(32, Math.max(1, raw))
}

function readMaxConcurrent(): number {
  const raw = Number.parseInt(process.env.RIOT_LIMITER_MAX_CONCURRENT ?? '', 10)
  if (!Number.isFinite(raw)) return 24
  return Math.min(64, Math.max(1, raw))
}

/** If 1, apply short breath when 120s bucket has ≤1 slot left (99/100). If 0, disabled. */
function readApp120sBreathRemainingMax(): number {
  const raw = Number.parseInt(process.env.RIOT_APP_120S_BREATH_REMAINING_MAX ?? '', 10)
  if (!Number.isFinite(raw)) return 0
  return Math.min(5, Math.max(0, raw))
}

/** Near-limit pause duration (ms) when remaining<=threshold. */
function readApp120sBreathMs(): number {
  const raw = Number.parseInt(process.env.RIOT_APP_120S_BREATH_MS ?? '', 10)
  if (!Number.isFinite(raw)) return RIOT_HEADER_APP_120S_BREATH_MS_DEFAULT
  return Math.min(60_000, Math.max(250, raw))
}

/** Debounce between two near-limit breaths (ms). */
function readApp120sBreathMinIntervalMs(): number {
  const raw = Number.parseInt(process.env.RIOT_APP_120S_BREATH_MIN_INTERVAL_MS ?? '', 10)
  if (!Number.isFinite(raw)) return RIOT_HEADER_APP_120S_BREATH_MIN_INTERVAL_MS_DEFAULT
  return Math.min(60_000, Math.max(250, raw))
}

/** Header-driven hard stop threshold on remaining app slots in 120s window. */
function readApp120sHardStopRemainingMax(): number {
  const raw = Number.parseInt(process.env.RIOT_APP_120S_HARD_STOP_REMAINING_MAX ?? '', 10)
  if (!Number.isFinite(raw)) return RIOT_HEADER_APP_120S_HARD_STOP_REMAINING_MAX_DEFAULT
  return Math.min(10, Math.max(0, raw))
}

/** Header-driven hard stop duration when threshold is reached. */
function readApp120sHardStopMs(): number {
  const raw = Number.parseInt(process.env.RIOT_APP_120S_HARD_STOP_MS ?? '', 10)
  if (!Number.isFinite(raw)) return RIOT_HEADER_APP_120S_HARD_STOP_MS_DEFAULT
  return Math.min(120_000, Math.max(1_000, raw))
}

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
  private maxApp120CountObserved = 0
  private headerHardStopPauseCount = 0
  /** Timestamp (ms) until which all requests are blocked. Only extends, never shortens. */
  private penaltyUntil = 0
  /** Last time we applied a 120 s near-limit breath (debounce). */
  private lastApp120BreathAtMs = 0
  private stopped = false

  constructor() {
    const target = readTargetAppRequestsPer120s()
    const dripMs = Math.max(1, Math.floor(120_000 / target))
    this.limiter = new Bottleneck({
      reservoir: 1,
      reservoirIncreaseAmount: 1,
      reservoirIncreaseInterval: dripMs,
      reservoirIncreaseMaximum: readReservoirMax(),
      maxConcurrent: readMaxConcurrent(),
      minTime: 50,
    })
  }

  /**
   * Schedule a function to execute within Riot API rate limits.
   *
   * If a 429 penalty is active, waits until it expires before handing
   * the job to Bottleneck for pacing.
   */
  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    const waitForPenalty = async (): Promise<void> => {
      while (!this.stopped) {
        const wait = this.penaltyUntil - Date.now()
        if (wait <= 0) break
        await new Promise<void>((r) => setTimeout(r, Math.min(wait + 50, 1_000)))
      }
      if (this.stopped) throw new Error('RiotRateLimiter stopped')
    }

    // 1) Before entering Bottleneck queue.
    await waitForPenalty()
    // 2) Just before executing the HTTP call, so jobs queued before a fresh 429 also respect penalty.
    return this.limiter.schedule(async () => {
      await waitForPenalty()
      return fn()
    })
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
      this.maxApp120CountObserved = Math.max(this.maxApp120CountObserved, app120.count)
      // remaining120 <= 1 ⟺ count >= limit - 1 (e.g. ≥ RIOT_HEADER_APP_120S_NEAR_LIMIT when limit is 100).
      const remaining120 = app120.limit - app120.count
      const hardStopRemainingMax = readApp120sHardStopRemainingMax()
      if (hardStopRemainingMax > 0 && remaining120 <= hardStopRemainingMax) {
        this.headerHardStopPauseCount++
        this.penaltyUntil = Math.max(this.penaltyUntil, now + readApp120sHardStopMs())
        return
      }
      const breathRemainingMax = readApp120sBreathRemainingMax()
      if (remaining120 <= 0) {
        this.nearLimitPauseCount++
        this.penaltyUntil = Math.max(this.penaltyUntil, now + RIOT_HEADER_NEAR_LIMIT_COOLDOWN_MS)
      } else if (
        breathRemainingMax > 0 &&
        remaining120 <= breathRemainingMax &&
        now - this.lastApp120BreathAtMs >= readApp120sBreathMinIntervalMs()
      ) {
        this.lastApp120BreathAtMs = now
        this.nearLimitPauseCount++
        this.penaltyUntil = Math.max(this.penaltyUntil, now + readApp120sBreathMs())
      }
    }
  }

  getStats(): {
    nearLimitPauseCount: number
    headerHardStopPauseCount: number
    http429PauseCount: number
    appBuckets: BucketSnapshot[]
    methodBuckets: BucketSnapshot[]
    maxApp120CountObserved: number
  } {
    return {
      nearLimitPauseCount: this.nearLimitPauseCount,
      headerHardStopPauseCount: this.headerHardStopPauseCount,
      http429PauseCount: this.http429PauseCount,
      appBuckets: [...this.appBuckets],
      methodBuckets: [...this.methodBuckets],
      maxApp120CountObserved: this.maxApp120CountObserved,
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
