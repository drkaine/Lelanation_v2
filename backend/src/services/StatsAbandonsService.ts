/**
 * Stats d'abandon : surrender (early / normal) depuis les tables d'agrégats runtime.
 * Remake = match où au moins un participant n'a aucun item (déco / non connecté).
 * Cache mémoire 5 min pour limiter les requêtes lourdes.
 */
import { queryRawUnsafe } from '../db/query.js'
import { isDatabaseConfigured } from '../db/query.js'
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
  return false
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

const SURRENDER_MATRIX_RANK_ORDER = [
  'ALL',
  'UNRANKED',
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
] as const

type Cell = {
  matchCount: number
  surrenderCount: number
  earlySurrenderCount: number
}

function buildSurrenderCells(
  rows: TeamAggRow[],
  matchCountByRank: Map<string, number>
): Map<string, Cell> {
  const byKey = new Map<string, Cell>()
  const addTeam = (rank: string, team: 100 | 200, match: number, surrender: number, early: number) => {
    const key = `${rank}|${String(team)}`
    const cur = byKey.get(key) ?? { matchCount: 0, surrenderCount: 0, earlySurrenderCount: 0 }
    cur.matchCount += match
    cur.surrenderCount += surrender
    cur.earlySurrenderCount += early
    byKey.set(key, cur)
  }

  for (const r of rows) {
    const rank = String(r.rank_tier ?? '').toUpperCase()
    if (!rank) continue
    const team = Number(r.team) as 100 | 200
    if (team !== 100 && team !== 200) continue
    const match = Number(r.match_count ?? 0)
    const surrender = Number(r.surrender_count ?? 0)
    const early = Number(r.early_surrender_count ?? 0)
    addTeam(rank, team, match, surrender, early)
    addTeam('ALL', team, match, surrender, early)
  }

  const ranks = new Set<string>([...matchCountByRank.keys(), ...byKey.keys()].map((k) => k.split('|')[0]!))
  for (const rank of ranks) {
    if (rank === 'ALL') continue
    const blue = byKey.get(`${rank}|100`)
    const red = byKey.get(`${rank}|200`)
    if (!blue && !red) continue
    const matchCount =
      matchCountByRank.get(rank) ??
      Math.max(blue?.matchCount ?? 0, red?.matchCount ?? 0)
    byKey.set(`${rank}|ALL`, {
      matchCount,
      surrenderCount: (blue?.surrenderCount ?? 0) + (red?.surrenderCount ?? 0),
      earlySurrenderCount: (blue?.earlySurrenderCount ?? 0) + (red?.earlySurrenderCount ?? 0),
    })
  }

  const grandMatch =
    matchCountByRank.get('ALL') ??
    [...matchCountByRank.values()].reduce((s, n) => s + n, 0)
  const grandBlue = byKey.get('ALL|100')
  const grandRed = byKey.get('ALL|200')
  if (grandBlue || grandRed) {
    byKey.set('ALL|ALL', {
      matchCount: grandMatch > 0 ? grandMatch : Math.max(grandBlue?.matchCount ?? 0, grandRed?.matchCount ?? 0),
      surrenderCount: (grandBlue?.surrenderCount ?? 0) + (grandRed?.surrenderCount ?? 0),
      earlySurrenderCount: (grandBlue?.earlySurrenderCount ?? 0) + (grandRed?.earlySurrenderCount ?? 0),
    })
  }

  return byKey
}

async function loadSurrenderMatchCountsByRank(
  version: string | null,
  rankTier?: string | string[] | null
): Promise<Map<string, number>> {
  const moFrom = await matchVersionedAggFrom('agg_match_outcome_stats', version, 'mo')
  const versionWhere = version
    ? ` AND mo.game_version LIKE '${normalizePatchMajorMinor(version).replace(/'/g, "''")}%'`
    : ''
  const rankWhere = buildRankTierWhere('mo', rankTier)
  const rows = await queryRawUnsafe<Array<{ rank_tier: string; match_count: bigint }>>(`
    SELECT
      mo.rank_tier,
      COALESCE(SUM(mo.count_match), 0)::bigint AS match_count
    FROM ${moFrom}
    WHERE 1=1
      ${rankWhere}
      ${versionWhere}
    GROUP BY mo.rank_tier
  `)
  const out = new Map<string, number>()
  let total = 0
  for (const r of rows) {
    const rank = String(r.rank_tier ?? '').toUpperCase()
    if (!rank) continue
    const n = Number(r.match_count ?? 0)
    out.set(rank, n)
    total += n
  }
  out.set('ALL', total)
  return out
}

function buildRankTierWhere(alias: string, rankTier?: string | string[] | null): string {
  const ranks = toQueryStringArrayParam(rankTier)
    .map((r) => r.toUpperCase())
    .filter((r) => r && r !== 'ALL' && r !== '*')
  if (ranks.length === 1) return ` AND ${alias}.rank_tier = '${ranks[0]}'`
  if (ranks.length > 1) return ` AND ${alias}.rank_tier IN (${ranks.map((r) => `'${r}'`).join(',')})`
  return ''
}

