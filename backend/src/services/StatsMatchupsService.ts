/**
 * Matchups by champion: winrate vs each opponent (same filters as other champion stats).
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
  minGames?: number
}

type MatchupsResult = Array<{ get_matchups_by_champion: { matchups: RawMatchup[] } | null }>
interface RawMatchup {
  opponentChampionId: number
  games: number
  wins: number
  winrate: number
}

export async function getMatchupsByChampion(
  options: MatchupsByChampionOptions
): Promise<{ matchups: MatchupRow[] } | null> {
  if (!isDatabaseConfigured()) return null
  const { championId, version, rankTier, minGames = 10 } = options
  try {
    const pVersion = version != null && version !== '' ? version : null
    const pRankTier = rankTier != null && rankTier !== '' ? rankTier : null

    const rows = await prisma.$queryRaw<MatchupsResult>`
      SELECT get_matchups_by_champion(${championId}, ${pVersion}, ${pRankTier}, ${minGames}) AS get_matchups_by_champion
    `
    const raw = rows[0]?.get_matchups_by_champion
    if (!raw?.matchups) return { matchups: [] }

    const matchups: MatchupRow[] = (raw.matchups ?? []).map((m) => ({
      opponentChampionId: Number(m.opponentChampionId),
      games: Number(m.games),
      wins: Number(m.wins),
      winrate: Number(m.winrate),
    }))

    return { matchups }
  } catch {
    return null
  }
}
