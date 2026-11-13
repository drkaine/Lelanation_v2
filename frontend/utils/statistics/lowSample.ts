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

/**
 * Seuil de parties pour classer des matchups : part de LOW_SAMPLE_MIN_GAMES et le divise par 2
 * tant qu'il reste moins de `need` lignes classables (plancher `floor`). Les lignes par
 * adversaire × rôle ont souvent < 100 parties même avec des dizaines de milliers de parties.
 */
export function adaptiveMinGames(
  games: readonly number[],
  opts: { max?: number; floor?: number; need?: number } = {}
): number {
  const floor = opts.floor ?? 10
  const need = opts.need ?? 6
  let min = opts.max ?? LOW_SAMPLE_MIN_GAMES
  while (min > floor && games.filter(g => g >= min).length < need) {
    min = Math.max(floor, Math.floor(min / 2))
  }
  return min
}
