/**
 * Stats d'abandon : surrender (early / normal) depuis les tables d'agrégats runtime.
 * Remake = match où au moins un participant n'a aucun item (déco / non connecté).
 * Cache mémoire 5 min pour limiter les requêtes lourdes.
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'
import { rankTierCacheKey, toQueryStringArrayParam } from '../utils/statsFilters.js'

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
    const versions = toQueryStringArrayParam(version)
    const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
    const cond: string[] = ['1=1']
    if (versions.length === 1) cond.push(`mo.game_version LIKE '${versions[0].replace(/'/g, "''")}%'`)
    else if (versions.length > 1)
      cond.push(`mo.game_version IN (${versions.map((v) => `'${v.replace(/'/g, "''")}'`).join(',')})`)
    if (ranks.length === 1) cond.push(`mo.rank_tier = '${ranks[0]}'`)
    else if (ranks.length > 1) cond.push(`mo.rank_tier IN (${ranks.map((r) => `'${r}'`).join(',')})`)
    else cond.push(`mo.rank_tier <> 'UNRANKED'`)
    const whereSql = cond.join(' AND ')

    const rows = await prisma.$queryRawUnsafe<
      Array<{
        total_matches: bigint
        early_surrender_count: bigint
        surrender_count: bigint
        remake_count: bigint
      }>
    >(`
      SELECT
        COALESCE(SUM(mo.count_match), 0)::bigint AS total_matches,
        COALESCE(SUM(tc.count_team_early_surrendered), 0)::bigint AS early_surrender_count,
        COALESCE(SUM(tc.count_team_surrendered), 0)::bigint AS surrender_count,
        0::bigint AS remake_count
      FROM agg_match_outcome_stats mo
      LEFT JOIN agg_team_core_stats tc
        ON tc.game_version = mo.game_version AND tc.rank_tier = mo.rank_tier
      WHERE ${whereSql}
    `)
    const row = rows[0]
    const totalMatches = Number(row?.total_matches ?? 0)
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

    const earlySurrenderCount = Number(row?.early_surrender_count ?? 0)
    const surrenderCount = Number(row?.surrender_count ?? 0)
    const remakeCount = Number(row?.remake_count ?? 0)

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
