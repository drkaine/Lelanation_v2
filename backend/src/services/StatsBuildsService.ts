/**
 * Builds stats by champion via get_builds_by_champion() (single round-trip).
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'

export interface BuildRow {
  items: number[]
  games: number
  wins: number
  winrate: number
  pickrate: number
}

export interface BuildsByChampionOptions {
  championId: number
  rankTier?: string | null
  role?: string | null
  patch?: string | null
  minGames?: number
  limit?: number
}

type BuildsRow = Array<{ get_builds_by_champion: RawBuildsResult | null }>
interface RawBuildsResult {
  totalGames: number
  builds: Array<{
    items: number[] | string[]
    games: number
    wins: number
    winrate: number
    pickrate: number
  }>
}

function toItemsArray(raw: number[] | string[] | unknown): number[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => (typeof x === 'number' ? x : parseInt(String(x), 10))).filter((n) => !Number.isNaN(n))
}

export async function getBuildsByChampion(
  options: BuildsByChampionOptions
): Promise<{ totalGames: number; builds: BuildRow[] } | null> {
  if (!isDatabaseConfigured()) return null
  const { championId, rankTier, role, patch, minGames = 10, limit = 20 } = options
  try {
    const pRankTier = rankTier != null && rankTier !== '' ? rankTier : null
    const pRole = role != null && role !== '' ? role : null
    const pPatch = patch != null && patch !== '' ? patch : null

    const rows = await prisma.$queryRaw<BuildsRow>`
      SELECT get_builds_by_champion(${championId}, ${pRankTier}, ${pRole}, ${pPatch}, ${minGames}, ${limit}) AS get_builds_by_champion
    `
    const raw = rows[0]?.get_builds_by_champion
    if (!raw) return { totalGames: 0, builds: [] }

    const builds: BuildRow[] = (raw.builds ?? []).map((b) => ({
      items: toItemsArray(b.items),
      games: Number(b.games),
      wins: Number(b.wins),
      winrate: Number(b.winrate),
      pickrate: Number(b.pickrate),
    }))

    return {
      totalGames: Number(raw.totalGames) ?? 0,
      builds,
    }
  } catch {
    return null
  }
}
