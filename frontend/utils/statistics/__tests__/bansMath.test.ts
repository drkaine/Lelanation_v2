import { describe, expect, it } from 'vitest'
import { banPct, banPctDelta } from '../bansMath'

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
