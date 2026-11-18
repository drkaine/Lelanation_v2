import { describe, expect, it } from 'vitest'
import { metaBubbleColor } from '~/utils/statistics/metaBubbleColor'
import { TIER_CHART_COLORS } from '~/utils/tierChartColors'

describe('metaBubbleColor', () => {
  it('reprend la palette unique des tiers', () => {
    expect(metaBubbleColor('S+')).toBe(TIER_CHART_COLORS['S+'])
    expect(metaBubbleColor('S')).toBe(TIER_CHART_COLORS.S)
    expect(metaBubbleColor('F')).toBe(TIER_CHART_COLORS.D)
  })
})
