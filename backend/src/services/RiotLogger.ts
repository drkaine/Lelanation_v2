type RiotHeaderReader = {
  get(name: string): string | null | undefined
}

export type RiotResponseLogInput = {
  status: number
  endpoint: string
  headers?: RiotHeaderReader | Record<string, unknown> | null
}

/**
 * Logs Riot API quota headers in a single, grep-friendly line.
 * Kept lightweight so we can later persist these metrics in DB.
 */
export class RiotLogger {
  logResponse(input: RiotResponseLogInput): void {
    const appCount = this.readHeader(input.headers, 'x-app-rate-limit-count')
    const methodCount = this.readHeader(input.headers, 'x-method-rate-limit-count')
    const statusBucket = input.status >= 400 ? 'ERR' : 'OK'
    const normalizedEndpoint = this.normalizeEndpoint(input.endpoint)
    const appDisplay = this.firstBucketCount(appCount) ?? 'n/a'
    const methodDisplay = this.firstBucketCount(methodCount) ?? 'n/a'

    console.info(
      `[API-STATS] [${statusBucket}] ${normalizedEndpoint} - AppCount: ${appDisplay}/100 - MethodCount: ${methodDisplay}`
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
}

export const riotLogger = new RiotLogger()
