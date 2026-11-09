export type BalanceQuickFilter = 'ALL' | 'NERF' | 'EQUAL' | 'BUFF' | 'CHANGED'

export const BALANCE_QUICK_FILTERS: BalanceQuickFilter[] = [
  'ALL',
  'NERF',
  'EQUAL',
  'BUFF',
  'CHANGED',
]

export interface BalanceQuickRow {
  globalStatus: 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED'
  globalDelta?: string | null
}

/** Filtre rapide de la maquette Balance : tous / nerf / équilibré / buff / statut changé. */
export function balanceQuickMatch(row: BalanceQuickRow, filter: BalanceQuickFilter): boolean {
  if (filter === 'NERF') return row.globalStatus === 'OVERPOWERED'
  if (filter === 'EQUAL') return row.globalStatus === 'BALANCED'
  if (filter === 'BUFF') return row.globalStatus === 'UNDERPOWERED'
  if (filter === 'CHANGED') return Boolean(row.globalDelta)
  return true
}

export function countBalanceQuick(rows: BalanceQuickRow[]): Record<BalanceQuickFilter, number> {
  const out = { ALL: 0, NERF: 0, EQUAL: 0, BUFF: 0, CHANGED: 0 }
  for (const f of BALANCE_QUICK_FILTERS) out[f] = rows.filter(r => balanceQuickMatch(r, f)).length
  return out
}
