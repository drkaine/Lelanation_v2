/**
 * HTTP client for Riot API: key resolution (env), rate limiting, 429/400 handling.
 */
import { appendUnifiedLog } from '../logging/unifiedAppLog.js'
import { RiotRateLimiter, RIOT_429_MIN_PENALTY_MS } from './RiotRateLimiter.js'
import type { RiotPollerLogger } from '../utils/riotPollerLogger.js'

const RIOT_API_KEY_ENV = 'RIOT_API_KEY'
const RIOT_PUUID_KEY_VERSION_ENV = 'RIOT_PUUID_KEY_VERSION'

function resolvePuuidKeyVersionFromEnv(): string {
  const raw = process.env[RIOT_PUUID_KEY_VERSION_ENV]
  const value = typeof raw === 'string' ? raw.trim() : ''
  return value || 'perso'
}

const PLATFORM_BY_REGION: Record<string, string> = {
  euw1: 'euw1',
  eun1: 'eun1',
}
const REGIONAL_BY_PLATFORM: Record<string, string> = {
  euw1: 'europe',
  eun1: 'europe',
}

function getPlatformBase(platform: string): string {
  return `https://${platform}.api.riotgames.com`
}

function getRegionalBase(platform: string): string {
  const region = REGIONAL_BY_PLATFORM[platform] ?? 'europe'
  return `https://${region}.api.riotgames.com`
}

/** Riot documents these on every response; use to compare with our local throttle. */
const RIOT_RATE_LIMIT_HEADER_KEYS = [
  'x-app-rate-limit',
  'x-app-rate-limit-count',
  'x-method-rate-limit',
  'x-method-rate-limit-count',
  'retry-after',
] as const

function pickRiotRateLimitHeaders(h: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of RIOT_RATE_LIMIT_HEADER_KEYS) {
    const v = h.get(key)
    if (v) out[key] = v
  }
  return out
}

/** Riot format: "100:120,20:1" → limit or current count per window (seconds). */
function parseRiotLimitPairs(raw: string): Array<{ value: number; windowSec: number }> {
  const out: Array<{ value: number; windowSec: number }> = []
  for (const part of raw.split(',')) {
    const seg = part.trim()
    if (!seg) continue
    const [a, b] = seg.split(':').map((s) => s.trim())
    const value = Number(a)
    const windowSec = Number(b)
    if (Number.isFinite(value) && Number.isFinite(windowSec) && windowSec > 0) {
      out.push({ value, windowSec })
    }
  }
  return out
}

const RIOT_WINDOW_2MIN_SEC = 120

export type RiotNearLimit120sInfo = {
  /** Which header family matched (app vs method). */
  scope: 'app' | 'method'
  limit: number
  count: number
  remaining: number
  utilization: number
  windowSec: number
  pairIndex: number
}

/**
 * Among limit/count pairs with a 120s window, pick the one whose usage is closest to the limit
 * (highest count/limit). Aligns pairs by index between *-limit and *-count headers.
 */
export function pickNearestLimit120sBucket(headers: Record<string, string>): RiotNearLimit120sInfo | null {
  const candidates: RiotNearLimit120sInfo[] = []

  const tryScope = (scope: 'app' | 'method', limitKey: string, countKey: string) => {
    const limitRaw = headers[limitKey]
    const countRaw = headers[countKey]
    if (!limitRaw || !countRaw) return
    const limits = parseRiotLimitPairs(limitRaw)
    const counts = parseRiotLimitPairs(countRaw)
    const n = Math.min(limits.length, counts.length)
    for (let i = 0; i < n; i++) {
      const L = limits[i]
      const C = counts[i]
      if (L.windowSec !== RIOT_WINDOW_2MIN_SEC || C.windowSec !== RIOT_WINDOW_2MIN_SEC) continue
      if (L.value <= 0) continue
      const remaining = Math.max(0, L.value - C.value)
      const utilization = C.value / L.value
      candidates.push({
        scope,
        limit: L.value,
        count: C.value,
        remaining,
        utilization,
        windowSec: RIOT_WINDOW_2MIN_SEC,
        pairIndex: i,
      })
    }
  }

  tryScope('app', 'x-app-rate-limit', 'x-app-rate-limit-count')
  tryScope('method', 'x-method-rate-limit', 'x-method-rate-limit-count')

  if (candidates.length === 0) return null
  return candidates.reduce((best, cur) => (cur.utilization > best.utilization ? cur : best))
}

