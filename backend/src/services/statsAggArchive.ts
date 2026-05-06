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
 * Logical table name → physical `agg_*` / `archive_agg_*`.
 * `mv_*` prefixes are normalized to `agg_*` for callers that still pass old names.
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

/** Live `agg_*` rows for the same patch (current patch is often here until close_patch moves them). */
function sqlLiveSinglePatchFragment(aggTableName: string, p: string): string {
  const normalizedTable = normalizeAggTableName(aggTableName)
  if (CHAMPION_SATELLITE_TABLES.has(normalizedTable)) {
    return `(SELECT s.* FROM ${normalizedTable} s INNER JOIN agg_champion_core_stats cj ON cj.id = s.champion_stat_id WHERE ${patchVersionSqlPredicate('cj', p)})`
  }
  if (normalizedTable === 'agg_team_bucket') {
    return `(SELECT tb.* FROM ${normalizedTable} tb INNER JOIN agg_team_core_stats tj ON tj.id = tb.team_stat_id WHERE ${patchVersionSqlPredicate('tj', p)})`
  }
  return `(SELECT * FROM ${normalizedTable} WHERE game_version = '${p}' OR game_version LIKE '${p}.%')`
}

async function unifiedArchiveRelationExists(archiveName: string): Promise<boolean> {
  if (!/^[a-z0-9_]+$/.test(archiveName)) return false
  const rows = await prisma.$queryRawUnsafe<Array<{ x: boolean }>>(
    `SELECT to_regclass('public.${archiveName}') IS NOT NULL AS x`,
  )
  return Boolean(rows[0]?.x)
}

/** True if the incremental `agg_*` table exists (current patch rows often live here). */
export async function liveAggRelationExists(aggTableName: string): Promise<boolean> {
  if (!/^[a-z0-9_]+$/.test(aggTableName)) return false
  const rows = await prisma.$queryRawUnsafe<Array<{ x: boolean }>>(
    `SELECT to_regclass('public.${aggTableName}') IS NOT NULL AS x`,
  )
  return Boolean(rows[0]?.x)
}

/**
 * `agg_match_outcome_stats` PK = (game_version, rank_tier). Après archivage, des lignes peuvent rester
 * temporairement dans `agg_*` en plus de `archive_*` : UNION ALL doublait les `count_match` côté API/stats.
 * On garde une seule ligne par clé ; l’archive (prio 2) l’emporte sur le live (1) si doublon.
 */
function sqlUnionMatchOutcomeArchiveLiveDeduped(archiveSubsql: string, liveSubsql: string): string {
  return `(
    SELECT DISTINCT ON (game_version, rank_tier)
      game_version, rank_tier, count_match, updated_at
    FROM (
      SELECT game_version, rank_tier, count_match, updated_at, 2 AS _dedupe_prio
      FROM ${archiveSubsql} _mo_arch
      UNION ALL
      SELECT game_version, rank_tier, count_match, updated_at, 1 AS _dedupe_prio
      FROM ${liveSubsql} _mo_live
    ) _mo_u
    ORDER BY game_version, rank_tier, _dedupe_prio DESC
  )`
}

async function sqlSinglePatchArchivePlusLive(aggTableName: string, p: string): Promise<string> {
  const normalizedTable = normalizeAggTableName(aggTableName)
  const archiveName = unifiedArchiveTableName(normalizedTable)
  const archiveOk = await unifiedArchiveRelationExists(archiveName)
  const liveOk = await liveAggRelationExists(normalizedTable)
  if (!archiveOk && !liveOk) {
    throw new Error(
      `[statsAggArchive] no aggregate source for ${aggTableName}: missing ${archiveName} and ${normalizedTable}`,
    )
  }
  if (archiveOk && liveOk) {
    if (normalizedTable === 'agg_match_outcome_stats') {
      return sqlUnionMatchOutcomeArchiveLiveDeduped(
        sqlArchivedSinglePatchFragment(normalizedTable, p),
        sqlLiveSinglePatchFragment(normalizedTable, p)
      )
    }
    /** Lecture stats = snapshots `archive_agg_*` uniquement ; l’UNION ALL avec `agg_*` live dupliquait les lignes (totaux ×2, WR objectifs incohérents). */
    return sqlArchivedSinglePatchFragment(normalizedTable, p)
  }
  if (archiveOk) return sqlArchivedSinglePatchFragment(normalizedTable, p)
  return sqlLiveSinglePatchFragment(normalizedTable, p)
}

