/** « Les plus bavards » : champions triés par pings / partie, barre relative au premier. */
export type TopPinger = { championId: number; totalPerGame: number; barPct: number }

export function topPingers(
  rows: readonly { championId: number; totalPerGame: number }[],
  limit = 8
): TopPinger[] {
  const sorted = rows
    .filter(r => Number.isFinite(r.totalPerGame) && r.totalPerGame > 0)
    .sort((a, b) => b.totalPerGame - a.totalPerGame)
    .slice(0, limit)
  const max = sorted[0]?.totalPerGame ?? 0
  return sorted.map(r => ({
    championId: r.championId,
    totalPerGame: r.totalPerGame,
    barPct: max > 0 ? Math.round((r.totalPerGame / max) * 1000) / 10 : 0,
  }))
}
