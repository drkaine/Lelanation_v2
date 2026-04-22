import { prisma } from '../db.js'
import { toQueryStringArrayParam } from '../utils/statsFilters.js'

const partitionListCache = new Map<string, { at: number; names: string[] }>()
const PARTITION_TTL_MS = 60_000

export function invalidateAggArchivePartitionCache(): void {
  partitionListCache.clear()
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

/** Physical relation for one patch: live agg table or frozen archive_agg_*_{major_minor}. */
export async function sqlAggOrArchiveRelation(aggTableName: string, patchKey: string): Promise<string | null> {
  if (!isSafeIdentSegment(aggTableName)) return null
  const p = normalizePatchMajorMinor(patchKey)
  if (!/^\d+\.\d+$/.test(p)) return null

  const row = await prisma.activePatch.findUnique({
    where: { gameVersion: p },
    select: { archivedAt: true },
  })
  const suffix = p.replace(/\./g, '_')
  const archiveName = `archive_${aggTableName}_${suffix}`
  if (!isSafeIdentSegment(archiveName)) return null

  if (row?.archivedAt != null) return archiveName

  if (!row) {
    const exists = await archiveRelationExists(archiveName)
    if (exists) return archiveName
  }
  return aggTableName
}

async function archiveRelationExists(rel: string): Promise<boolean> {
  if (!/^[a-z0-9_]+$/.test(rel)) return false
  const rows = await prisma.$queryRawUnsafe<Array<{ x: boolean }>>(
    `SELECT to_regclass('public.${rel}') IS NOT NULL AS x`
  )
  return Boolean(rows[0]?.x)
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
  const archives = await listArchivePartitionTables(aggTableName)
  if (archives.length === 0) return `${aggTableName} ${asAlias}`
  const parts = [`SELECT * FROM ${aggTableName}`, ...archives.map((t) => `SELECT * FROM ${t}`)]
  return `(${parts.join(' UNION ALL ')}) AS ${asAlias}`
}

async function listArchivePartitionTables(aggTableName: string): Promise<string[]> {
  const now = Date.now()
  const cached = partitionListCache.get(aggTableName)
  if (cached && now - cached.at < PARTITION_TTL_MS) return cached.names

  const prefix = `archive_${aggTableName}_`
  const rows = await prisma.$queryRaw<Array<{ relname: string }>>`
    SELECT c.relname::text AS relname
    FROM pg_class c
    INNER JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname LIKE ${prefix + '%'}
    ORDER BY c.relname
  `
  const safePrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^${safePrefix}\\d+_\\d+$`)
  const names = rows.map((r) => r.relname).filter((n) => re.test(n) && /^[a-z0-9_]+$/.test(n))
  partitionListCache.set(aggTableName, { at: now, names })
  return names
}
