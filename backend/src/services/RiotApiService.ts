/**
 * Riot API client: League v4, Match v5. EUW/EUNE only.
 * Rate limits: per-route (see RiotRateLimiter). Queue 420 = Ranked Solo/Duo.
 */
import axios, { type AxiosInstance } from 'axios'
import { rateLimitByRoute } from '../utils/RiotRateLimiter.js'
import { getRiotApiKeyAsync } from '../utils/riotApiKey.js'
import { Result } from '../utils/Result.js'
import { AppError } from '../utils/errors.js'
import type { EuropePlatform } from '../utils/riotRegions.js'
import {
  recordRiotApi429,
  requestPuuidMigration,
  getRiotApiStats,
} from './RiotApiStatsService.js'

const PLATFORM_BASE = {
  euw1: 'https://euw1.api.riotgames.com',
  eun1: 'https://eun1.api.riotgames.com',
  na1: 'https://na1.api.riotgames.com',
  br1: 'https://br1.api.riotgames.com',
  la1: 'https://la1.api.riotgames.com',
  la2: 'https://la2.api.riotgames.com',
  oc1: 'https://oc1.api.riotgames.com',
  kr: 'https://kr.api.riotgames.com',
  jp1: 'https://jp1.api.riotgames.com',
  tr1: 'https://tr1.api.riotgames.com',
  ru: 'https://ru.api.riotgames.com',
  ph2: 'https://ph2.api.riotgames.com',
  sg2: 'https://sg2.api.riotgames.com',
  th2: 'https://th2.api.riotgames.com',
  tw2: 'https://tw2.api.riotgames.com',
  vn2: 'https://vn2.api.riotgames.com',
  me1: 'https://me1.api.riotgames.com',
} as const
export type PlatformRegion = keyof typeof PLATFORM_BASE
const REGIONAL_BASE = 'https://europe.api.riotgames.com'
const CONTINENT_BASE: Record<string, string> = {
  europe: 'https://europe.api.riotgames.com',
  americas: 'https://americas.api.riotgames.com',
  asia: 'https://asia.api.riotgames.com',
}
const RANKED_SOLO_QUEUE = 'RANKED_SOLO_5x5'
const QUEUE_ID_420 = 420

/** Max retries on 429 (rate limit). Backoff: Retry-After header or 60s. */
const RATE_LIMIT_MAX_RETRIES = 3
/** Max retries on 5xx (server error). Backoff: 5s, 10s, 20s, 40s, 80s. Riot often returns 500/503 during outages. Reduce via RIOT_5XX_MAX_RETRIES when API is unstable. */
const RETRY_5XX_MAX = Math.min(5, Math.max(0, parseInt(process.env.RIOT_5XX_MAX_RETRIES ?? '5', 10) || 5))
const RETRY_5XX_BACKOFF_MS = 5000

async function withRetry429<T>(
  fn: () => Promise<T>,
  options: { max429Retries?: number; max5xxRetries?: number; backoffMs?: number } = {}
): Promise<T> {
  const max429Retries = Math.max(0, options.max429Retries ?? RATE_LIMIT_MAX_RETRIES)
  const max5xxRetries = Math.max(0, options.max5xxRetries ?? RETRY_5XX_MAX)
  const backoffMs = Math.max(100, options.backoffMs ?? RETRY_5XX_BACKOFF_MS)
  let lastErr: unknown
  const maxAttempts = Math.max(max429Retries, max5xxRetries) + 1
  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!axios.isAxiosError(err)) throw err
      const status = err.response?.status ?? 0
      // 429: wait Retry-After or 60s; si plusieurs 429, sleep 3s supplémentaire
      if (status === 429 && attempt <= max429Retries) {
        recordRiotApi429()
        const retryAfter = err.response?.headers?.['retry-after']
        const waitMs =
          typeof retryAfter === 'string' && /^\d+$/.test(retryAfter)
            ? parseInt(retryAfter, 10) * 1000
            : 60_000
        await new Promise((r) => setTimeout(r, waitMs))
        const stats = await getRiotApiStats()
        if (stats.count429Total >= 2) {
          await new Promise((r) => setTimeout(r, 3000))
        }
        continue
      }
      // 5xx: retry with backoff (transient server errors from Riot). 503 may include Retry-After.
      if (status >= 500 && status < 600 && attempt <= max5xxRetries) {
        const retryAfter = err.response?.headers?.['retry-after']
        const waitMs =
          typeof retryAfter === 'string' && /^\d+$/.test(retryAfter)
            ? parseInt(retryAfter, 10) * 1000
            : backoffMs * Math.pow(2, attempt)
        await new Promise((r) => setTimeout(r, waitMs))
        continue
      }
      throw err
    }
  }
  checkPuuidMigration(lastErr)
  throw lastErr
}