export interface RiotHttpResponse<T = unknown> {
  status: number
  data: T
  headers: Record<string, string>
}

export interface RiotHttpError {
  status: number
  message?: string
  body?: unknown
}

export type RiotKeySource = 'env'

export interface ActiveKeyInfo {
  key: string
  source: RiotKeySource
  clefType: string | null
}

/** Returned on `status: 429` when `shouldAbort` is true — ingest must not write partial rows. */
export const RIOT_INGEST_ABORTED_MESSAGE = 'RIOT_INGEST_ABORTED' as const

export type RiotRequestOptions = {
  retryCount?: number
  /** Retry indefinitely on 429 (after each Retry-After window) until success or `shouldAbort`. */
  infinite429Retry?: boolean
  /** If set, return ok:false with RIOT_INGEST_ABORTED_MESSAGE instead of retrying when true. */
  shouldAbort?: () => boolean
}

/**
 * Resolve API key from env only.
 */
export async function resolveRiotApiKey(): Promise<
  { ok: true; key: string; source: RiotKeySource; clefType: string | null } | { ok: false; error: string }
> {
  const envKey = process.env[RIOT_API_KEY_ENV]?.trim()
  if (envKey) {
    return { ok: true, key: envKey, source: 'env', clefType: resolvePuuidKeyVersionFromEnv() }
  }
  return { ok: false, error: 'No RIOT_API_KEY in env' }
}

const RIOT_RL_SNAPSHOT_LOG_INTERVAL_MS = 120_000

type RiotCountPeak = {
  peak: number
  last: number
  windowSec: number
  pairIndex: number
}

type RiotWindowAggregate = {
  completedWindows: number
  peakSum: number
}

/** Fired once per completed `fetch` (every HTTP round-trip), including 4xx/5xx and 429 before retry. */
export type RiotHttpResponseObserver = (info: {
  bucket: string
  httpStatus: number
  retryAfterSec?: number
}) => void

export class RiotHttpClient {
  private key: string = ''
  private keySource: RiotKeySource = 'env'
  private clefType: string | null = null
  private platform: string = 'euw1'
  private onInvalidKey?: () => void
  /** Optional: poller uses this to count every Riot HTTP response (accurate request totals). */
  private onHttpResponse?: RiotHttpResponseObserver
  /** Throttle unified logs that include Riot rate-limit headers from successful responses. */
  private lastRiotRateLimitSnapshotLogMs = 0
  /** Last observed rate-limit header set (OK responses). */
  private lastRiotRateLimitHeaders: Record<string, string> = {}
  /** Rolling max per header pair until a drop is seen (reset/new window). */
  private appCountPeaks = new Map<string, RiotCountPeak>()
  private methodCountPeaks = new Map<string, RiotCountPeak>()
  /** Peak captured for the previous completed window (when counter drops/resets). */
  private appCountLastCompletedPeaks = new Map<string, RiotCountPeak>()
  private methodCountLastCompletedPeaks = new Map<string, RiotCountPeak>()
  /** Running average of completed-window peaks (by pair index + windowSec). */
  private appCountWindowAverages = new Map<string, RiotWindowAggregate>()
  private methodCountWindowAverages = new Map<string, RiotWindowAggregate>()

  constructor(
    private readonly rateLimiter: RiotRateLimiter,
    private readonly _log: RiotPollerLogger,
    private readonly apiLogScript: string = 'poller'
  ) {}

  /** Count every Riot API HTTP response (200, 429, etc.); each 429 retry is another response. */
  setOnHttpResponse(cb: RiotHttpResponseObserver | undefined): void {
    this.onHttpResponse = cb
  }

  /** Latest rate-limit headers from the last successful Riot response (for poller snapshots). */
  getLastRiotRateLimitHeaders(): Record<string, string> {
    return { ...this.lastRiotRateLimitHeaders }
  }

