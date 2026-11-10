import { describe, expect, it } from 'vitest'
import {
  donutArcs,
  sideRatePct,
  sideWinrateBarPct,
  surrenderBarSegments,
  surrenderDeltaTone,
} from '../teamSides'

describe('teamSides', () => {
  it('sideRatePct : part en %, 0 si total nul', () => {
    expect(sideRatePct(97, 1000)).toBe(9.7)
    expect(sideRatePct(5, 0)).toBe(0)
    expect(sideRatePct(null, 10)).toBe(0)
  })

  it('sideWinrateBarPct : (v-50)/10, borné 0..100', () => {
    expect(sideWinrateBarPct(55)).toBe(50)
    expect(sideWinrateBarPct(48)).toBe(0)
    expect(sideWinrateBarPct(72)).toBe(100)
  })

  it('surrenderBarSegments : précoce et reste sur échelle 50 %', () => {
    expect(surrenderBarSegments(20, 4)).toEqual({ early: 8, rest: 32 })
    expect(surrenderBarSegments(80, 10)).toEqual({ early: 20, rest: 80 })
    expect(surrenderBarSegments(3, 5)).toEqual({ early: 10, rest: 0 })
  })

  it('surrenderDeltaTone : hausse rouge, baisse verte, nul neutre', () => {
    expect(surrenderDeltaTone(1.2)).toBe('up')
    expect(surrenderDeltaTone(-0.4)).toBe('down')
    expect(surrenderDeltaTone(0)).toBe('none')
    expect(surrenderDeltaTone(null)).toBe('none')
  })

  it('donutArcs : arcs et décalages proportionnels, vide si total nul', () => {
    expect(donutArcs([1, 3], 100)).toEqual([
      { arc: 25, offset: 0 },
      { arc: 75, offset: 25 },
    ])
    expect(donutArcs([0, 0], 100)).toEqual([])
    expect(donutArcs([-2, 4], 100)).toEqual([
      { arc: 0, offset: 0 },
      { arc: 100, offset: 0 },
    ])
  })
})
