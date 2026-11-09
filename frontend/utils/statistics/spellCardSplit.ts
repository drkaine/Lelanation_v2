/** Sorts en cartes (maquette 26) : les plus joués au-dessus du seuil, le reste regroupé. */
export function spellCardSplit<T extends { pickrate: number }>(
  rows: readonly T[],
  minPick: number,
  maxCards: number
): { cards: T[]; rest: T[] } {
  const pick = (x: T) => (Number.isFinite(x.pickrate) ? x.pickrate : 0)
  const sorted = [...rows].sort((a, b) => pick(b) - pick(a))
  const cards = sorted.filter(x => pick(x) >= minPick).slice(0, maxCards)
  const rest = sorted.filter(x => !cards.includes(x))
  return { cards, rest }
}
