import { describe, expect, it } from 'vitest'
import { barList, outcomeSegments, pairedBans } from '../overviewCards'

describe('barList', () => {
  it('scale au max et coupe à limit', () => {
    const r = barList(
      [
        { championId: 1, value: 2 },
        { championId: 2, value: 1 },
        { championId: 3, value: 0.5 },
      ],
      { limit: 2 }
    )
    expect(r).toEqual([
      { championId: 1, value: 2, pct: 100 },
      { championId: 2, value: 1, pct: 50 },
    ])
  })
  it('baseline : écart à 50', () => {
    const r = barList(
      [
        { championId: 1, value: 54 },
        { championId: 2, value: 52 },
        { championId: 3, value: 49 },
      ],
      { limit: 5, baseline: 50 }
    )
    expect(r.map(x => x.pct)).toEqual([100, 50, 0])
  })
  it('vide', () => {
    expect(barList([], { limit: 5 })).toEqual([])
  })
})

describe('outcomeSegments', () => {
  it('pourcentages du total', () => {
    expect(outcomeSegments({ played: 80, surrender: 15, early: 5 })).toEqual([
      { key: 'played', count: 80, pct: 80 },
      { key: 'surrender', count: 15, pct: 15 },
      { key: 'early', count: 5, pct: 5 },
    ])
  })
  it('total nul', () => {
    expect(outcomeSegments({ played: 0, surrender: 0, early: 0 }).every(s => s.pct === 0)).toBe(
      true
    )
  })
})

describe('pairedBans', () => {
  it('union ordonnée par gagnante, échelle commune', () => {
    const r = pairedBans(
      [
        { championId: 1, banRatePercent: '20%' },
        { championId: 2, banRatePercent: '10%' },
      ],
      [
        { championId: 2, banRatePercent: '12%' },
        { championId: 1, banRatePercent: '19%' },
        { championId: 3, banRatePercent: '5%' },
      ],
      2
    )
    expect(r).toEqual([
      { championId: 1, win: 20, loss: 19, winPct: 100, lossPct: 95 },
      { championId: 2, win: 10, loss: 12, winPct: 50, lossPct: 60 },
    ])
  })
  it('absent d’un côté = 0', () => {
    const r = pairedBans([{ championId: 1, banRatePercent: '10' }], [], 5)
    expect(r[0]).toEqual({ championId: 1, win: 10, loss: 0, winPct: 100, lossPct: 0 })
  })
})
