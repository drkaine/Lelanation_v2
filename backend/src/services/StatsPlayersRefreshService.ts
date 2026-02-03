/**
 * Refreshes players and champion_player_stats from participants (aggregation).
 * Run after match collection or on a schedule (e.g. every 12h).
 * Optionally enriches Player.summonerName and Player.currentRankTier/Division via Riot Summoner + League APIs.
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'
import { getRiotApiService } from './RiotApiService.js'

export async function refreshPlayersAndChampionStats(): Promise<{
  playersUpserted: number
  championStatsUpserted: number
}> {
  if (!isDatabaseConfigured()) return { playersUpserted: 0, championStatsUpserted: 0 }
  const participants = await prisma.participant.findMany({
    select: {
      puuid: true,
      summonerId: true,
      championId: true,
      win: true,
      rankTier: true,
      rankDivision: true,
      rankLp: true,
      kills: true,
      deaths: true,
      assists: true,
      matchId: true,
    },
  })
  const matchIds = [...new Set(participants.map((p) => p.matchId))]
  const matches = await prisma.match.findMany({
    where: { id: { in: matchIds } },
    select: { id: true, region: true },
  })
  const matchRegion = new Map<string, string>()
  for (const m of matches) matchRegion.set(String(m.id), m.region)

  const byPuuid = new Map<
    string,
    {
      summonerId: string | null
      region: string
      totalGames: number
      totalWins: number
      lastRank: { tier: string | null; division: string | null; lp: number | null }
      byChamp: Map<
        number,
        { games: number; wins: number; kills: number; deaths: number; assists: number }
      >
    }
  >()
  for (const p of participants) {
    const region = matchRegion.get(String(p.matchId)) ?? 'euw1'
    let entry = byPuuid.get(p.puuid)
    if (!entry) {
      entry = {
        summonerId: p.summonerId ?? null,
        region,
        totalGames: 0,
        totalWins: 0,
        lastRank: { tier: p.rankTier, division: p.rankDivision, lp: p.rankLp },
        byChamp: new Map(),
      }
      byPuuid.set(p.puuid, entry)
    }
    entry.totalGames++
    if (p.win) entry.totalWins++
    entry.lastRank = { tier: p.rankTier, division: p.rankDivision, lp: p.rankLp }
    const champ = entry.byChamp.get(p.championId) ?? {
      games: 0,
      wins: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
    }
    champ.games++
    if (p.win) champ.wins++
    champ.kills += p.kills ?? 0
    champ.deaths += p.deaths ?? 0
    champ.assists += p.assists ?? 0
    entry.byChamp.set(p.championId, champ)
  }

  let playersUpserted = 0
  let championStatsUpserted = 0
  for (const [puuid, e] of byPuuid) {
    await prisma.player.upsert({
      where: { puuid },
      create: {
        puuid,
        summonerId: e.summonerId,
        region: e.region,
        currentRankTier: e.lastRank.tier,
        currentRankDivision: e.lastRank.division,
        currentRankLp: e.lastRank.lp,
        totalGames: e.totalGames,
        totalWins: e.totalWins,
        lastSeen: new Date(),
      },
      update: {
        totalGames: e.totalGames,
        totalWins: e.totalWins,
        currentRankTier: e.lastRank.tier,
        currentRankDivision: e.lastRank.division,
        currentRankLp: e.lastRank.lp,
        lastSeen: new Date(),
      },
    })
    playersUpserted++

    for (const [championId, c] of e.byChamp) {
      const winrate = c.games > 0 ? (c.wins / c.games) * 100 : 0
      await prisma.championPlayerStats.upsert({
        where: {
          puuid_championId: { puuid, championId },
        },
        create: {
          puuid,
          championId,
          games: c.games,
          wins: c.wins,
          winrate,
          avgKills: c.games > 0 ? c.kills / c.games : null,
          avgDeaths: c.games > 0 ? c.deaths / c.games : null,
          avgAssists: c.games > 0 ? c.assists / c.games : null,
          lastPlayed: new Date(),
        },
        update: {
          games: c.games,
          wins: c.wins,
          winrate,
          avgKills: c.games > 0 ? c.kills / c.games : null,
          avgDeaths: c.games > 0 ? c.deaths / c.games : null,
          avgAssists: c.games > 0 ? c.assists / c.games : null,
          lastPlayed: new Date(),
        },
      })
      championStatsUpserted++
    }
  }
  return { playersUpserted, championStatsUpserted }
}

/** Platform from Player.region (euw1, eun1). */
function regionToPlatform(region: string): 'euw1' | 'eun1' {
  return region === 'eun1' ? 'eun1' : 'euw1'
}

