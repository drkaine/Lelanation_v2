/** Listes « Pépites » / « Populaires mais faibles » du graphique meta (seuils = moyennes, comme le graphique). */
export interface MetaQuadrantEntry {
  championId: number
  winPct: number
  pickPct: number
}

const pct = (v: number) => (!Number.isFinite(v) ? 0 : v > 1 ? v : v * 100)
const r2 = (v: number) => Math.round(v * 100) / 100

export function metaQuadrantPicks(
  rows: readonly { championId: number; winrate: number; pickrate: number }[],
  limit = 5
): { gems: MetaQuadrantEntry[]; popularWeak: MetaQuadrantEntry[] } {
  if (!rows.length) return { gems: [], popularWeak: [] }
  const pts = rows.map(r => ({
    championId: r.championId,
    winPct: r2(pct(r.winrate)),
    pickPct: r2(pct(r.pickrate)),
  }))
  const refWin = pts.reduce((s, r) => s + r.winPct, 0) / pts.length
  const refPick = pts.reduce((s, r) => s + r.pickPct, 0) / pts.length
  return {
    gems: pts
      .filter(r => r.winPct > refWin && r.pickPct < refPick)
      .sort((a, b) => b.winPct - a.winPct)
      .slice(0, limit),
    popularWeak: pts
      .filter(r => r.winPct < refWin && r.pickPct >= refPick)
      .sort((a, b) => b.pickPct - a.pickPct)
      .slice(0, limit),
  }
}