  getRateLimiterStats() {
    return this.rateLimiter.getStats()
  }

  private updateCountPeaks(
    raw: string | undefined,
    target: Map<string, RiotCountPeak>,
    completedTarget: Map<string, RiotCountPeak>,
    averagesTarget: Map<string, RiotWindowAggregate>
  ): void {
    if (!raw) return
    const pairs = parseRiotLimitPairs(raw)
    for (let i = 0; i < pairs.length; i++) {
      const p = pairs[i]
      const key = `${i}:${p.windowSec}`
      const current = Math.max(0, Math.trunc(p.value))
      const prev = target.get(key)
      if (!prev) {
        target.set(key, { peak: current, last: current, windowSec: p.windowSec, pairIndex: i })
        continue
      }
      // Riot counters are monotonic within a window and drop at reset.
      if (current < prev.last) {
        const avg = averagesTarget.get(key) ?? { completedWindows: 0, peakSum: 0 }
        avg.completedWindows += 1
        avg.peakSum += prev.peak
        averagesTarget.set(key, avg)
        completedTarget.set(key, {
          peak: prev.peak,
          last: prev.last,
          windowSec: prev.windowSec,
          pairIndex: prev.pairIndex,
        })
        target.set(key, { ...prev, peak: current, last: current })
      } else {
        target.set(key, { ...prev, peak: Math.max(prev.peak, current), last: current })
      }
    }
  }

  private formatCountPeaks(
    target: Map<string, RiotCountPeak>,
    completedTarget: Map<string, RiotCountPeak>
  ): string | null {
    const list = Array.from(target.values()).sort((a, b) => a.pairIndex - b.pairIndex)
    if (list.length === 0 && completedTarget.size === 0) return null
    const out: string[] = []
    const keys = new Set<string>([
      ...Array.from(target.keys()),
      ...Array.from(completedTarget.keys()),
    ])
    const sortedKeys = Array.from(keys).sort((a, b) => {
      const [ai, aw] = a.split(':').map(Number)
      const [bi, bw] = b.split(':').map(Number)
      if (ai !== bi) return ai - bi
      return aw - bw
    })
    for (const key of sortedKeys) {
      const current = target.get(key)
      const completed = completedTarget.get(key)
      const best = Math.max(current?.peak ?? 0, completed?.peak ?? 0)
      const windowSec = current?.windowSec ?? completed?.windowSec
      if (!windowSec || best <= 0) continue
      out.push(`${best}:${windowSec}`)
    }
    return out.length > 0 ? out.join(',') : null
  }

  private formatCompletedWindowPeaks(completedTarget: Map<string, RiotCountPeak>): string | null {
    const list = Array.from(completedTarget.values()).sort((a, b) => {
      if (a.pairIndex !== b.pairIndex) return a.pairIndex - b.pairIndex
      return a.windowSec - b.windowSec
    })
    if (list.length === 0) return null
    return list.map((x) => `${x.peak}:${x.windowSec}`).join(',')
  }

  private avgReqPerHourFromCompleted120s(averagesTarget: Map<string, RiotWindowAggregate>): number | null {
    let peakSum = 0
    let windows = 0
    for (const [key, agg] of averagesTarget.entries()) {
      const [, windowSecStr] = key.split(':')
      const windowSec = Number(windowSecStr)
      if (windowSec !== 120) continue
      peakSum += agg.peakSum
      windows += agg.completedWindows
    }
    if (windows <= 0) return null
    const avgPeakPer120s = peakSum / windows
    return Math.round(avgPeakPer120s * (3600 / 120))
  }

  /** Register a callback invoked whenever the API returns 401 or 403 (key invalid/expired). */
  setOnInvalidKey(cb: () => void): void {
    this.onInvalidKey = cb
  }

  setPlatform(platform: string): void {
    this.platform = PLATFORM_BY_REGION[platform] ?? platform
  }

  setKey(key: string, source: RiotKeySource, clefType: string | null): void {
    this.key = key
    this.keySource = source
    this.clefType = clefType
  }

  getActiveKeyInfo(): ActiveKeyInfo | null {
    if (!this.key) return null
    return { key: this.key, source: this.keySource, clefType: this.clefType }
  }

