/**
 * Matchups by champion: winrate vs each opponent, from champion_vs_stats aggregate table.
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'

export interface MatchupRow {
  opponentChampionId: number
  games: number
  wins: number
  winrate: number
}

export interface MatchupsByChampionOptions {
  championId: number
  version?: string | null
  rankTier?: string | null
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
    const pRankTier = rankTier != null && rankTier !== '' ? rankTier : null
    const pRole = role != null && role !== '' ? role : null
    const pRegion = region != null && region !== '' ? region : null

    // Get all champion_core_stat IDs for this champion matching filters
    const coreWhere: Record<string, unknown> = { championId }
    if (pRankTier) coreWhere.rankTier = pRankTier
    if (pRole) coreWhere.role = pRole
    if (pVersion) coreWhere.gameVersion = pVersion
    if (pRegion) coreWhere.region = pRegion

    const coreStats = await prisma.championCoreStat.findMany({
      where: coreWhere,
      select: { id: true },
    })
    if (coreStats.length === 0) return { matchups: [] }

    const statIds = coreStats.map((s) => s.id)

    const vsRows = await prisma.championVsStat.findMany({
      where: {
        championStatId: { in: statIds },
      },
      select: {
        opponentChampionId: true,
        countWin: true,
        countGame: true,
      },
    })

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
