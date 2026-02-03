/**
 * Riot API client: League v4, Match v5. EUW/EUNE only.
 * Rate limit: ~15 req/s (delay 70ms between calls). Queue 420 = Ranked Solo/Duo.
 */
import axios, { type AxiosInstance } from 'axios'
import { getRiotApiKeyAsync } from '../utils/riotApiKey.js'
import { Result } from '../utils/Result.js'
import { AppError } from '../utils/errors.js'

const PLATFORM_BASE: Record<string, string> = {
  euw1: 'https://euw1.api.riotgames.com',
  eun1: 'https://eun1.api.riotgames.com',
}
const REGIONAL_BASE = 'https://europe.api.riotgames.com'
const RANKED_SOLO_QUEUE = 'RANKED_SOLO_5x5'
const QUEUE_ID_420 = 420

/** Delay between requests (ms) to respect rate limits (~14 req/s) */
const RATE_LIMIT_DELAY_MS = 70
/** Max retries on 429 (rate limit). Backoff: Retry-After header or 60s. */
const RATE_LIMIT_MAX_RETRIES = 3

let lastRequestTime = 0

async function rateLimit(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < RATE_LIMIT_DELAY_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS - elapsed))
  }
  lastRequestTime = Date.now()
}

async function withRetry429<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt < RATE_LIMIT_MAX_RETRIES && axios.isAxiosError(err) && err.response?.status === 429) {
        const retryAfter = err.response.headers['retry-after']
        const waitMs =
          typeof retryAfter === 'string' && /^\d+$/.test(retryAfter)
            ? parseInt(retryAfter, 10) * 1000
            : 60_000
        await new Promise((r) => setTimeout(r, waitMs))
        continue
      }
      throw err
    }
  }
  throw lastErr
}

function createClient(baseURL: string, apiKey: string): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: 15000,
    headers: {
      'X-Riot-Token': apiKey,
      'Accept': 'application/json',
    },
  })
}

export interface LeagueEntry {
  summonerId: string
  puuid?: string
  summonerName: string
  leaguePoints: number
  rank: string
  wins: number
  losses: number
  tier: string
}

/** League list (Challenger / Grandmaster / Master) */
export interface LeagueListDTO {
  tier: string
  leagueId: string
  entries: Array<{
    summonerId: string
    summonerName: string
    leaguePoints: number
    rank: string
    wins: number
    losses: number
  }>
}

export interface MatchSummary {
  metadata: { matchId: string }
  info: {
    gameId?: number
    gameCreation: number
    gameDuration: number
    gameVersion?: string
    queueId: number
    participants: Array<{
      puuid: string
      summonerId?: string
      championId: number
      teamId: number
      win: boolean
      teamPosition: string
      individualPosition?: string
      kills: number
      deaths: number
      assists: number
      challenges?: { teamPosition?: string }
    }>
  }
}

export class RiotApiService {
  private apiKey: string | null = null
  /** When true, ensureKey() uses env first then admin file (used by the script). */
  private preferEnv = false

  /** Set key preference for the next ensureKey() call. Used by the script: try .env first, then admin file. */
  setKeyPreference(preferEnv: boolean): void {
    this.preferEnv = preferEnv
  }

  private async ensureKey(): Promise<string> {
    if (this.apiKey) return this.apiKey
    const key = await getRiotApiKeyAsync(this.preferEnv)
    if (!key) {
      throw new AppError('RIOT_API_KEY not configured (env or admin Riot API key)', 'CONFIG_ERROR')
    }
    this.apiKey = key
    return key
  }

  /** Clear cached key so next request re-reads from admin file or env (e.g. after 401/403). */
  invalidateKeyCache(): void {
    this.apiKey = null
  }

  /**
   * League v4: entries by queue/tier/division (IRON..DIAMOND). Platform: euw1, eun1.
   */
  async getLeagueEntries(
    platform: 'euw1' | 'eun1',
    tier: 'DIAMOND' | 'EMERALD' | 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'IRON',
    division: 'I' | 'II' | 'III' | 'IV',
    page: number = 1
  ): Promise<Result<LeagueEntry[], AppError>> {
    await rateLimit()
    const key = await this.ensureKey()
    const base = PLATFORM_BASE[platform]
    if (!base) return Result.err(new AppError(`Unknown platform: ${platform}`, 'VALIDATION_ERROR'))
    const client = createClient(base, key)
    const path = `/lol/league/v4/entries/${RANKED_SOLO_QUEUE}/${tier.toUpperCase()}/${division.toUpperCase()}`
    try {
      const res = await withRetry429(() => client.get<LeagueEntry[]>(path, { params: { page } }))
      const list = Array.isArray(res.data) ? res.data : []
      return Result.ok(list)
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.status?.message ?? err.message : String(err)
      return Result.err(new AppError(`League API: ${message}`, 'RIOT_API_ERROR', err))
    }
  }

