/**
 * In-memory rate limiter for Riot API buckets.
 * Before each request, wait if necessary so we stay under limits.
 */
import type { RateLimitConfig } from './RiotConfigService.js'

type Timestamp = number

export class RiotRateLimiter {
  private readonly buckets = new Map<string, Timestamp[]>()
  private readonly config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = config
    for (const b of config.buckets) {
      this.buckets.set(b.name, [])
    }
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
   */
  async acquire(bucketName: string): Promise<void> {
    const bucket = this.config.buckets.find((b) => b.name === bucketName)
    if (!bucket) return

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
  }
}
