import type { ItemKind } from './itemTypeCounts'

export type ItemSetStat = {
  items: number[]
  games: number
  wins: number
  pickrate: number
  winrate: number
}

const SET_KINDS = new Set<ItemKind>(['final', 'boots', 'starter'])

/**
 * Sets d'items affichables : légendaires, bottes et starters seulement (pas de composants).
 * Les sets qui deviennent identiques sont fusionnés ; un set sans légendaire est écarté.
 */
export function itemSetsForDisplay(
  sets: readonly ItemSetStat[],
  kindOf: (itemId: number) => ItemKind
): ItemSetStat[] {
  const merged = new Map<string, ItemSetStat>()
  for (const set of sets) {
    const items = set.items.filter(id => SET_KINDS.has(kindOf(id)))
    if (!items.some(id => kindOf(id) === 'final')) continue
    const key = [...items].sort((a, b) => a - b).join(',')
    const prev = merged.get(key)
    if (prev) {
      prev.games += set.games
      prev.wins += set.wins
      prev.pickrate = Math.round((prev.pickrate + set.pickrate) * 100) / 100
    } else {
      merged.set(key, { ...set, items })
    }
  }
  return [...merged.values()]
    .map(s => ({
      ...s,
      winrate: s.games > 0 ? Math.round((s.wins / s.games) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.games - a.games)
}