  private async request<T>(
    method: 'GET',
    bucket: string,
    url: string,
    options?: RiotRequestOptions
  ): Promise<{ ok: true; data: T; status: number } | { ok: false; status: number; message?: string; body?: unknown }> {
    // Bail out before queuing in Bottleneck so the poller can shut down
    // without waiting for a penalized reservoir to restore.
    if (options?.shouldAbort?.()) {
      return { ok: false, status: 0, message: RIOT_INGEST_ABORTED_MESSAGE }
    }

    const reqHeaders: Record<string, string> = {
      'X-Riot-Token': this.key,
      'Accept': 'application/json',
    }

    let res: Response
    let text: string
    try {
      const result = await this.rateLimiter.schedule(async () => {
        const r = await fetch(url, { method, headers: reqHeaders })
        const t = await r.text()
        return { r, t }
      })
      res = result.r
      text = result.t
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      void this._log.error('Riot API request failed', msg, url)
      return { ok: false, status: 0, message: msg }
    }

    const retryAfterRaw = Number.parseInt(res.headers.get('Retry-After') ?? '', 10)
    const retryAfterSec = Number.isFinite(retryAfterRaw) ? retryAfterRaw : undefined
    this.onHttpResponse?.({ bucket, httpStatus: res.status, retryAfterSec })

    let data: unknown
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }

    if (res.status === 429) {
      const riotHeaders = pickRiotRateLimitHeaders(res.headers)
      const effectiveRetryAfterSec =
        retryAfterSec != null && Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec : 1
      const effectiveRetryMs =
        Number.isFinite(effectiveRetryAfterSec) && effectiveRetryAfterSec > 0
          ? effectiveRetryAfterSec * 1000
          : RIOT_429_MIN_PENALTY_MS
      void appendUnifiedLog({
        section: 'back',
        type: 'warning',
        script: this.apiLogScript,
        message: 'Riot API HTTP 429',
        json: {
          httpStatus: res.status,
          origin: 'riot_http_response',
          bucket,
          url,
          retryAfterSec: effectiveRetryAfterSec,
          effectiveRetryMs,
          riotRateLimitHeaders: riotHeaders,
        },
      })
      this.rateLimiter.penalize429(effectiveRetryAfterSec)
      if (options?.shouldAbort?.()) {
        return { ok: false, status: 429, message: RIOT_INGEST_ABORTED_MESSAGE, body: data }
      }
      const retryCount = options?.retryCount ?? 0
      const infinite = options?.infinite429Retry === true
      if (infinite || retryCount < 5) {
        return this.request<T>(method, bucket, url, { ...options, retryCount: retryCount + 1 })
      }
      return { ok: false, status: 429, message: 'Rate limit exceeded (max retries)', body: data }
    }

    if (res.status === 401) {
      this.onInvalidKey?.()
      return { ok: false, status: res.status, message: 'Invalid or expired API key', body: data }
    }
    if (res.status >= 400) {
      const msg = typeof (data as { status?: { message?: string } })?.status?.message === 'string'
        ? (data as { status: { message: string } }).status.message
        : undefined
      return { ok: false, status: res.status, message: msg, body: data }
    }

    this.rateLimiter.syncFromResponseHeaders(res.headers)

    const riotHeaders = pickRiotRateLimitHeaders(res.headers)
    if (Object.keys(riotHeaders).length > 0) {
      this.lastRiotRateLimitHeaders = riotHeaders
      this.updateCountPeaks(
        riotHeaders['x-app-rate-limit-count'],
        this.appCountPeaks,
        this.appCountLastCompletedPeaks,
        this.appCountWindowAverages
      )
      this.updateCountPeaks(
        riotHeaders['x-method-rate-limit-count'],
        this.methodCountPeaks,
        this.methodCountLastCompletedPeaks,
        this.methodCountWindowAverages
      )
    }

