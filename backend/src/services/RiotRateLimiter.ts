/**
 * In-memory rate limiter for Riot API buckets.
 * Before each request, wait if necessary so we stay under limits.
 */
import type { RateLimitConfig } from './RiotConfigService.js'

type Timestamp = number

export class RiotRateLimiter {
  private readonly buckets = new Map<string, Timestamp[]>()
  private readonly config: RateLimitConfig
  // Mutex per bucket: chains acquire() calls so check+record is always atomic,
  // even when multiple coroutines call acquire() concurrently.
  private readonly locks = new Map<string, Promise<void>>()
  // Global penalty: set when a 429 is received. All acquire() calls block until it expires.
  private penaltyUntil = 0

  constructor(config: RateLimitConfig) {
    this.config = config
    for (const b of config.buckets) {
      this.buckets.set(b.name, [])
      this.locks.set(b.name, Promise.resolve())
    }
  }

  /**
   * Block all future acquire() calls for `durationMs` milliseconds.
   * Called when a 429 is received — honors the Retry-After header from Riot.
   */
  penalize(durationMs: number): void {
    this.penaltyUntil = Math.max(this.penaltyUntil, Date.now() + durationMs)
  }

  /**
   * Record a request and return ms to wait (0 if no wait needed).
   * Caller should await delay(ms) then call record again or proceed.
   * Actually: we wait inside acquire() so the caller just awaits acquire(bucket).
   */
  private getTimestamps(bucketName: string): Timestamp[] {
    let ts = this.buckets.get(bucketName)
    if (!ts) {
      ts = []
      this.buckets.set(bucketName, ts)
    }
    return ts
  }

  private prune(bucketName: string, now: number): void {
    const bucket = this.config.buckets.find((b) => b.name === bucketName)
    if (!bucket) return
    const ts = this.getTimestamps(bucketName)
    const maxWindow = Math.max(...bucket.limits.map((l) => l.windowSeconds))
    const cutoff = now - maxWindow * 1000
    while (ts.length > 0 && ts[0]! < cutoff) ts.shift()
  }

  /**
   * Wait as long as needed to respect limits, then record the request.
   * Thread-safe: uses a per-bucket mutex so concurrent coroutines cannot
   * simultaneously pass the check and over-consume a limit slot.
   */
  async acquire(bucketName: string): Promise<void> {
    const bucket = this.config.buckets.find((b) => b.name === bucketName)
    if (!bucket) return

    // Chain onto the existing lock for this bucket
    let release!: () => void
    const prev = this.locks.get(bucketName) ?? Promise.resolve()
    const next = new Promise<void>((res) => { release = res })
    this.locks.set(bucketName, next)

    await prev // wait for the previous acquire to finish

    try {
      // Respect any global penalty (e.g., from a 429 Retry-After)
      const penaltyWait = this.penaltyUntil - Date.now()
      if (penaltyWait > 0) {
        await new Promise((r) => setTimeout(r, penaltyWait))
      }

      const now = Date.now()
      this.prune(bucketName, now)
      const ts = this.getTimestamps(bucketName)

      let waitMs = 0
      for (const limit of bucket.limits) {
        const windowMs = limit.windowSeconds * 1000
        const inWindow = ts.filter((t) => t >= now - windowMs)
        if (inWindow.length >= limit.count) {
          const oldestInWindow = Math.min(...inWindow)
          const releaseAt = oldestInWindow + windowMs
          const w = releaseAt - now
          if (w > waitMs) waitMs = w
        }
      }

      if (waitMs > 0) {
        await new Promise((r) => setTimeout(r, waitMs))
      }

      this.getTimestamps(bucketName).push(Date.now())
    } finally {
      release() // unblock the next acquire for this bucket
    }
  }
}
