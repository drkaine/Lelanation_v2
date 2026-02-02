/**
 * Top players (from players + champion_player_stats). Requires refresh job to populate.
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'

export interface PlayerRow {
  puuid: string
  maskedPuid: string
  summonerName: string | null
  region: string
  rankTier: string | null
  totalGames: number
  totalWins: number
  winrate: number
}

export interface ChampionPlayerRow {
  puuid: string
  maskedPuid: string
  summonerName: string | null
  region: string
  rankTier: string | null
  games: number
  wins: number
  winrate: number
  avgKills: number | null
  avgDeaths: number | null
  avgAssists: number | null
}

function maskPuuid(puuid: string): string {
  if (!puuid || puuid.length < 12) return '****'
  return `${puuid.slice(0, 4)}****...${puuid.slice(-4)}`
}

export async function getTopPlayers(options: {
  rankTier?: string | null
  minGames?: number
  limit?: number
}): Promise<PlayerRow[]> {
  if (!isDatabaseConfigured()) return []
  const { rankTier, minGames = 50, limit = 100 } = options
  try {
    const where: { currentRankTier?: string | null } = {}
    if (rankTier != null && rankTier !== '') where.currentRankTier = rankTier

    const players = await prisma.player.findMany({
      where: { ...where, totalGames: { gte: minGames } },
      orderBy: [{ totalWins: 'desc' }],
      take: limit,
    })

    return players.map((p) => ({
      puuid: p.puuid,
      maskedPuid: maskPuuid(p.puuid),
      summonerName: p.summonerName,
      region: p.region,
      rankTier: p.currentRankTier,
      totalGames: p.totalGames,
      totalWins: p.totalWins,
      winrate: p.totalGames > 0 ? Math.round((p.totalWins / p.totalGames) * 10000) / 100 : 0,
    }))
  } catch {
    return []
  }
}

export async function getTopPlayersByChampion(options: {
  championId: number
  rankTier?: string | null
  minGames?: number
  limit?: number
}): Promise<ChampionPlayerRow[]> {
  if (!isDatabaseConfigured()) return []
  const { championId, rankTier, minGames = 20, limit = 50 } = options
  try {
    const where: { championId: number; games: { gte: number }; player?: { currentRankTier?: string | null } } = {
      championId,
      games: { gte: minGames },
    }
    if (rankTier != null && rankTier !== '') {
      where.player = { currentRankTier: rankTier }
    }

    const rows = await prisma.championPlayerStats.findMany({
      where,
      include: { player: true },
      orderBy: [{ winrate: 'desc' }, { games: 'desc' }],
      take: limit,
    })

    return rows.map((r) => ({
      puuid: r.puuid,
      maskedPuid: maskPuuid(r.puuid),
      summonerName: r.player.summonerName,
      region: r.player.region,
      rankTier: r.player.currentRankTier,
      games: r.games,
      wins: r.wins,
      winrate: Number(r.winrate),
      avgKills: r.avgKills != null ? Number(r.avgKills) : null,
      avgDeaths: r.avgDeaths != null ? Number(r.avgDeaths) : null,
      avgAssists: r.avgAssists != null ? Number(r.avgAssists) : null,
    }))
  } catch {
    return []
  }
}
