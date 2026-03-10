/**
 * HTTP client for Riot API: key resolution (env then file), rate limiting, 429/400 handling.
 */
import { join } from 'path'
import { FileManager } from '../utils/fileManager.js'
import { RiotRateLimiter } from './RiotRateLimiter.js'
import type { RiotPollerLogger } from '../utils/riotPollerLogger.js'

const RIOT_API_KEY_ENV = 'RIOT_API_KEY'
const RIOT_APIKEY_FILE = join(process.cwd(), 'data', 'admin', 'riot-apikey.json')

interface RiotApiKeyFile {
  riotApiKey?: string
  clefType?: string
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

export type RiotKeySource = 'env' | 'file'

export interface ActiveKeyInfo {
  key: string
  source: RiotKeySource
  clefType: string | null
}

/**
 * Resolve API key: try env first, then riot-apikey.json.
 */
export async function resolveRiotApiKey(): Promise<
  { ok: true; key: string; source: RiotKeySource; clefType: string | null } | { ok: false; error: string }
> {
  const envKey = process.env[RIOT_API_KEY_ENV]?.trim()
  if (envKey) {
    return { ok: true, key: envKey, source: 'env', clefType: null }
  }
  const read = await FileManager.readJson<RiotApiKeyFile>(RIOT_APIKEY_FILE)
  if (read.isErr()) {
    return { ok: false, error: read.unwrapErr().message }
  }
  const data = read.unwrap()
  const key = data?.riotApiKey?.trim()
  if (!key) {
    return { ok: false, error: 'No RIOT_API_KEY in env and no riotApiKey in riot-apikey.json' }
  }
  return {
    ok: true,
    key,
    source: 'file',
    clefType: data?.clefType ?? null,
  }
}

/**
 * Get clefType from riot-apikey.json (when key is from file we have it; when from env we read file for clefType).
 */
export async function getClefTypeFromFile(): Promise<string | null> {
  const r = await FileManager.readJson<RiotApiKeyFile>(RIOT_APIKEY_FILE)
  if (r.isErr()) return null
  return r.unwrap()?.clefType ?? null
}

export class RiotHttpClient {
  private key: string = ''
  private keySource: RiotKeySource = 'env'
  private clefType: string | null = null
  private platform: string = 'euw1'
  private onInvalidKey?: () => void

  constructor(
    private readonly rateLimiter: RiotRateLimiter,
    private readonly _log: RiotPollerLogger
  ) {}

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
    options?: { retryCount?: number }
  ): Promise<{ ok: true; data: T; status: number } | { ok: false; status: number; message?: string; body?: unknown }> {
    // Always acquire the global app rate limit first, then the per-endpoint bucket.
    // The 'app' bucket tracks total requests across all endpoints, matching Riot's
    // global App Rate Limit (e.g. 20 req/s and 100 req/2min for personal keys).
    await this.rateLimiter.acquire('app')
    await this.rateLimiter.acquire(bucket)

    const headers: Record<string, string> = {
      'X-Riot-Token': this.key,
      'Accept': 'application/json',
    }
    try {
      const res = await fetch(url, { method, headers })
      const text = await res.text()
      let data: unknown
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        data = text
      }

      if (res.status === 429) {
        // Honor Riot's Retry-After header: block ALL future requests for that duration.
        const retryAfterSec = parseInt(res.headers.get('Retry-After') ?? '1', 10)
        void this._log.info('Riot API 429 rate limit', {
          bucket,
          retryAfterSec,
          url,
        })
        this.rateLimiter.penalize((retryAfterSec + 1) * 1000)
        // Auto-retry up to 2 times — rate limiter will wait out the penalty before proceeding.
        const retryCount = options?.retryCount ?? 0
        if (retryCount < 2) {
          return this.request<T>(method, bucket, url, { retryCount: retryCount + 1 })
        }
        return { ok: false, status: 429, message: 'Rate limit exceeded (max retries)', body: data }
      }
      if (res.status === 401 || res.status === 403) {
        this.onInvalidKey?.()
        return { ok: false, status: res.status, message: 'Invalid or expired API key', body: data }
      }
      if (res.status >= 400) {
        const msg = typeof (data as { status?: { message?: string } })?.status?.message === 'string'
          ? (data as { status: { message: string } }).status.message
          : undefined
        return { ok: false, status: res.status, message: msg, body: data }
      }

      return { ok: true, data: data as T, status: res.status }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      void this._log.error('Riot API request failed', msg, url)
      return { ok: false, status: 0, message: msg }
    }
  }

  async getPlatformData(): Promise<
    { ok: true; data: unknown } | { ok: false; status: number; message?: string; body?: unknown }
  > {
    const url = `${getPlatformBase(this.platform)}/lol/status/v4/platform-data`
    return this.request('GET', 'lol-status-v4-platform', url)
  }

  async getMatchIdsByPuuid(
    puuid: string,
    query: { queue?: number; count?: number; start?: number; startTime?: number; endTime?: number }
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
    return this.request<string[]>('GET', 'match-v5-ids', url)
  }

  async getMatch(matchId: string): Promise<
    { ok: true; data: RiotMatchDto } | { ok: false; status: number; message?: string; body?: unknown }
  > {
    const url = `${getRegionalBase(this.platform)}/lol/match/v5/matches/${encodeURIComponent(matchId)}`
    return this.request<RiotMatchDto>('GET', 'match-v5-detail', url)
  }

  async getMatchTimeline(matchId: string): Promise<
    { ok: true; data: RiotMatchTimelineDto } | { ok: false; status: number; message?: string; body?: unknown }
  > {
    const url = `${getRegionalBase(this.platform)}/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`
    return this.request<RiotMatchTimelineDto>('GET', 'match-v5-timeline', url)
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
}

export interface RiotAccountDto {
  puuid: string
  gameName?: string
  tagLine?: string
}

export interface RiotSummonerDto {
  id: string
  puuid: string
  accountId?: string
  summonerLevel?: number
}

export interface RiotLeagueEntryDto {
  queueType: string
  tier: string
  rank: string
  leaguePoints?: number
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
