/**
 * Refreshes players (totalGames, totalWins) from participants.
 * Champion stats are computed on the fly from participants; no pre-aggregated table.
 * Backfills participant rank (rankTier, rankDivision, rankLp) from Riot League API and Match.rank.
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'
import { getRiotApiService } from './RiotApiService.js'

const TIER_ORDER = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'] as const
/** Sentinel for participants whose Solo/Duo rank could not be fetched (unranked, decayed, etc.). Excluded from Match.rank and from "ranked" stats. */
export const UNRANKED_TIER = 'UNRANKED'
export { TIER_ORDER }
const DIVISION_ORDER = ['IV', 'III', 'II', 'I'] as const

/** Convert tier+division+lp to a numeric score (higher = higher rank). MASTER+ have no division (use 0). */
export function rankToScore(tier: string, division: string, lp: number): number {
  const t = TIER_ORDER.indexOf(tier.toUpperCase() as (typeof TIER_ORDER)[number])
  const tierIdx = t >= 0 ? t : 0
  const d = DIVISION_ORDER.indexOf(division.toUpperCase() as (typeof DIVISION_ORDER)[number])
  const divIdx = d >= 0 ? d : 0
  const isMasterPlus = tierIdx >= TIER_ORDER.indexOf('MASTER')
  const div = isMasterPlus ? 0 : divIdx
  return tierIdx * 4 + div + lp / 100
}

/** Convert numeric score back to tier+division string (e.g. "GOLD_II"). Rounds to nearest tier/division. */
export function scoreToRankLabel(score: number): string {
  if (score <= 0) return 'IRON_IV'
  const tierIdx = Math.min(Math.floor(score / 4), TIER_ORDER.length - 1)
  const remainder = score - tierIdx * 4
  const tier = TIER_ORDER[Math.max(0, tierIdx)]
  if (tier === 'MASTER' || tier === 'GRANDMASTER' || tier === 'CHALLENGER') return tier
  const divIdx = Math.min(Math.floor(remainder), DIVISION_ORDER.length - 1)
  const div = DIVISION_ORDER[Math.max(0, divIdx)]
  return `${tier}_${div}`
}

export async function refreshPlayersAndChampionStats(): Promise<{
  playersUpserted: number
  championStatsUpserted: number
}> {
  if (!isDatabaseConfigured()) return { playersUpserted: 0, championStatsUpserted: 0 }
  const participants = await prisma.participant.findMany({
    select: { puuid: true, win: true, matchId: true },
  })
  const matchIds = [...new Set(participants.map((p) => p.matchId))]
  const matches = await prisma.match.findMany({
    where: { id: { in: matchIds } },
    select: { id: true, region: true },
  })
  const matchRegion = new Map<string, string>()
  for (const m of matches) matchRegion.set(String(m.id), m.region)

  const byPuuid = new Map<string, { region: string; totalGames: number; totalWins: number }>()
  for (const p of participants) {
    const region = matchRegion.get(String(p.matchId)) ?? 'euw1'
    let entry = byPuuid.get(p.puuid)
    if (!entry) {
      entry = { region, totalGames: 0, totalWins: 0 }
      byPuuid.set(p.puuid, entry)
    }
    entry.totalGames++
    if (p.win) entry.totalWins++
  }

  let playersUpserted = 0
  for (const [puuid, e] of byPuuid) {
    await prisma.player.upsert({
      where: { puuid },
      create: {
        puuid,
        region: e.region,
        totalGames: e.totalGames,
        totalWins: e.totalWins,
        lastSeen: new Date(),
      },
      update: {
        totalGames: e.totalGames,
        totalWins: e.totalWins,
        lastSeen: new Date(),
      },
    })
    playersUpserted++
  }
  return { playersUpserted, championStatsUpserted: 0 }
}

/** Continent for Account-V1 (euw1, eun1 → europe). */
function regionToContinent(region: string): 'europe' | 'americas' | 'asia' {
  if (region === 'eun1' || region === 'euw1') return 'europe'
  if (region === 'na1' || region === 'br1' || region === 'la1' || region === 'la2') return 'americas'
  return 'asia'
}

/**
 * Count players without summoner_name. Used to skip enrichment when 0 and reserve API quota for match collection.
 */
export async function countPlayersMissingSummonerName(): Promise<number> {
  if (!isDatabaseConfigured()) return 0
  return prisma.player.count({ where: { summonerName: null } })
}

