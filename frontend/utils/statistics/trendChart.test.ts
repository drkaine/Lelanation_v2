import { describe, expect, it } from 'vitest'
import {
  RANK_TIER_COLORS,
  compareRankTiers,
  normalizeRankTier,
  smoothSeries,
  svgLinePath,
} from './trendChart'

describe('svgLinePath', () => {
  it('draws a polyline, a visible dot for one point, nothing for none', () => {
    expect(svgLinePath([])).toBe('')
    expect(svgLinePath([{ x: 1, y: 2 }])).toBe('M 1,2 L 1.1,2')
    expect(
      svgLinePath([
        { x: 0, y: 0 },
        { x: 5, y: 3 },
      ])
    ).toBe('M 0,0 L 5,3')
  })
})

describe('smoothSeries', () => {
  it('averages each value with the previous ones (trailing window)', () => {
    expect(smoothSeries([3, 6, 9, 12])).toEqual([3, 4.5, 6, 9])
    expect(smoothSeries([1, 2])).toEqual([1, 2])
  })
})

describe('normalizeRankTier', () => {
  it('upper-cases, drops the division suffix and unranked', () => {
    expect(normalizeRankTier(' gold_ii ')).toBe('GOLD')
    expect(normalizeRankTier('UNRANKED')).toBe('')
    expect(normalizeRankTier('')).toBe('')
  })
})

describe('RANK_TIER_COLORS', () => {
  it('has a color per tier plus the global line', () => {
    expect(RANK_TIER_COLORS.CHALLENGER).toBe('#9a3412')
    expect(RANK_TIER_COLORS.GLOBAL).toBe('#c084fc')
  })
})

describe('compareRankTiers', () => {
  it('orders tiers from Iron to Challenger, unknown tiers last', () => {
    expect(['GLOBAL', 'GOLD', 'IRON', 'CHALLENGER'].sort(compareRankTiers)).toEqual([
      'IRON',
      'GOLD',
      'CHALLENGER',
      'GLOBAL',
    ])
  })
})