/**
 * Enrich players missing summoner_name or current_rank_* via Riot Summoner-v4 and League-v4.
 * Processes up to `limit` players per run to respect rate limits. Returns count enriched.
 */
const ENRICH_LOG = '[enrich]'

export async function enrichPlayers(limit = 25): Promise<{ enriched: number }> {
  if (!isDatabaseConfigured()) {
    console.warn(`${ENRICH_LOG} Skipped: database not configured`)
    return { enriched: 0 }
  }
  const riotApi = getRiotApiService()
  const players = await prisma.player.findMany({
    where: {
      OR: [
        { summonerName: null },
        { currentRankTier: null, summonerId: { not: null } },
      ],
    },
    take: limit,
    select: { puuid: true, region: true, summonerId: true, summonerName: true, currentRankTier: true },
  })
  console.log(`${ENRICH_LOG} Found ${players.length} players to enrich (summoner_name or rank missing)`)
  if (players.length === 0) return { enriched: 0 }

  let enriched = 0
  for (const p of players) {
    const platform = regionToPlatform(p.region)
    const updated: {
      summonerName?: string
      summonerId?: string
      currentRankTier?: string
      currentRankDivision?: string
      currentRankLp?: number
    } = {}

    if (!p.summonerName) {
      const summonerResult = await riotApi.getSummonerByPuuid(platform, p.puuid)
      if (summonerResult.isOk()) {
        const s = summonerResult.unwrap()
        if (s.name) updated.summonerName = s.name
        if (s.id) updated.summonerId = s.id
      } else {
        console.warn(`${ENRICH_LOG} Summoner API failed for puuid ${p.puuid.slice(0, 8)}…: ${summonerResult.unwrapErr().message}`)
      }
    }

    const summonerId = updated.summonerId ?? p.summonerId
    if (summonerId && !p.currentRankTier) {
      const leagueResult = await riotApi.getLeagueEntriesBySummonerId(platform, summonerId)
      if (leagueResult.isOk()) {
        const entry = leagueResult.unwrap()
        if (entry) {
          updated.currentRankTier = entry.tier
          updated.currentRankDivision = entry.rank
          updated.currentRankLp = entry.leaguePoints
        }
      } else {
        console.warn(`${ENRICH_LOG} League API failed for summonerId ${summonerId.slice(0, 12)}…: ${leagueResult.unwrapErr().message}`)
      }
    }

    if (Object.keys(updated).length > 0) {
      await prisma.player.update({
        where: { puuid: p.puuid },
        data: updated,
      })
      enriched++
      // Backfill Participant.rankTier/rankDivision/rankLp for this puuid (Match API doesn't return rank; use current rank)
      const participantRankData: { rankTier?: string; rankDivision?: string; rankLp?: number } = {}
      if (updated.currentRankTier != null) participantRankData.rankTier = updated.currentRankTier
      if (updated.currentRankDivision != null) participantRankData.rankDivision = updated.currentRankDivision
      if (updated.currentRankLp != null) participantRankData.rankLp = updated.currentRankLp
      if (Object.keys(participantRankData).length > 0) {
        await prisma.participant.updateMany({
          where: { puuid: p.puuid },
          data: participantRankData,
        })
      }
    }
  }
  console.log(`${ENRICH_LOG} Enriched ${enriched} players`)
  return { enriched }
}
