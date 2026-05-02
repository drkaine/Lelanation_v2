import Bottleneck from 'bottleneck'
import { riotLogger } from './RiotLogger.js'

const RIOT_API_KEY_ENV = 'RIOT_API_KEY'
const RIOT_PUUID_KEY_VERSION_ENV = 'RIOT_PUUID_KEY_VERSION'
// Keep a safer headroom under Riot app cap (100/120s) to reduce recurring 429.
const RIOT_TARGET_REQUESTS_PER_WINDOW = 90
const RIOT_WINDOW_MS = 125_000
const RIOT_429_BUFFER_MS = 2_500

const PLATFORM_BY_REGION: Record<string, string> = {
  euw1: 'euw1',
  eun1: 'eun1',
}
const REGIONAL_BY_PLATFORM: Record<string, string> = {
  euw1: 'europe',
  eun1: 'europe',
}

export type RiotGatewayMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface RiotGatewayResponse<T = unknown> {
  status: number
  data: T
  headers: Record<string, string>
}

export interface RiotGatewayError extends Error {
  status: number
  body?: unknown
  headers?: Record<string, string>
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizePlatform(value: string): string {
  return PLATFORM_BY_REGION[value] ?? value
}

function parseHeaderValue(value: unknown): string | undefined {
  if (Array.isArray(value) && value.length > 0) return String(value[0])
  if (typeof value === 'string') return value
  if (value == null) return undefined
  return String(value)
}

function extractRetryAfterMs(headers: Record<string, unknown>): number {
  const retryRaw = parseHeaderValue(headers['retry-after'])
  const sec = Number.parseInt(retryRaw ?? '', 10)
  if (!Number.isFinite(sec) || sec <= 0) return 1_000
  return Math.max(1_000, sec * 1_000)
}

function normalizeHeadersFromResponse(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of headers.entries()) {
    out[k.toLowerCase()] = v
  }
  return out
}

function appendQueryParams(endpoint: string, params?: Record<string, unknown>): string {
  if (!params) return endpoint
  const entries = Object.entries(params).filter(([, v]) => v != null)
  if (entries.length === 0) return endpoint
  const url = new URL(endpoint)
  for (const [k, v] of entries) {
    url.searchParams.set(k, String(v))
  }
  return url.toString()
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }
  return text
}

class RiotGateway {
  private platform = 'euw1'
  private limiter = this.createLimiter()
  private pausedUntil = 0

  private createLimiter(): Bottleneck {
    // Drip one token at a time to smooth traffic and keep us under Riot app caps.
    const dripMs = Math.max(1, Math.floor(RIOT_WINDOW_MS / RIOT_TARGET_REQUESTS_PER_WINDOW))
    return new Bottleneck({
      reservoir: 1,
      reservoirIncreaseAmount: 1,
      reservoirIncreaseInterval: dripMs,
      reservoirIncreaseMaximum: RIOT_TARGET_REQUESTS_PER_WINDOW,
      minTime: 110,
      maxConcurrent: 8,
    })
  }

  private resolveApiKey(): string {
    const key = process.env[RIOT_API_KEY_ENV]?.trim()
    if (!key) throw this.asError(500, 'No RIOT_API_KEY in env')
    return key
  }

  setPlatform(platform: string): void {
    this.platform = normalizePlatform(platform)
  }

  getPlatform(): string {
    return this.platform
  }

  getActiveKeyInfo(): { source: 'env'; clefType: string | null } {
    const clefType = (process.env[RIOT_PUUID_KEY_VERSION_ENV] ?? '').trim() || 'perso'
    return { source: 'env', clefType }
  }

  getPlatformBase(platform = this.platform): string {
    return `https://${normalizePlatform(platform)}.api.riotgames.com`
  }

  getRegionalBase(platform = this.platform): string {
    const normalizedPlatform = normalizePlatform(platform)
    const region = REGIONAL_BY_PLATFORM[normalizedPlatform] ?? 'europe'
    return `https://${region}.api.riotgames.com`
  }

