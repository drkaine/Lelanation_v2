import { describe, expect, it } from 'vitest'
import { trendRows } from '../overviewTrends'

describe('trendRows', () => {
  it('maps winrate rows with bar relative to max |delta| across lists', () => {
    const ups = [{ championId: 1, wrOldest: 44.2, wrSince: 51.4, deltaWr: 7.2 }]
    const downs = [{ championId: 2, wrOldest: 51.9, wrSince: 44.4, deltaWr: -7.5 }]
    const r = trendRows('winrate', ups, downs)
    expect(r.ups[0]).toEqual({ championId: 1, from: 44.2, to: 51.4, delta: 7.2, barPct: 96 })
    expect(r.downs[0]).toEqual({ championId: 2, from: 51.9, to: 44.4, delta: -7.5, barPct: 100 })
  })
  it('reads pickrate and banrate fields and limits to 5', () => {
    const ups = Array.from({ length: 7 }, (_, i) => ({
      championId: i,
      pickrateOldest: 1,
      pickrateSince: 2,
      deltaPick: 1,
    }))
    expect(trendRows('pickrate', ups, []).ups).toHaveLength(5)
    const b = trendRows(
      'banrate',
      [{ championId: 9, banrateOldest: 3, banrateSince: 5, deltaBan: 2 }],
      []
    )
    expect(b.ups[0]).toMatchObject({ from: 3, to: 5, delta: 2, barPct: 100 })
  })
  it('drops non-finite rows and handles empty lists', () => {
    expect(
      trendRows('winrate', [{ championId: 1, wrOldest: 1, wrSince: 2, deltaWr: Number.NaN }], [])
    ).toEqual({
      ups: [],
      downs: [],
    })
  })
})
