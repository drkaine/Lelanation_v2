/** Recherche « mettre en évidence » et listes par quadrant du graphique meta (seuils = moyennes). */
import type { MetaQuadrantEntry } from './metaQuadrantPicks'

export type MetaQuadrantKey = 'meta' | 'gems' | 'traps' | 'niche'

interface ChartRow {
  championId: number
  winrate: number
  pickrate: number
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

const pct = (v: number) => (!Number.isFinite(v) ? 0 : v > 1 ? v : v * 100)
const r2 = (v: number) => Math.round(v * 100) / 100

export function findMetaChartChampion(
  query: string,
  rows: readonly ChartRow[],
  nameOf: (id: number) => string
): number | null {
  const q = norm(query)
  if (!q) return null
  const exact = rows.find(r => norm(nameOf(r.championId)) === q)
  if (exact) return exact.championId
  const prefix = rows.find(r => norm(nameOf(r.championId)).startsWith(q))
  return prefix ? prefix.championId : null
}

export function metaQuadrantList(
  rows: readonly ChartRow[],
  key: MetaQuadrantKey
): MetaQuadrantEntry[] {
  if (!rows.length) return []
  const pts = rows.map(r => ({
    championId: r.championId,
    winPct: r2(pct(r.winrate)),
    pickPct: r2(pct(r.pickrate)),
  }))
  const refWin = pts.reduce((s, r) => s + r.winPct, 0) / pts.length
  const refPick = pts.reduce((s, r) => s + r.pickPct, 0) / pts.length
  const inQuadrant = (r: MetaQuadrantEntry) => {
    const winning = r.winPct > refWin
    const popular = r.pickPct >= refPick
    if (key === 'meta') return winning && popular
    if (key === 'gems') return winning && !popular
    if (key === 'traps') return !winning && popular
    return !winning && !popular
  }
  return pts.filter(inQuadrant).sort((a, b) => b.winPct - a.winPct)
}
