/**
 * Refreshes players (totalGames, totalWins) from participants.
 * Champion stats are computed on the fly from participants; no pre-aggregated table.
 * Backfills participant rank (rankTier, rankDivision, rankLp) from Riot League API and Match.rank.
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'
import { isEuropePlatform, type EuropePlatform } from '../utils/riotRegions.js'
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

/**
 * @deprecated total_games/total_wins are now computed via view players_with_stats.
 * Kept for backward compatibility; returns no-op.
 */
export async function refreshPlayersAndChampionStats(): Promise<{
  playersUpserted: number
  championStatsUpserted: number
}> {
  return { playersUpserted: 0, championStatsUpserted: 0 }
}

/** Continent for Account-V1. Europe: euw1, eun1, tr1, ru, me1. */
function regionToContinent(region: string): 'europe' | 'americas' | 'asia' {
  const r = region.toLowerCase()
  if (['euw1', 'eun1', 'tr1', 'ru', 'me1'].includes(r)) return 'europe'
  if (['na1', 'br1', 'la1', 'la2'].includes(r)) return 'americas'
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
 * Count participants without role (role null). Used to skip role backfill when 0.
 */
export async function countParticipantsMissingRole(): Promise<number> {
  if (!isDatabaseConfigured()) return 0
  return prisma.participant.count({ where: { role: null } })
}

function normalizeRole(teamPosition?: string, individualPosition?: string): string | null {
  const pos = teamPosition ?? individualPosition ?? ''
  if (!pos || pos === 'Invalid' || pos === '') return null
  const upper = pos.toUpperCase()
  if (['TOP', 'JUNGLE', 'MIDDLE', 'MID', 'BOTTOM', 'BOT', 'UTILITY'].includes(upper)) {
    if (upper === 'MID') return 'MIDDLE'
    if (upper === 'BOT') return 'BOTTOM'
    return upper
  }
  return null
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
  platform: EuropePlatform,
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
  region: EuropePlatform,
  puuids: string[]
): Promise<{ updated: number }> {
  if (!isDatabaseConfigured() || puuids.length === 0) return { updated: 0 }
  const match = await prisma.match.findUnique({ where: { matchId }, select: { id: true } })
  if (!match) return { updated: 0 }
  const rankByPuuid = await fetchRanksForPuuids(region, puuids)
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
  // Requête limitée (distinct puuids) pour ne pas charger des centaines de milliers de lignes en mémoire
  const rows = await prisma.$queryRaw<{ puuid: string; region: string }[]>`
    SELECT DISTINCT ON (p.puuid) p.puuid, m.region
    FROM participants p
    INNER JOIN matches m ON m.id = p.match_id
    WHERE p.rank_tier IS NULL
    ORDER BY p.puuid
    LIMIT ${limit}
  `
  const puuidToRegion = new Map<string, EuropePlatform>()
  for (const r of rows) {
    const platform: EuropePlatform = isEuropePlatform(r.region) ? (r.region as EuropePlatform) : 'euw1'
    puuidToRegion.set(r.puuid, platform)
  }
  const puuids = rows.map((r) => r.puuid)

  let updated = 0
  let errors = 0
  for (const puuid of puuids) {
    const platform = puuidToRegion.get(puuid) ?? 'euw1'
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
 * Backfill participant role for rows where role is null, by refetching recent matches from Riot.
 * limitMatches = max number of matches to inspect in one run.
 */
export async function backfillParticipantRoles(limitMatches = 50): Promise<{ updated: number; errors: number; matches: number }> {
  if (!isDatabaseConfigured()) {
    console.warn('[backfill-role] Skipped: database not configured')
    return { updated: 0, errors: 0, matches: 0 }
  }
  const riotApi = getRiotApiService()
  const safeLimit = Number.isFinite(limitMatches) ? Math.max(1, Math.min(500, Math.trunc(limitMatches))) : 50
  const rows = await prisma.$queryRaw<Array<{ id: bigint; matchId: string; region: string }>>`
    SELECT m.id, m.match_id AS "matchId", m.region
    FROM matches m
    WHERE EXISTS (
      SELECT 1
      FROM participants p
      WHERE p.match_id = m.id
        AND p.role IS NULL
    )
    ORDER BY m.id DESC
    LIMIT ${safeLimit}
  `

  let updated = 0
  let errors = 0
  for (const row of rows) {
    const matchRes = await riotApi.getMatch(row.matchId)
    if (matchRes.isErr()) {
      errors++
      continue
    }
    const match = matchRes.unwrap()
    const participants = match.info?.participants ?? []
    for (const p of participants) {
      const puuid = typeof p.puuid === 'string' ? p.puuid.trim() : ''
      if (!puuid) continue
      const role = normalizeRole(p.teamPosition, p.individualPosition)
      if (!role) continue
      const r = await prisma.participant.updateMany({
        where: { matchId: row.id, puuid, role: null },
        data: { role },
      })
      updated += r.count
    }
  }

  return { updated, errors, matches: rows.length }
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
