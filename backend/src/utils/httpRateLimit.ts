import type { Request, Response, NextFunction } from 'express'

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export type RateLimitOptions = {
  windowMs: number
  max: number
  keyPrefix?: string
}

function clientKey(req: Request): string {
  const forwarded = req.header('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || req.ip || 'unknown'
}

export function createRateLimit(options: RateLimitOptions) {
  const { windowMs, max, keyPrefix = 'rl' } = options

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now()
    const key = `${keyPrefix}:${clientKey(req)}`
    let bucket = buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs }
      buckets.set(key, bucket)
    }

    bucket.count += 1
    if (bucket.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)))
      return res.status(429).json({ error: 'Too many requests' })
    }

    return next()
  }
}
