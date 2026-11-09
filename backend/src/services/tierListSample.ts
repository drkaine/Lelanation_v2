/** Seuils d'échantillon tier list : évite les S+ à 6 parties sur les petites divisions. */
export const TIER_LIST_MIN_GAMES_FLOOR = 10
export const TIER_LIST_MIN_PICK_SHARE = 0.005

export function tierListMinGames(totalMatches: number): number {
  const rel = Math.ceil(Math.max(0, totalMatches) * TIER_LIST_MIN_PICK_SHARE)
  return Math.max(TIER_LIST_MIN_GAMES_FLOOR, rel)
}

/** Pickrate d'un rôle = parties / matchs ; chaque match a 2 joueurs par rôle. */
export function rolePickrate(games: number, roleTotalGames: number): number {
  if (!(roleTotalGames > 0)) return 0
  return games / (roleTotalGames / 2)
}
