/**
 * Top players and champion stats: computed on the fly from participants (no pre-aggregated table).
 * total_games/total_wins from view players_with_stats.
 */
import { Prisma } from '../generated/prisma/index.js'
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'

export interface PlayerRow {
  puuid: string
  maskedPuid: string
  /** Display name: gameName#tagName or gameName or '—' */
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

function displayName(gameName: string | null, tagName: string | null): string | null {
  if (gameName && tagName) return `${gameName}#${tagName}`
  if (gameName) return gameName
  return null
}

function maskPuuid(puuid: string): string {
  if (!puuid || puuid.length < 12) return '****'
  return `${puuid.slice(0, 4)}****...${puuid.slice(-4)}`
}

const HIGH_RANK_TIERS = ['MASTER', 'GRANDMASTER', 'CHALLENGER'] as const

export async function getTopPlayers(options: {
  rankTier?: string | null
  /** When true, only players who have at least one participant row with rank_tier in MASTER, GRANDMASTER, CHALLENGER */
  highRankOnly?: boolean
  minGames?: number
  limit?: number
}): Promise<PlayerRow[]> {
  if (!isDatabaseConfigured()) return []
  const { rankTier, highRankOnly = false, minGames = 50, limit = 100 } = options
  try {
    type ViewRow = { id: bigint; puuid: string; game_name: string | null; tag_name: string | null; region: string; total_games: number; total_wins: number }
    if (rankTier != null && rankTier !== '') {
      const whereRank = highRankOnly
        ? { rankTier: { in: [...HIGH_RANK_TIERS] } }
        : { rankTier }
      const playerIds = await prisma.participant.findMany({
        where: whereRank,
        select: { playerId: true },
        distinct: ['playerId'],
      })
      const idList = playerIds.map((r) => r.playerId)
      if (idList.length === 0) return []
      const rows = await prisma.$queryRaw<ViewRow[]>(Prisma.sql`
        SELECT id, puuid, game_name, tag_name, region, total_games, total_wins
        FROM players_with_stats
        WHERE total_games >= ${minGames} AND id = ANY(${idList}::bigint[])
        ORDER BY total_wins DESC
        LIMIT ${limit}
      `)
      return rows.map((p) => ({
        puuid: p.puuid,
        maskedPuid: maskPuuid(p.puuid),
        summonerName: displayName(p.game_name, p.tag_name),
        region: p.region,
        rankTier: null,
        totalGames: Number(p.total_games),
        totalWins: Number(p.total_wins),
        winrate: p.total_games > 0 ? Math.round((p.total_wins / p.total_games) * 10000) / 100 : 0,
      }))
    }
    const idFilter = highRankOnly
      ? Prisma.sql`AND id IN (SELECT player_id FROM participants WHERE rank_tier IN ('MASTER', 'GRANDMASTER', 'CHALLENGER') LIMIT 50000)`
      : Prisma.sql``
    const rows = await prisma.$queryRaw<ViewRow[]>(Prisma.sql`
      SELECT id, puuid, game_name, tag_name, region, total_games, total_wins
      FROM players_with_stats
      WHERE total_games >= ${minGames}
      ${idFilter}
      ORDER BY total_wins DESC
      LIMIT ${limit}
    `)
    return rows.map((p) => ({
      puuid: p.puuid,
      maskedPuid: maskPuuid(p.puuid),
      summonerName: displayName(p.game_name, p.tag_name),
      region: p.region,
      rankTier: null,
      totalGames: Number(p.total_games),
      totalWins: Number(p.total_wins),
      winrate: p.total_games > 0 ? Math.round((p.total_wins / p.total_games) * 10000) / 100 : 0,
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

/** Find a player by display name (game_name or tag_name, case-insensitive partial match). */
export async function getPlayerBySummonerName(summonerName: string): Promise<PlayerRow | null> {
  if (!isDatabaseConfigured() || !summonerName?.trim()) return null
  const name = summonerName.trim()
  const pattern = `%${name}%`
  try {
    const rows = await prisma.$queryRaw<
      Array<{ puuid: string; game_name: string | null; tag_name: string | null; region: string; total_games: number; total_wins: number }>
    >(Prisma.sql`
      SELECT puuid, game_name, tag_name, region, total_games, total_wins
      FROM players_with_stats
      WHERE game_name ILIKE ${pattern} OR tag_name ILIKE ${pattern}
      LIMIT 1
    `)
    const p = rows[0]
    if (!p) return null
    return {
      puuid: p.puuid,
      maskedPuid: maskPuuid(p.puuid),
      summonerName: displayName(p.game_name, p.tag_name),
      region: p.region,
      rankTier: null,
      totalGames: Number(p.total_games),
      totalWins: Number(p.total_wins),
      winrate: p.total_games > 0 ? Math.round((p.total_wins / p.total_games) * 10000) / 100 : 0,
    }
  } catch {
    return null
  }
}

/** Champion stats for a given player (puuid), computed from participants via player_id. */
export async function getChampionStatsForPlayer(
  puuid: string,
  limit = 50
): Promise<PlayerChampionStatRow[]> {
  if (!isDatabaseConfigured()) return []
  try {
    const player = await prisma.player.findUnique({ where: { puuid }, select: { id: true } })
    if (!player) return []
    const rows = await prisma.$queryRaw<
      Array<{ championId: number; games: number; wins: number; winrate: number }>
    >(Prisma.sql`
      SELECT
        champion_id AS "championId",
        COUNT(*)::int AS games,
        SUM(CASE WHEN win THEN 1 ELSE 0 END)::int AS wins,
        ROUND(100.0 * SUM(CASE WHEN win THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2)::double precision AS winrate
      FROM participants
      WHERE player_id = ${player.id}
      GROUP BY champion_id
      ORDER BY games DESC
      LIMIT ${limit}
    `)
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
  /** When true, only players whose latest rank is MASTER, GRANDMASTER or CHALLENGER */
  highRankOnly?: boolean
  minGames?: number
  limit?: number
}): Promise<ChampionPlayerRow[]> {
  if (!isDatabaseConfigured()) return []
  const { championId, rankTier, highRankOnly = false, minGames = 20, limit = 50 } = options
  try {
    type Row = {
      puuid: string
      game_name: string | null
      tag_name: string | null
      region: string
      games: number
      wins: number
      winrate: number
      rankTier: string | null
      avgKills: number | null
      avgDeaths: number | null
      avgAssists: number | null
    }
    const highRankFilter = highRankOnly
      ? Prisma.sql`AND p.player_id IN (SELECT player_id FROM participants WHERE rank_tier IN ('MASTER', 'GRANDMASTER', 'CHALLENGER') LIMIT 50000)`
      : Prisma.sql``
    const rankTierFilter =
      rankTier != null && rankTier !== ''
        ? Prisma.sql`AND p.player_id IN (SELECT player_id FROM participants WHERE rank_tier = ${rankTier} LIMIT 10000)`
        : Prisma.sql``
    const rows: Row[] = await prisma.$queryRaw<Row[]>(
      Prisma.sql`
      WITH latest_rank AS (
        SELECT DISTINCT ON (p2.player_id) p2.player_id, p2.rank_tier
        FROM participants p2
        WHERE p2.champion_id = ${championId}
        ORDER BY p2.player_id, p2.match_id DESC
      )
      SELECT
        pl.puuid,
        pl.game_name,
        pl.tag_name,
        pl.region,
        COUNT(*)::int AS games,
        SUM(CASE WHEN p.win THEN 1 ELSE 0 END)::int AS wins,
        ROUND(100.0 * SUM(CASE WHEN p.win THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2)::double precision AS winrate,
        MAX(lr.rank_tier) AS "rankTier",
        ROUND(AVG(p.kills)::numeric, 2)::double precision AS "avgKills",
        ROUND(AVG(p.deaths)::numeric, 2)::double precision AS "avgDeaths",
        ROUND(AVG(p.assists)::numeric, 2)::double precision AS "avgAssists"
      FROM participants p
      JOIN players pl ON pl.id = p.player_id
      LEFT JOIN latest_rank lr ON lr.player_id = p.player_id
      WHERE p.champion_id = ${championId}
        ${rankTierFilter}
        ${highRankFilter}
      GROUP BY pl.puuid, pl.game_name, pl.tag_name, pl.region
      HAVING COUNT(*) >= ${minGames}
      ORDER BY winrate DESC, games DESC
      LIMIT ${limit}
    `
    )
    return rows.map((r) => ({
      puuid: r.puuid,
      maskedPuid: maskPuuid(r.puuid),
      summonerName: displayName(r.game_name, r.tag_name),
      region: r.region,
      rankTier: r.rankTier ?? null,
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
