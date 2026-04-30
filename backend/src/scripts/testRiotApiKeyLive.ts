import 'dotenv/config'
import { writeSync } from 'node:fs'

type LimitPair = { value: number; windowSec: number }

function logLine(message: string): void {
  writeSync(1, Buffer.from(`${message}\n`, 'utf8'))
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (!raw) return fallback
  const v = raw.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

function parseIntBounded(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function parseLimitPairs(header: string | null): LimitPair[] {
  if (!header?.trim()) return []
  const out: LimitPair[] = []
  for (const part of header.split(',')) {
    const [a, b] = part.trim().split(':')
    const value = Number(a)
    const windowSec = Number(b)
    if (Number.isFinite(value) && Number.isFinite(windowSec) && windowSec > 0) {
      out.push({ value, windowSec })
    }
  }
  return out
}

function getPairForWindow(pairs: LimitPair[], windowSec: number): LimitPair | null {
  return pairs.find((p) => p.windowSec === windowSec) ?? null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main(): Promise<void> {
  const testApiKey = (process.env['api-key-test'] ?? process.env.API_KEY_TEST ?? '').trim()
  if (!testApiKey) {
    throw new Error('Missing env key "api-key-test" (or API_KEY_TEST fallback)')
  }

  const platform = (process.env.RIOT_TEST_PLATFORM ?? 'euw1').trim().toLowerCase()
  const endpointRaw = (process.env.RIOT_TEST_ENDPOINT ?? '/lol/status/v4/platform-data').trim()
  const endpoint = endpointRaw.startsWith('/') ? endpointRaw : `/${endpointRaw}`
  const durationSec = parseIntBounded(process.env.RIOT_TEST_DURATION_SEC, 120, 10, 3600)
  const intervalMs = parseIntBounded(process.env.RIOT_TEST_INTERVAL_MS, 1300, 100, 120_000)
  const maxRequests = parseIntBounded(process.env.RIOT_TEST_MAX_REQUESTS, 0, 0, 50_000)
  const verbose = parseBool(process.env.RIOT_TEST_VERBOSE, true)

  const url = `https://${platform}.api.riotgames.com${endpoint}`
  const startedAt = Date.now()
  const endAt = startedAt + durationSec * 1000

  let totalRequests = 0
  let ok2xx = 0
  let status429 = 0
  let timeoutCount = 0
  const statusCounts = new Map<number, number>()
  let maxApp120CountObserved = 0
  let minApp120RemainingObserved = Number.POSITIVE_INFINITY
  let lastAppRateLimit = ''
  let lastAppRateLimitCount = ''
  let lastMethodRateLimit = ''
  let lastMethodRateLimitCount = ''

  logLine(`[riot-live-test] start platform=${platform} endpoint=${endpoint}`)
  logLine(
    `[riot-live-test] durationSec=${durationSec} intervalMs=${intervalMs} maxRequests=${maxRequests || 'unbounded'}`
  )

  while (Date.now() < endAt && (maxRequests <= 0 || totalRequests < maxRequests)) {
    const loopStart = Date.now()
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'X-Riot-Token': testApiKey },
      })
      totalRequests += 1
      const status = response.status
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1)
      if (status >= 200 && status < 300) ok2xx += 1
      if (status === 429) status429 += 1

      const appRateLimit = response.headers.get('x-app-rate-limit')
      const appRateLimitCount = response.headers.get('x-app-rate-limit-count')
      const methodRateLimit = response.headers.get('x-method-rate-limit')
      const methodRateLimitCount = response.headers.get('x-method-rate-limit-count')
      if (appRateLimit) lastAppRateLimit = appRateLimit
      if (appRateLimitCount) lastAppRateLimitCount = appRateLimitCount
      if (methodRateLimit) lastMethodRateLimit = methodRateLimit
      if (methodRateLimitCount) lastMethodRateLimitCount = methodRateLimitCount

      const appLimit120 = getPairForWindow(parseLimitPairs(appRateLimit), 120)
      const appCount120 = getPairForWindow(parseLimitPairs(appRateLimitCount), 120)
      if (appLimit120 && appCount120) {
        maxApp120CountObserved = Math.max(maxApp120CountObserved, appCount120.value)
        const remaining = appLimit120.value - appCount120.value
        minApp120RemainingObserved = Math.min(minApp120RemainingObserved, remaining)
      }

      const retryAfter = response.headers.get('retry-after')
      if (verbose) {
        logLine(
          `[riot-live-test] #${totalRequests} status=${status} app=${appRateLimitCount ?? 'n/a'} method=${methodRateLimitCount ?? 'n/a'} retryAfter=${retryAfter ?? 'n/a'}`
        )
      }
    } catch (_err) {
      totalRequests += 1
      timeoutCount += 1
      statusCounts.set(-1, (statusCounts.get(-1) ?? 0) + 1)
      if (verbose) logLine(`[riot-live-test] #${totalRequests} status=timeout/network-error`)
    }

    const elapsed = Date.now() - loopStart
    const waitMs = Math.max(0, intervalMs - elapsed)
    if (waitMs > 0) await sleep(waitMs)
  }

  const elapsedMs = Date.now() - startedAt
  const elapsedMin = elapsedMs / 60_000
  const elapsedPer120 = elapsedMs / 120_000
  const avgPerMinute = elapsedMin > 0 ? totalRequests / elapsedMin : 0
  const avgPer120s = elapsedPer120 > 0 ? totalRequests / elapsedPer120 : 0
  const minRemainingText =
    Number.isFinite(minApp120RemainingObserved) && minApp120RemainingObserved !== Number.POSITIVE_INFINITY
      ? String(minApp120RemainingObserved)
      : 'n/a'
  const sortedStatusCounts = Array.from(statusCounts.entries()).sort((a, b) => a[0] - b[0])
  const statusSummary = sortedStatusCounts.map(([code, count]) => `${code}:${count}`).join(' ')

  logLine('[riot-live-test] --- summary ---')
  logLine(`[riot-live-test] elapsedMs=${elapsedMs} requests=${totalRequests} ok2xx=${ok2xx}`)
  logLine(`[riot-live-test] status429=${status429} timeoutOrNetwork=${timeoutCount}`)
  logLine(
    `[riot-live-test] avgPerMinute=${avgPerMinute.toFixed(2)} avgPer120s=${avgPer120s.toFixed(2)}`
  )
  logLine(
    `[riot-live-test] app120 maxCountObserved=${maxApp120CountObserved} minRemainingObserved=${minRemainingText}`
  )
  logLine(`[riot-live-test] lastHeaders appLimit=${lastAppRateLimit || 'n/a'} appCount=${lastAppRateLimitCount || 'n/a'}`)
  logLine(
    `[riot-live-test] lastHeaders methodLimit=${lastMethodRateLimit || 'n/a'} methodCount=${lastMethodRateLimitCount || 'n/a'}`
  )
  logLine(`[riot-live-test] statusDistribution ${statusSummary || 'n/a'}`)
}

void main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  writeSync(2, Buffer.from(`[riot-live-test] fatal: ${msg}\n`, 'utf8'))
  process.exitCode = 1
})
