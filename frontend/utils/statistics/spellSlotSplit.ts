/** Répartition touche D / F d'un sort (en %, somme 100), ou null sans données. */
export function spellSlotSplit(
  pctD: number | null | undefined,
  pctF: number | null | undefined
): { d: number; f: number } | null {
  const d = Number(pctD)
  const f = Number(pctF)
  if (pctD == null || pctF == null || !Number.isFinite(d) || !Number.isFinite(f)) return null
  const sum = d + f
  if (sum <= 0) return null
  const dr = Math.round((d / sum) * 100)
  return { d: dr, f: 100 - dr }
}
