/**
 * Refreshes players and champion_player_stats from participants (aggregation).
 * Run after match collection or on a schedule (e.g. every 12h).
 * Optionally enriches Player.summonerName (Riot ID via Account-V1 by-puuid).
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

/** Continent for Account-V1 (euw1, eun1 → europe). */
function regionToContinent(region: string): 'europe' | 'americas' | 'asia' {
  if (region === 'eun1' || region === 'euw1') return 'europe'
  if (region === 'na1' || region === 'br1' || region === 'la1' || region === 'la2') return 'americas'
  return 'asia'
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
