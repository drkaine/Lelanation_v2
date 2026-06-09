import { sql } from '../db/client.js'
import { isDatabaseConfigured } from '../db/query.js'
import { normalizePatchMajorMinor } from '../stats/statsPatchQuery.js'
import type { PatchNotesTargetType } from './patchNotesStatsBuilder.js'
import {
  aggregatePatchNotesRows,
  normalizeTargetTypes,
  patchesInVersionRange,
  type PatchNotesAggregateRow,
  type PatchNotesChangeType,
} from './patchNotesAggregateLogic.js'

export type { PatchNotesAggregateRow, PatchNotesChangeType }
export {
  aggregatePatchNotesRows,
  dominantChangeType,
  patchesInVersionRange,
} from './patchNotesAggregateLogic.js'

export type PatchNotesAggregateResponse = {
  fromVersion: string | null
  toVersion: string | null
  totalPatches: number
  rows: PatchNotesAggregateRow[]
  message?: string
}

type DbRow = {
  type_cible: string
  id_cible: string
  game_version: string
  count_nerf: number
  count_up: number
  count_ajust: number
}

async function listDistinctPatchNoteVersions(): Promise<string[]> {
  const rows = await sql<Array<{ game_version: string }>>`
    SELECT DISTINCT game_version
    FROM patch_notes_stats
    WHERE game_version IS NOT NULL AND TRIM(game_version) <> ''
    ORDER BY game_version DESC
  `
  return rows.map(r => String(r.game_version ?? '').trim()).filter(Boolean)
}

export async function getPatchNotesVersionList(): Promise<string[]> {
  if (!isDatabaseConfigured()) return []
  return listDistinctPatchNoteVersions()
}

export async function getPatchNotesAggregateStats(
  fromVersion: string | null,
  toVersion: string | null,
  targetTypes: PatchNotesTargetType[] | null,
): Promise<PatchNotesAggregateResponse> {
  if (!isDatabaseConfigured()) {
    return {
      fromVersion,
      toVersion,
      totalPatches: 0,
      rows: [],
      message: 'Database not configured',
    }
  }

  const available = await listDistinctPatchNoteVersions()
  const patches = patchesInVersionRange(available, fromVersion, toVersion)
  if (patches.length === 0) {
    return {
      fromVersion: fromVersion ? normalizePatchMajorMinor(fromVersion) : null,
      toVersion: toVersion ? normalizePatchMajorMinor(toVersion) : null,
      totalPatches: 0,
      rows: [],
      message: 'No patch notes data in selected version range',
    }
  }

  const allowedTypes = normalizeTargetTypes(targetTypes)
  const rows = await sql<DbRow[]>`
    SELECT type_cible, id_cible, game_version, count_nerf, count_up, count_ajust
    FROM patch_notes_stats
    WHERE type_cible = ANY(${sql.array(allowedTypes)})
  `

  const aggregated = aggregatePatchNotesRows(rows, patches, allowedTypes)

  return {
    fromVersion: fromVersion ? normalizePatchMajorMinor(fromVersion) : patches[0] ?? null,
    toVersion: toVersion ? normalizePatchMajorMinor(toVersion) : patches[patches.length - 1] ?? null,
    totalPatches: patches.length,
    rows: aggregated,
  }
}
