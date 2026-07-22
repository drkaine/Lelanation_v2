import { readFile } from 'fs/promises'
import { join } from 'path'
import pg from 'pg'
import {
  loadRiotPortalDescriptions,
  resolveFieldDescription,
} from './riotApiPortalDescriptions.js'
import {
  collectFieldLeavesFromPayload,
  type FieldLeaf,
  fieldRowId,
} from './riotApiFieldWalk.js'
import type { FieldChangeStatus, FieldRegistry, FieldRegistryRow } from './RiotApiFieldRegistryService.js'

export type { FieldRegistry, FieldRegistryRow }

const DEFAULT_REVIEW_COLUMNS = ['lelariva', 'alkora'] as const

const CHALLENGE_SUM_SUFFIX_OVERRIDE: Record<string, string> = {
  jungleCsBefore10Minutes: 'jungle_cs_before_10_minutes',
  outerTurretExecutesBefore10Minutes: 'outer_turret_executes_before_10_minutes',
  takedownsFirstXMinutes: 'takedowns_first_x_minutes',
  wardTakedownsBefore20M: 'ward_takedowns_before_20_m',
  '12AssistStreakCount': 'assist_streak_count',
}

const MATCH_INFO_TO_DB: Record<string, { table: string; column: string }> = {
  gameDuration: { table: 'matchs', column: 'game_duration' },
  gameCreation: { table: 'matchs', column: 'game_date' },
  queueId: { table: 'matchs', column: 'queue_id' },
}

const TEAM_INFO_TO_DB: Record<string, { table: string; column: string }> = {
  baronKills: { table: 'teams', column: 'baron_kills' },
  championKills: { table: 'teams', column: 'champion_kills' },
  dragonKills: { table: 'teams', column: 'dragon_kills' },
  firstBaron: { table: 'teams', column: 'baron_first' },
  firstBlood: { table: 'teams', column: 'first_blood' },
  firstDragon: { table: 'teams', column: 'dragon_first' },
  firstTower: { table: 'teams', column: 'tower_first' },
  inhibitorKills: { table: 'teams', column: 'inhibitor_kills' },
  riftHeraldKills: { table: 'teams', column: 'rift_herald_kills' },
  towerKills: { table: 'teams', column: 'tower_kills' },
  win: { table: 'teams', column: 'win' },
}

function toSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toLowerCase()
}

function resolveDbMapping(source: 'match' | 'timeline', path: string, key: string): { table: string; column: string } | null {
  if (source !== 'match') return null

  if (path.startsWith('info.') && !path.includes('[') && MATCH_INFO_TO_DB[key]) {
    return MATCH_INFO_TO_DB[key]
  }

  if (path.includes('info.teams[]')) {
    return TEAM_INFO_TO_DB[key] ?? null
  }

  if (path.includes('info.participants[].challenges.')) {
    const col = CHALLENGE_SUM_SUFFIX_OVERRIDE[key] ?? toSnakeCase(key)
    return { table: 'participants', column: col }
  }

  if (path.includes('info.participants[]') && !path.includes('.')) {
    return { table: 'participants', column: toSnakeCase(key) }
  }

  const participantLeaf = path.match(/info\.participants\[\]\.([^.]+)$/)
  if (participantLeaf) {
    const leaf = participantLeaf[1]
    if (leaf === 'championId') return { table: 'participants', column: 'champion_id' }
    if (leaf === 'teamId') return { table: 'participants', column: 'team_id' }
    if (leaf === 'participantId') return { table: 'participants', column: 'participant_id' }
    if (leaf === 'teamPosition') return { table: 'participants', column: 'team_position' }
    if (leaf === 'visionScore') return null
    return { table: 'participants', column: toSnakeCase(leaf) }
  }

  const nestedParticipant = path.match(/info\.participants\[\]\.([a-zA-Z0-9_]+)\.([^.]+)$/)
  if (nestedParticipant) {
    const parent = nestedParticipant[1]
    if (parent === 'perks' || parent === 'stats' || parent === 'PlayerBehavior') return null
  }

  return null
}

