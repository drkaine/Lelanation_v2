export type ItemTierRoleBucket = 'top' | 'jungle' | 'mid' | 'adc' | 'support'

export type ItemTierRoleGameWinCounts = {
  top_game: number
  top_win: number
  jungle_game: number
  jungle_win: number
  mid_game: number
  mid_win: number
  adc_game: number
  adc_win: number
  support_game: number
  support_win: number
}

const ZERO_COUNTS: ItemTierRoleGameWinCounts = {
  top_game: 0,
  top_win: 0,
  jungle_game: 0,
  jungle_win: 0,
  mid_game: 0,
  mid_win: 0,
  adc_game: 0,
  adc_win: 0,
  support_game: 0,
  support_win: 0,
}

export function itemTierRoleBucket(role: string): ItemTierRoleBucket | null {
  const r = String(role ?? '').trim().toUpperCase()
  if (r === 'TOP') return 'top'
  if (r === 'JUNGLE') return 'jungle'
  if (r === 'MID' || r === 'MIDDLE') return 'mid'
  if (r === 'ADC' || r === 'BOTTOM') return 'adc'
  if (r === 'SUPPORT' || r === 'UTILITY') return 'support'
  return null
}

/** Compteurs à incrémenter sur `item_tier_daily_snapshots` pour un participant / item. */
export function itemTierRoleGameWinCounts(
  role: string,
  winCount: number,
): ItemTierRoleGameWinCounts {
  const bucket = itemTierRoleBucket(role)
  if (!bucket) return { ...ZERO_COUNTS }
  return {
    ...ZERO_COUNTS,
    [`${bucket}_game`]: 1,
    [`${bucket}_win`]: winCount,
  }
}
