export type BalanceStatusCode = 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED'

/** Cellule de niveau (maquette Balance) : ▲ surpuissant, ▼ sous-puissant, = équilibré. */
export function balanceLevelGlyph(status: BalanceStatusCode): {
  glyph: '▲' | '▼' | '='
  tone: 'op' | 'up' | 'eq'
} {
  if (status === 'OVERPOWERED') return { glyph: '▲', tone: 'op' }
  if (status === 'UNDERPOWERED') return { glyph: '▼', tone: 'up' }
  return { glyph: '=', tone: 'eq' }
}

/** Tri par défaut : besoin de nerf, besoin de buff, puis équilibré. */
export function balanceVerdictRank(status: BalanceStatusCode): number {
  if (status === 'OVERPOWERED') return 0
  if (status === 'UNDERPOWERED') return 1
  return 2
}

/** "A -> B" → [A, B] ; null sinon. */
export function splitStatusDelta(delta: string | null | undefined): [string, string] | null {
  if (!delta) return null
  const parts = delta
    .split('->')
    .map(x => x.trim())
    .filter(Boolean)
  return parts.length === 2 ? [parts[0]!, parts[1]!] : null
}
