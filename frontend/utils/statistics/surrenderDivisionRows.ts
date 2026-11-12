/** Largeurs (en % de piste) de la barre surrender, échelle 0–50 % (maquette 03). */
export function surrenderBarWidths(
  surrenderPct: number | null | undefined,
  earlyPct: number | null | undefined,
  scaleMax = 50
): { early: number; rest: number } {
  const r = Number(surrenderPct)
  const e = Number(earlyPct)
  if (!Number.isFinite(r) || r <= 0) return { early: 0, rest: 0 }
  const early = Math.min(100, Math.max(0, ((Number.isFinite(e) ? e : 0) / scaleMax) * 100))
  const total = Math.min(100, (r / scaleMax) * 100)
  return { early, rest: Math.max(0, total - early) }
}

export type SurrenderDeltaView = { dir: 'up' | 'down' | 'none'; abs: number | null }

/** Sens et valeur absolue du Δ vs patch de référence. */
export function surrenderDeltaView(delta: number | null | undefined): SurrenderDeltaView {
  const d = Number(delta)
  if (delta == null || !Number.isFinite(d)) return { dir: 'none', abs: null }
  return { dir: d >= 0 ? 'up' : 'down', abs: Math.abs(d) }
}
