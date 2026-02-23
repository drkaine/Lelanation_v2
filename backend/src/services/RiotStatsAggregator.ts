/**
 * Aggregates LoL stats from PostgreSQL via get_stats_champions() (single round-trip).
 * Winrate / pickrate by champion; optional filters by rank and role.
 * Sans filtre (NULL, NULL) : lecture depuis mv_stats_champions (< 1 s). Avec filtre : cache mémoire 5 min.
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'

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
    banrate?: number
    presence?: number
    byRole?: Record<string, { games: number; wins: number; winrate: number; pickrate?: number }>
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

      const now = Date.now()
      const cacheKey = championsCacheKey(pRankTier, pRole)
      const cached = championsCache.get(cacheKey)
      if (cached && cached.expiresAt > now) return cached.data

      let raw: RawChampionsResult | null = null
      if (pRankTier === null && pRole === null) {
        const mvRows = await prisma.$queryRaw<Array<{ data: RawChampionsResult | null }>>`
          SELECT data FROM mv_stats_champions LIMIT 1
        `
        raw = mvRows[0]?.data ?? null
      }
      if (raw === null) {
        const rows = await prisma.$queryRaw<ChampionsRow>`
          SELECT get_stats_champions(${pRankTier}, ${pRole}) AS get_stats_champions
        `
        raw = rows[0]?.get_stats_champions ?? null
      }
      if (!raw) return null

      const champions: ChampionStats[] = (raw.champions ?? []).map((c) => {
        let byRole: ChampionStats['byRole'] = undefined
        if (c.byRole && typeof c.byRole === 'object' && Object.keys(c.byRole).length > 0) {
          byRole = {}
          for (const [role, val] of Object.entries(c.byRole)) {
            byRole[role] = {
              games: Number(val.games),
              wins: Number(val.wins),
              winrate: Number(val.winrate),
              ...(val.pickrate != null && { pickrate: Number(val.pickrate) }),
            }
          }
        }
        return {
          championId: Number(c.championId),
          games: Number(c.games),
          wins: Number(c.wins),
          winrate: Number(c.winrate),
          pickrate: Number(c.pickrate),
          ...(c.banrate != null && { banrate: Number(c.banrate) }),
          ...(c.presence != null && { presence: Number(c.presence) }),
          ...(byRole && { byRole }),
        }
      })

      const generatedAt =
        raw.generatedAt == null
          ? null
          : typeof raw.generatedAt === 'string'
            ? raw.generatedAt
            : (raw.generatedAt as unknown as Date)?.toISOString?.() ?? String(raw.generatedAt)

      const result: AggregatedStats = {
        totalGames: Number(raw.totalGames) ?? 0,
        totalMatches: Number(raw.totalMatches) ?? 0,
        champions,
        generatedAt,
      }
      championsCache.set(cacheKey, { data: result, expiresAt: now + CHAMPIONS_CACHE_TTL_MS })
      return result
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
