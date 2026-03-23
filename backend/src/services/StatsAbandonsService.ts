/**
 * Stats d'abandon : surrender (early / normal) from the matchs table.
 * Remake = match où au moins un participant n'a aucun item (déco / non connecté).
 * Cache mémoire 5 min pour limiter les requêtes lourdes.
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'
import { applyRankTierWhere, rankTierCacheKey } from '../utils/statsFilters.js'

const ABANDONS_CACHE_TTL_MS = 5 * 60 * 1000
const abandonsCache = new Map<string, { data: OverviewAbandonsResult; expiresAt: number }>()
function abandonsCacheKey(
  pVersion: string | null,
  rankTier: string | string[] | null | undefined
): string {
  return `${pVersion ?? ''}|${rankTierCacheKey(rankTier) ?? ''}`
}

export interface OverviewAbandonsResult {
  totalMatches: number
  remakeCount: number
  remakeRate: number
  earlySurrenderCount: number
  earlySurrenderRate: number
  surrenderCount: number
  surrenderRate: number
}

export function computeAbandonRates(
  totalMatches: number,
  remakeCount: number,
  earlySurrenderCount: number,
  surrenderCount: number
): Pick<
  OverviewAbandonsResult,
  'remakeRate' | 'earlySurrenderRate' | 'surrenderRate'
> {
  if (totalMatches <= 0) {
    return { remakeRate: 0, earlySurrenderRate: 0, surrenderRate: 0 }
  }
  return {
    remakeRate: (remakeCount / totalMatches) * 100,
    earlySurrenderRate: (earlySurrenderCount / totalMatches) * 100,
    surrenderRate: (surrenderCount / totalMatches) * 100,
  }
}

function normalizeParam(value: string | string[] | null | undefined): string | null {
  if (value == null) return null
  const s = Array.isArray(value) ? value[0] : value
  if (typeof s !== 'string' || s === '' || s.startsWith('[')) return null
  return s
}

export async function getOverviewAbandons(
  version?: string | string[] | null,
  rankTier?: string | string[] | null
): Promise<OverviewAbandonsResult | null> {
  if (!isDatabaseConfigured()) return null
  const pVersion = normalizeParam(version)
  const now = Date.now()
  const cacheKey = abandonsCacheKey(pVersion, rankTier)
  const cached = abandonsCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.data

  try {
    // Build match filter
    const matchWhere: Record<string, unknown> = {}
    if (pVersion) matchWhere.gameVersion = { startsWith: pVersion }
    applyRankTierWhere(matchWhere, rankTier)

    const totalMatches = await prisma.match.count({ where: matchWhere })
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

    const [earlySurrenderCount, surrenderCount] = await Promise.all([
      prisma.match.count({ where: { ...matchWhere, gameEndedInEarlySurrender: true } }),
      prisma.match.count({ where: { ...matchWhere, gameEndedInSurrender: true } }),
    ])

    // Remake = match where at least one player has 0 items
    // Check match_player_items count grouped by match_player
    const remakeCandidates = await prisma.matchPlayer.findMany({
      where: {
        match: matchWhere,
      },
      select: {
        matchId: true,
        items: true,
      },
    })

    const remakeMatchIds = new Set<bigint>()
    for (const mp of remakeCandidates) {
      const itemCount = Array.isArray(mp.items) ? mp.items.length : 0
      if (itemCount === 0) {
        remakeMatchIds.add(mp.matchId)
      }
    }
    const remakeCount = remakeMatchIds.size

    const rates = computeAbandonRates(totalMatches, remakeCount, earlySurrenderCount, surrenderCount)
    const result: OverviewAbandonsResult = {
      totalMatches,
      remakeCount,
      remakeRate: rates.remakeRate,
      earlySurrenderCount,
      earlySurrenderRate: rates.earlySurrenderRate,
      surrenderCount,
      surrenderRate: rates.surrenderRate,
    }
    abandonsCache.set(cacheKey, { data: result, expiresAt: now + ABANDONS_CACHE_TTL_MS })
    return result
  } catch (err) {
    console.warn('[getOverviewAbandons]', err)
    return null
  }
}