  /**
   * League v4: Challenger league (full list). Platform: euw1, eun1.
   */
  async getChallengerLeague(platform: 'euw1' | 'eun1'): Promise<Result<LeagueEntry[], AppError>> {
    return this.getLeagueList(platform, 'challengerleagues')
  }

  /**
   * League v4: Grandmaster league. Platform: euw1, eun1.
   */
  async getGrandmasterLeague(platform: 'euw1' | 'eun1'): Promise<Result<LeagueEntry[], AppError>> {
    return this.getLeagueList(platform, 'grandmasterleagues')
  }

  /**
   * League v4: Master league. Platform: euw1, eun1.
   */
  async getMasterLeague(platform: 'euw1' | 'eun1'): Promise<Result<LeagueEntry[], AppError>> {
    return this.getLeagueList(platform, 'masterleagues')
  }

  private async getLeagueList(
    platform: 'euw1' | 'eun1',
    listType: 'challengerleagues' | 'grandmasterleagues' | 'masterleagues'
  ): Promise<Result<LeagueEntry[], AppError>> {
    await rateLimit()
    const key = await this.ensureKey()
    const base = PLATFORM_BASE[platform]
    if (!base) return Result.err(new AppError(`Unknown platform: ${platform}`, 'VALIDATION_ERROR'))
    const client = createClient(base, key)
    const path = `/lol/league/v4/${listType}/by-queue/${RANKED_SOLO_QUEUE}`
    try {
      const res = await withRetry429(() => client.get<LeagueListDTO>(path))
      const rawEntries = res.data?.entries ?? []
      const tier = (res.data?.tier ?? '').toUpperCase()
      const list: LeagueEntry[] = rawEntries
        .map((e) => {
          const raw = e as Record<string, unknown>
          const summonerId = (raw.summonerId ?? raw.summoner_id) as string | undefined
          if (!summonerId || typeof summonerId !== 'string') return null
          return {
            summonerId,
            summonerName: (raw.summonerName ?? raw.summoner_name ?? '') as string,
            leaguePoints: (raw.leaguePoints ?? raw.league_points ?? 0) as number,
            rank: (raw.rank ?? '') as string,
            wins: (raw.wins ?? 0) as number,
            losses: (raw.losses ?? 0) as number,
            tier,
          }
        })
        .filter((e): e is LeagueEntry => e !== null)
      return Result.ok(list)
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.status?.message ?? err.message : String(err)
      return Result.err(new AppError(`League API: ${message}`, 'RIOT_API_ERROR', err))
    }
  }

  /**
   * Summoner v4 by encrypted summoner id (returns puuid for match list). Platform: euw1, eun1.
   */
  async getSummonerById(platform: 'euw1' | 'eun1', summonerId: string): Promise<Result<{ id: string; puuid: string; name: string }, AppError>> {
    await rateLimit()
    const key = await this.ensureKey()
    const base = PLATFORM_BASE[platform]
    if (!base) return Result.err(new AppError(`Unknown platform: ${platform}`, 'VALIDATION_ERROR'))
    const client = createClient(base, key)
    try {
      const res = await withRetry429(() =>
        client.get<{ id: string; puuid: string; name: string }>(
          `/lol/summoner/v4/summoners/${encodeURIComponent(summonerId)}`
        )
      )
      return Result.ok(res.data)
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.status?.message ?? err.message : String(err)
      return Result.err(new AppError(`Summoner API: ${message}`, 'RIOT_API_ERROR', err))
    }
  }

