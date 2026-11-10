/** Logique pure du tableau des sorts d'invocateur (maquette #sorts). */

export function spellBarPct(value: number | null | undefined, max: number): number {
  if (value == null || !(max > 0)) return 0
  return Math.max(0, Math.min(100, (Number(value) / max) * 100))
}

/** Répartition touche D / F ramenée à 100 %. */
export function spellSlotSplit(
  pctD: number | null | undefined,
  pctF: number | null | undefined
): { d: number; f: number } | null {
  const d = Math.max(0, Number(pctD ?? 0))
  const f = Math.max(0, Number(pctF ?? 0))
  const total = d + f
  if (!(total > 0)) return null
  return { d: (d / total) * 100, f: (f / total) * 100 }
}

export function spellDeltaTone(v: number): 'up' | 'down' | 'flat' {
  if (v > 0) return 'up'
  if (v < 0) return 'down'
  return 'flat'
}