async function loadDbColumnSets(pool: pg.Pool): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>()
  const tables = ['participants', 'matchs', 'teams'] as const
  for (const table of tables) {
    const colsRes = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    )
    result.set(table, new Set(colsRes.rows.map((r) => r.column_name)))
  }
  return result
}

async function loadColumnStats(pool: pg.Pool): Promise<Map<string, { min: number; max: number }>> {
  const result = new Map<string, { min: number; max: number }>()
  const tables = ['participants', 'matchs', 'teams'] as const

  for (const table of tables) {
    const colsRes = await pool.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
         AND data_type IN ('integer', 'bigint', 'double precision', 'numeric', 'smallint', 'real')`,
      [table],
    )

    for (const col of colsRes.rows) {
      try {
        const stats = await pool.query<{ min: string | null; max: string | null }>(
          `SELECT MIN("${col.column_name}")::text AS min, MAX("${col.column_name}")::text AS max FROM ${table}`,
        )
        const minRaw = stats.rows[0]?.min
        const maxRaw = stats.rows[0]?.max
        if (minRaw == null || maxRaw == null) continue
        const min = Number(minRaw)
        const max = Number(maxRaw)
        if (!Number.isFinite(min) || !Number.isFinite(max)) continue
        result.set(`${table}.${col.column_name}`, { min, max })
      } catch {
        // skip columns that fail
      }
    }
  }

  return result
}

function buildRowFromLeaf(
  leaf: FieldLeaf,
  reviewColumns: string[],
  existingReviews: Map<string, Record<string, string>>,
  dbColumns: Map<string, Set<string>>,
  dbStats: Map<string, { min: number; max: number }>,
  portalDescriptions: Record<string, string>,
  changeStatus: FieldChangeStatus | null,
  changeDetectedAt: string | null,
): FieldRegistryRow {
  const db = resolveDbMapping(leaf.source, leaf.path, leaf.key)
  const inDb = Boolean(db && dbColumns.get(db.table)?.has(db.column))
  const stats = inDb && db ? dbStats.get(`${db.table}.${db.column}`) : undefined
  const reviews: Record<string, 'oui' | 'non' | 'unknown'> = {}
  const id = fieldRowId(leaf.source, leaf.path)
  for (const col of reviewColumns) {
    reviews[col] = (existingReviews.get(id)?.[col] as 'oui' | 'non' | 'unknown' | undefined) ?? 'unknown'
  }
  return {
    id,
    source: leaf.source,
    path: leaf.path,
    key: leaf.key,
    description: resolveFieldDescription(
      leaf.source,
      leaf.path,
      leaf.key,
      leaf.valueType,
      portalDescriptions,
    ),
    valueType: leaf.valueType,
    sampleValue: leaf.sampleValue,
    inDb,
    dbMin: stats?.min ?? null,
    dbMax: stats?.max ?? null,
    reviews,
    changeStatus,
    changeDetectedAt,
  }
}

function obsoletedDescription(base: string): string {
  const marker = '[Obsoleted]'
  if (base.startsWith(marker)) return base
  return `${marker} ${base}`
}

export type FieldRegistryDiff = {
  added: string[]
  removed: string[]
}

export type BuildFieldRegistryOptions = {
  refreshDocs?: boolean
  diffAgainst?: FieldRegistry | null
  fixtureMeta?: {
    patch: string
    matchId?: string
    refreshedAt: string
  }
}

export async function buildFieldRegistryFromFixtures(
  options: BuildFieldRegistryOptions = {},
): Promise<{ registry: FieldRegistry; diff: FieldRegistryDiff }> {
  const dataDir = join(process.cwd(), 'data', 'api-riot')
  const portalDescriptions = await loadRiotPortalDescriptions({ refresh: options.refreshDocs ?? false })

  const [matchRaw, timelineRaw, existingRaw] = await Promise.all([
    readFile(join(dataDir, 'match-id.json'), 'utf-8'),
    readFile(join(dataDir, 'timeline.json'), 'utf-8'),
    readFile(join(dataDir, 'field-registry.json'), 'utf-8').catch(() => null),
  ])

  const matchJson = JSON.parse(matchRaw) as Record<string, unknown>
  const timelineJson = JSON.parse(timelineRaw) as Record<string, unknown>
  const existingFromFile = existingRaw ? (JSON.parse(existingRaw) as FieldRegistry) : null
  const existing = options.diffAgainst ?? existingFromFile

  const leaves = collectFieldLeavesFromPayload(matchJson, timelineJson)
  const currentIds = new Set(leaves.keys())
  const previousIds = new Set((existing?.rows ?? []).map((r) => r.id))

  const added = [...currentIds].filter((id) => !previousIds.has(id)).sort()
  const removed = [...previousIds].filter((id) => !currentIds.has(id)).sort()
  const diff: FieldRegistryDiff = { added, removed }

  const now = new Date().toISOString()
  const changeDetectedAt = options.fixtureMeta?.refreshedAt ?? now

  let dbStats = new Map<string, { min: number; max: number }>()
  let dbColumns = new Map<string, Set<string>>()
  const dbUrl = process.env.DATABASE_URL?.trim()
  if (dbUrl) {
    const pool = new pg.Pool({ connectionString: dbUrl })
    try {
      dbColumns = await loadDbColumnSets(pool)
      dbStats = await loadColumnStats(pool)
    } finally {
      await pool.end()
    }
  }

  const reviewColumns =
    existing?.reviewColumns?.length ? [...existing.reviewColumns] : [...DEFAULT_REVIEW_COLUMNS]
  for (const col of DEFAULT_REVIEW_COLUMNS) {
    if (!reviewColumns.includes(col)) reviewColumns.unshift(col)
  }

  const existingReviews = new Map<string, Record<string, string>>()
  const existingById = new Map<string, FieldRegistryRow>()
  for (const row of existing?.rows ?? []) {
    if (row.reviews && Object.keys(row.reviews).length > 0) {
      existingReviews.set(row.id, row.reviews)
    }
    existingById.set(row.id, row)
  }

  const rows: FieldRegistryRow[] = []

  for (const leaf of [...leaves.values()].sort(
    (a, b) => a.source.localeCompare(b.source) || a.path.localeCompare(b.path),
  )) {
    const id = fieldRowId(leaf.source, leaf.path)
    const isNew = added.includes(id)
    rows.push(
      buildRowFromLeaf(
        leaf,
        reviewColumns,
        existingReviews,
        dbColumns,
        dbStats,
        portalDescriptions,
        isNew ? 'new' : null,
        isNew ? changeDetectedAt : null,
      ),
    )
  }

  for (const removedId of removed) {
    const prev = existingById.get(removedId)
    if (!prev) continue
    rows.push({
      ...prev,
      changeStatus: 'obsoleted',
      changeDetectedAt,
      description: obsoletedDescription(prev.description.replace(/^\[Obsoleted\]\s*/, '')),
    })
  }

  rows.sort((a, b) => a.source.localeCompare(b.source) || a.path.localeCompare(b.path))

  const registry: FieldRegistry = {
    version: 1,
    generatedAt: now,
    reviewColumns,
    rows,
    lastFixtureDiff: options.fixtureMeta
      ? {
          patch: options.fixtureMeta.patch,
          matchId: options.fixtureMeta.matchId,
          refreshedAt: options.fixtureMeta.refreshedAt,
          addedCount: added.length,
          removedCount: removed.length,
          added,
          removed,
        }
      : existing?.lastFixtureDiff,
  }

  return { registry, diff }
}
