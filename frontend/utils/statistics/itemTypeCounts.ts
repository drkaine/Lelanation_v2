/** Puces de type d'objet avec compteurs (maquette Builds › Objets). */
export const ITEM_TYPE_CHIPS = ['all', 'final', 'core', 'boots', 'starter'] as const
export type ItemTypeChip = (typeof ITEM_TYPE_CHIPS)[number]

export function countItemTypes(rows: readonly { type: string }[]): Record<ItemTypeChip, number> {
  const out: Record<ItemTypeChip, number> = {
    all: rows.length,
    final: 0,
    core: 0,
    boots: 0,
    starter: 0,
  }
  for (const r of rows) {
    if (r.type === 'final' || r.type === 'core' || r.type === 'boots' || r.type === 'starter') {
      out[r.type]++
    }
  }
  return out
}
