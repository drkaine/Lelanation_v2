import { describe, expect, it } from 'vitest'
import { aggregateJunglePaths } from '../../../../src/services/junglePathAggregate.js'

const FULL = ['blue_buff_blue', 'gromp_blue', 'wolves_blue', 'raptors_blue', 'red_buff_blue', 'krugs_blue']
const RED_START = ['red_buff_blue', 'krugs_blue', 'raptors_blue', 'wolves_blue', 'blue_buff_blue', 'gromp_blue']
const path = (seq: string[], clear = 200_000) => ({ pathSequence: seq, pathHash: seq.join(','), clearTimeMs: clear })

describe('aggregateJunglePaths', () => {
  const rows = [
    { teamId: 100, win: true, path: path(FULL, 190_000) },
    { teamId: 100, win: false, path: path(FULL, 210_000) },
    { teamId: 100, win: true, path: path(RED_START) },
    { teamId: 100, win: true, path: path(['wolves_blue', 'scuttler_red']) },
    { teamId: 100, win: true, path: null },
    { teamId: 200, win: false, path: path(['red_buff_red', 'krugs_red', 'raptors_red']) },
  ]
  const res = aggregateJunglePaths(rows, { top: 6 })

  it('groups by side, blue first', () => {
    expect(res.sides.map(s => s.teamId)).toEqual([100, 200])
  })

  it('counts every game with a path in the side total', () => {
    expect(res.sides[0]!.games).toBe(4)
  })

  it('ranks clears of 3+ camps by games with winrate, share and mean clear time', () => {
    const [first, second] = res.sides[0]!.paths
    expect(first).toMatchObject({ pathSequence: FULL, games: 2, wins: 1, winrate: 0.5, share: 0.5, avgClearTimeMs: 200_000 })
    expect(second!.pathSequence).toEqual(RED_START)
    expect(res.sides[0]!.paths).toHaveLength(2)
  })

  it('gives the start camp distribution by camp type', () => {
    expect(res.sides[0]!.starts).toEqual([
      { camp: 'blue_buff', games: 2, share: 0.5 },
      { camp: 'red_buff', games: 1, share: 0.25 },
      { camp: 'wolves', games: 1, share: 0.25 },
    ])
  })

  it('keeps only the top N paths per side', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      teamId: 200,
      win: true,
      path: path(['red_buff_red', 'krugs_red', `raptors_red_${i}`]),
    }))
    expect(aggregateJunglePaths(many, { top: 6 }).sides[0]!.paths).toHaveLength(6)
  })
})