    const now = Date.now()
    if (now - this.lastRiotRateLimitSnapshotLogMs >= RIOT_RL_SNAPSHOT_LOG_INTERVAL_MS) {
      this.lastRiotRateLimitSnapshotLogMs = now
      if (Object.keys(this.lastRiotRateLimitHeaders).length > 0) {
        const near120 = pickNearestLimit120sBucket(this.lastRiotRateLimitHeaders)
        const pctUsed = near120 != null ? Math.round(near120.utilization * 1000) / 10 : null
        const appCountPeakHeader = this.formatCountPeaks(
          this.appCountPeaks,
          this.appCountLastCompletedPeaks
        )
        const methodCountPeakHeader = this.formatCountPeaks(
          this.methodCountPeaks,
          this.methodCountLastCompletedPeaks
        )
        const appCountCompletedWindowPeaks = this.formatCompletedWindowPeaks(
          this.appCountLastCompletedPeaks
        )
        const methodCountCompletedWindowPeaks = this.formatCompletedWindowPeaks(
          this.methodCountLastCompletedPeaks
        )
        const appAvgReqPerHourFromCompleted120s = this.avgReqPerHourFromCompleted120s(
          this.appCountWindowAverages
        )
        const message =
          near120 != null
            ? `Riot rate-limit 120s (bucket le plus proche de la limite) — ${near120.scope}: ${near120.count}/${near120.limit} utilisés, ${near120.remaining} restants (${pctUsed}% de la fenêtre) | currentPeaks app=${appCountPeakHeader ?? 'n/a'} method=${methodCountPeakHeader ?? 'n/a'} | completedWindowPeaks app=${appCountCompletedWindowPeaks ?? 'n/a'} method=${methodCountCompletedWindowPeaks ?? 'n/a'} | avgReqPerHour(app120s)=${appAvgReqPerHourFromCompleted120s ?? 'n/a'}`
            : `Riot rate-limit headers (dernière réponse OK) — pas de paire 120s dans les en-têtes | currentPeaks app=${appCountPeakHeader ?? 'n/a'} method=${methodCountPeakHeader ?? 'n/a'} | completedWindowPeaks app=${appCountCompletedWindowPeaks ?? 'n/a'} method=${methodCountCompletedWindowPeaks ?? 'n/a'} | avgReqPerHour(app120s)=${appAvgReqPerHourFromCompleted120s ?? 'n/a'}`
        void appendUnifiedLog({
          section: 'back',
          type: 'rate_limit',
          script: this.apiLogScript,
          message,
          json: {
            httpStatus: res.status,
            bucket,
            nearLimit120s: near120,
            rateLimitCountPeaks: {
              app: appCountPeakHeader,
              method: methodCountPeakHeader,
            },
            rateLimitCountCompletedWindowPeaks: {
              app: appCountCompletedWindowPeaks,
              method: methodCountCompletedWindowPeaks,
            },
            appAvgReqPerHourFromCompleted120s,
            riotRateLimitHeaders: { ...this.lastRiotRateLimitHeaders },
          },
        })
      }
    }

