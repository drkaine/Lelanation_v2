/**
 * Top players and champion stats: computed on the fly from participants (no pre-aggregated table).
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
    const where: { totalGames: { gte: number }; puuid?: { in: string[] } } = { totalGames: { gte: minGames } }
    if (rankTier != null && rankTier !== '') {
      const puuids = await prisma.participant.findMany({
        where: { rankTier },
        select: { puuid: true },
        distinct: ['puuid'],
      })
      where.puuid = { in: puuids.map((r) => r.puuid) }
    }

    const players = await prisma.player.findMany({
      where,
      orderBy: [{ totalWins: 'desc' }],
      take: limit,
    })

    return players.map((p) => ({
      puuid: p.puuid,
      maskedPuid: maskPuuid(p.puuid),
      summonerName: p.summonerName,
      region: p.region,
      rankTier: null,
      totalGames: p.totalGames,
      totalWins: p.totalWins,
      winrate: p.totalGames > 0 ? Math.round((p.totalWins / p.totalGames) * 10000) / 100 : 0,
    }))
  } catch {
    return []
  }
}

export interface PlayerChampionStatRow {
  championId: number
  games: number
  wins: number
  winrate: number
}

/** Find a player by summoner name (case-insensitive partial match). */
export async function getPlayerBySummonerName(summonerName: string): Promise<PlayerRow | null> {
  if (!isDatabaseConfigured() || !summonerName?.trim()) return null
  const name = summonerName.trim()
  try {
    const player = await prisma.player.findFirst({
      where: {
        summonerName: { contains: name, mode: 'insensitive' },
      },
    })
    if (!player) return null
    return {
      puuid: player.puuid,
      maskedPuid: maskPuuid(player.puuid),
      summonerName: player.summonerName,
      region: player.region,
      rankTier: null,
      totalGames: player.totalGames,
      totalWins: player.totalWins,
      winrate:
        player.totalGames > 0
          ? Math.round((player.totalWins / player.totalGames) * 10000) / 100
          : 0,
    }
  } catch {
    return null
  }
}

/** Champion stats for a given player (puuid), computed from participants. */
export async function getChampionStatsForPlayer(
  puuid: string,
  limit = 50
): Promise<PlayerChampionStatRow[]> {
  if (!isDatabaseConfigured()) return []
  try {
    const rows = await prisma.$queryRaw<
      Array<{ championId: number; games: number; wins: number; winrate: number }>
    >`
      SELECT
        champion_id AS "championId",
        COUNT(*)::int AS games,
        SUM(CASE WHEN win THEN 1 ELSE 0 END)::int AS wins,
        ROUND(100.0 * SUM(CASE WHEN win THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2)::double precision AS winrate
      FROM participants
      WHERE puuid = ${puuid}
      GROUP BY champion_id
      ORDER BY games DESC
      LIMIT ${limit}
    `
    return rows.map((r) => ({
      championId: r.championId,
      games: r.games,
      wins: r.wins,
      winrate: r.winrate,
    }))
  } catch {
    return []
  }
}

/** Top players by champion, computed from participants (on the fly). */
export async function getTopPlayersByChampion(options: {
  championId: number
  rankTier?: string | null
  minGames?: number
  limit?: number
}): Promise<ChampionPlayerRow[]> {
  if (!isDatabaseConfigured()) return []
  const { championId, rankTier, minGames = 20, limit = 50 } = options
  try {
    type Row = {
      puuid: string
      summonerName: string | null
      region: string
      games: number
      wins: number
      winrate: number
      avgKills: number | null
      avgDeaths: number | null
      avgAssists: number | null
    }
    const rows: Row[] =
      rankTier != null && rankTier !== ''
        ? await prisma.$queryRaw<Row[]>`
            SELECT
              p.puuid,
              pl.summoner_name AS "summonerName",
              pl.region,
              COUNT(*)::int AS games,
              SUM(CASE WHEN p.win THEN 1 ELSE 0 END)::int AS wins,
              ROUND(100.0 * SUM(CASE WHEN p.win THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2)::double precision AS winrate,
              ROUND(AVG(p.kills)::numeric, 2)::double precision AS "avgKills",
              ROUND(AVG(p.deaths)::numeric, 2)::double precision AS "avgDeaths",
              ROUND(AVG(p.assists)::numeric, 2)::double precision AS "avgAssists"
            FROM participants p
            JOIN players pl ON pl.puuid = p.puuid
            WHERE p.champion_id = ${championId}
              AND p.puuid IN (SELECT puuid FROM participants WHERE rank_tier = ${rankTier} LIMIT 10000)
            GROUP BY p.puuid, pl.summoner_name, pl.region
            HAVING COUNT(*) >= ${minGames}
            ORDER BY winrate DESC, games DESC
            LIMIT ${limit}
          `
        : await prisma.$queryRaw<Row[]>`
            SELECT
              p.puuid,
              pl.summoner_name AS "summonerName",
              pl.region,
              COUNT(*)::int AS games,
              SUM(CASE WHEN p.win THEN 1 ELSE 0 END)::int AS wins,
              ROUND(100.0 * SUM(CASE WHEN p.win THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2)::double precision AS winrate,
              ROUND(AVG(p.kills)::numeric, 2)::double precision AS "avgKills",
              ROUND(AVG(p.deaths)::numeric, 2)::double precision AS "avgDeaths",
              ROUND(AVG(p.assists)::numeric, 2)::double precision AS "avgAssists"
            FROM participants p
            JOIN players pl ON pl.puuid = p.puuid
            WHERE p.champion_id = ${championId}
            GROUP BY p.puuid, pl.summoner_name, pl.region
            HAVING COUNT(*) >= ${minGames}
            ORDER BY winrate DESC, games DESC
            LIMIT ${limit}
          `
    return rows.map((r) => ({
      puuid: r.puuid,
      maskedPuid: maskPuuid(r.puuid),
      summonerName: r.summonerName,
      region: r.region,
      rankTier: null,
      games: r.games,
      wins: r.wins,
      winrate: r.winrate,
      avgKills: r.avgKills,
      avgDeaths: r.avgDeaths,
      avgAssists: r.avgAssists,
    }))
  } catch {
    return []
  }
}
