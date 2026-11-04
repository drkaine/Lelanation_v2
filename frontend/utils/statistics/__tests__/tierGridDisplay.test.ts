import { describe, expect, it } from 'vitest'
import { tierDistribution, visibleTierRows, winrateTone } from '../tierGridDisplay'

describe('winrateTone', () => {
  it('high at >= 52 %', () => {
    expect(winrateTone(0.52)).toBe('high')
    expect(winrateTone(0.534)).toBe('high')
  })
  it('low at <= 48 %', () => {
    expect(winrateTone(0.48)).toBe('low')
    expect(winrateTone(0.449)).toBe('low')
  })
  it('neutral in between or invalid', () => {
    expect(winrateTone(0.5)).toBe('neutral')
    expect(winrateTone(Number.NaN)).toBe('neutral')
  })
})

describe('tierDistribution', () => {
  it('one entry per group with count and share', () => {
    const d = tierDistribution([
      { tier: 'S', rows: [1, 2, 3] },
      { tier: 'C', rows: [4] },
    ])
    expect(d).toEqual([
      { tier: 'S', count: 3, share: 0.75 },
      { tier: 'C', count: 1, share: 0.25 },
    ])
  })
  it('empty → []', () => {
    expect(tierDistribution([])).toEqual([])
  })
})

describe('visibleTierRows', () => {
  const rows = Array.from({ length: 25 }, (_, i) => i)
  it('limits and reports hidden count', () => {
    expect(visibleTierRows(rows, 20, false)).toEqual({ rows: rows.slice(0, 20), hidden: 5 })
  })
  it('expanded shows all', () => {
    expect(visibleTierRows(rows, 20, true)).toEqual({ rows, hidden: 0 })
  })
  it('under limit → nothing hidden', () => {
    expect(visibleTierRows([1, 2], 20, false)).toEqual({ rows: [1, 2], hidden: 0 })
  })
})
