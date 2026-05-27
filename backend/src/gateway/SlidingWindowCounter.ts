import type { RateLimitState } from './types.js'

const HEADER_SYNC_STALE_MS = 5_000
const RESYNC_DIFF_THRESHOLD = 2

export class SlidingWindowCounter {
  private readonly timestamps: number[] = []
  private lastTarget = Number.POSITIVE_INFINITY
  private lastSyncAt = 0

  constructor(private readonly windowMs: number) {}

  add(now = Date.now()): void {
    this.purge(now)
    this.timestamps.push(now)
  }

  count(now = Date.now()): number {
    this.purge(now)
    return this.timestamps.length
  }

  canSend(target: number): boolean {
    this.lastTarget = target
    return this.count() < target
  }

  syncFromHeaders(state: RateLimitState): void {
    const now = Date.now()
    if (now - state.lastSyncAt > HEADER_SYNC_STALE_MS) return

    const local = this.count(now)
    if (Math.abs(local - state.appCount) <= RESYNC_DIFF_THRESHOLD) {
      this.lastSyncAt = state.lastSyncAt
      return
    }

    this.timestamps.length = 0
    if (state.appCount <= 0) {
      this.lastSyncAt = state.lastSyncAt
      return
    }

    const start = now - this.windowMs
    const step = this.windowMs / Math.max(1, state.appCount)
    for (let i = 0; i < state.appCount; i++) {
      this.timestamps.push(start + (i * step))
    }
    this.lastSyncAt = state.lastSyncAt
    this.purge(now)
  }

  nextSlotMs(): number {
    if (this.canSend(this.lastTarget)) return 0
    const now = Date.now()
    const oldest = this.timestamps[0]
    if (oldest == null) return 0
    return Math.max(0, Math.ceil((oldest + this.windowMs) - now))
  }

  getLastSyncAt(): number {
    return this.lastSyncAt
  }

  private purge(now = Date.now()): void {
    const minTs = now - this.windowMs
    while (this.timestamps.length > 0 && this.timestamps[0]! <= minTs) {
      this.timestamps.shift()
    }
  }
}
