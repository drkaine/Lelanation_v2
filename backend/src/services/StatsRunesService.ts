/**
 * Runes stats by champion via get_runes_by_champion() (single round-trip).
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'

export interface RuneRow {
  runes: unknown
  games: number
  wins: number
  winrate: number
  pickrate: number
}

export interface RunesByChampionOptions {
  championId: number
  rankTier?: string | null
  patch?: string | null
  minGames?: number
  limit?: number
}

type RunesRow = Array<{ get_runes_by_champion: RawRunesResult | null }>
interface RawRunesResult {
  totalGames: number
  runes: Array<{
    runes: unknown
    games: number
    wins: number
    winrate: number
    pickrate: number
  }>
}

export async function getRunesByChampion(
  options: RunesByChampionOptions
): Promise<{ totalGames: number; runes: RuneRow[] } | null> {
  if (!isDatabaseConfigured()) return null
  const { championId, rankTier, patch, minGames = 10, limit = 20 } = options
  try {
    const pRankTier = rankTier != null && rankTier !== '' ? rankTier : null
    const pPatch = patch != null && patch !== '' ? patch : null

    const rows = await prisma.$queryRaw<RunesRow>`
      SELECT get_runes_by_champion(${championId}, ${pRankTier}, ${pPatch}, ${minGames}, ${limit}) AS get_runes_by_champion
    `
    const raw = rows[0]?.get_runes_by_champion
    if (!raw) return { totalGames: 0, runes: [] }

    const runes: RuneRow[] = (raw.runes ?? []).map((r) => ({
      runes: r.runes,
      games: Number(r.games),
      wins: Number(r.wins),
      winrate: Number(r.winrate),
      pickrate: Number(r.pickrate),
    }))

    return {
      totalGames: Number(raw.totalGames) ?? 0,
      runes,
    }
  } catch {
    return null
  }
}
