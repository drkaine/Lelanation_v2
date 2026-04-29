type RiotHeaderReader = {
  get(name: string): string | null | undefined
}

export type RiotResponseLogInput = {
  status: number
  endpoint: string
  headers?: RiotHeaderReader | Record<string, unknown> | null
}

type LimitPair = { value: number; windowSec: number }

function parseLimitPairs(raw: string | null): LimitPair[] {
  if (!raw?.trim()) return []
  const out: LimitPair[] = []
  for (const part of raw.split(',')) {
    const [a, b] = part.trim().split(':')
    const value = Number(a)
    const windowSec = Number(b)
    if (Number.isFinite(value) && Number.isFinite(windowSec) && windowSec > 0) {
      out.push({ value, windowSec })
    }
  }
  return out
}

function pickUsedLimit(
  limits: LimitPair[],
  counts: LimitPair[],
  windowSec: number
): { used: number; lim: number } | null {
  const lim = limits.find((p) => p.windowSec === windowSec)?.value
  const used = counts.find((p) => p.windowSec === windowSec)?.value
  if (
    lim === undefined ||
    used === undefined ||
    !Number.isFinite(lim) ||
    lim <= 0 ||
    !Number.isFinite(used)
  ) {
    return null
  }
  return { used, lim }
}

/**
 * Logs Riot API quota headers in a single, grep-friendly line.
 * Kept lightweight so we can later persist these metrics in DB.
 */
export class RiotLogger {
  logResponse(input: RiotResponseLogInput): void {
    const appLimit = this.readHeader(input.headers, 'x-app-rate-limit')
    const appCount = this.readHeader(input.headers, 'x-app-rate-limit-count')
    const methodLimit = this.readHeader(input.headers, 'x-method-rate-limit')
    const methodCount = this.readHeader(input.headers, 'x-method-rate-limit-count')
    const statusBucket = input.status >= 400 ? 'ERR' : 'OK'
    const normalizedEndpoint = this.normalizeEndpoint(input.endpoint)
    const appDisplay = this.formatAppRateLine(appLimit, appCount)
    const methodDisplay = this.formatMethodRateLine(methodLimit, methodCount)

    console.info(
      `[API-STATS] [${statusBucket}] ${normalizedEndpoint} - AppRate: ${appDisplay} | MethodRate: ${methodDisplay}`
    )
  }

  private normalizeEndpoint(endpoint: string): string {
    if (!endpoint) return '/'
    try {
      if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
        const url = new URL(endpoint)
        return `${url.pathname}${url.search}`
      }
    } catch {
      return endpoint
    }
    return endpoint
  }

  private readHeader(
    headers: RiotResponseLogInput['headers'],
    name: string
  ): string | null {
    if (!headers) return null
    const key = name.toLowerCase()
    if (typeof (headers as RiotHeaderReader).get === 'function') {
      return (headers as RiotHeaderReader).get(name) ?? null
    }
    const dict = headers as Record<string, unknown>
    const direct = dict[key] ?? dict[name] ?? null
    return typeof direct === 'string' ? direct : null
  }

  private firstBucketCount(raw: string | null): string | null {
    if (!raw) return null
    const first = raw.split(',')[0]?.trim()
    if (!first) return null
    const count = first.split(':')[0]?.trim()
    return count || null
  }

  /** Prefer explicit 1s + 120s app buckets (Riot order varies by route). */
  private formatAppRateLine(rawLimit: string | null, rawCount: string | null): string {
    const limits = parseLimitPairs(rawLimit)
    const counts = parseLimitPairs(rawCount)
    const b1 = pickUsedLimit(limits, counts, 1)
    const b120 = pickUsedLimit(limits, counts, 120)
    const parts: string[] = []
    if (b1) parts.push(`${b1.used}/${b1.lim}@1s`)
    if (b120) parts.push(`${b120.used}/${b120.lim}@120s`)
    if (parts.length > 0) return parts.join(' ')
    const fallback = this.firstBucketCount(rawCount)
    return fallback != null ? `${fallback}/?` : 'n/a'
  }

  private formatMethodRateLine(rawLimit: string | null, rawCount: string | null): string {
    const limits = parseLimitPairs(rawLimit)
    const counts = parseLimitPairs(rawCount)
    const b1 = pickUsedLimit(limits, counts, 1)
    const b10 = pickUsedLimit(limits, counts, 10)
    const b120 = pickUsedLimit(limits, counts, 120)
    const parts: string[] = []
    if (b1) parts.push(`${b1.used}/${b1.lim}@1s`)
    if (b10) parts.push(`${b10.used}/${b10.lim}@10s`)
    if (b120) parts.push(`${b120.used}/${b120.lim}@120s`)
    if (parts.length > 0) return parts.join(' ')
    return this.firstBucketCount(rawCount) ?? 'n/a'
  }
}

export const riotLogger = new RiotLogger()