    return { ok: true, data: data as T, status: res.status }
  }

  async getPlatformData(): Promise<
    { ok: true; data: unknown } | { ok: false; status: number; message?: string; body?: unknown }
  > {
    const url = `${getPlatformBase(this.platform)}/lol/status/v4/platform-data`
    return this.request('GET', 'lol-status-v4-platform', url)
  }

  async getMatchIdsByPuuid(
    puuid: string,
    query: { queue?: number; count?: number; start?: number; startTime?: number; endTime?: number },
    reqOpts?: RiotRequestOptions
  ): Promise<
    { ok: true; data: string[] } | { ok: false; status: number; message?: string; body?: unknown }
  > {
    const params = new URLSearchParams()
    if (query.queue != null) params.set('queue', String(query.queue))
    if (query.count != null) params.set('count', String(query.count))
    if (query.start != null) params.set('start', String(query.start))
    if (query.startTime != null) params.set('startTime', String(query.startTime))
    if (query.endTime != null) params.set('endTime', String(query.endTime))
    const qs = params.toString()
    const url = `${getRegionalBase(this.platform)}/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids${qs ? `?${qs}` : ''}`
    return this.request<string[]>('GET', 'match-v5-ids', url, reqOpts)
  }

  async getMatch(
    matchId: string,
    reqOpts?: RiotRequestOptions
  ): Promise<
    { ok: true; data: RiotMatchDto } | { ok: false; status: number; message?: string; body?: unknown }
  > {
    const url = `${getRegionalBase(this.platform)}/lol/match/v5/matches/${encodeURIComponent(matchId)}`
    return this.request<RiotMatchDto>('GET', 'match-v5-detail', url, reqOpts)
  }

  async getMatchTimeline(
    matchId: string,
    reqOpts?: RiotRequestOptions
  ): Promise<
    { ok: true; data: RiotMatchTimelineDto } | { ok: false; status: number; message?: string; body?: unknown }
  > {
    const url = `${getRegionalBase(this.platform)}/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`
    return this.request<RiotMatchTimelineDto>('GET', 'match-v5-timeline', url, reqOpts)
  }

  async getAccountByRiotId(
    gameName: string,
    tagLine: string,
    region: 'europe' = 'europe'
  ): Promise<
    { ok: true; data: RiotAccountDto } | { ok: false; status: number; message?: string; body?: unknown }
  > {
    const base = region === 'europe' ? getRegionalBase(this.platform) : getPlatformBase(this.platform)
    const url = `${base}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    return this.request<RiotAccountDto>('GET', 'account-v1-by-riot-id', url)
  }

  async getAccountByPuuid(puuid: string): Promise<
    { ok: true; data: RiotAccountDto } | { ok: false; status: number; message?: string; body?: unknown }
  > {
    const url = `${getRegionalBase(this.platform)}/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`
    return this.request<RiotAccountDto>('GET', 'account-v1-by-puuid', url)
  }

  /** Summoner v4: get summoner by puuid (returns encrypted summoner id for League v4). */
  async getSummonerByPuuid(puuid: string): Promise<
    { ok: true; data: RiotSummonerDto } | { ok: false; status: number; message?: string; body?: unknown }
  > {
    const url = `${getPlatformBase(this.platform)}/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`
    return this.request<RiotSummonerDto>('GET', 'summoner-v4-by-puuid', url)
  }

  /** League v4: entries by encrypted summoner id (not puuid). */
  async getLeagueEntriesBySummonerId(encryptedSummonerId: string): Promise<
    { ok: true; data: RiotLeagueEntryDto[] } | { ok: false; status: number; message?: string; body?: unknown }
  > {
    const url = `${getPlatformBase(this.platform)}/lol/league/v4/entries/by-summoner/${encodeURIComponent(encryptedSummonerId)}`
    return this.request<RiotLeagueEntryDto[]>('GET', 'league-v4-entries-by-summoner', url)
  }

  /**
   * League v4: entries by PUUID.
   * Uses platform host: `{platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/{encryptedPUUID}`.
   */
  async getLeagueEntriesByPuuid(
    puuid: string,
    reqOpts?: RiotRequestOptions
  ): Promise<
    { ok: true; data: RiotLeagueEntryDto[] } | { ok: false; status: number; message?: string; body?: unknown }
  > {
    // League-v4 routes on platform host (euw1/eun1), not regional host (europe).
    const url = `${getPlatformBase(this.platform)}/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`
    return this.request<RiotLeagueEntryDto[]>('GET', 'league-v4-entries-by-puuid', url, reqOpts)
  }

  /**
   * League v4: entries by PUUID on an explicit platform host (no mutable client platform switch).
   */
  async getLeagueEntriesByPuuidOnPlatform(
    puuid: string,
    platform: string,
    reqOpts?: RiotRequestOptions
  ): Promise<
    { ok: true; data: RiotLeagueEntryDto[] } | { ok: false; status: number; message?: string; body?: unknown }
  > {
    const normalizedPlatform = PLATFORM_BY_REGION[platform] ?? platform
    const url = `${getPlatformBase(normalizedPlatform)}/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`
    return this.request<RiotLeagueEntryDto[]>('GET', 'league-v4-entries-by-puuid', url, reqOpts)
  }

  /**
   * League v4: paginated list of all league entries for a given queue, tier, and division.
   * Useful for discovering new players at a specific Elo bracket.
   * GET /lol/league/v4/entries/{queue}/{tier}/{division}?page={page}
   */
  async getLeagueEntries(queue: string, tier: string, division: string, page = 1): Promise<
    { ok: true; data: RiotLeagueEntryDto[] } | { ok: false; status: number; message?: string; body?: unknown }
  > {
    const url = `${getPlatformBase(this.platform)}/lol/league/v4/entries/${encodeURIComponent(queue)}/${encodeURIComponent(tier)}/${encodeURIComponent(division)}?page=${page}`
    return this.request<RiotLeagueEntryDto[]>('GET', 'league-v4-entries', url)
  }
}

export interface RiotAccountDto {
  puuid: string
  gameName?: string
  tagLine?: string
  // Some deployments/proxies may enrich this endpoint with ranked info.
  // We keep these optional + loosely typed to avoid coupling to one exact schema.
  tier?: string
  rankTier?: string
  division?: string
  rankDivision?: string
  leaguePoints?: number
  lp?: number
  // Allow extra fields without TypeScript friction.
  [key: string]: unknown
}

export interface RiotSummonerDto {
  id: string
  puuid: string
  accountId?: string
  summonerLevel?: number
}

export interface RiotLeagueEntryDto {
  leagueId?: string
  queueType: string
  tier: string
  rank: string
  summonerId?: string
  puuid?: string
  leaguePoints?: number
  wins?: number
  losses?: number
  veteran?: boolean
  inactive?: boolean
  freshBlood?: boolean
  hotStreak?: boolean
}

export interface RiotMatchDto {
  metadata?: { matchId: string }
  info?: {
    gameId?: number
    gameCreation?: number
    gameDuration?: number
    gameVersion?: string
    queueId?: number
    endOfGameResult?: string
    participants?: RiotParticipantDto[]
    teams?: Array<{
      teamId?: number
      win?: boolean
      bans?: Array<{ championId?: number }>
      objectives?: Record<string, { first?: boolean; kills?: number }>
    }>
  }
}

export interface RiotMatchTimelineDto {
  info?: {
    frameInterval?: number
    frames?: RiotTimelineFrameDto[]
  }
}

export interface RiotTimelineFrameDto {
  timestamp: number
  participantFrames: Record<string, RiotParticipantFrameDto>
  events?: RiotTimelineEventDto[]
}

export interface RiotParticipantFrameDto {
  participantId: number
  jungleMinionsKilled?: number
  [key: string]: unknown
}

/** Union of all timeline event shapes we care about. */
export type RiotTimelineEventDto =
  | RiotTimelineEventEliteMonsterKill
  | RiotTimelineEventDragonSoulGiven
  | RiotTimelineEventSkillLevelUp
  | RiotTimelineEventItemPurchased
  | { type: string; [key: string]: unknown }

export interface RiotTimelineEventEliteMonsterKill {
  type: 'ELITE_MONSTER_KILL'
  timestamp: number
  killerId: number
  killerTeamId?: number // team that got the kill (100/200)
  monsterType: string   // "DRAGON", "BARON_NASHOR", etc.
  monsterSubType?: string // "FIRE_DRAGON", "WATER_DRAGON", "ELDER_DRAGON", etc.
}

export interface RiotTimelineEventDragonSoulGiven {
  type: 'DRAGON_SOUL_GIVEN'
  timestamp: number
  name: string    // soul name, e.g. "Infernal"
  teamId: number  // 100 or 200
}

export interface RiotTimelineEventSkillLevelUp {
  type: 'SKILL_LEVEL_UP'
  timestamp: number
  participantId: number
  skillSlot: number  // 1=Q, 2=W, 3=E, 4=R
  levelUpType: string
}

export interface RiotTimelineEventItemPurchased {
  type: 'ITEM_PURCHASED'
  timestamp: number
  participantId: number
  itemId: number
}

export interface RiotParticipantDto {
  puuid?: string
  championId?: number
  teamId?: number
  win?: boolean
  individualPosition?: string
  teamPosition?: string
  kills?: number
  deaths?: number
  assists?: number
  champLevel?: number
  goldEarned?: number
  totalDamageDealtToChampions?: number
  totalMinionsKilled?: number
  visionScore?: number
  [key: string]: unknown
}
