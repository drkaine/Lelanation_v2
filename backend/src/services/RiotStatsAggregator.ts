/**
 * Aggregates LoL stats from PostgreSQL via get_stats_champions() (single round-trip).
 * Winrate / pickrate by champion; optional filters by rank and role.
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'

export interface ChampionStats {
  championId: number
  games: number
  wins: number
  winrate: number
  pickrate: number
  byRole?: Record<string, { games: number; wins: number; winrate: number }>
}

export interface AggregatedStats {
  /** Total participant rows (used for pickrate denominator). */
  totalGames: number
  /** Total distinct matches (for display as "Total parties"). */
  totalMatches: number
  champions: ChampionStats[]
  generatedAt: string | null
}

export interface LoadStatsOptions {
  rankTier?: string | null
  role?: string | null
}

type ChampionsRow = Array<{ get_stats_champions: RawChampionsResult | null }>
interface RawChampionsResult {
  totalGames: number
  totalMatches: number
  champions: Array<{
    championId: number
    games: number
    wins: number
    winrate: number
    pickrate: number
    byRole?: Record<string, { games: number; wins: number; winrate: number }>
  }>
  generatedAt: string | null
}

export class RiotStatsAggregator {
  /**
   * Load stats from DB via get_stats_champions(). Returns null if DB not configured or no data.
   */
  async load(options: LoadStatsOptions = {}): Promise<AggregatedStats | null> {
    if (!isDatabaseConfigured()) return null
    try {
      const { rankTier, role } = options
      const pRankTier = rankTier != null && rankTier !== '' ? rankTier : null
      const pRole = role != null && role !== '' ? role : null

      const rows = await prisma.$queryRaw<ChampionsRow>`
        SELECT get_stats_champions(${pRankTier}, ${pRole}) AS get_stats_champions
      `
      const raw = rows[0]?.get_stats_champions
      if (!raw) return null

      const champions: ChampionStats[] = (raw.champions ?? []).map((c) => {
        const byRole = c.byRole && typeof c.byRole === 'object' && Object.keys(c.byRole).length > 0 ? c.byRole : undefined
        return {
          championId: Number(c.championId),
          games: Number(c.games),
          wins: Number(c.wins),
          winrate: Number(c.winrate),
          pickrate: Number(c.pickrate),
          ...(byRole && { byRole }),
        }
      })

      const generatedAt =
        raw.generatedAt == null
          ? null
          : typeof raw.generatedAt === 'string'
            ? raw.generatedAt
            : (raw.generatedAt as unknown as Date)?.toISOString?.() ?? String(raw.generatedAt)

      return {
        totalGames: Number(raw.totalGames) ?? 0,
        totalMatches: Number(raw.totalMatches) ?? 0,
        champions,
        generatedAt,
      }
    } catch {
      return null
    }
  }

  /**
   * Compute and return aggregated stats (no separate save in MVP; load() computes on the fly).
   */
  async computeAndSave(): Promise<AggregatedStats> {
    const result = await this.load()
    if (result) return result
    return {
      totalGames: 0,
      totalMatches: 0,
      champions: [],
      generatedAt: new Date().toISOString(),
    }
  }
}
