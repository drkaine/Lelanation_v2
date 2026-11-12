import { describe, expect, it } from 'vitest'
import { sideSurrenderRates } from '../sideSummary'

describe('sideSurrenderRates', () => {
  it('rates_are_percent_of_side_games', () => {
    expect(
      sideSurrenderRates({ total: 1000, surrenderCount: 97, earlySurrenderCount: 14 })
    ).toEqual({
      surrenderPct: 9.7,
      earlyPct: 1.4,
    })
  })
  it('zero_total_gives_null', () => {
    expect(sideSurrenderRates({ total: 0, surrenderCount: 0, earlySurrenderCount: 0 })).toEqual({
      surrenderPct: null,
      earlyPct: null,
    })
  })
  it('accepts_string_counts', () => {
    expect(
      sideSurrenderRates({ total: '200', surrenderCount: '20', earlySurrenderCount: '3' })
    ).toEqual({ surrenderPct: 10, earlyPct: 1.5 })
  })
})
