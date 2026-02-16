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

/** Per-rune stats for a champion (like overview-detail runes but for this champion only). */
export interface RuneStatRow {
  runeId: number
  games: number
  wins: number
  pickrate: number
  winrate: number
}

export interface RuneStatsByChampionOptions {
  championId: number
  version?: string | null
  rankTier?: string | null
  minGames?: number
}

type RuneStatsRow = Array<{ get_rune_stats_by_champion: { totalGames: number; runes: RawRuneStat[] } | null }>
interface RawRuneStat {
  runeId: number
  games: number
  wins: number
  pickrate: number
  winrate: number
}

export async function getRuneStatsByChampion(
  options: RuneStatsByChampionOptions
): Promise<{ totalGames: number; runes: RuneStatRow[] } | null> {
  if (!isDatabaseConfigured()) return null
  const { championId, version, rankTier, minGames = 10 } = options
  try {
    const pVersion = version != null && version !== '' ? version : null
    const pRankTier = rankTier != null && rankTier !== '' ? rankTier : null

    const rows = await prisma.$queryRaw<RuneStatsRow>`
      SELECT get_rune_stats_by_champion(${championId}, ${pVersion}, ${pRankTier}, ${minGames}) AS get_rune_stats_by_champion
    `
    const raw = rows[0]?.get_rune_stats_by_champion
    if (!raw?.runes) return { totalGames: Number(raw?.totalGames ?? 0) || 0, runes: [] }

    const runes: RuneStatRow[] = (raw.runes ?? []).map((r) => ({
      runeId: Number(r.runeId),
      games: Number(r.games),
      wins: Number(r.wins),
      pickrate: Number(r.pickrate),
      winrate: Number(r.winrate),
    }))

    return {
      totalGames: Number(raw.totalGames) ?? 0,
      runes,
    }
  } catch {
    return null
  }
}
