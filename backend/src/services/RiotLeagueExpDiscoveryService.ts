import axios from 'axios'
import { prisma, isDatabaseConfigured } from '../db.js'
import { getRiotApiService } from './RiotApiService.js'

const ALLOWED_TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND'] as const
const ALLOWED_DIVISIONS = ['I', 'II', 'III', 'IV'] as const

export interface LeagueExpDiscoveryOptions {
  platform: 'euw1' | 'eun1'
  queue: string
  tier: string
  division: string
  pages: number
}

export interface LeagueExpDiscoveryResult {
  platform: 'euw1' | 'eun1'
  queue: string
  tier: string
  division: string
  pages: number
  entriesFetched: number
  uniqueSummoners: number
  playersUpserted: number
  errors: number
}

function normalizeOptions(input: Partial<LeagueExpDiscoveryOptions>): LeagueExpDiscoveryOptions {
  const platform = input.platform === 'eun1' ? 'eun1' : 'euw1'
  const queue = typeof input.queue === 'string' && input.queue.trim() ? input.queue.trim() : 'RANKED_SOLO_5x5'
  const tier = String(input.tier ?? 'GOLD').toUpperCase()
  const division = String(input.division ?? 'I').toUpperCase()
  const pagesRaw = Number(input.pages ?? 3)
  const pages = Number.isFinite(pagesRaw) ? Math.max(1, Math.min(50, Math.trunc(pagesRaw))) : 3

  if (!ALLOWED_TIERS.includes(tier as (typeof ALLOWED_TIERS)[number])) {
    throw new Error(`Invalid tier "${tier}". Allowed: ${ALLOWED_TIERS.join(', ')}`)
  }
  if (!ALLOWED_DIVISIONS.includes(division as (typeof ALLOWED_DIVISIONS)[number])) {
    throw new Error(`Invalid division "${division}". Allowed: ${ALLOWED_DIVISIONS.join(', ')}`)
  }

  return { platform, queue, tier, division, pages }
}

function isRiotAuthError(err: unknown): boolean {
  const cause = err && typeof err === 'object' && 'cause' in err ? (err as { cause: unknown }).cause : err
  return axios.isAxiosError(cause) && (cause.response?.status === 401 || cause.response?.status === 403)
}

export type LeagueExpDiscoveryRunOptions = {
  shouldStop?: () => Promise<boolean>
}

export async function discoverPlayersFromLeagueExp(
  rawOptions: Partial<LeagueExpDiscoveryOptions>,
  runOptions?: LeagueExpDiscoveryRunOptions
): Promise<LeagueExpDiscoveryResult> {
  if (!isDatabaseConfigured()) throw new Error('DATABASE_URL not configured')
  const options = normalizeOptions(rawOptions)
  const riotApi = getRiotApiService()
  const bySummonerId = new Map<string, string>() // summonerId -> summonerName
  let entriesFetched = 0
  let errors = 0

  console.log(
    `[riot:discover-league-exp] Start platform=${options.platform} queue=${options.queue} tier=${options.tier} division=${options.division} pages=${options.pages}`
  )

  for (let page = 1; page <= options.pages; page++) {
    if (runOptions?.shouldStop && (await runOptions.shouldStop())) break
    const entriesRes = await riotApi.getLeagueExpEntries(
      options.platform,
      options.queue,
      options.tier as 'DIAMOND' | 'EMERALD' | 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'IRON',
      options.division as 'I' | 'II' | 'III' | 'IV',
      page
    )
    if (entriesRes.isErr()) {
      errors++
      const err = entriesRes.unwrapErr()
      console.warn(`[riot:discover-league-exp] Page ${page} failed:`, err.message)
      if (isRiotAuthError(err)) {
        riotApi.invalidateKeyCache()
        throw err
      }
      continue
    }

    const entries = entriesRes.unwrap()
    entriesFetched += entries.length
    console.log(`[riot:discover-league-exp] Page ${page}/${options.pages}: ${entries.length} entries`)
    if (entries.length === 0) continue
    for (const e of entries) {
      if (!e.summonerId) continue
      bySummonerId.set(e.summonerId, e.summonerName ?? '')
    }
  }

  let playersUpserted = 0
  for (const [summonerId, fallbackName] of bySummonerId.entries()) {
    if (runOptions?.shouldStop && (await runOptions.shouldStop())) break
    const summonerRes = await riotApi.getSummonerById(options.platform, summonerId)
    if (summonerRes.isErr()) {
      errors++
      const err = summonerRes.unwrapErr()
      if (isRiotAuthError(err)) {
        riotApi.invalidateKeyCache()
        throw err
      }
      continue
    }
    const s = summonerRes.unwrap()
    const puuid = typeof s.puuid === 'string' ? s.puuid.trim() : ''
    if (!puuid) continue
    const summonerName = (s.name || fallbackName || '').trim() || null
    await prisma.player.upsert({
      where: { puuid },
      create: { puuid, region: options.platform, summonerName, lastSeen: null },
      update: {},
    })
    playersUpserted++
  }

  const result: LeagueExpDiscoveryResult = {
    platform: options.platform,
    queue: options.queue,
    tier: options.tier,
    division: options.division,
    pages: options.pages,
    entriesFetched,
    uniqueSummoners: bySummonerId.size,
    playersUpserted,
    errors,
  }
  console.log(
    `[riot:discover-league-exp] Done: entries=${result.entriesFetched}, uniqueSummoners=${result.uniqueSummoners}, upserts=${result.playersUpserted}, errors=${result.errors}`
  )
  return result
}
