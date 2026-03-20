/**
 * Global Riot API throttle: one counter for all endpoints (application limit).
 * - At most N requests per 1s and M per 120s (defaults from `app` bucket in rate-limit.json).
 * - When the 1s cap would be exceeded: wait 1s before the next slot.
 * - When the 120s cap would be exceeded: wait until the oldest request in that window falls out.
 * - On HTTP 429: block at least 10s, or longer if Riot sends Retry-After (whichever is greater).
 */
import type { RateLimitConfig } from './RiotConfigService.js'

const WINDOW_1S_MS = 1000
const WINDOW_120S_MS = 120_000
/** Minimum pause after a real HTTP 429 from Riot (may extend via `penalize429(retryAfterSec)`). */
export const RIOT_429_MIN_PENALTY_MS = 10_000
const PENALTY_429_MS = RIOT_429_MIN_PENALTY_MS
const DEFAULT_PER_SECOND = 19
const DEFAULT_PER_120S = 99

export class RiotRateLimiter {
  private readonly maxPerSecond: number
  private readonly maxPer120Seconds: number
  private readonly penalty429Ms: number

  private requestTimestamps: number[] = []
  private penaltyUntil = 0
  private chain: Promise<void> = Promise.resolve()

  constructor(config: RateLimitConfig) {
    const app = config.buckets.find((b) => b.name === 'app')
    const lim1 = app?.limits.find((l) => l.windowSeconds === 1)
    const lim120 = app?.limits.find((l) => l.windowSeconds === 120)
    this.maxPerSecond = lim1?.count ?? DEFAULT_PER_SECOND
    this.maxPer120Seconds = lim120?.count ?? DEFAULT_PER_120S
    this.penalty429Ms = PENALTY_429_MS
  }

  /**
   * After an HTTP 429 from Riot: block all outgoing requests for at least {@link RIOT_429_MIN_PENALTY_MS},
   * or `retryAfterSec * 1000` from the Retry-After header when it is higher.
   */
  penalize429(retryAfterSec?: number): void {
    const fromHeader =
      retryAfterSec != null && Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec * 1000 : 0
    const ms = Math.max(this.penalty429Ms, fromHeader)
    this.penaltyUntil = Math.max(this.penaltyUntil, Date.now() + ms)
  }

  /**
   * @deprecated Prefer penalize429(). Kept for callers that pass a custom duration.
   */
  penalize(durationMs: number): void {
    this.penaltyUntil = Math.max(this.penaltyUntil, Date.now() + durationMs)
  }

  /**
   * Reserve one global slot before a Riot HTTP call. Bucket name is ignored (single app-wide budget).
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
        const now = Date.now()

        const penaltyWait = this.penaltyUntil - now
        if (penaltyWait > 0) {
          await new Promise((r) => setTimeout(r, penaltyWait))
          continue
        }

        this.pruneOld(now)

        const in1s = this.requestTimestamps.filter((t) => t > now - WINDOW_1S_MS)
        const in120 = this.requestTimestamps.filter((t) => t > now - WINDOW_120S_MS)

        if (in120.length >= this.maxPer120Seconds) {
          const oldest = Math.min(...in120)
          const waitMs = oldest + WINDOW_120S_MS - now
          await new Promise((r) => setTimeout(r, Math.max(0, waitMs)))
          continue
        }

        if (in1s.length >= this.maxPerSecond) {
          await new Promise((r) => setTimeout(r, WINDOW_1S_MS))
          continue
        }

        this.requestTimestamps.push(Date.now())
        break
      }
    } finally {
      release()
    }
  }

  private pruneOld(now: number): void {
    const cutoff = now - WINDOW_120S_MS
    this.requestTimestamps = this.requestTimestamps.filter((t) => t >= cutoff)
  }
}
