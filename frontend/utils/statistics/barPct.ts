/** Largeur d'une barre (0–100 %) : `value` rapporté au plus grand de la série. */
export function barPct(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((value / max) * 1000) / 10))
}
