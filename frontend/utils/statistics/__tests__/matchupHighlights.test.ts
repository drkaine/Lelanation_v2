import { describe, expect, it } from 'vitest'
import { matchupHighlights } from '../matchupHighlights'

const r = (id: number, games: number, winrate: number) => ({ id, games, winrate })

describe('matchupHighlights', () => {
  it('splits best and worst without overlap, ignores small samples', () => {
    const h = matchupHighlights(
      [r(1, 100, 55), r(2, 100, 45), r(3, 100, 50), r(4, 5, 90), r(5, 100, 52)],
      { minGames: 20, limit: 3 }
    )
    expect(h.best.map(x => x.id)).toEqual([1, 5])
    expect(h.worst.map(x => x.id)).toEqual([2, 3])
  })

  it('sums games and weights the mean winrate', () => {
    const h = matchupHighlights([r(1, 300, 60), r(2, 100, 40)], { minGames: 1, limit: 5 })
    expect(h.count).toBe(2)
    expect(h.games).toBe(400)
    expect(h.meanWinrate).toBeCloseTo(55)
  })

  it('handles empty input', () => {
    expect(matchupHighlights([], { minGames: 1, limit: 3 })).toEqual({
      best: [],
      worst: [],
      count: 0,
      games: 0,
      meanWinrate: null,
    })
  })
})
