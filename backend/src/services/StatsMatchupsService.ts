/**
 * Matchups by champion: winrate vs each opponent, from mv_champion_vs_stats (vue matérialisée).
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'
import { toQueryStringArrayParam } from '../utils/statsFilters.js'

export interface MatchupRow {
  opponentChampionId: number
  games: number
  wins: number
  winrate: number
}

export interface MatchupsByChampionOptions {
  championId: number
  version?: string | null
  rankTier?: string | string[] | null
  role?: string | null
  region?: string | null
  minGames?: number
}

export async function getMatchupsByChampion(
  options: MatchupsByChampionOptions
): Promise<{ matchups: MatchupRow[] } | null> {
  if (!isDatabaseConfigured()) return null
  const { championId, version, rankTier, role, region, minGames = 10 } = options
  try {
    const pVersion = version != null && version !== '' ? version : null
    const pRole = role != null && role !== '' ? role : null
    const pRegion = region != null && region !== '' ? region : null

    const filters: string[] = [`champion_id = ${championId}`]
    const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
    if (ranks.length === 1) filters.push(`rank_tier = '${ranks[0].replace(/'/g, "''")}'`)
    else if (ranks.length > 1) {
      filters.push(`rank_tier IN (${ranks.map((r) => `'${r.replace(/'/g, "''")}'`).join(',')})`)
    }
    if (pRole) filters.push(`role = '${pRole.replace(/'/g, "''")}'`)
    if (pVersion) filters.push(`game_version LIKE '${pVersion.replace(/'/g, "''")}%'`)
    if (pRegion) filters.push(`region = '${pRegion.replace(/'/g, "''")}'`)
    const whereSql = filters.join(' AND ')

    const coreStats = await prisma.$queryRawUnsafe<Array<{ id: bigint }>>(`
      SELECT id
      FROM agg_champion_core_stats
      WHERE ${whereSql}
    `)
    if (coreStats.length === 0) return { matchups: [] }

    const statIds = coreStats.map((s) => s.id)

    const vsRows = await prisma.$queryRawUnsafe<Array<{
      opponentChampionId: number
      countWin: number
      countGame: number
    }>>(`
      SELECT
        opponent_champion_id AS "opponentChampionId",
        count_win AS "countWin",
        count_game AS "countGame"
      FROM agg_champion_vs_stats
      WHERE champion_stat_id IN (${statIds.map((id) => id.toString()).join(',')})
    `)

    // Aggregate by opponent
    const byOpponent = new Map<number, { wins: number; games: number }>()
    for (const row of vsRows) {
      const opp = row.opponentChampionId
      let entry = byOpponent.get(opp)
      if (!entry) {
        entry = { wins: 0, games: 0 }
        byOpponent.set(opp, entry)
      }
      entry.wins += row.countWin
      entry.games += row.countGame
    }

    const matchups: MatchupRow[] = []
    for (const [oppId, entry] of byOpponent.entries()) {
      if (entry.games < minGames) continue
      matchups.push({
        opponentChampionId: oppId,
        games: entry.games,
        wins: entry.wins,
        winrate: entry.games > 0 ? Math.round((entry.wins / entry.games) * 10000) / 100 : 0,
      })
    }

    matchups.sort((a, b) => b.games - a.games)

    return { matchups }
  } catch {
    return null
  }
}
