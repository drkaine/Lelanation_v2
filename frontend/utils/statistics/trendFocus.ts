export type TrendFocus = 'all' | 'games' | 'winrate' | 'pickrate' | 'banrate'

/** Graphes d'évolution affichés : tous (grille) ou un seul métrique. */
export function trendCardsForFocus<T extends { metricId: string }>(
  cards: readonly T[],
  focus: TrendFocus
): T[] {
  return focus === 'all' ? [...cards] : cards.filter(c => c.metricId === focus)
}
