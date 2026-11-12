/** Synthèse onglets matchups / synergies : meilleurs et pires, sans doublon, + totaux. */
export type MatchupHighlights<T> = {
  best: T[]
  worst: T[]
  count: number
  games: number
  meanWinrate: number | null
}

export function matchupHighlights<T extends { games: number; winrate: number }>(
  rows: readonly T[],
  opts: { minGames: number; limit: number }
): MatchupHighlights<T> {
  const ok = rows.filter(r => r.games >= opts.minGames)
  const sorted = [...ok].sort((a, b) => b.winrate - a.winrate)
  const half = Math.min(opts.limit, Math.ceil(sorted.length / 2))
  const best = sorted.slice(0, half)
  const worst = sorted
    .slice(half)
    .reverse()
    .slice(0, Math.min(opts.limit, sorted.length - half))
  const games = rows.reduce((a, r) => a + r.games, 0)
  const won = rows.reduce((a, r) => a + r.games * r.winrate, 0)
  return {
    best,
    worst,
    count: rows.length,
    games,
    meanWinrate: games > 0 ? won / games : null,
  }
}