function checkPuuidMigration(err: unknown): void {
  const msg = axios.isAxiosError(err)
    ? String(err.response?.data?.status?.message ?? err.response?.data?.message ?? err.message ?? '')
    : String(err && typeof err === 'object' && 'message' in err ? (err as { message: string }).message : err)
  if (/decrypt|exception decrypting/i.test(msg)) void requestPuuidMigration()
}

function createClient(baseURL: string, apiKey: string, timeoutMs = 15000): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: timeoutMs,
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

export interface ReplayLinkEntry {
  replayUrl: string
  matchId?: string
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
    await rateLimitByRoute('league-entries')
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
      checkPuuidMigration(err)
      const message = axios.isAxiosError(err) ? err.response?.data?.status?.message ?? err.message : String(err)
      return Result.err(new AppError(`League API: ${message}`, 'RIOT_API_ERROR', err))
    }
  }

  /**
   * League-exp v4: entries by queue/tier/division (IRON..DIAMOND). Platform: euw1, eun1.
   * Endpoint: /lol/league-exp/v4/entries/{queue}/{tier}/{division}
   */
  async getLeagueExpEntries(
    platform: 'euw1' | 'eun1',
    queue: string,
    tier: 'DIAMOND' | 'EMERALD' | 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'IRON',
    division: 'I' | 'II' | 'III' | 'IV',
    page: number = 1
  ): Promise<Result<LeagueEntry[], AppError>> {
    await rateLimitByRoute('league-exp')
    const key = await this.ensureKey()
    const base = PLATFORM_BASE[platform]
    if (!base) return Result.err(new AppError(`Unknown platform: ${platform}`, 'VALIDATION_ERROR'))
    const client = createClient(base, key)
    const path = `/lol/league-exp/v4/entries/${encodeURIComponent(queue)}/${tier.toUpperCase()}/${division.toUpperCase()}`
    try {
      const res = await withRetry429(() => client.get<LeagueEntry[]>(path, { params: { page } }))
      const list = Array.isArray(res.data) ? res.data : []
      return Result.ok(list)
    } catch (err: unknown) {
      checkPuuidMigration(err)
      const message = axios.isAxiosError(err) ? err.response?.data?.status?.message ?? err.message : String(err)
      return Result.err(new AppError(`League-exp API: ${message}`, 'RIOT_API_ERROR', err))
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
    await rateLimitByRoute('league-challenger-master-grandmaster')
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
      checkPuuidMigration(err)
      const message = axios.isAxiosError(err) ? err.response?.data?.status?.message ?? err.message : String(err)
      return Result.err(new AppError(`League API: ${message}`, 'RIOT_API_ERROR', err))
    }
  }

  /**
   * League v4: entries by puuid (ranked queues). Platform: Europe (euw1, eun1, tr1, ru, me1).
   * Uses /lol/league/v4/entries/by-puuid/{puuid} (available on Riot Developer Portal Swagger).
   * Returns Solo/Duo entry if present (tier, rank = division, leaguePoints).
   */
  async getLeagueEntriesByPuuid(
    platform: EuropePlatform,
    puuid: string
  ): Promise<Result<{ tier: string; rank: string; leaguePoints: number } | null, AppError>> {
    await rateLimitByRoute('league-entries-by-puuid')
    const key = await this.ensureKey()
    const base = PLATFORM_BASE[platform as keyof typeof PLATFORM_BASE]
    if (!base) return Result.err(new AppError(`Unknown platform: ${platform}`, 'VALIDATION_ERROR'))
    const client = createClient(base, key)
    try {
      const res = await withRetry429(() =>
        client.get<Array<{ queueType: string; tier: string; rank: string; leaguePoints: number }>>(
          `/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`
        )
      )
      const entries = res.data ?? []
      const solo = entries.find((e) => e.queueType === RANKED_SOLO_QUEUE)
      if (!solo) return Result.ok(null)
      return Result.ok({
        tier: (solo.tier ?? '').toUpperCase(),
        rank: (solo.rank ?? '').toUpperCase(),
        leaguePoints: typeof solo.leaguePoints === 'number' ? solo.leaguePoints : 0,
      })
    } catch (err: unknown) {
      checkPuuidMigration(err)
      const status = axios.isAxiosError(err) ? err.response?.status : undefined
      if (status === 404) {
        return Result.ok(null)
      }
      const message = axios.isAxiosError(err) ? err.response?.data?.status?.message ?? err.message : String(err)
      const hint =
        status === 403
          ? ' League-v4 may be disabled for your API key: check product permissions in Riot Developer Portal.'
          : ''
      return Result.err(new AppError(`League entries API (by-puuid): ${message}${hint}`, 'RIOT_API_ERROR', err))
    }
  }

  /**
   * League v4: entries by summoner id (ranked queues). Platform: euw1, eun1.
   * Uses /lol/league/v4/entries/by-summoner/{summonerId}. Prefer getLeagueEntriesByPuuid when you have puuid.
   */
  async getLeagueEntriesBySummonerId(
    platform: 'euw1' | 'eun1',
    summonerId: string
  ): Promise<Result<{ tier: string; rank: string; leaguePoints: number } | null, AppError>> {
    await rateLimitByRoute('league-entries-by-summoner')
    const key = await this.ensureKey()
    const base = PLATFORM_BASE[platform]
    if (!base) return Result.err(new AppError(`Unknown platform: ${platform}`, 'VALIDATION_ERROR'))
    const client = createClient(base, key)
    try {
      const res = await withRetry429(() =>
        client.get<Array<{ queueType: string; tier: string; rank: string; leaguePoints: number }>>(
          `/lol/league/v4/entries/by-summoner/${encodeURIComponent(summonerId)}`
        )
      )
      const entries = res.data ?? []
      const solo = entries.find((e) => e.queueType === RANKED_SOLO_QUEUE)
      if (!solo) return Result.ok(null)
      return Result.ok({
        tier: (solo.tier ?? '').toUpperCase(),
        rank: (solo.rank ?? '').toUpperCase(),
        leaguePoints: typeof solo.leaguePoints === 'number' ? solo.leaguePoints : 0,
      })
    } catch (err: unknown) {
      checkPuuidMigration(err)
      const status = axios.isAxiosError(err) ? err.response?.status : undefined
      const message = axios.isAxiosError(err) ? err.response?.data?.status?.message ?? err.message : String(err)
      const hint =
        status === 403
          ? ' League-v4 may be disabled for your API key: check product permissions in Riot Developer Portal.'
          : ''
      return Result.err(new AppError(`League entries API (by-summoner): ${message}${hint}`, 'RIOT_API_ERROR', err))
    }
  }

  /**
   * Summoner v4 by encrypted summoner id (returns puuid for match list). Platform: euw1, eun1.
   */
  async getSummonerById(platform: PlatformRegion, summonerId: string): Promise<Result<{ id: string; puuid: string; name: string }, AppError>> {
    await rateLimitByRoute('summoner-by-id')
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
      checkPuuidMigration(err)
      const message = axios.isAxiosError(err) ? err.response?.data?.status?.message ?? err.message : String(err)
      return Result.err(new AppError(`Summoner API: ${message}`, 'RIOT_API_ERROR', err))
    }
  }

  /**
   * Summoner v4 by puuid. Platform: euw1, eun1.
   */
  async getSummonerByPuuid(platform: PlatformRegion, puuid: string): Promise<Result<{ id: string; puuid: string; name: string }, AppError>> {
    await rateLimitByRoute('summoner-by-puuid')
    const key = await this.ensureKey()
    const base = PLATFORM_BASE[platform]
    if (!base) return Result.err(new AppError(`Unknown platform: ${platform}`, 'VALIDATION_ERROR'))
    const client = createClient(base, key)
    try {
      const res = await withRetry429(() =>
        client.get<Record<string, unknown>>(
          `/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`
        )
      )
      const raw = res.data ?? {}
      const id = (raw.id ?? raw.summonerId) as string | undefined
      const name = (raw.name ?? raw.summonerName) as string | undefined
      const puuidRes = (raw.puuid as string) ?? puuid
      if (!puuidRes) return Result.err(new AppError('Summoner API: no puuid in response', 'RIOT_API_ERROR'))
      return Result.ok({
        id: id ?? '',
        puuid: puuidRes,
        name: name ?? '',
      })
    } catch (err: unknown) {
      checkPuuidMigration(err)
      const message = axios.isAxiosError(err) ? err.response?.data?.status?.message ?? err.message : String(err)
      return Result.err(new AppError(`Summoner API: ${message}`, 'RIOT_API_ERROR', err))
    }
  }

  /**
   * Account v1: PUUID → Riot ID (gameName, tagLine). Route continentale (europe, americas, asia).
   * Riot ID = gameName#tagLine.
   */
  async getAccountByPuuid(
    continent: 'europe' | 'americas' | 'asia',
    puuid: string
  ): Promise<Result<{ gameName: string; tagLine: string; riotId: string }, AppError>> {
    await rateLimitByRoute('account')
    const key = await this.ensureKey()
    const base = CONTINENT_BASE[continent]
    if (!base) return Result.err(new AppError(`Unknown continent: ${continent}`, 'VALIDATION_ERROR'))
    const client = createClient(base, key)
    try {
      const res = await withRetry429(() =>
        client.get<{ gameName: string; tagLine: string }>(
          `/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`
        )
      )
      const gameName = res.data?.gameName ?? ''
      const tagLine = res.data?.tagLine ?? ''
      if (!gameName && !tagLine) return Result.err(new AppError('Account API: no gameName/tagLine in response', 'RIOT_API_ERROR'))
      const riotId = tagLine ? `${gameName}#${tagLine}` : gameName
      return Result.ok({ gameName, tagLine, riotId })
    } catch (err: unknown) {
      checkPuuidMigration(err)
      const message = axios.isAxiosError(err) ? err.response?.data?.status?.message ?? err.message : String(err)
      return Result.err(new AppError(`Account API (by-puuid): ${message}`, 'RIOT_API_ERROR', err))
    }
  }

  /**
   * Account v1: Riot ID (gameName#tagLine) → PUUID.
   * GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine} (pas l'API esport/tournament).
   * Base: europe.api.riotgames.com | americas | asia.
   */
  async getAccountByRiotId(
    gameName: string,
    tagLine: string,
    continent: 'europe' | 'americas' | 'asia' = 'europe',
    options: { fast?: boolean; debugLog?: (msg: string) => void } = {}
  ): Promise<Result<{ puuid: string }, AppError>> {
    if (!options.fast) await rateLimitByRoute('account')
    const key = await this.ensureKey()
    const base = CONTINENT_BASE[continent]
    if (!base) return Result.err(new AppError(`Unknown continent: ${continent}`, 'VALIDATION_ERROR'))
    const path = `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    const url = `${base}${path}`
    options.debugLog?.(`Account by-riot-id: gameName="${gameName}" tagLine="${tagLine}" → ${url}`)
    const client = createClient(base, key, options.fast ? 6000 : 15000)
    try {
      const res = await withRetry429(
        () =>
        client.get<{ puuid: string }>(path),
        options.fast ? { max429Retries: 0, max5xxRetries: 0 } : {}
      )
      const puuid = res.data?.puuid
      if (!puuid) return Result.err(new AppError('Account API: no puuid in response', 'RIOT_API_ERROR'))
      return Result.ok({ puuid })
    } catch (err: unknown) {
      checkPuuidMigration(err)
      const status = axios.isAxiosError(err) ? err.response?.status : undefined
      const message = axios.isAxiosError(err) ? err.response?.data?.status?.message ?? err.message : String(err)
      const body = axios.isAxiosError(err) && err.response?.data ? JSON.stringify(err.response.data).slice(0, 200) : ''
      options.debugLog?.(`Account by-riot-id FAILED: status=${status} message="${message}" body=${body}`)
      return Result.err(new AppError(`Account API: ${message}`, 'RIOT_API_ERROR', err))
    }
  }

  /**
   * Match v5 replay links by puuid (API-provided replay URLs).
   * Region cluster must match the player's shard: europe, americas, asia.
   */
  async getReplayLinksByPuuid(
    continent: 'europe' | 'americas' | 'asia',
    puuid: string,
    options: { count?: number; start?: number; fast?: boolean } = {}
  ): Promise<Result<ReplayLinkEntry[], AppError>> {
    if (!options.fast) await rateLimitByRoute('match-replays')
    const key = await this.ensureKey()
    const base = CONTINENT_BASE[continent]
    if (!base) return Result.err(new AppError(`Unknown continent: ${continent}`, 'VALIDATION_ERROR'))
    const client = createClient(base, key, options.fast ? 6000 : 15000)
    const count = options.count ?? 20
    const start = options.start ?? 0
    try {
      const res = await withRetry429(
        () =>
        client.get<unknown>(
          `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/replays`,
          { params: { count, start } }
        ),
        options.fast ? { max429Retries: 0, max5xxRetries: 0 } : {}
      )
      const raw = res.data
      const list = Array.isArray(raw) ? raw : []
      const links: ReplayLinkEntry[] = list
        .map((entry) => {
          if (typeof entry === 'string') return { replayUrl: entry }
          if (!entry || typeof entry !== 'object') return null
          const obj = entry as Record<string, unknown>
          const replayUrlRaw = obj.replayUrl ?? obj.url ?? obj.replay_url
          if (typeof replayUrlRaw !== 'string' || replayUrlRaw.trim().length === 0) return null
          const matchIdRaw = obj.matchId ?? obj.match_id
          return {
            replayUrl: replayUrlRaw.trim(),
            matchId: typeof matchIdRaw === 'string' && matchIdRaw.trim() ? matchIdRaw.trim() : undefined,
          }
        })
        .filter((x): x is ReplayLinkEntry => x !== null)
      return Result.ok(links)
    } catch (err: unknown) {
      checkPuuidMigration(err)
      const message = axios.isAxiosError(err) ? err.response?.data?.status?.message ?? err.message : String(err)
      return Result.err(new AppError(`Replay API: ${message}`, 'RIOT_API_ERROR', err))
    }
  }

  /**
   * Summoner v4 by name. Platform: euw1, eun1.
   */
  async getSummonerByName(
    platform: PlatformRegion,
    summonerName: string,
    options: { fast?: boolean } = {}
  ): Promise<Result<{ id: string; puuid: string; name: string }, AppError>> {
    if (!options.fast) await rateLimitByRoute('summoner-by-puuid')
    const key = await this.ensureKey()
    const base = PLATFORM_BASE[platform]
    if (!base) return Result.err(new AppError(`Unknown platform: ${platform}`, 'VALIDATION_ERROR'))
    const client = createClient(base, key, options.fast ? 6000 : 15000)
    try {
      const res = await withRetry429(
        () =>
        client.get<{ id: string; puuid: string; name: string }>(
          `/lol/summoner/v4/summoners/by-name/${encodeURIComponent(summonerName)}`
        ),
        options.fast ? { max429Retries: 0, max5xxRetries: 0 } : {}
      )
      return Result.ok(res.data)
    } catch (err: unknown) {
      checkPuuidMigration(err)
      const message = axios.isAxiosError(err) ? err.response?.data?.status?.message ?? err.message : String(err)
      return Result.err(new AppError(`Summoner API: ${message}`, 'RIOT_API_ERROR', err))
    }
  }

  /**
   * Match v5: match IDs by puuid. Continent = europe | americas | asia (default europe). queue=420 only.
   * startTime/endTime: epoch seconds; only match IDs in (startTime, endTime] are returned (avoids duplicates across runs).
   */
  async getMatchIdsByPuuid(
    puuid: string,
    options: {
      count?: number
      start?: number
      queue?: number | null
      startTime?: number
      endTime?: number
      continent?: 'europe' | 'americas' | 'asia'
    } = {}
  ): Promise<Result<string[], AppError>> {
    await rateLimitByRoute('match-ids')
    const key = await this.ensureKey()
    const base = options.continent && CONTINENT_BASE[options.continent]
      ? CONTINENT_BASE[options.continent]
      : REGIONAL_BASE
    const client = createClient(base, key)
    const count = options.count ?? 20
    const start = options.start ?? 0
    const queue = options.queue === null ? null : (options.queue ?? QUEUE_ID_420)
    const params: Record<string, number> = { count, start }
    if (typeof queue === 'number') params.queue = queue
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
      checkPuuidMigration(err)
      const message = axios.isAxiosError(err) ? err.response?.data?.status?.message ?? err.message : String(err)
      return Result.err(new AppError(`Match list API: ${message}`, 'RIOT_API_ERROR', err))
    }
  }

  /**
   * Match v5: full match by id. Region = europe.
   */
  async getMatch(matchId: string): Promise<Result<MatchSummary, AppError>> {
    await rateLimitByRoute('match')
    const key = await this.ensureKey()
    const client = createClient(REGIONAL_BASE, key)
    try {
      const res = await withRetry429(() =>
        client.get<MatchSummary>(`/lol/match/v5/matches/${encodeURIComponent(matchId)}`)
      )
      return Result.ok(res.data)
    } catch (err: unknown) {
      checkPuuidMigration(err)
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
