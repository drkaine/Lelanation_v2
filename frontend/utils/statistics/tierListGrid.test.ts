import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TIER_PRESENTATION,
  groupRowsByTier,
  isTierPresentation,
  normalizeGridTier,
  tierTokenClass,
} from './tierListGrid'

const row = (championId: number, tier: string, rank: number) => ({ championId, tier, rank })

describe('tierListGrid', () => {
  it('normalize_grid_tier_maps_unknown_and_f_to_d', () => {
    expect(normalizeGridTier('s+')).toBe('S+')
    expect(normalizeGridTier('F')).toBe('D')
    expect(normalizeGridTier('')).toBe('D')
  })

  it('group_rows_by_tier_orders_tiers_and_ranks_and_drops_empty', () => {
    const groups = groupRowsByTier([
      row(1, 'A', 5),
      row(2, 'S+', 2),
      row(3, 'A', 3),
      row(4, 'F', 9),
    ])
    expect(groups.map(g => g.tier)).toEqual(['S+', 'A', 'D'])
    expect(groups[1]!.rows.map(r => r.championId)).toEqual([3, 1])
  })

  it('group_rows_by_tier_keeps_extra_row_fields', () => {
    const groups = groupRowsByTier([{ ...row(7, 'S', 1), winrate: 0.52 }])
    expect(groups[0]!.rows[0]!.winrate).toBe(0.52)
  })

  it('tier_token_class_is_css_safe', () => {
    expect(tierTokenClass('S+')).toBe('tier-s-plus')
    expect(tierTokenClass('B')).toBe('tier-b')
  })

  it('is_tier_presentation_accepts_only_grid_or_table', () => {
    expect(isTierPresentation('grid')).toBe(true)
    expect(isTierPresentation('table')).toBe(true)
    expect(isTierPresentation('chart')).toBe(false)
  })

  it('default_tier_presentation_is_grid', () => {
    expect(DEFAULT_TIER_PRESENTATION).toBe('grid')
  })
})
