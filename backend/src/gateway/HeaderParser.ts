import type { MethodRateLimitState, RateLimitState } from './types.js'

type LimitPair = {
  value: number
  windowSec: number
  index: number
}

function parsePairs(raw: string | null): LimitPair[] {
  if (!raw) return []
  const out: LimitPair[] = []
  const parts = raw.split(',')
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]?.trim()
    if (!part) continue
    const [left, right] = part.split(':').map((s) => s.trim())
    const value = Number.parseInt(left ?? '', 10)
    const windowSec = Number.parseInt(right ?? '', 10)
    if (!Number.isFinite(value) || !Number.isFinite(windowSec) || windowSec <= 0) continue
    out.push({ value, windowSec, index: i })
  }
  return out
}

function pickLargestWindow(pairs: LimitPair[]): LimitPair | null {
  if (pairs.length === 0) return null
  return pairs.reduce((best, cur) => {
    if (cur.windowSec > best.windowSec) return cur
    return best
  })
}

export function parseRateLimitHeaders(headers: Headers): Partial<RateLimitState> {
  const limits = parsePairs(headers.get('x-app-rate-limit'))
  const counts = parsePairs(headers.get('x-app-rate-limit-count'))
  const bestLimit = pickLargestWindow(limits)
  if (!bestLimit) return {}

  const countByIndex = new Map<number, LimitPair>()
  for (const c of counts) countByIndex.set(c.index, c)
  const aligned = countByIndex.get(bestLimit.index)
  if (!aligned) return {}

  const now = Date.now()
  const windowMs = bestLimit.windowSec * 1_000
  return {
    appLimit: bestLimit.value,
    appCount: aligned.value,
    windowMs,
    lastSyncAt: now,
    windowStartAt: now - windowMs,
  }
}

export function parseMethodLimitHeaders(path: string, headers: Headers): Partial<MethodRateLimitState> {
  const limits = parsePairs(headers.get('x-method-rate-limit'))
  const counts = parsePairs(headers.get('x-method-rate-limit-count'))
  const bestLimit = pickLargestWindow(limits)
  if (!bestLimit) return {}

  const countByIndex = new Map<number, LimitPair>()
  for (const c of counts) countByIndex.set(c.index, c)
  const aligned = countByIndex.get(bestLimit.index)
  if (!aligned) return {}

  return {
    path,
    limit: bestLimit.value,
    count: aligned.value,
    windowMs: bestLimit.windowSec * 1_000,
    lastSyncAt: Date.now(),
  }
}