  private async waitForPauseIfNeeded(): Promise<void> {
    const wait = this.pausedUntil - Date.now()
    if (wait > 0) await sleep(wait)
  }

  private pauseLimiterForRetryAfter(retryAfterMs: number): void {
    const nextPauseUntil = Date.now() + retryAfterMs + RIOT_429_BUFFER_MS
    if (nextPauseUntil <= this.pausedUntil) return

    this.pausedUntil = nextPauseUntil
  }

  private asError(
    status: number,
    message: string,
    body?: unknown,
    headers?: Record<string, string>
  ): RiotGatewayError {
    const err = new Error(message) as RiotGatewayError
    err.status = status
    err.body = body
    err.headers = headers
    return err
  }

  async call<T = unknown>(
    method: RiotGatewayMethod,
    endpoint: string,
    params?: Record<string, unknown>
  ): Promise<RiotGatewayResponse<T>> {
    const execute = async (): Promise<RiotGatewayResponse<T>> => {
      await this.waitForPauseIfNeeded()

      const requestEndpoint = method === 'GET' ? appendQueryParams(endpoint, params) : endpoint
      const reqHeaders: Record<string, string> = {
          'X-Riot-Token': this.resolveApiKey(),
          Accept: 'application/json',
      }
      if (method !== 'GET') {
        reqHeaders['Content-Type'] = 'application/json'
      }

      try {
        const response = await fetch(requestEndpoint, {
          method,
          headers: reqHeaders,
          ...(method !== 'GET' && params ? { body: JSON.stringify(params) } : {}),
        })
        const normalizedHeaders = normalizeHeadersFromResponse(response.headers)
        const body = await readResponseBody(response)

        riotLogger.logResponse({
          status: response.status,
          endpoint: requestEndpoint,
          headers: normalizedHeaders,
        })

        if (response.status >= 400) {
          if (response.status === 429) {
            const retryAfterMs = extractRetryAfterMs(normalizedHeaders)
            this.pauseLimiterForRetryAfter(retryAfterMs)
          }

          const message =
            typeof (body as { status?: { message?: string } })?.status?.message === 'string'
              ? ((body as { status: { message: string } }).status.message ?? `HTTP ${response.status}`)
              : `HTTP ${response.status}`

          throw this.asError(response.status, message, body, normalizedHeaders)
        }

        return {
          status: response.status,
          data: body as T,
          headers: normalizedHeaders,
        }
      } catch (error) {
        if ((error as RiotGatewayError)?.status != null) throw error
        const message = error instanceof Error ? error.message : String(error)
        riotLogger.logResponse({ status: 0, endpoint: requestEndpoint, headers: null })
        throw this.asError(0, message)
      }
    }

    await this.waitForPauseIfNeeded()
    const limiterForThisCall = this.limiter
    try {
      return await limiterForThisCall.schedule(() => execute())
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('cannot accept new jobs') || message.includes('This limiter has been stopped')) {
        await this.waitForPauseIfNeeded()
        return this.limiter.schedule(() => execute())
      }
      throw err
    }
  }

  async getMatch(matchId: string): Promise<RiotGatewayResponse<unknown>> {
    return this.call('GET', `${this.getRegionalBase()}/lol/match/v5/matches/${encodeURIComponent(matchId)}`)
  }

  async getMatchList(
    puuid: string,
    params?: { queue?: number; count?: number; start?: number; startTime?: number; endTime?: number }
  ): Promise<RiotGatewayResponse<unknown>> {
    return this.call(
      'GET',
      `${this.getRegionalBase()}/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids`,
      params as Record<string, unknown> | undefined
    )
  }

  async getPlayerRank(summonerId: string): Promise<RiotGatewayResponse<unknown>> {
    return this.call(
      'GET',
      `${this.getPlatformBase()}/lol/league/v4/entries/by-summoner/${encodeURIComponent(summonerId)}`
    )
  }
}

export const riotGateway = new RiotGateway()
