import { describe, expect, it } from 'vitest'
import { trendCardsForFocus } from '../trendFocus'

const cards = [{ metricId: 'winrate' }, { metricId: 'pickrate' }, { metricId: 'banrate' }]

describe('trendCardsForFocus', () => {
  it('shows every chart with "all"', () => {
    expect(trendCardsForFocus(cards, 'all')).toHaveLength(3)
  })
  it('keeps only the focused metric', () => {
    expect(trendCardsForFocus(cards, 'pickrate')).toEqual([{ metricId: 'pickrate' }])
  })
})