/**
 * Count participants without rank (rankTier null). Used to skip backfill when 0 and reserve API quota for match collection.
 */
export async function countParticipantsMissingRank(): Promise<number> {
  if (!isDatabaseConfigured()) return 0
  return prisma.participant.count({ where: { rankTier: null } })
}

/**
 * Enrich players missing summoner_name (Riot ID via Account-V1 by-puuid).
 * Run with a higher limit to fill summoner_name for many players (e.g. 100).
 */
const ENRICH_LOG = '[enrich]'

export async function enrichPlayers(limit = 150): Promise<{ enriched: number }> {
  if (!isDatabaseConfigured()) {
    console.warn(`${ENRICH_LOG} Skipped: database not configured`)
    return { enriched: 0 }
  }
  const riotApi = getRiotApiService()
  const players = await prisma.player.findMany({
    where: { summonerName: null },
    take: limit,
    select: { puuid: true, region: true },
  })
  console.log(`${ENRICH_LOG} Found ${players.length} players missing summoner_name`)
  if (players.length === 0) return { enriched: 0 }

  let enriched = 0
  for (const p of players) {
    const continent = regionToContinent(p.region)
    const accountResult = await riotApi.getAccountByPuuid(continent, p.puuid)
    if (accountResult.isErr()) {
      console.warn(`${ENRICH_LOG} Account API (by-puuid) failed for puuid ${p.puuid.slice(0, 8)}…: ${accountResult.unwrapErr().message}`)
      continue
    }
    const account = accountResult.unwrap()
    if (!account.riotId) continue
    await prisma.player.update({
      where: { puuid: p.puuid },
      data: { summonerName: account.riotId },
    })
    enriched++
  }
  console.log(`${ENRICH_LOG} Enriched ${enriched} players (summoner_name)`)
  return { enriched }
}

const BACKFILL_RANK_LOG = '[backfill-rank]'

export type RankEntry = { tier: string; rank: string; leaguePoints: number }

/**
 * Récupère les rangs de tous les puuids en parallèle (League API). Un appel par puuid, tous en même temps.
 * Utilisé avant d'insérer un match pour avoir match + participants avec rangs en une seule persistance.
 */
export async function fetchRanksForPuuids(
  platform: 'euw1' | 'eun1',
  puuids: string[]
): Promise<Map<string, RankEntry | null>> {
  const distinct = [...new Set(puuids.filter((p) => p && p.trim() !== ''))]
  if (distinct.length === 0) return new Map()
  const riotApi = getRiotApiService()
  const results = await Promise.all(
    distinct.map(async (puuid) => {
      const res = await riotApi.getLeagueEntriesByPuuid(platform, puuid)
      if (res.isErr()) return { puuid, entry: null as RankEntry | null }
      return { puuid, entry: res.unwrap() }
    })
  )
  const map = new Map<string, RankEntry | null>()
  for (const { puuid, entry } of results) map.set(puuid, entry)
  return map
}

/**
 * Calcule le rang moyen (label type "GOLD_II") à partir des entrées rank. Exclut UNRANKED et null.
 */
export function computeMatchRankLabel(
  entries: Map<string, RankEntry | null>
): string | null {
  const scores: number[] = []
  for (const entry of entries.values()) {
    if (!entry || entry.tier === UNRANKED_TIER) continue
    const div = entry.rank ?? ''
    const lp = typeof entry.leaguePoints === 'number' ? entry.leaguePoints : 0
    scores.push(rankToScore(entry.tier, div, lp))
  }
  if (scores.length === 0) return null
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  return scoreToRankLabel(avg)
}

/**
 * Fetch ranks for participants of a newly inserted match and update them immediately.
 * Préférer le flux : fetchRanksForPuuids + upsertMatchFromRiot(..., rankByPuuid) pour tout en une fois.
 */
export async function backfillRanksForNewMatch(
  matchId: string,
  region: 'euw1' | 'eun1',
  puuids: string[]
): Promise<{ updated: number }> {
  if (!isDatabaseConfigured() || puuids.length === 0) return { updated: 0 }
  const match = await prisma.match.findUnique({ where: { matchId }, select: { id: true } })
  if (!match) return { updated: 0 }
  const rankByPuuid = await fetchRanksForPuuids(region === 'eun1' ? 'eun1' : 'euw1', puuids)
  let updated = 0
  for (const [puuid, entry] of rankByPuuid) {
    const data = entry
      ? { rankTier: entry.tier, rankDivision: entry.rank, rankLp: entry.leaguePoints }
      : { rankTier: UNRANKED_TIER, rankDivision: undefined, rankLp: undefined }
    const result = await prisma.participant.updateMany({
      where: { matchId: match.id, puuid },
      data,
    })
    updated += result.count
  }
  return { updated }
}

