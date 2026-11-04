/** Seuil d'échantillon : sous ce nombre de parties, la ligne est atténuée (maquette Équipe). */
export const LOW_SAMPLE_MIN_GAMES = 100

export function isLowSample(games: unknown, min = LOW_SAMPLE_MIN_GAMES): boolean {
  const n = Number(games)
  return !Number.isFinite(n) || n < min
}

/**
 * Sépare les lignes à faible échantillon (ex. ordres à 81 % de WR sur 11 parties).
 * Si toutes sont rares, rien n'est caché.
 */
export function splitRareRows<T extends { games: unknown }>(
  rows: readonly T[],
  includeRare: boolean,
  min = LOW_SAMPLE_MIN_GAMES
): { rows: T[]; hidden: number } {
  const reliable = rows.filter(r => !isLowSample(r.games, min))
  if (!reliable.length) return { rows: [...rows], hidden: 0 }
  const hidden = rows.length - reliable.length
  return { rows: includeRare ? [...rows] : reliable, hidden }
}
