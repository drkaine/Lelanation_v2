import { describe, expect, it } from 'vitest'
import { overviewKeyFigures } from '../overviewKeyFigures'

describe('overviewKeyFigures', () => {
  it('computes games, surrender share, top ban and top winrate rise', () => {
    const k = overviewKeyFigures({
      total: 1000,
      surrenderOnly: 150,
      early: 50,
      topBan: [{ championId: 1, banrate: 32.456 }],
      topWinrateRise: [{ championId: 2, wrSince: 53.2, deltaWr: 2.345 }],
    })
    expect(k.games).toBe(1000)
    expect(k.surrenderPct).toBe(20)
    expect(k.earlyPct).toBe(5)
    expect(k.topBan).toEqual({ championId: 1, banrate: 32.46 })
    expect(k.topRise).toEqual({ championId: 2, winrate: 53.2, delta: 2.35 })
  })

  it('returns nulls when data is missing', () => {
    const k = overviewKeyFigures({
      total: 0,
      surrenderOnly: 0,
      early: 0,
      topBan: [],
      topWinrateRise: [],
    })
    expect(k.games).toBe(0)
    expect(k.surrenderPct).toBeNull()
    expect(k.earlyPct).toBeNull()
    expect(k.topBan).toBeNull()
    expect(k.topRise).toBeNull()
  })

  it('ignores a top rise that is not positive', () => {
    const k = overviewKeyFigures({
      total: 10,
      surrenderOnly: 0,
      early: 0,
      topBan: [],
      topWinrateRise: [{ championId: 3, wrSince: 48, deltaWr: -1 }],
    })
    expect(k.topRise).toBeNull()
  })
})
