import {
  comparePatchMajorMinor,
  normalizePatchMajorMinor,
} from '../stats/statsPatchQuery.js'
import type { PatchNotesTargetType } from './patchNotesStatsBuilder.js'

export type PatchNotesChangeType = 'up' | 'nerf' | 'ajust'

export type PatchNotesAggregateRow = {
  targetType: PatchNotesTargetType
  targetId: string
  countNerf: number
  countUp: number
  countAjust: number
  totalChanges: number
  patchesTouched: number
  totalPatches: number
  regularity: number
  lastModPatch: string
  lastModType: PatchNotesChangeType
}

type DbRow = {
  type_cible: string
  id_cible: string
  game_version: string
  count_nerf: number
  count_up: number
  count_ajust: number
}

const ALL_TARGET_TYPES: PatchNotesTargetType[] = ['champion', 'items', 'runes']

export function dominantChangeType(
  countNerf: number,
  countUp: number,
  countAjust: number,
): PatchNotesChangeType {
  if (countUp >= countNerf && countUp >= countAjust) return 'up'
  if (countNerf >= countUp && countNerf >= countAjust) return 'nerf'
  return 'ajust'
}

export function patchesInVersionRange(
  available: string[],
  fromVersion: string | null,
  toVersion: string | null,
): string[] {
  const normalized = [...new Set(available.map(normalizePatchMajorMinor))].sort(comparePatchMajorMinor)
  const from = fromVersion ? normalizePatchMajorMinor(fromVersion) : null
  const to = toVersion ? normalizePatchMajorMinor(toVersion) : null

  return normalized.filter(p => {
    if (from && comparePatchMajorMinor(p, from) < 0) return false
    if (to && comparePatchMajorMinor(p, to) > 0) return false
    return true
  })
}

function normalizeTargetTypes(types: PatchNotesTargetType[] | null | undefined): PatchNotesTargetType[] {
  const unique = [...new Set((types ?? []).filter(t => ALL_TARGET_TYPES.includes(t)))]
  if (unique.length === 0 || unique.length === ALL_TARGET_TYPES.length) return ALL_TARGET_TYPES
  return unique
}

export function aggregatePatchNotesRows(
  rows: DbRow[],
  patchesInRange: string[],
  targetTypes: PatchNotesTargetType[],
): PatchNotesAggregateRow[] {
  const allowedTypes = new Set(normalizeTargetTypes(targetTypes))
  const patchSet = new Set(patchesInRange.map(normalizePatchMajorMinor))
  const totalPatches = patchSet.size

  const byEntity = new Map<
    string,
    {
      targetType: PatchNotesTargetType
      targetId: string
      countNerf: number
      countUp: number
      countAjust: number
      patches: Set<string>
      latestPatch: string | null
      latestCounts: { countNerf: number; countUp: number; countAjust: number } | null
    }
  >()

  for (const row of rows) {
    const targetType = row.type_cible as PatchNotesTargetType
    if (!allowedTypes.has(targetType)) continue

    const patch = normalizePatchMajorMinor(row.game_version)
    if (!patchSet.has(patch)) continue

    const countNerf = Number(row.count_nerf ?? 0)
    const countUp = Number(row.count_up ?? 0)
    const countAjust = Number(row.count_ajust ?? 0)
    if (countNerf + countUp + countAjust <= 0) continue

    const key = `${targetType}:${row.id_cible}`
    let agg = byEntity.get(key)
    if (!agg) {
      agg = {
        targetType,
        targetId: String(row.id_cible),
        countNerf: 0,
        countUp: 0,
        countAjust: 0,
        patches: new Set(),
        latestPatch: null,
        latestCounts: null,
      }
      byEntity.set(key, agg)
    }

    agg.countNerf += countNerf
    agg.countUp += countUp
    agg.countAjust += countAjust
    agg.patches.add(patch)

    if (!agg.latestPatch || comparePatchMajorMinor(patch, agg.latestPatch) > 0) {
      agg.latestPatch = patch
      agg.latestCounts = { countNerf, countUp, countAjust }
    }
  }

  return [...byEntity.values()]
    .map(agg => {
      const totalChanges = agg.countNerf + agg.countUp + agg.countAjust
      const patchesTouched = agg.patches.size
      const regularity =
        totalPatches > 0 ? Math.round((patchesTouched / totalPatches) * 10000) / 10000 : 0
      const latest = agg.latestCounts ?? {
        countNerf: agg.countNerf,
        countUp: agg.countUp,
        countAjust: agg.countAjust,
      }

      return {
        targetType: agg.targetType,
        targetId: agg.targetId,
        countNerf: agg.countNerf,
        countUp: agg.countUp,
        countAjust: agg.countAjust,
        totalChanges,
        patchesTouched,
        totalPatches,
        regularity,
        lastModPatch: agg.latestPatch ?? '',
        lastModType: dominantChangeType(latest.countNerf, latest.countUp, latest.countAjust),
      }
    })
    .sort((a, b) => b.totalChanges - a.totalChanges || a.targetId.localeCompare(b.targetId))
}

export { normalizeTargetTypes }
