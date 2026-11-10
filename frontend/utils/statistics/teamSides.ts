/** Équipe & objectifs (maquette) : parts par côté, barres winrate, barres surrender. */
const r2 = (v: number) => Math.round(v * 100) / 100
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function sideRatePct(count: unknown, total: unknown): number {
  const c = Number(count)
  const t = Number(total)
  if (!Number.isFinite(c) || !Number.isFinite(t) || t <= 0) return 0
  return r2((c / t) * 100)
}

/** Barre « meilleur winrate » : 50 % → vide, 60 % → pleine. */
export function sideWinrateBarPct(winrate: number): number {
  return r2(clamp(((Number(winrate) - 50) / 10) * 100, 0, 100))
}

/** Barre surrender empilée sur une échelle de 50 % : part avant 15 min, puis le reste. */
export function surrenderBarSegments(rate: number, early: number): { early: number; rest: number } {
  const e = clamp((Number(early) || 0) * 2, 0, 100)
  const total = clamp((Number(rate) || 0) * 2, 0, 100)
  return { early: r2(e), rest: r2(Math.max(0, total - e)) }
}

export type SurrenderDeltaTone = 'up' | 'down' | 'none'

/** Plus de surrender = rouge (up), moins = vert (down). */
export function surrenderDeltaTone(delta: number | null | undefined): SurrenderDeltaTone {
  if (delta == null || !Number.isFinite(delta) || delta === 0) return 'none'
  return delta > 0 ? 'up' : 'down'
}

/** Donut SVG : longueur d'arc et décalage de chaque segment sur un cercle de périmètre `circumference`. */
export function donutArcs(
  values: readonly number[],
  circumference: number
): { arc: number; offset: number }[] {
  const vals = values.map(v => (Number.isFinite(v) ? Math.max(0, v) : 0))
  const total = vals.reduce((s, v) => s + v, 0)
  if (total <= 0) return []
  let offset = 0
  return vals.map(v => {
    const arc = r2((v / total) * circumference)
    const seg = { arc, offset: r2(offset) }
    offset += arc
    return seg
  })
}
