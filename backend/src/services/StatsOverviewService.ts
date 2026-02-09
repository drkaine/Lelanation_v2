/**
 * Overview stats for the statistics page: total matches, last update, top winrate champions,
 * matches per division, distinct participant count (unique puuids in participants).
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'
import { RiotStatsAggregator } from './RiotStatsAggregator.js'

const TIER_ORDER: string[] = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'CHALLENGER',
  'UNRANKED',
]
const TIER_ORDER_SET = new Set(TIER_ORDER)

export interface OverviewStats {
  totalMatches: number
  lastUpdate: string | null
  topWinrateChampions: Array<{
    championId: number
    games: number
    wins: number
    winrate: number
    pickrate: number
  }>
  matchesByDivision: Array<{ rankTier: string; matchCount: number }>
  /** Match count per game version (16.x only, e.g. 16.1, 16.2, 16.3). */
  matchesByVersion: Array<{ version: string; matchCount: number }>
  /** Distinct puuids in participants (joueurs récupérés = participants uniques). */
  playerCount: number
}

const MIN_GAMES_TOP_WINRATE = 20
const TOP_WINRATE_LIMIT = 10

/**
 * Load overview stats for the statistics page. Returns null if DB not configured.
 */
export async function getOverviewStats(): Promise<OverviewStats | null> {
  if (!isDatabaseConfigured()) return null
  try {
    const [totalMatches, lastMatch, byDivisionRaw, byVersionRaw, distinctParticipantsResult, aggregatorData] =
      await Promise.all([
        prisma.match.count(),
        prisma.match.findFirst({
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
        prisma.$queryRaw<Array<{ rank_tier: string; match_count: bigint }>>`
          SELECT split_part(rank, '_', 1) AS rank_tier, COUNT(*)::bigint AS match_count
          FROM matches
          WHERE rank IS NOT NULL AND rank != ''
          GROUP BY split_part(rank, '_', 1)
        `,
        prisma.$queryRaw<Array<{ version_prefix: string; match_count: bigint }>>`
          SELECT (split_part(game_version, '.', 1) || '.' || split_part(game_version, '.', 2)) AS version_prefix, COUNT(*)::bigint AS match_count
          FROM matches
          WHERE game_version IS NOT NULL AND game_version LIKE '16.%'
          GROUP BY split_part(game_version, '.', 1), split_part(game_version, '.', 2)
          ORDER BY 1
        `,
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT puuid)::bigint AS count FROM participants
        `,
        new RiotStatsAggregator().load({}),
      ])
    const playerCount = Number(distinctParticipantsResult[0]?.count ?? 0)

    const lastUpdate = lastMatch?.createdAt?.toISOString() ?? null

    const byDivisionMap = new Map<string, number>()
    for (const row of byDivisionRaw) {
      const tier = row.rank_tier.trim().toUpperCase()
      if (!tier) continue
      byDivisionMap.set(tier, (byDivisionMap.get(tier) ?? 0) + Number(row.match_count))
    }
    const matchesByDivision: Array<{ rankTier: string; matchCount: number }> = []
    for (const t of TIER_ORDER) {
      if (byDivisionMap.has(t)) matchesByDivision.push({ rankTier: t, matchCount: byDivisionMap.get(t)! })
    }
    for (const [rankTier, matchCount] of byDivisionMap) {
      if (!TIER_ORDER_SET.has(rankTier)) matchesByDivision.push({ rankTier, matchCount })
    }

    const matchesByVersion: Array<{ version: string; matchCount: number }> = byVersionRaw.map((row) => ({
      version: row.version_prefix.trim(),
      matchCount: Number(row.match_count),
    }))

    const champions = aggregatorData?.champions ?? []
    const topWinrateChampions = champions
      .filter((c) => c.games >= MIN_GAMES_TOP_WINRATE)
      .sort((a, b) => b.winrate - a.winrate)
      .slice(0, TOP_WINRATE_LIMIT)
      .map((c) => ({
        championId: c.championId,
        games: c.games,
        wins: c.wins,
        winrate: c.winrate,
        pickrate: c.pickrate,
      }))

    return {
      totalMatches,
      lastUpdate,
      topWinrateChampions,
      matchesByDivision,
      matchesByVersion,
      playerCount,
    }
  } catch {
    return null
  }
}
