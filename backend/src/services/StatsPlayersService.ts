/**
 * Top players and champion stats: computed on the fly from match_players (new schema).
 */
import { Prisma } from '../generated/prisma/index.js'
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'
import { toQueryStringArrayParam } from '../utils/statsFilters.js'

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


function rankTierMatchPlayerSql(
  rankTier: string | string[] | null | undefined,
  highRankOnly: boolean
): Prisma.Sql {
  const tiers = toQueryStringArrayParam(rankTier).map((t) => t.toUpperCase())
  if (tiers.length === 1) return Prisma.sql`AND mp.rank_tier = ${tiers[0]}`
  if (tiers.length > 1) {
    return Prisma.sql`AND mp.rank_tier IN (${Prisma.join(tiers.map((t) => Prisma.sql`${t}`))})`
  }
  return highRankOnly
    ? Prisma.sql`AND mp.rank_tier IN ('MASTER', 'GRANDMASTER', 'CHALLENGER')`
    : Prisma.sql``
}

export async function getTopPlayers(options: {
  rankTier?: string | string[] | null
  highRankOnly?: boolean
  minGames?: number
  limit?: number
}): Promise<PlayerRow[]> {
  if (!isDatabaseConfigured()) return []
  const { rankTier, highRankOnly = false, minGames = 50, limit = 100 } = options
  try {
    type StatsRow = {
      id: bigint
      puuid: string
      game_name: string | null
      tag_name: string | null
      region: string
      total_games: bigint
      total_wins: bigint
    }

    const rankTierFilter = rankTierMatchPlayerSql(rankTier, highRankOnly)

    const rows = await prisma.$queryRaw<StatsRow[]>(
      Prisma.sql`
        SELECT
          pl.id,
          pl.puuid,
          pl.game_name,
          pl.tag_name,
          pl.region,
          COUNT(mp.id) AS total_games,
          SUM(CASE WHEN t.win THEN 1 ELSE 0 END) AS total_wins
        FROM players pl
        INNER JOIN match_players mp ON mp.player_id = pl.id
        INNER JOIN teams t ON t.id = mp.team_id
        WHERE 1=1 ${rankTierFilter}
        GROUP BY pl.id
        HAVING COUNT(mp.id) >= ${minGames}
        ORDER BY total_wins DESC
        LIMIT ${limit}
      `
    )

    return rows.map((p) => {
      const totalGames = Number(p.total_games)
      const totalWins = Number(p.total_wins)
      return {
        puuid: p.puuid,
        maskedPuid: maskPuuid(p.puuid),
        summonerName: displayName(p.game_name, p.tag_name),
        region: p.region,
        rankTier: null,
        totalGames,
        totalWins,
        winrate: totalGames > 0 ? Math.round((totalWins / totalGames) * 10000) / 100 : 0,
      }
    })
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

export async function getPlayerBySummonerName(summonerName: string): Promise<PlayerRow | null> {
  if (!isDatabaseConfigured() || !summonerName?.trim()) return null
  const name = summonerName.trim()
  const pattern = `%${name}%`
  try {
    type StatsRow = {
      puuid: string
      game_name: string | null
      tag_name: string | null
      region: string
      total_games: bigint
      total_wins: bigint
    }
    const rows = await prisma.$queryRaw<StatsRow[]>(
      Prisma.sql`
        SELECT
          pl.puuid,
          pl.game_name,
          pl.tag_name,
          pl.region,
          COUNT(mp.id) AS total_games,
          SUM(CASE WHEN t.win THEN 1 ELSE 0 END) AS total_wins
        FROM players pl
        INNER JOIN match_players mp ON mp.player_id = pl.id
        INNER JOIN teams t ON t.id = mp.team_id
        WHERE pl.game_name ILIKE ${pattern} OR pl.tag_name ILIKE ${pattern}
        GROUP BY pl.puuid, pl.game_name, pl.tag_name, pl.region
        LIMIT 1
      `
    )
    const p = rows[0]
    if (!p) return null
    const totalGames = Number(p.total_games)
    const totalWins = Number(p.total_wins)
    return {
      puuid: p.puuid,
      maskedPuid: maskPuuid(p.puuid),
      summonerName: displayName(p.game_name, p.tag_name),
      region: p.region,
      rankTier: null,
      totalGames,
      totalWins,
      winrate: totalGames > 0 ? Math.round((totalWins / totalGames) * 10000) / 100 : 0,
    }
  } catch {
    return null
  }
}

export async function getChampionStatsForPlayer(
  puuid: string,
  limit = 50
): Promise<PlayerChampionStatRow[]> {
  if (!isDatabaseConfigured()) return []
  try {
    const player = await prisma.player.findUnique({ where: { puuid }, select: { id: true } })
    if (!player) return []

    type Row = { championId: number; games: number; wins: number; winrate: number }
    const rows = await prisma.$queryRaw<Row[]>(
      Prisma.sql`
        SELECT
          mp.champion_id AS "championId",
          COUNT(mp.id)::int AS games,
          SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS wins,
          ROUND(100.0 * SUM(CASE WHEN t.win THEN 1 ELSE 0 END) / NULLIF(COUNT(mp.id), 0), 2)::double precision AS winrate
        FROM match_players mp
        INNER JOIN teams t ON t.id = mp.team_id
        WHERE mp.player_id = ${player.id}
        GROUP BY mp.champion_id
        ORDER BY games DESC
        LIMIT ${limit}
      `
    )
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

export async function getTopPlayersByChampion(options: {
  championId: number
  rankTier?: string | string[] | null
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
      rank_tier: string | null
      avg_kills: number | null
      avg_deaths: number | null
      avg_assists: number | null
    }

    const tiers = toQueryStringArrayParam(rankTier).map((t) => t.toUpperCase())
    const rankTierFilter =
      tiers.length === 1
        ? Prisma.sql`AND mp.rank_tier = ${tiers[0]}`
        : tiers.length > 1
          ? Prisma.sql`AND mp.rank_tier IN (${Prisma.join(tiers.map((t) => Prisma.sql`${t}`))})`
          : highRankOnly
            ? Prisma.sql`AND mp.rank_tier IN ('MASTER', 'GRANDMASTER', 'CHALLENGER')`
            : Prisma.sql``

    const rows = await prisma.$queryRaw<Row[]>(
      Prisma.sql`
        WITH latest_rank AS (
          SELECT DISTINCT ON (mp2.player_id) mp2.player_id, mp2.rank_tier
          FROM match_players mp2
          WHERE mp2.champion_id = ${championId}
          ORDER BY mp2.player_id, mp2.match_id DESC
        )
        SELECT
          pl.puuid,
          pl.game_name,
          pl.tag_name,
          pl.region,
          COUNT(mp.id)::int AS games,
          SUM(CASE WHEN t.win THEN 1 ELSE 0 END)::int AS wins,
          ROUND(100.0 * SUM(CASE WHEN t.win THEN 1 ELSE 0 END) / NULLIF(COUNT(mp.id), 0), 2)::double precision AS winrate,
          MAX(lr.rank_tier) AS rank_tier,
          ROUND(AVG(mpc.kills)::numeric, 2)::double precision AS avg_kills,
          ROUND(AVG(mpc.deaths)::numeric, 2)::double precision AS avg_deaths,
          ROUND(AVG(mpc.assists)::numeric, 2)::double precision AS avg_assists
        FROM match_players mp
        INNER JOIN teams t ON t.id = mp.team_id
        JOIN players pl ON pl.id = mp.player_id
        LEFT JOIN match_player_core mpc ON mpc.match_player_id = mp.id
        LEFT JOIN latest_rank lr ON lr.player_id = mp.player_id
        WHERE mp.champion_id = ${championId}
          ${rankTierFilter}
        GROUP BY pl.puuid, pl.game_name, pl.tag_name, pl.region
        HAVING COUNT(mp.id) >= ${minGames}
        ORDER BY winrate DESC, games DESC
        LIMIT ${limit}
      `
    )
    return rows.map((r) => ({
      puuid: r.puuid,
      maskedPuid: maskPuuid(r.puuid),
      summonerName: displayName(r.game_name, r.tag_name),
      region: r.region,
      rankTier: r.rank_tier ?? null,
      games: r.games,
      wins: r.wins,
      winrate: r.winrate,
      avgKills: r.avg_kills,
      avgDeaths: r.avg_deaths,
      avgAssists: r.avg_assists,
    }))
  } catch {
    return []
  }
}