  /**
   * Summoner v4 by puuid. Platform: euw1, eun1.
   */
  async getSummonerByPuuid(platform: 'euw1' | 'eun1', puuid: string): Promise<Result<{ id: string; puuid: string; name: string }, AppError>> {
    await rateLimit()
    const key = await this.ensureKey()
    const base = PLATFORM_BASE[platform]
    if (!base) return Result.err(new AppError(`Unknown platform: ${platform}`, 'VALIDATION_ERROR'))
    const client = createClient(base, key)
    try {
      const res = await withRetry429(() =>
        client.get<{ id: string; puuid: string; name: string }>(
          `/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`
        )
      )
      return Result.ok(res.data)
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.status?.message ?? err.message : String(err)
      return Result.err(new AppError(`Summoner API: ${message}`, 'RIOT_API_ERROR', err))
    }
  }

  /**
   * Account v1: Riot ID (gameName#tagLine) → PUUID. Regional Europe.
   */
  async getAccountByRiotId(gameName: string, tagLine: string): Promise<Result<{ puuid: string }, AppError>> {
    await rateLimit()
    const key = await this.ensureKey()
    const client = createClient(REGIONAL_BASE, key)
    try {
      const res = await withRetry429(() =>
        client.get<{ puuid: string }>(
          `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
        )
      )
      const puuid = res.data?.puuid
      if (!puuid) return Result.err(new AppError('Account API: no puuid in response', 'RIOT_API_ERROR'))
      return Result.ok({ puuid })
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.status?.message ?? err.message : String(err)
      return Result.err(new AppError(`Account API: ${message}`, 'RIOT_API_ERROR', err))
    }
  }

  /**
   * Summoner v4 by name. Platform: euw1, eun1.
   */
  async getSummonerByName(
    platform: 'euw1' | 'eun1',
    summonerName: string
  ): Promise<Result<{ id: string; puuid: string; name: string }, AppError>> {
    await rateLimit()
    const key = await this.ensureKey()
    const base = PLATFORM_BASE[platform]
    if (!base) return Result.err(new AppError(`Unknown platform: ${platform}`, 'VALIDATION_ERROR'))
    const client = createClient(base, key)
    try {
      const res = await withRetry429(() =>
        client.get<{ id: string; puuid: string; name: string }>(
          `/lol/summoner/v4/summoners/by-name/${encodeURIComponent(summonerName)}`
        )
      )
      return Result.ok(res.data)
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.status?.message ?? err.message : String(err)
      return Result.err(new AppError(`Summoner API: ${message}`, 'RIOT_API_ERROR', err))
    }
  }

  /**
   * Match v5: match IDs by puuid. Region = europe (covers EUW+EUNE). queue=420 only.
   * startTime/endTime: epoch seconds; only match IDs in (startTime, endTime] are returned (avoids duplicates across runs).
   */
  async getMatchIdsByPuuid(
    puuid: string,
    options: {
      count?: number
      start?: number
      queue?: number
      startTime?: number
      endTime?: number
    } = {}
  ): Promise<Result<string[], AppError>> {
    await rateLimit()
    const key = await this.ensureKey()
    const client = createClient(REGIONAL_BASE, key)
    const count = options.count ?? 20
    const start = options.start ?? 0
    const queue = options.queue ?? QUEUE_ID_420
    const params: Record<string, number> = { count, start, queue }
    if (typeof options.startTime === 'number') params.startTime = options.startTime
    if (typeof options.endTime === 'number') params.endTime = options.endTime
    try {
      const res = await withRetry429(() =>
        client.get<string[]>(
          `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids`,
          { params }
        )
      )
      const ids = Array.isArray(res.data) ? res.data : []
      return Result.ok(ids)
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.status?.message ?? err.message : String(err)
      return Result.err(new AppError(`Match list API: ${message}`, 'RIOT_API_ERROR', err))
    }
  }

  /**
   * Match v5: full match by id. Region = europe.
   */
  async getMatch(matchId: string): Promise<Result<MatchSummary, AppError>> {
    await rateLimit()
    const key = await this.ensureKey()
    const client = createClient(REGIONAL_BASE, key)
    try {
      const res = await withRetry429(() =>
        client.get<MatchSummary>(`/lol/match/v5/matches/${encodeURIComponent(matchId)}`)
      )
      return Result.ok(res.data)
    } catch (err: unknown) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined
      const message = axios.isAxiosError(err) ? err.response?.data?.status?.message ?? err.message : String(err)
      return Result.err(new AppError(`Match API: ${message} (status ${status})`, 'RIOT_API_ERROR', err))
    }
  }
}

let instance: RiotApiService | null = null

export function getRiotApiService(): RiotApiService {
  if (!instance) instance = new RiotApiService()
  return instance
}
