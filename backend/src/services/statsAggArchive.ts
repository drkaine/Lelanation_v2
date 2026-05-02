import { prisma } from '../db.js'
import { toQueryStringArrayParam } from '../utils/statsFilters.js'

export function invalidateAggArchivePartitionCache(): void {
  /* no-op: legacy per-patch archive tables removed; unified archive does not need a partition list cache */
}

export function normalizePatchMajorMinor(version: string): string {
  const parts = String(version ?? '')
    .trim()
    .split('.')
    .filter(Boolean)
  if (parts.length >= 2) return `${parts[0]}.${parts[1]}`
  if (parts.length === 1) return `${parts[0]}.0`
  return '0.0'
}

function isSafeIdentSegment(s: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(s)
}

/** Satellites keyed by champion_stat_id (no game_version on row). */
const CHAMPION_SATELLITE_TABLES = new Set([
  'agg_champion_bucket',
  'agg_champion_damage_stats',
  'agg_champion_duo_role_stats',
  'agg_champion_participant_stats',
  'agg_champion_spells_stats',
  'agg_champion_summoner_spells',
  'agg_champion_runes_stats',
  'agg_champion_runes_solo_stats',
  'agg_champion_shard_solo_stats',
  'agg_champion_item_stats',
  'agg_champion_item_solo_stats',
])

function unifiedArchiveTableName(aggTableName: string): string {
  const normalized = normalizeAggTableName(aggTableName)
  return `archive_${normalized}`
}

/**
 * Some services still request legacy `mv_*` names for fallback paths.
 * Archive snapshot tables are `archive_agg_*`, so we normalize aliases here.
 */
function normalizeAggTableName(rawTableName: string): string {
  const t = String(rawTableName ?? '').trim()
  if (t.startsWith('mv_')) return `agg_${t.slice(3)}`
  return t
}

function patchVersionSqlPredicate(alias: string, p: string): string {
  return `(${alias}.game_version = '${p}' OR ${alias}.game_version LIKE '${p}.%')`
}

/**
 * Single-patch archive fragment: unified table `archive_<aggTableName>` filtered to one patch.
 */
function sqlArchivedSinglePatchFragment(aggTableName: string, p: string): string {
  const normalizedTable = normalizeAggTableName(aggTableName)
  const archive = unifiedArchiveTableName(normalizedTable)
  if (CHAMPION_SATELLITE_TABLES.has(normalizedTable)) {
    return `(SELECT s.* FROM ${archive} s INNER JOIN archive_agg_champion_core_stats cj ON cj.id = s.champion_stat_id WHERE ${patchVersionSqlPredicate('cj', p)})`
  }
  if (normalizedTable === 'agg_team_bucket') {
    return `(SELECT tb.* FROM ${archive} tb INNER JOIN archive_agg_team_core_stats tj ON tj.id = tb.team_stat_id WHERE ${patchVersionSqlPredicate('tj', p)})`
  }
  return `(SELECT * FROM ${archive} WHERE game_version = '${p}' OR game_version LIKE '${p}.%')`
}

async function unifiedArchiveRelationExists(archiveName: string): Promise<boolean> {
  if (!/^[a-z0-9_]+$/.test(archiveName)) return false
  const rows = await prisma.$queryRawUnsafe<Array<{ x: boolean }>>(
    `SELECT to_regclass('public.${archiveName}') IS NOT NULL AS x`,
  )
  return Boolean(rows[0]?.x)
}

/**
 * FROM fragment for one patch: filtered rows from unified archive table only.
 * Exported so callers can probe columns on the same physical branch as `matchVersionedAggFrom`.
 */
export async function sqlAggOrArchiveRelation(aggTableName: string, patchKey: string): Promise<string | null> {
  const normalizedTable = normalizeAggTableName(aggTableName)
  if (!isSafeIdentSegment(normalizedTable)) return null
  const p = normalizePatchMajorMinor(patchKey)
  if (!/^\d+\.\d+$/.test(p)) return null

  const archiveName = unifiedArchiveTableName(normalizedTable)
  if (!(await unifiedArchiveRelationExists(archiveName))) {
    throw new Error(`[statsAggArchive] required archive table missing: ${archiveName}`)
  }

  return sqlArchivedSinglePatchFragment(normalizedTable, p)
}

function normalizeSingleVersionKey(version: string | string[] | null | undefined): string | null {
  const arr = toQueryStringArrayParam(version)
  if (arr.length !== 1) return null
  return normalizePatchMajorMinor(arr[0]!)
}

/**
 * FROM clause fragment: one physical table + alias, or (UNION ALL …) AS alias when version is unset / multi.
 */
export async function matchVersionedAggFrom(
  aggTableName: string,
  version: string | string[] | null | undefined,
  asAlias: string
): Promise<string> {
  const normalizedTable = normalizeAggTableName(aggTableName)
  if (!isSafeIdentSegment(normalizedTable) || !/^[a-z][a-z0-9_]*$/.test(asAlias)) {
    throw new Error(`[statsAggArchive] invalid identifier for archive read: ${aggTableName} ${asAlias}`)
  }
  const single = normalizeSingleVersionKey(version)
  if (single) {
    const rel = await sqlAggOrArchiveRelation(normalizedTable, single)
    const physical = rel ?? sqlArchivedSinglePatchFragment(normalizedTable, normalizePatchMajorMinor(single))
    return `${physical} ${asAlias}`
  }
  return sqlAggUnionAllLiveAndArchives(normalizedTable, asAlias)
}

export async function sqlAggUnionAllLiveAndArchives(aggTableName: string, asAlias: string): Promise<string> {
  if (!isSafeIdentSegment(aggTableName) || !/^[a-z][a-z0-9_]*$/.test(asAlias)) {
    throw new Error(`[statsAggArchive] invalid identifier for archive read: ${aggTableName} ${asAlias}`)
  }
  const archive = unifiedArchiveTableName(aggTableName)
  if (!(await unifiedArchiveRelationExists(archive))) {
    throw new Error(`[statsAggArchive] required archive table missing: ${archive}`)
  }
  if (CHAMPION_SATELLITE_TABLES.has(aggTableName)) {
    return `(SELECT s.* FROM ${archive} s
      INNER JOIN archive_agg_champion_core_stats c ON c.id = s.champion_stat_id) AS ${asAlias}`
  }
  if (aggTableName === 'agg_team_bucket') {
    return `(SELECT tb.* FROM ${archive} tb
      INNER JOIN archive_agg_team_core_stats t ON t.id = tb.team_stat_id) AS ${asAlias}`
  }
  return `(SELECT * FROM ${archive}) AS ${asAlias}`
}
