import { describe, expect, it } from 'vitest'
import { pingColumnsForMode, topPingers } from '../topPingers'

describe('topPingers', () => {
  const rows = [
    { championId: 1, totalPerGame: 30 },
    { championId: 2, totalPerGame: 40 },
    { championId: 3, totalPerGame: 20 },
  ]
  it('sorts by pings per game desc and limits', () => {
    expect(topPingers(rows, 2).map(r => r.championId)).toEqual([2, 1])
  })
  it('gives bar width relative to the top value', () => {
    const out = topPingers(rows, 3)
    expect(out[0]!.barPct).toBe(100)
    expect(out[2]!.barPct).toBe(50)
  })
  it('handles empty and non-finite input', () => {
    expect(topPingers([], 8)).toEqual([])
    expect(topPingers([{ championId: 1, totalPerGame: Number.NaN }], 8)).toEqual([])
  })
})

describe('pingColumnsForMode', () => {
  it('simple: the three named key pings of the mock', () => {
    expect(pingColumnsForMode('simple')).toEqual(['danger', 'onMyWay', 'assistMe'])
  })
  it('detailed: every ping type', () => {
    expect(pingColumnsForMode('detailed')).toHaveLength(10)
    expect(pingColumnsForMode('detailed')).toContain('enemyVision')
  })
})
