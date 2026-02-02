/**
 * Aggregates LoL stats from PostgreSQL participants (Ranked Solo/Duo).
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
  totalGames: number
  champions: ChampionStats[]
  generatedAt: string | null
}

export interface LoadStatsOptions {
  rankTier?: string | null
  role?: string | null
}

export class RiotStatsAggregator {
  /**
   * Load stats from DB (computed from participants). Returns null if DB not configured or no data.
   */
  async load(options: LoadStatsOptions = {}): Promise<AggregatedStats | null> {
    if (!isDatabaseConfigured()) return null
    try {
      const { rankTier, role } = options
      const where: { rankTier?: string | null; role?: string | null } = {}
      if (rankTier != null && rankTier !== '') where.rankTier = rankTier
      if (role != null && role !== '') where.role = role

      const all = await prisma.participant.findMany({
        where,
        select: { championId: true, win: true, role: true },
      })
      const totalGames = all.length
      if (totalGames === 0) {
        return { totalGames: 0, champions: [], generatedAt: new Date().toISOString() }
      }

      const byChamp = new Map<
        number,
        { games: number; wins: number; byRole: Map<string, { games: number; wins: number }> }
      >()
      for (const p of all) {
        const cid = p.championId
        let entry = byChamp.get(cid)
        if (!entry) {
          entry = { games: 0, wins: 0, byRole: new Map() }
          byChamp.set(cid, entry)
        }
        entry.games++
        if (p.win) entry.wins++
        const r = p.role ?? 'UNKNOWN'
        let re = entry.byRole.get(r)
        if (!re) {
          re = { games: 0, wins: 0 }
          entry.byRole.set(r, re)
        }
        re.games++
        if (p.win) re.wins++
      }

      const champions: ChampionStats[] = []
      for (const [championId, e] of byChamp) {
        const byRole: Record<string, { games: number; wins: number; winrate: number }> = {}
        for (const [r, re] of e.byRole) {
          byRole[r] = {
            games: re.games,
            wins: re.wins,
            winrate: re.games > 0 ? Math.round((re.wins / re.games) * 10000) / 100 : 0,
          }
        }
        champions.push({
          championId,
          games: e.games,
          wins: e.wins,
          winrate: e.games > 0 ? Math.round((e.wins / e.games) * 10000) / 100 : 0,
          pickrate: totalGames > 0 ? Math.round((e.games / totalGames) * 10000) / 100 : 0,
          byRole: Object.keys(byRole).length ? byRole : undefined,
        })
      }
      champions.sort((a, b) => b.games - a.games)

      return {
        totalGames,
        champions,
        generatedAt: new Date().toISOString(),
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
      champions: [],
      generatedAt: new Date().toISOString(),
    }
  }
}
