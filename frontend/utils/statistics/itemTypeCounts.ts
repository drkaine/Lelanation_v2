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

export type ItemKind = Exclude<ItemTypeChip, 'all'>

/** Champs Data Dragon utiles au classement d'un objet. */
export type ClassifiableItem = {
  id: string
  tags?: string[]
  gold?: { total: number }
  from?: string[]
  into?: string[]
  isMasterwork?: boolean
}

const STARTER_TAGS = new Set(['Consumable', 'Lane', 'Jungle'])
/** Objet support de départ (s'améliore en jeu, a donc un `into`). */
const SUPPORT_STARTER_ID = '3865'

/** Type d'objet déduit de Data Dragon (l'API ne remplit plus starters / finaux). */
export function classifyItemType(item: ClassifiableItem | undefined): ItemKind {
  if (!item) return 'core'
  const tags = item.tags ?? []
  if (tags.includes('Boots')) return 'boots'
  const hasFrom = (item.from?.length ?? 0) > 0
  const hasInto = (item.into?.length ?? 0) > 0
  if (item.isMasterwork || item.id === '2526') return 'final'
  if (item.id === SUPPORT_STARTER_ID) return 'starter'
  if (!hasFrom && !hasInto && tags.some(t => STARTER_TAGS.has(t))) return 'starter'
  if (hasFrom && !hasInto) return 'final'
  return 'core'
}
