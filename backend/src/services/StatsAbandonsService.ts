/**
 * Stats d'abandon : surrender (early / normal) depuis les tables d'agrégats runtime.
 * Remake = match où au moins un participant n'a aucun item (déco / non connecté).
 * Cache mémoire 5 min pour limiter les requêtes lourdes.
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'
import { rankTierCacheKey, toQueryStringArrayParam } from '../utils/statsFilters.js'
import { matchVersionedAggFrom, normalizePatchMajorMinor } from './statsAggArchive.js'

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

export type SurrenderMatrixTeam = 'ALL' | 100 | 200

export interface SurrenderMatrixRow {
  rankTier: string
  team: SurrenderMatrixTeam
  matchCount: number
  surrenderCount: number
  earlySurrenderCount: number
  surrenderRate: number
  earlySurrenderRate: number
  surrenderDelta: number | null
  earlySurrenderDelta: number | null
}

export interface SurrenderMatrixResult {
  version: string | null
  baselineVersion: string | null
  rows: SurrenderMatrixRow[]
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

function previousPatchVersion(version: string | null): string | null {
  if (!version) return null
  const patch = normalizePatchMajorMinor(version)
  const m = /^(\d+)\.(\d+)$/.exec(patch)
  if (!m) return null
  const major = Number(m[1])
  const minor = Number(m[2])
  if (!Number.isFinite(major) || !Number.isFinite(minor) || minor <= 0) return null
  return `${major}.${minor - 1}`
}

function toRate(count: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0
  return (count / total) * 100
}

const SURRENDER_MATRIX_CACHE_TTL_MS = 2 * 60 * 1000
const surrenderMatrixCache = new Map<string, { data: SurrenderMatrixResult; expiresAt: number }>()

async function ingestMatchsTableExists(): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ ok: boolean }>>`
    SELECT to_regclass('public.ingest_matchs') IS NOT NULL AS ok
  `
  return Boolean(rows[0]?.ok)
}

function surrenderMatrixCacheKey(version: string | null, baselineVersion: string | null): string {
  return `${version ?? ''}|${baselineVersion ?? ''}`
}

type TeamAggRow = {
  rank_tier: string
  team: number
  match_count: bigint
  surrender_count: bigint
  early_surrender_count: bigint
}

type Cell = {
  matchCount: number
  surrenderCount: number
  earlySurrenderCount: number
}

function buildSurrenderCells(rows: TeamAggRow[]): Map<string, Cell> {
  const byKey = new Map<string, Cell>()
  const add = (rank: string, team: SurrenderMatrixTeam, match: number, surrender: number, early: number) => {
    const key = `${rank}|${String(team)}`
    const cur = byKey.get(key) ?? { matchCount: 0, surrenderCount: 0, earlySurrenderCount: 0 }
    cur.matchCount += match
    cur.surrenderCount += surrender
    cur.earlySurrenderCount += early
    byKey.set(key, cur)
  }
  for (const r of rows) {
    const rank = String(r.rank_tier ?? '').toUpperCase()
    if (!rank || rank === 'UNRANKED') continue
    const team = Number(r.team) as 100 | 200
    if (team !== 100 && team !== 200) continue
    const match = Number(r.match_count ?? 0)
    const surrender = Number(r.surrender_count ?? 0)
    const early = Number(r.early_surrender_count ?? 0)
    add(rank, team, match, surrender, early)
    add(rank, 'ALL', match, surrender, early)
    add('ALL', team, match, surrender, early)
    add('ALL', 'ALL', match, surrender, early)
  }
  return byKey
}

async function loadSurrenderTeamAgg(version: string | null): Promise<TeamAggRow[]> {
  const tcFrom = await matchVersionedAggFrom('agg_team_core_stats', version, 'tc')
  const versionWhere = version
    ? ` AND tc.game_version LIKE '${normalizePatchMajorMinor(version).replace(/'/g, "''")}%'`
    : ''
  return prisma.$queryRawUnsafe<TeamAggRow[]>(`
    SELECT
      tc.rank_tier,
      tc.team,
      COALESCE(SUM(tc.count_game), 0)::bigint AS match_count,
      COALESCE(SUM(tc.count_team_surrendered), 0)::bigint AS surrender_count,
      COALESCE(SUM(tc.count_team_early_surrendered), 0)::bigint AS early_surrender_count
    FROM ${tcFrom}
    WHERE tc.rank_tier <> 'UNRANKED'
      ${versionWhere}
    GROUP BY tc.rank_tier, tc.team
  `)
}

export async function getSurrenderMatrix(
  version?: string | string[] | null,
  baselineVersion?: string | string[] | null
): Promise<SurrenderMatrixResult | null> {
  if (!isDatabaseConfigured()) return null
  const curVersion = normalizeParam(version)
  const curPatch = curVersion ? normalizePatchMajorMinor(curVersion) : null
  const baselineRaw = normalizeParam(baselineVersion)
  const baselinePatch = baselineRaw
    ? normalizePatchMajorMinor(baselineRaw)
    : previousPatchVersion(curPatch)
  const cacheKey = surrenderMatrixCacheKey(curPatch, baselinePatch)
  const now = Date.now()
  const cached = surrenderMatrixCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.data
  try {
    const [curRows, baseRows] = await Promise.all([
      loadSurrenderTeamAgg(curPatch),
      baselinePatch ? loadSurrenderTeamAgg(baselinePatch) : Promise.resolve([]),
    ])
    const curCells = buildSurrenderCells(curRows)
    const baseCells = buildSurrenderCells(baseRows)
    const rankOrder = ['ALL', 'IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER']
    const teamOrder: SurrenderMatrixTeam[] = ['ALL', 100, 200]
    const rows: SurrenderMatrixRow[] = []
    for (const rankTier of rankOrder) {
      for (const team of teamOrder) {
        const k = `${rankTier}|${String(team)}`
        const cur = curCells.get(k) ?? { matchCount: 0, surrenderCount: 0, earlySurrenderCount: 0 }
        const base = baseCells.get(k)
        const surrenderRate = toRate(cur.surrenderCount, cur.matchCount)
        const earlyRate = toRate(cur.earlySurrenderCount, cur.matchCount)
        const surrenderDelta = base ? surrenderRate - toRate(base.surrenderCount, base.matchCount) : null
        const earlyDelta = base ? earlyRate - toRate(base.earlySurrenderCount, base.matchCount) : null
        rows.push({
          rankTier,
          team,
          matchCount: cur.matchCount,
          surrenderCount: cur.surrenderCount,
          earlySurrenderCount: cur.earlySurrenderCount,
          surrenderRate,
          earlySurrenderRate: earlyRate,
          surrenderDelta,
          earlySurrenderDelta: earlyDelta,
        })
      }
    }
    const result: SurrenderMatrixResult = {
      version: curPatch,
      baselineVersion: baselinePatch,
      rows,
    }
    surrenderMatrixCache.set(cacheKey, { data: result, expiresAt: now + SURRENDER_MATRIX_CACHE_TTL_MS })
    return result
  } catch (err) {
    console.warn('[getSurrenderMatrix]', err)
    return null
  }
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
    const condIngest: string[] = ['1=1']
    if (versions.length === 1)
      {
        const patch = normalizePatchMajorMinor(versions[0]!).replace(/'/g, "''")
        cond.push(`mo.game_version LIKE '${patch}%'`)
        condIngest.push(`im.game_version LIKE '${patch}%'`)
      }
    else if (versions.length > 1) {
      const versionsSql = versions.map((v) => `'${v.replace(/'/g, "''")}'`).join(',')
      cond.push(`mo.game_version IN (${versionsSql})`)
      condIngest.push(`im.game_version IN (${versionsSql})`)
    }
    if (ranks.length === 1) {
      cond.push(`mo.rank_tier = '${ranks[0]}'`)
      condIngest.push(`im.rank_tier = '${ranks[0]}'`)
    } else if (ranks.length > 1) {
      const ranksSql = ranks.map((r) => `'${r}'`).join(',')
      cond.push(`mo.rank_tier IN (${ranksSql})`)
      condIngest.push(`im.rank_tier IN (${ranksSql})`)
    } else {
      cond.push(`mo.rank_tier <> 'UNRANKED'`)
      condIngest.push(`im.rank_tier <> 'UNRANKED'`)
    }
    const whereSql = cond.join(' AND ')
    const whereIngestSql = condIngest.join(' AND ')

    const moFrom = await matchVersionedAggFrom('agg_match_outcome_stats', pVersion, 'mo')
    const tcFrom = await matchVersionedAggFrom('agg_team_core_stats', pVersion, 'tc')

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
      FROM ${moFrom}
      LEFT JOIN ${tcFrom}
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
    // Fallback: some fresh patches can have match outcome rows before team-core surrender counters are filled.
    const fallbackNeeded =
      totalMatches > 0 && earlySurrenderCount === 0 && surrenderCount === 0
    let earlyFinal = earlySurrenderCount
    let surrenderFinal = surrenderCount
    if (fallbackNeeded && (await ingestMatchsTableExists())) {
      try {
        const ingestRows = await prisma.$queryRawUnsafe<
          Array<{ early_surrender_count: bigint; surrender_count: bigint }>
        >(`
          SELECT
            COALESCE(SUM(CASE WHEN im.game_ended_in_early_surrender THEN 1 ELSE 0 END), 0)::bigint AS early_surrender_count,
            COALESCE(SUM(CASE WHEN im.game_ended_in_surrender THEN 1 ELSE 0 END), 0)::bigint AS surrender_count
          FROM ingest_matchs im
          WHERE ${whereIngestSql}
        `)
        earlyFinal = Number(ingestRows[0]?.early_surrender_count ?? 0)
        surrenderFinal = Number(ingestRows[0]?.surrender_count ?? 0)
      } catch {
        /* ingest_matchs removed between existence check and query — keep agg values */
      }
    }

    const rates = computeAbandonRates(totalMatches, remakeCount, earlyFinal, surrenderFinal)
    const result: OverviewAbandonsResult = {
      totalMatches,
      remakeCount,
      remakeRate: rates.remakeRate,
      earlySurrenderCount: earlyFinal,
      earlySurrenderRate: rates.earlySurrenderRate,
      surrenderCount: surrenderFinal,
      surrenderRate: rates.surrenderRate,
    }
    abandonsCache.set(cacheKey, { data: result, expiresAt: now + ABANDONS_CACHE_TTL_MS })
    return result
  } catch (err) {
    console.warn('[getOverviewAbandons]', err)
    return null
  }
}