async function loadSurrenderTeamAgg(
  version: string | null,
  rankTier?: string | string[] | null
): Promise<TeamAggRow[]> {
  const tcFrom = await matchVersionedAggFrom('agg_team_core_stats', version, 'tc')
  const versionWhere = version
    ? ` AND tc.game_version LIKE '${normalizePatchMajorMinor(version).replace(/'/g, "''")}%'`
    : ''
  const rankWhere = buildRankTierWhere('tc', rankTier)
  return queryRawUnsafe<TeamAggRow[]>(`
    SELECT
      tc.rank_tier,
      tc.team,
      COALESCE(SUM(tc.count_game), 0)::bigint AS match_count,
      COALESCE(SUM(tc.count_team_surrendered), 0)::bigint AS surrender_count,
      COALESCE(SUM(tc.count_team_early_surrendered), 0)::bigint AS early_surrender_count
    FROM ${tcFrom}
    WHERE 1=1
      ${rankWhere}
      ${versionWhere}
    GROUP BY tc.rank_tier, tc.team
  `)
}

/** Totaux surrender / early par côté (team 100 / 200) depuis team_core_stat. */
export async function getTeamSurrenderTotalsBySide(
  version?: string | string[] | null,
  rankTier?: string | string[] | null
): Promise<Map<100 | 200, { surrender: number; early: number }>> {
  const pVersion = normalizeParam(version)
  const patch = pVersion ? normalizePatchMajorMinor(pVersion) : null
  const rows = await loadSurrenderTeamAgg(patch, rankTier)
  const out = new Map<100 | 200, { surrender: number; early: number }>()
  for (const r of rows) {
    const team = Number(r.team) as 100 | 200
    if (team !== 100 && team !== 200) continue
    const cur = out.get(team) ?? { surrender: 0, early: 0 }
    cur.surrender += Number(r.surrender_count ?? 0)
    cur.early += Number(r.early_surrender_count ?? 0)
    out.set(team, cur)
  }
  return out
}

export async function getSurrenderMatrix(
  version?: string | string[] | null,
  baselineVersion?: string | string[] | null,
  rankTier?: string | string[] | null
): Promise<SurrenderMatrixResult | null> {
  if (!isDatabaseConfigured()) return null
  const curVersion = normalizeParam(version)
  const curPatch = curVersion ? normalizePatchMajorMinor(curVersion) : null
  const baselineRaw = normalizeParam(baselineVersion)
  let baselinePatch = baselineRaw
    ? normalizePatchMajorMinor(baselineRaw)
    : previousPatchVersion(curPatch)
  if (baselinePatch && curPatch && baselinePatch === curPatch) {
    baselinePatch = previousPatchVersion(curPatch)
  }
  const rankKey = rankTierCacheKey(rankTier)
  const cacheKey = `${surrenderMatrixCacheKey(curPatch, baselinePatch)}|${rankKey}`
  const now = Date.now()
  const cached = surrenderMatrixCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.data
  try {
    const [curRows, baseRows, curMatchByRank, baseMatchByRank] = await Promise.all([
      loadSurrenderTeamAgg(curPatch, rankTier),
      baselinePatch ? loadSurrenderTeamAgg(baselinePatch, rankTier) : Promise.resolve([]),
      loadSurrenderMatchCountsByRank(curPatch, rankTier),
      baselinePatch ? loadSurrenderMatchCountsByRank(baselinePatch, rankTier) : Promise.resolve(new Map()),
    ])
    const curCells = buildSurrenderCells(curRows, curMatchByRank)
    const baseCells = buildSurrenderCells(baseRows, baseMatchByRank)
    const rankOrder = [...SURRENDER_MATRIX_RANK_ORDER]
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
    const ranks = toQueryStringArrayParam(rankTier)
      .map((r) => r.toUpperCase())
      .filter((r) => r && r !== 'ALL' && r !== '*')
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
    }
    const whereSql = cond.join(' AND ')
    const whereIngestSql = condIngest.join(' AND ')

    const moFrom = await matchVersionedAggFrom('agg_match_outcome_stats', pVersion, 'mo')
    const totalRows = await queryRawUnsafe<Array<{ total_matches: bigint }>>(`
      SELECT COALESCE(SUM(mo.count_match), 0)::bigint AS total_matches
      FROM ${moFrom} WHERE ${whereSql}
    `)
    const totalMatches = Number(totalRows[0]?.total_matches ?? 0)
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

    const teamRows = await loadSurrenderTeamAgg(pVersion, rankTier)
    const earlySurrenderCount = teamRows.reduce(
      (s, r) => s + Number(r.early_surrender_count ?? 0),
      0
    )
    const surrenderCount = teamRows.reduce((s, r) => s + Number(r.surrender_count ?? 0), 0)
    const remakeCount = 0
    // Fallback: some fresh patches can have match outcome rows before team-core surrender counters are filled.
    const fallbackNeeded =
      totalMatches > 0 && earlySurrenderCount === 0 && surrenderCount === 0
    let earlyFinal = earlySurrenderCount
    let surrenderFinal = surrenderCount
    if (fallbackNeeded && (await ingestMatchsTableExists())) {
      try {
        const ingestRows = await queryRawUnsafe<
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