/**
 * Backfill participant rank (rankTier, rankDivision, rankLp) for participants missing it.
 * Uses Riot League API by puuid (Solo/Duo). One API call per distinct puuid; updates all participant rows for that puuid.
 * Used for legacy backlog; new participants get rank via backfillRanksForNewMatch right after match insert.
 */
export async function backfillParticipantRanks(limit = 200): Promise<{ updated: number; errors: number }> {
  if (!isDatabaseConfigured()) {
    console.warn(`${BACKFILL_RANK_LOG} Skipped: database not configured`)
    return { updated: 0, errors: 0 }
  }
  const riotApi = getRiotApiService()
  const participants = await prisma.participant.findMany({
    where: { rankTier: null },
    select: { puuid: true, matchId: true },
  })
  const matchIds = [...new Set(participants.map((p) => p.matchId))]
  const matches = await prisma.match.findMany({
    where: { id: { in: matchIds } },
    select: { id: true, region: true },
  })
  const matchRegion = new Map<string, string>()
  for (const m of matches) matchRegion.set(String(m.id), m.region)

  const puuidToRegion = new Map<string, string>()
  for (const p of participants) {
    const region = matchRegion.get(String(p.matchId)) ?? 'euw1'
    const platform = region === 'eun1' ? 'eun1' : 'euw1'
    if (!puuidToRegion.has(p.puuid)) puuidToRegion.set(p.puuid, platform)
  }
  const puuids = [...puuidToRegion.keys()].slice(0, limit)

  let updated = 0
  let errors = 0
  for (const puuid of puuids) {
    const platform = puuidToRegion.get(puuid) === 'eun1' ? 'eun1' : 'euw1'
    const leagueResult = await riotApi.getLeagueEntriesByPuuid(platform, puuid)
    if (leagueResult.isErr()) {
      errors++
      continue
    }
    const entryData = leagueResult.unwrap()
    if (!entryData) {
      // Player has no Solo/Duo entry (unranked, decayed, etc.). Mark as UNRANKED so we stop retrying.
      const result = await prisma.participant.updateMany({
        where: { puuid, rankTier: null },
        data: { rankTier: UNRANKED_TIER, rankDivision: undefined, rankLp: undefined },
      })
      updated += result.count
      continue
    }
    const { tier, rank: division, leaguePoints } = entryData
    const result = await prisma.participant.updateMany({
      where: { puuid, rankTier: null },
      data: { rankTier: tier, rankDivision: division, rankLp: leaguePoints },
    })
    updated += result.count
  }
  console.log(`${BACKFILL_RANK_LOG} Updated ${updated} participants (${puuids.length} PUUIDs), ${errors} errors`)
  return { updated, errors }
}

/**
 * Recompute Match.rank from participants (average rank of players in the match).
 * Only participants with a real rank (tier + division) are included; UNRANKED and null are excluded.
 */
export async function refreshMatchRanks(): Promise<{ matchesUpdated: number }> {
  if (!isDatabaseConfigured()) return { matchesUpdated: 0 }
  const participants = await prisma.participant.findMany({
    where: {
      rankTier: { in: [...TIER_ORDER] },
      rankDivision: { not: null },
    },
    select: { matchId: true, rankTier: true, rankDivision: true, rankLp: true },
  })
  const byMatch = new Map<string, number[]>()
  for (const p of participants) {
    if (p.rankTier === UNRANKED_TIER) continue
    const tier = p.rankTier!
    const div = p.rankDivision!
    const lp = p.rankLp ?? 0
    const score = rankToScore(tier, div, lp)
    const key = String(p.matchId)
    if (!byMatch.has(key)) byMatch.set(key, [])
    byMatch.get(key)!.push(score)
  }
  let matchesUpdated = 0
  for (const [matchIdStr, scores] of byMatch) {
    if (scores.length === 0) continue
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    const rankLabel = scoreToRankLabel(avg)
    await prisma.match.update({
      where: { id: BigInt(matchIdStr) },
      data: { rank: rankLabel },
    })
    matchesUpdated++
  }
  return { matchesUpdated }
}
