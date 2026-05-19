/**
 * Aggregates LoL champion stats into `agg_*` tables (incremental; archives on close_patch).
 * Winrate / pickrate by champion; optional filters by rank and role. Cache mémoire 5 min.
 */
import { queryRawUnsafe } from '../db/query.js'
import { isDatabaseConfigured } from '../db/query.js'
import { bansPerChampionFromMvRows } from '../utils/statsMvBanAggregate.js'
import {
  normalizeStatsRoleForBanner,
  normalizeStatsRoleForChampion,
  statsRoleSqlLiteral,
  toQueryStringArrayParam,
} from '../utils/statsFilters.js'
import { matchVersionedAggFrom, normalizePatchMajorMinor } from './statsAggArchive.js'

const CHAMPIONS_CACHE_TTL_MS = 5 * 60 * 1000
const championsCache = new Map<
  string,
  { data: AggregatedStats; expiresAt: number }
>()
function championsCacheKey(
  rankTier: string | string[] | null,
  pRole: string | null,
  pVersion: string | null
): string {
  const rt = Array.isArray(rankTier) ? [...rankTier].sort().join(',') : rankTier ?? ''
  const v = pVersion ?? ''
  return `${rt}|${pRole ?? ''}|${v}`
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
  rankTier?: string | string[] | null
  role?: string | null
  version?: string | null
  region?: string | null
}

export class RiotStatsAggregator {
  async load(options: LoadStatsOptions = {}): Promise<AggregatedStats | null> {
    if (!isDatabaseConfigured()) return null
    try {
      const { rankTier, role, version, region } = options
      const pRole = normalizeStatsRoleForChampion(role)
      const pVersion = version != null && version !== '' ? version : null
      const pRegion = region != null && region !== '' ? region : null

      const now = Date.now()
      const cacheKey = championsCacheKey(rankTier ?? null, pRole, pVersion)
      const cached = championsCache.get(cacheKey)
      if (cached && cached.expiresAt > now) return cached.data

      const filters: string[] = []
      const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
      if (ranks.length === 1) filters.push(`rank_tier = '${ranks[0].replace(/'/g, "''")}'`)
      else if (ranks.length > 1) {
        filters.push(`rank_tier IN (${ranks.map((r) => `'${r.replace(/'/g, "''")}'`).join(',')})`)
      } else {
        filters.push(`rank_tier <> 'UNRANKED'`)
      }
      if (pRole) filters.push(`role = '${statsRoleSqlLiteral(pRole)}'`)
      if (pVersion) filters.push(`game_version LIKE '${normalizePatchMajorMinor(pVersion).replace(/'/g, "''")}%'`)
      if (pRegion) filters.push(`region = '${pRegion.replace(/'/g, "''")}'`)
      const whereSql = filters.length > 0 ? filters.join(' AND ') : '1=1'

      const coreFrom = await matchVersionedAggFrom('agg_champion_core_stats', pVersion, 'ac')

      const rows = await queryRawUnsafe<Array<{
        championId: number
        role: string
        countWin: number
        countGame: number
        countBan: number
        rankTier: string
        gameVersion: string
        region: string
      }>>(`
        SELECT
          champion_id AS "championId",
          role,
          count_win AS "countWin",
          count_game AS "countGame",
          count_ban AS "countBan",
          rank_tier AS "rankTier",
          game_version AS "gameVersion",
          region
        FROM ${coreFrom}
        WHERE ${whereSql}
      `)

      if (rows.length === 0) {
        return { totalGames: 0, totalMatches: 0, champions: [], generatedAt: new Date().toISOString() }
      }

      // Prefer bans from dedicated aggregate table (more reliable than count_ban on core rows).
      // Fallback to core-row bans when the table is unavailable.
      let banTotalsByChampion = bansPerChampionFromMvRows(rows)
      try {
        const bansFrom = await matchVersionedAggFrom('agg_champion_bans_by_banner', pVersion, 'bb')
        const banFilters: string[] = []
        if (ranks.length === 1) banFilters.push(`bb.rank_tier = '${ranks[0]!.replace(/'/g, "''")}'`)
        else if (ranks.length > 1) {
          banFilters.push(`bb.rank_tier IN (${ranks.map((r) => `'${r.replace(/'/g, "''")}'`).join(',')})`)
        } else {
          banFilters.push(`bb.rank_tier <> 'UNRANKED'`)
        }
        if (pVersion) {
          banFilters.push(
            `bb.game_version LIKE '${normalizePatchMajorMinor(pVersion).replace(/'/g, "''")}%'`
          )
        }
        const bannerRole = normalizeStatsRoleForBanner(role)
        if (bannerRole) {
          banFilters.push(`bb.banner_role_norm = '${statsRoleSqlLiteral(bannerRole)}'`)
        }
        const bansWhereSql = banFilters.length ? banFilters.join(' AND ') : '1=1'
        const banRows = await queryRawUnsafe<Array<{ championId: number; bans: bigint }>>(`
          SELECT
            bb.banned_champion_id AS "championId",
            COALESCE(SUM(bb.ban_count), 0)::bigint AS bans
          FROM ${bansFrom}
          WHERE ${bansWhereSql}
          GROUP BY bb.banned_champion_id
        `)
        if (banRows.length > 0) {
          const banMap = new Map<number, number>()
          for (const r of banRows) {
            const cid = Number(r.championId ?? 0)
            if (!Number.isFinite(cid) || cid <= 0) continue
            banMap.set(cid, Number(r.bans ?? 0))
          }
          banTotalsByChampion = banMap
        }
      } catch {
        // Keep fallback from core rows.
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

      for (const row of rows) {
        const cid = row.championId
        const games = row.countGame
        const wins = row.countWin
        totalGames += games
        let entry = byChampion.get(cid)
        if (!entry) {
          entry = { games: 0, wins: 0, bans: 0, byRole: {} }
          byChampion.set(cid, entry)
        }
        entry.games += games
        entry.wins += wins
        const roleKey = row.role
        if (!entry.byRole[roleKey]) entry.byRole[roleKey] = { games: 0, wins: 0 }
        entry.byRole[roleKey].games += games
        entry.byRole[roleKey].wins += wins
      }
      for (const [cid, entry] of byChampion) {
        entry.bans = banTotalsByChampion.get(cid) ?? 0
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
   * Return champion rollups from incremental aggregate tables.
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
