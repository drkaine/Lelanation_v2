/**
 * Affichage de la grille tier list (maquette Claude Design « Tier list ») :
 * ton du winrate, barre de répartition, repli « + N autres ».
 */

export type WinrateTone = 'high' | 'low' | 'neutral'

/** Ratio 0–1 : ≥ 52 % → high, ≤ 48 % → low. */
export function winrateTone(ratio: number): WinrateTone {
  if (!Number.isFinite(ratio)) return 'neutral'
  const pct = Math.round(ratio * 1000) / 10
  if (pct >= 52) return 'high'
  if (pct <= 48) return 'low'
  return 'neutral'
}

export type TierShare<T extends string> = { tier: T; count: number; share: number }

export function tierDistribution<T extends string>(
  groups: { tier: T; rows: readonly unknown[] }[]
): TierShare<T>[] {
  const total = groups.reduce((sum, g) => sum + g.rows.length, 0)
  if (total === 0) return []
  return groups.map(g => ({ tier: g.tier, count: g.rows.length, share: g.rows.length / total }))
}

export function visibleTierRows<R>(
  rows: R[],
  limit: number,
  expanded: boolean
): { rows: R[]; hidden: number } {
  if (expanded || rows.length <= limit) return { rows, hidden: 0 }
  return { rows: rows.slice(0, limit), hidden: rows.length - limit }
}
