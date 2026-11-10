import type { PatchNotesChangeType as PatchNotesChange } from '~/composables/statistics/useStatisticsPatchNotesTab'

export type PatchNotesBarInput = {
  countUp: number
  countNerf: number
  countAjust: number
  totalChanges: number
}

export type PatchNotesBarSegment = { kind: PatchNotesChange; count: number }

export const PATCH_NOTES_TARGET_SEGMENTS = ['all', 'champion', 'items', 'runes'] as const

/** Barre empilée buff/nerf/ajust : largeur relative au total max affiché. */
export function patchNotesBar(
  row: PatchNotesBarInput,
  maxTotal: number
): { widthPct: number; segments: PatchNotesBarSegment[] } {
  const widthPct = maxTotal > 0 ? Math.min(100, (row.totalChanges / maxTotal) * 100) : 0
  const segments: PatchNotesBarSegment[] = [
    { kind: 'up' as const, count: row.countUp },
    { kind: 'nerf' as const, count: row.countNerf },
    { kind: 'ajust' as const, count: row.countAjust },
  ].filter(s => s.count > 0)
  return { widthPct, segments }
}
