import type {
  PatchNotesChangeFilter,
  PatchNotesTargetType,
} from '~/composables/statistics/useStatisticsPatchNotesTab'

export type PatchNotesChip = 'all' | PatchNotesTargetType | Exclude<PatchNotesChangeFilter, 'all'>

export const PATCH_NOTES_CHIPS: readonly PatchNotesChip[] = [
  'all',
  'champion',
  'items',
  'runes',
  'up',
  'nerf',
  'adjust',
]

const TARGETS: readonly PatchNotesTargetType[] = ['champion', 'items', 'runes']

function isTarget(chip: PatchNotesChip): chip is PatchNotesTargetType {
  return (TARGETS as readonly string[]).includes(chip)
}

export function patchNotesChipActive(
  chip: PatchNotesChip,
  targets: ReadonlySet<PatchNotesTargetType>,
  change: PatchNotesChangeFilter
): boolean {
  const allTargets = targets.size === 0 || targets.size === TARGETS.length
  if (chip === 'all') return allTargets && change === 'all'
  if (isTarget(chip)) return targets.size === 1 && targets.has(chip)
  return change === chip
}

export function applyPatchNotesChip(
  chip: PatchNotesChip,
  change: PatchNotesChangeFilter
): { targets: Set<PatchNotesTargetType> | null; change: PatchNotesChangeFilter } {
  if (chip === 'all') return { targets: new Set(TARGETS), change: 'all' }
  if (isTarget(chip)) return { targets: new Set([chip]), change }
  return { targets: null, change: change === chip ? 'all' : chip }
}