/**
 * FROM fragment for one patch: `archive_*` ∪ `agg_*` for that patch (disjoint after patch close; live holds current patch).
 * Exported so callers can probe the same branch as `matchVersionedAggFrom`.
 */
export async function sqlAggOrArchiveRelation(aggTableName: string, patchKey: string): Promise<string | null> {
  const normalizedTable = normalizeAggTableName(aggTableName)
  if (!isSafeIdentSegment(normalizedTable)) return null
  const p = normalizePatchMajorMinor(patchKey)
  if (!/^\d+\.\d+$/.test(p)) return null

  return sqlSinglePatchArchivePlusLive(normalizedTable, p)
}

function normalizeSingleVersionKey(version: string | string[] | null | undefined): string | null {
  const arr = toQueryStringArrayParam(version)
  if (arr.length !== 1) return null
  return normalizePatchMajorMinor(arr[0]!)
}

/**
 * FROM clause fragment: single patch = archive ∪ live for that patch; multi / unset = full archive ∪ full live.
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
    const physical = await sqlSinglePatchArchivePlusLive(normalizedTable, normalizePatchMajorMinor(single))
    return `${physical} ${asAlias}`
  }
  return sqlAggUnionAllLiveAndArchives(normalizedTable, asAlias)
}

/** Full-table read: `archive_*` UNION ALL `agg_*` when both exist (name kept for callers). */
export async function sqlAggUnionAllLiveAndArchives(aggTableName: string, asAlias: string): Promise<string> {
  if (!isSafeIdentSegment(aggTableName) || !/^[a-z][a-z0-9_]*$/.test(asAlias)) {
    throw new Error(`[statsAggArchive] invalid identifier for archive read: ${aggTableName} ${asAlias}`)
  }
  const archive = unifiedArchiveTableName(aggTableName)
  const archiveOk = await unifiedArchiveRelationExists(archive)
  const liveOk = await liveAggRelationExists(aggTableName)
  if (!archiveOk && !liveOk) {
    throw new Error(`[statsAggArchive] missing aggregate tables: ${archive} and ${aggTableName}`)
  }
  const archSelect = (): string => {
    if (CHAMPION_SATELLITE_TABLES.has(aggTableName)) {
      return `SELECT s.* FROM ${archive} s
      INNER JOIN archive_agg_champion_core_stats c ON c.id = s.champion_stat_id`
    }
    if (aggTableName === 'agg_team_bucket') {
      return `SELECT tb.* FROM ${archive} tb
      INNER JOIN archive_agg_team_core_stats t ON t.id = tb.team_stat_id`
    }
    return `SELECT * FROM ${archive}`
  }
  const liveSelect = (): string => {
    if (CHAMPION_SATELLITE_TABLES.has(aggTableName)) {
      return `SELECT s.* FROM ${aggTableName} s
      INNER JOIN agg_champion_core_stats c ON c.id = s.champion_stat_id`
    }
    if (aggTableName === 'agg_team_bucket') {
      return `SELECT tb.* FROM ${aggTableName} tb
      INNER JOIN agg_team_core_stats t ON t.id = tb.team_stat_id`
    }
    return `SELECT * FROM ${aggTableName}`
  }
  if (archiveOk && liveOk) {
    if (aggTableName === 'agg_match_outcome_stats') {
      return `${sqlUnionMatchOutcomeArchiveLiveDeduped(`(${archSelect()})`, `(${liveSelect()})`)} AS ${asAlias}`
    }
    return `((${archSelect()})) AS ${asAlias}`
  }
  if (archiveOk) {
    if (CHAMPION_SATELLITE_TABLES.has(aggTableName)) {
      return `(${archSelect()}) AS ${asAlias}`
    }
    if (aggTableName === 'agg_team_bucket') {
      return `(${archSelect()}) AS ${asAlias}`
    }
    return `(SELECT * FROM ${archive}) AS ${asAlias}`
  }
  if (CHAMPION_SATELLITE_TABLES.has(aggTableName)) {
    return `(${liveSelect()}) AS ${asAlias}`
  }
  if (aggTableName === 'agg_team_bucket') {
    return `(${liveSelect()}) AS ${asAlias}`
  }
  return `(SELECT * FROM ${aggTableName}) AS ${asAlias}`
}
