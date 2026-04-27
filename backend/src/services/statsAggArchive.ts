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
  'agg_champion_participant_stats',
  'agg_champion_summoner_spells',
  'agg_champion_runes_stats',
  'agg_champion_runes_solo_stats',
  'agg_champion_shard_solo_stats',
  'agg_champion_item_stats',
  'agg_champion_item_solo_stats',
])

function unifiedArchiveTableName(aggTableName: string): string {
  return `archive_${aggTableName}`
}

function patchVersionSqlPredicate(alias: string, p: string): string {
  return `(${alias}.game_version = '${p}' OR ${alias}.game_version LIKE '${p}.%')`
}

/**
 * Single-patch archive fragment: unified table `archive_<aggTableName>` filtered to one patch.
 */
function sqlArchivedSinglePatchFragment(aggTableName: string, p: string): string {
  const archive = unifiedArchiveTableName(aggTableName)
  if (CHAMPION_SATELLITE_TABLES.has(aggTableName)) {
    return `(SELECT s.* FROM ${archive} s INNER JOIN archive_agg_champion_core_stats cj ON cj.id = s.champion_stat_id WHERE ${patchVersionSqlPredicate('cj', p)})`
  }
  if (aggTableName === 'agg_team_bucket') {
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

async function patchHasRowsInUnifiedArchive(patchKey: string): Promise<boolean> {
  const p = normalizePatchMajorMinor(patchKey)
  if (!/^\d+\.\d+$/.test(p)) return false
  const like = `${p}.%`
  const rows = await prisma.$queryRaw<[{ ok: boolean }]>`
    SELECT EXISTS (
      SELECT 1 FROM archive_agg_champion_core_stats a
      WHERE a.game_version = ${p} OR a.game_version LIKE ${like}
    ) AS ok
  `
  return Boolean(rows[0]?.ok)
}

/**
 * FROM fragment for one patch: live agg or filtered rows from unified archive table.
 */
export async function sqlAggOrArchiveRelation(aggTableName: string, patchKey: string): Promise<string | null> {
  if (!isSafeIdentSegment(aggTableName)) return null
  const p = normalizePatchMajorMinor(patchKey)
  if (!/^\d+\.\d+$/.test(p)) return null

  const row = await prisma.activePatch.findUnique({
    where: { gameVersion: p },
    select: { archivedAt: true },
  })

  const inArchive =
    row?.archivedAt != null || (row == null && (await patchHasRowsInUnifiedArchive(p)))

  if (!inArchive) return aggTableName

  const archiveName = unifiedArchiveTableName(aggTableName)
  if (!(await unifiedArchiveRelationExists(archiveName))) return aggTableName

  return sqlArchivedSinglePatchFragment(aggTableName, p)
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
  if (!isSafeIdentSegment(aggTableName) || !/^[a-z][a-z0-9_]*$/.test(asAlias)) {
    return `${aggTableName} ${asAlias}`
  }
  const single = normalizeSingleVersionKey(version)
  if (single) {
    const rel = await sqlAggOrArchiveRelation(aggTableName, single)
    const physical = rel ?? aggTableName
    return `${physical} ${asAlias}`
  }
  return sqlAggUnionAllLiveAndArchives(aggTableName, asAlias)
}

export async function sqlAggUnionAllLiveAndArchives(aggTableName: string, asAlias: string): Promise<string> {
  if (!isSafeIdentSegment(aggTableName) || !/^[a-z][a-z0-9_]*$/.test(asAlias)) {
    return `${aggTableName} ${asAlias}`
  }
  const archive = unifiedArchiveTableName(aggTableName)
  if (!(await unifiedArchiveRelationExists(archive))) {
    return `${aggTableName} ${asAlias}`
  }
  if (CHAMPION_SATELLITE_TABLES.has(aggTableName)) {
    return `(SELECT * FROM ${aggTableName}
      UNION ALL
      SELECT s.* FROM ${archive} s
      INNER JOIN archive_agg_champion_core_stats c ON c.id = s.champion_stat_id) AS ${asAlias}`
  }
  if (aggTableName === 'agg_team_bucket') {
    return `(SELECT * FROM ${aggTableName}
      UNION ALL
      SELECT tb.* FROM ${archive} tb
      INNER JOIN archive_agg_team_core_stats t ON t.id = tb.team_stat_id) AS ${asAlias}`
  }
  return `(SELECT * FROM ${aggTableName} UNION ALL SELECT * FROM ${archive}) AS ${asAlias}`
}
