/**
 * Stats d'abandon : remake (participants sans items = non connectés), surrender (early / normal).
 * Remake = match où au moins un participant n'a aucun item (déco / non connecté).
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'

export interface OverviewAbandonsResult {
  totalMatches: number
  remakeCount: number
  remakeRate: number
  earlySurrenderCount: number
  earlySurrenderRate: number
  surrenderCount: number
  surrenderRate: number
}

function normalizeParam(value: string | string[] | null | undefined): string | null {
  if (value == null) return null
  const s = Array.isArray(value) ? value[0] : value
  if (typeof s !== 'string' || s === '' || s.startsWith('[')) return null
  return s
}

/**
 * Get abandon stats (remake = match with ≥1 participant without items, early surrender, surrender).
 * Version: prefix match on game_version (e.g. "16.1"). Rank: participant.rank_tier (e.g. "GOLD").
 */
export async function getOverviewAbandons(
  version?: string | string[] | null,
  rankTier?: string | string[] | null
): Promise<OverviewAbandonsResult | null> {
  if (!isDatabaseConfigured()) return null
  const pVersion = normalizeParam(version)
  const pRankTier = normalizeParam(rankTier)

  try {
    const versionPrefix = pVersion ? `${pVersion}%` : '%'
    const rankFilter = pRankTier ? 'AND p.rank_tier = $2' : ''
    const params = pRankTier ? [versionPrefix, pRankTier] : [versionPrefix]

    const totalResult = await prisma.$queryRawUnsafe<[{ count: string }]>(
      `SELECT COUNT(DISTINCT m.id)::text AS count
       FROM matches m
       INNER JOIN participants p ON p.match_id = m.id
       WHERE m.game_version LIKE $1 ${rankFilter}`,
      ...params
    )
    const totalMatches = Number(totalResult[0]?.count ?? 0)
    if (totalMatches === 0) {
      return {
        totalMatches: 0,
        remakeCount: 0,
        remakeRate: 0,
        earlySurrenderCount: 0,
        earlySurrenderRate: 0,
        surrenderCount: 0,
        surrenderRate: 0,
      }
    }

    /* Remake = match où au moins un participant a 0 item (non connecté / AFK → remake). */
    const remakeResult = await prisma.$queryRawUnsafe<[{ count: string }]>(
      `SELECT COUNT(DISTINCT m.id)::text AS count
       FROM matches m
       INNER JOIN participants p ON p.match_id = m.id
       WHERE m.game_version LIKE $1 ${rankFilter}
         AND EXISTS (
           SELECT 1 FROM participants p2
           WHERE p2.match_id = m.id
             AND (p2.items IS NULL OR COALESCE(jsonb_array_length(p2.items), 0) = 0)
         )`,
      ...params
    )
    const remakeCount = Number(remakeResult[0]?.count ?? 0)

    const earlyResult = await prisma.$queryRawUnsafe<[{ count: string }]>(
      `SELECT COUNT(DISTINCT m.id)::text AS count
       FROM matches m
       INNER JOIN participants p ON p.match_id = m.id
       WHERE m.game_version LIKE $1 AND p.game_ended_in_early_surrender = true ${rankFilter}`,
      ...params
    )
    const earlySurrenderCount = Number(earlyResult[0]?.count ?? 0)

    const surrenderResult = await prisma.$queryRawUnsafe<[{ count: string }]>(
      `SELECT COUNT(DISTINCT m.id)::text AS count
       FROM matches m
       INNER JOIN participants p ON p.match_id = m.id
       WHERE m.game_version LIKE $1 AND p.game_ended_in_surrender = true ${rankFilter}`,
      ...params
    )
    const surrenderCount = Number(surrenderResult[0]?.count ?? 0)

    return {
      totalMatches,
      remakeCount,
      remakeRate: (remakeCount / totalMatches) * 100,
      earlySurrenderCount,
      earlySurrenderRate: (earlySurrenderCount / totalMatches) * 100,
      surrenderCount,
      surrenderRate: (surrenderCount / totalMatches) * 100,
    }
  } catch (err) {
    console.warn('[getOverviewAbandons]', err)
    return null
  }
}
