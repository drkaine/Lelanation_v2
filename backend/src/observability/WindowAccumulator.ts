import type { WindowSnapshot } from './types.js'

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export class WindowAccumulator {
  private windowMs = 120_000
  private windowStart = Date.now()
  private requestsSent = 0
  private count429 = 0
  private headerSyncs = 0
  private queueDepthSamples: number[] = []
  private headroomSamples: number[] = []
  private lastKnownLimit = 100
  private readonly requestsTarget = 96

  onRequest(windowCount: number, windowLimit: number): void {
    this.requestsSent += 1
    this.lastKnownLimit = windowLimit
    this.headroomSamples.push(windowLimit - windowCount)
  }

  on429(): void {
    this.count429 += 1
  }

  onHeaderSync(windowMs?: number): void {
    this.headerSyncs += 1
    if (windowMs && Number.isFinite(windowMs) && windowMs > 0) {
      this.windowMs = Math.trunc(windowMs)
    }
  }

  onQueueDepth(depth: number): void {
    this.queueDepthSamples.push(depth)
  }

  maybeRollover(now = Date.now()): WindowSnapshot | null {
    if (now - this.windowStart < this.windowMs) return null
    const completed = this.snapshot()
    this.reset(now)
    return completed
  }

  snapshot(now = Date.now()): WindowSnapshot {
    const minHeadroom =
      this.headroomSamples.length > 0
        ? Math.min(...this.headroomSamples)
        : Math.max(0, this.lastKnownLimit - this.requestsSent)

    return {
      ts: now,
      windowStart: this.windowStart,
      windowEnd: this.windowStart + this.windowMs,
      requestsSent: this.requestsSent,
      requestsTarget: this.requestsTarget,
      requestsLimit: this.lastKnownLimit,
      count429: this.count429,
      headerSyncs: this.headerSyncs,
      avgQueueDepth: avg(this.queueDepthSamples),
      headroomMin: minHeadroom,
    }
  }

  private reset(now: number): void {
    this.windowStart = now
    this.requestsSent = 0
    this.count429 = 0
    this.headerSyncs = 0
    this.queueDepthSamples = []
    this.headroomSamples = []
  }
}
