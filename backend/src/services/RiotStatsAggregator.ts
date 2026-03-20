/**
 * Aggregates LoL champion stats from mv_champion_core_stats (vue matérialisée).
 * Winrate / pickrate by champion; optional filters by rank and role. Cache mémoire 5 min.
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'
import { refreshAllMaterializedViews } from './MaterializedViewService.js'

const CHAMPIONS_CACHE_TTL_MS = 5 * 60 * 1000
const championsCache = new Map<
  string,
  { data: AggregatedStats; expiresAt: number }
>()
function championsCacheKey(pRankTier: string | null, pRole: string | null): string {
  return `${pRankTier ?? ''}|${pRole ?? ''}`
}

export interface ChampionStats {
  championId: number
  games: number
  wins: number
  winrate: number
  pickrate: number
  banrate?: number
  /** presence(c) = (games + bans) / |M| in % */
  presence?: number
  byRole?: Record<string, { games: number; wins: number; winrate: number; pickrate?: number }>
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
  version?: string | null
  region?: string | null
}

export class RiotStatsAggregator {
  async load(options: LoadStatsOptions = {}): Promise<AggregatedStats | null> {
    if (!isDatabaseConfigured()) return null
    try {
      const { rankTier, role, version, region } = options
      const pRankTier = rankTier != null && rankTier !== '' ? rankTier : null
      const pRole = role != null && role !== '' ? role : null
      const pVersion = version != null && version !== '' ? version : null
      const pRegion = region != null && region !== '' ? region : null

      const now = Date.now()
      const cacheKey = championsCacheKey(pRankTier, pRole)
      const cached = championsCache.get(cacheKey)
      if (cached && cached.expiresAt > now) return cached.data

      const where: Record<string, unknown> = {}
      if (pRankTier) where.rankTier = pRankTier
      if (pRole) where.role = pRole
      if (pVersion) where.gameVersion = pVersion
      if (pRegion) where.region = pRegion

      const rows = await prisma.mvChampionCoreStat.findMany({
        where,
        select: {
          championId: true,
          role: true,
          countWin: true,
          countGame: true,
          countBan: true,
        },
      })

      if (rows.length === 0) {
        return { totalGames: 0, totalMatches: 0, champions: [], generatedAt: new Date().toISOString() }
      }

      // Aggregate by championId
      const byChampion = new Map<
        number,
        {
          games: number
          wins: number
          bans: number
          byRole: Record<string, { games: number; wins: number }>
        }
      >()

      let totalGames = 0
      let totalBans = 0

      for (const row of rows) {
        const cid = row.championId
        const games = row.countGame
        const wins = row.countWin
        const bans = row.countBan
        totalGames += games
        totalBans += bans
        let entry = byChampion.get(cid)
        if (!entry) {
          entry = { games: 0, wins: 0, bans: 0, byRole: {} }
          byChampion.set(cid, entry)
        }
        entry.games += games
        entry.wins += wins
        entry.bans += bans
        const roleKey = row.role
        if (!entry.byRole[roleKey]) entry.byRole[roleKey] = { games: 0, wins: 0 }
        entry.byRole[roleKey].games += games
        entry.byRole[roleKey].wins += wins
      }

      // Total matches ≈ totalGames / 10 (10 players per match)
      const totalMatches = Math.round(totalGames / 10)

      const champions: ChampionStats[] = []
      for (const [cid, entry] of byChampion.entries()) {
        if (entry.games === 0) continue
        const winrate = entry.games > 0 ? (entry.wins / entry.games) * 100 : 0
        const pickrate = totalGames > 0 ? (entry.games / totalGames) * 100 : 0
        const banrate = totalMatches > 0 ? (entry.bans / totalMatches) * 100 : 0
        const presence = totalMatches > 0 ? ((entry.games + entry.bans) / totalMatches) * 100 : 0

        const byRole: ChampionStats['byRole'] = {}
        for (const [r, rv] of Object.entries(entry.byRole)) {
          byRole[r] = {
            games: rv.games,
            wins: rv.wins,
            winrate: rv.games > 0 ? (rv.wins / rv.games) * 100 : 0,
            pickrate: totalGames > 0 ? (rv.games / totalGames) * 100 : 0,
          }
        }

        champions.push({
          championId: cid,
          games: entry.games,
          wins: entry.wins,
          winrate: Math.round(winrate * 100) / 100,
          pickrate: Math.round(pickrate * 100) / 100,
          banrate: Math.round(banrate * 100) / 100,
          presence: Math.round(presence * 100) / 100,
          byRole: Object.keys(byRole).length > 0 ? byRole : undefined,
        })
      }

      const result: AggregatedStats = {
        totalGames,
        totalMatches,
        champions,
        generatedAt: new Date().toISOString(),
      }
      championsCache.set(cacheKey, { data: result, expiresAt: now + CHAMPIONS_CACHE_TTL_MS })
      return result
    } catch {
      return null
    }
  }

  /**
   * Refresh all materialized views from raw match rows, then return champion rollups from MVs.
   */
  async computeAndSave(): Promise<AggregatedStats> {
    if (!isDatabaseConfigured()) {
      return {
        totalGames: 0,
        totalMatches: 0,
        champions: [],
        generatedAt: new Date().toISOString(),
      }
    }
    await refreshAllMaterializedViews()
    championsCache.clear()
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
