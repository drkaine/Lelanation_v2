import type { ChangeType, StatChange } from '~/stores/PatchNotesStore'

export type PatchEntitySummaryType = 'buff' | 'nerf' | 'adjustment' | 'new' | 'removed'

const AVERAGE_TYPES = ['buff', 'nerf', 'adjustment'] as const
type AverageType = (typeof AVERAGE_TYPES)[number]

const TYPE_WEIGHTS: Record<AverageType, number> = {
  buff: 2,
  nerf: 2,
  adjustment: 1,
}

function toAverageType(type: ChangeType): AverageType | null {
  if (type === 'buff' || type === 'nerf') return type
  if (type === 'new' || type === 'adjustment') return 'adjustment'
  return null
}

/**
 * Card-level summary tag from individual change types.
 * - All "new" → new
 * - All "removed" → removed
 * - Otherwise weighted score: buff/nerf ×2, adjustment/new ×1
 */
export function resolvePatchEntitySummaryType(
  changes: StatChange[]
): PatchEntitySummaryType | null {
  const types = changes.map(change => change.type).filter(type => type !== 'text')
  if (types.length === 0) return null

  if (types.every(type => type === 'new')) return 'new'
  if (types.every(type => type === 'removed')) return 'removed'

  const scores: Record<AverageType, number> = { buff: 0, nerf: 0, adjustment: 0 }

  for (const type of types) {
    if (type === 'removed') continue
    const averageType = toAverageType(type)
    if (averageType) scores[averageType] += TYPE_WEIGHTS[averageType]
  }

  const total = scores.buff + scores.nerf + scores.adjustment
  if (total === 0) return null

  const max = Math.max(scores.buff, scores.nerf, scores.adjustment)
  const winners = AVERAGE_TYPES.filter(type => scores[type] === max)

  if (winners.length > 1) return 'adjustment'
  return winners[0]
}
