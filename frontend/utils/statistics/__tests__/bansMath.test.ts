import { describe, expect, it } from 'vitest'
import { banBarWidth, banSplitShare, banPct, banPctDelta, bansSplitColumns } from '../bansMath'

describe('banPct', () => {
  it('rate = bans / matches', () => {
    expect(banPct(2971, 10000)).toBe(29.71)
  })
  it('0 when no match', () => {
    expect(banPct(5, 0)).toBe(0)
  })
})

describe('banPctDelta', () => {
  it('null when champion absent from reference patch', () => {
    expect(banPctDelta(376, null, 10000, 10000)).toBeNull()
  })
  it('null when a match count is 0', () => {
    expect(banPctDelta(10, 5, 0, 100)).toBeNull()
    expect(banPctDelta(10, 5, 100, 0)).toBeNull()
  })
  it('difference of rates in points', () => {
    expect(banPctDelta(300, 100, 1000, 1000)).toBe(20)
  })
})

describe('banBarWidth', () => {
  it('share of the max banrate, in %', () => {
    expect(banBarWidth(7.7, 15.4)).toBe(50)
  })
  it('clamped to 0–100, 0 when max invalid', () => {
    expect(banBarWidth(20, 15)).toBe(100)
    expect(banBarWidth(-1, 15)).toBe(0)
    expect(banBarWidth(5, 0)).toBe(0)
  })
})

describe('banSplitShare', () => {
  it('donne la part du premier côté en %', () => {
    expect(banSplitShare(3, 1)).toBe(75)
    expect(banSplitShare(7.61, 7.78)).toBeCloseTo(49.45, 2)
  })
  it('renvoie null sans donnée', () => {
    expect(banSplitShare(0, 0)).toBeNull()
    expect(banSplitShare(Number.NaN, 2)).toBeNull()
  })
})

describe('bansSplitColumns', () => {
  it('outcome mode shows team columns only', () => {
    expect(bansSplitColumns('outcome')).toEqual({ outcome: true, side: false })
  })
  it('side mode shows side columns only', () => {
    expect(bansSplitColumns('side')).toEqual({ outcome: false, side: true })
  })
})
