import type { Request, Response, NextFunction } from 'express'

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

const PURGE_INTERVAL_MS = 60_000
/** Hard cap so a flood of distinct keys cannot grow the map without bound. */
const MAX_BUCKETS = 50_000

let purgeTimer: NodeJS.Timeout | null = null

function purgeExpiredBuckets(): void {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
  if (buckets.size > MAX_BUCKETS) {
    // Still too many live keys: drop the oldest entries (Map preserves insertion order).
    const excess = buckets.size - MAX_BUCKETS
    let dropped = 0
    for (const key of buckets.keys()) {
      buckets.delete(key)
      if (++dropped >= excess) break
    }
  }
}

function ensurePurgeTimer(): void {
  if (purgeTimer) return
  purgeTimer = setInterval(purgeExpiredBuckets, PURGE_INTERVAL_MS)
  // Never keep the process alive just for housekeeping.
  purgeTimer.unref()
}

export type RateLimitOptions = {
  windowMs: number
  max: number
  keyPrefix?: string
}

/**
 * Client identity for rate limiting.
 * Relies on `req.ip`, which Express derives from X-Forwarded-For only for the
 * proxies trusted via `app.set('trust proxy', …)` — a client cannot spoof it
 * by sending its own header.
 */
export function clientKey(req: Request): string {
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

function hit(key: string, windowMs: number, now: number): Bucket {
  let bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs }
    buckets.set(key, bucket)
  }
  bucket.count += 1
  return bucket
}

export function createRateLimit(options: RateLimitOptions) {
  const { windowMs, max, keyPrefix = 'rl' } = options
  ensurePurgeTimer()

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now()
    const bucket = hit(`${keyPrefix}:${clientKey(req)}`, windowMs, now)
    if (bucket.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)))
      return res.status(429).json({ error: 'Too many requests' })
    }

    return next()
  }
}

/**
 * Limiter that only counts *failures* (e.g. bad admin credentials), so legitimate
 * authenticated traffic is never throttled but brute-forcing is.
 */
export function createFailureLimiter(options: RateLimitOptions) {
  const { windowMs, max, keyPrefix = 'fail' } = options
  ensurePurgeTimer()

  return {
    /** Returns the seconds to wait when the client is currently blocked, otherwise 0. */
    blockedFor(req: Request): number {
      const bucket = buckets.get(`${keyPrefix}:${clientKey(req)}`)
      const now = Date.now()
      if (!bucket || bucket.resetAt <= now || bucket.count < max) return 0
      return Math.ceil((bucket.resetAt - now) / 1000)
    },
    recordFailure(req: Request): void {
      hit(`${keyPrefix}:${clientKey(req)}`, windowMs, Date.now())
    },
    reset(req: Request): void {
      buckets.delete(`${keyPrefix}:${clientKey(req)}`)
    },
  }
}
