/**
 * Riot API throttle driven by response headers + HTTP 429.
 * - No local request counting: we send at full speed and read `X-App-Rate-Limit-Count` /
 *   `X-Method-Rate-Limit-Count` vs the matching limit headers.
 * - When the 120s application bucket reports ≥99 uses (e.g. 99/100), pause 2 minutes before more calls.
 * - On HTTP 429: block at least 10s, or longer if Riot sends Retry-After (whichever is greater).
 */
/** Pause when a 120s bucket count reaches this usage (Riot app limit is typically 100/120s). */
export const RIOT_HEADER_APP_120S_NEAR_LIMIT = 99
/** Cooldown after hitting near-limit on the 120s bucket (ms). */
export const RIOT_HEADER_NEAR_LIMIT_COOLDOWN_MS = 120_000
/** Minimum pause after a real HTTP 429 from Riot (may extend via `penalize429(retryAfterSec)`). */
export const RIOT_429_MIN_PENALTY_MS = 10_000

const PENALTY_429_MS = RIOT_429_MIN_PENALTY_MS

/** Parse Riot header like `20:1,100:120` → Map<windowSeconds, limitOrCount> */
function parseRiotLimitPairs(header: string | null): Map<number, number> {
  const m = new Map<number, number>()
  if (!header?.trim()) return m
  for (const part of header.split(',')) {
    const [a, b] = part.trim().split(':')
    const v = Number(a)
    const w = Number(b)
    if (Number.isFinite(v) && Number.isFinite(w) && w > 0) m.set(w, v)
  }
  return m
}

function applyNearLimitFromBuckets(
  limitByWin: Map<number, number>,
  countByWin: Map<number, number>,
  setPenalty: (ms: number) => void
): void {
  for (const [winSec, used] of countByWin) {
    if (winSec !== 120) continue
    const lim = limitByWin.get(winSec)
    if (lim == null || lim <= 0) continue
    if (used >= RIOT_HEADER_APP_120S_NEAR_LIMIT) {
      setPenalty(RIOT_HEADER_NEAR_LIMIT_COOLDOWN_MS)
      return
    }
  }
}

export class RiotRateLimiter {
  private readonly penalty429Ms: number
  private penaltyUntil = 0
  private chain: Promise<void> = Promise.resolve()
  private nearLimitPauseCount = 0
  private http429PauseCount = 0

  constructor() {
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
    const nextPenaltyUntil = Date.now() + ms
    if (nextPenaltyUntil > this.penaltyUntil) {
      this.http429PauseCount += 1
      this.penaltyUntil = nextPenaltyUntil
    }
  }

  /**
   * @deprecated Prefer penalize429(). Kept for callers that pass a custom duration.
   */
  penalize(durationMs: number): void {
    this.penaltyUntil = Math.max(this.penaltyUntil, Date.now() + durationMs)
  }

  /**
   * Read Riot rate-limit headers on successful responses. If the 120s bucket is at ≥99 uses,
   * enqueue a 2-minute cooldown (matches manual “wait before 429” behaviour).
   */
  syncFromResponseHeaders(headers: { get(name: string): string | null }): void {
    const appLimit = headers.get('x-app-rate-limit')
    const appCount = headers.get('x-app-rate-limit-count')
    if (appLimit && appCount) {
      applyNearLimitFromBuckets(parseRiotLimitPairs(appLimit), parseRiotLimitPairs(appCount), (ms) => {
        const nextPenaltyUntil = Date.now() + ms
        if (nextPenaltyUntil > this.penaltyUntil) {
          this.nearLimitPauseCount += 1
          this.penaltyUntil = nextPenaltyUntil
        }
      })
    }
    const methodLimit = headers.get('x-method-rate-limit')
    const methodCount = headers.get('x-method-rate-limit-count')
    if (methodLimit && methodCount) {
      applyNearLimitFromBuckets(parseRiotLimitPairs(methodLimit), parseRiotLimitPairs(methodCount), (ms) => {
        const nextPenaltyUntil = Date.now() + ms
        if (nextPenaltyUntil > this.penaltyUntil) {
          this.nearLimitPauseCount += 1
          this.penaltyUntil = nextPenaltyUntil
        }
      })
    }
  }

  getStats(): { nearLimitPauseCount: number; http429PauseCount: number } {
    return {
      nearLimitPauseCount: this.nearLimitPauseCount,
      http429PauseCount: this.http429PauseCount,
    }
  }

  /**
   * Wait until any penalty (429 or header-driven cooldown) expires, then proceed.
   * Bucket name is ignored (single global gate).
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
        break
      }
    } finally {
      release()
    }
  }
}
