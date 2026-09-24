/**
 * Sliding-window counter of API responses (total + 5xx per route).
 * Memory is bounded: requests are grouped in 10 s buckets.
 */
import type { HttpWindowStats } from './incidentRules.js'

const BUCKET_MS = 10_000

type Bucket = { total: number; errors: Map<string, number> }

export type HttpErrorTrackerOptions = { windowMs: number; logThrottleMs: number }

export class HttpErrorTracker {
  private readonly buckets = new Map<number, Bucket>()
  private readonly lastLogged = new Map<string, { atMs: number; suppressed: number }>()

  constructor(private readonly opts: HttpErrorTrackerOptions) {}

  /** Records one response; says whether this 5xx should be written to the log. */
  record(route: string, status: number, nowMs: number): { log: boolean; suppressed: number } {
    this.prune(nowMs)
    const key = Math.floor(nowMs / BUCKET_MS) * BUCKET_MS
    const bucket = this.buckets.get(key) ?? { total: 0, errors: new Map<string, number>() }
    bucket.total++
    this.buckets.set(key, bucket)
    if (status < 500) return { log: false, suppressed: 0 }

    bucket.errors.set(route, (bucket.errors.get(route) ?? 0) + 1)
    const throttleKey = `${route} ${status}`
    const prev = this.lastLogged.get(throttleKey)
    if (prev && nowMs - prev.atMs < this.opts.logThrottleMs) {
      prev.suppressed++
      return { log: false, suppressed: 0 }
    }
    this.lastLogged.set(throttleKey, { atMs: nowMs, suppressed: 0 })
    return { log: true, suppressed: prev?.suppressed ?? 0 }
  }

  stats(nowMs: number): HttpWindowStats {
    this.prune(nowMs)
    let total = 0
    const routes = new Map<string, number>()
    for (const b of this.buckets.values()) {
      total += b.total
      for (const [route, count] of b.errors) routes.set(route, (routes.get(route) ?? 0) + count)
    }
    const topRoutes = [...routes.entries()]
      .map(([route, count]) => ({ route, count }))
      .sort((a, b) => b.count - a.count)
    return { total, errors5xx: topRoutes.reduce((a, r) => a + r.count, 0), topRoutes }
  }

  private prune(nowMs: number): void {
    const minKey = nowMs - this.opts.windowMs
    for (const key of this.buckets.keys()) {
      if (key + BUCKET_MS <= minKey) this.buckets.delete(key)
    }
    for (const [key, v] of this.lastLogged) {
      if (nowMs - v.atMs > this.opts.windowMs) this.lastLogged.delete(key)
    }
  }
}
