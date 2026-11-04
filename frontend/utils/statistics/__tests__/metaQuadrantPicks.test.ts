import { describe, expect, it } from 'vitest'
import { metaQuadrantPicks } from '../metaQuadrantPicks'

const rows = [
  { championId: 1, winrate: 0.55, pickrate: 0.01 },
  { championId: 2, winrate: 0.53, pickrate: 0.02 },
  { championId: 3, winrate: 0.46, pickrate: 0.1 },
  { championId: 4, winrate: 0.48, pickrate: 0.08 },
  { championId: 5, winrate: 0.52, pickrate: 0.09 },
]

describe('metaQuadrantPicks', () => {
  it('gems = above mean winrate, below mean pickrate, sorted by winrate', () => {
    expect(metaQuadrantPicks(rows).gems.map(r => r.championId)).toEqual([1, 2])
  })
  it('popularWeak = above mean pickrate, below mean winrate, sorted by pickrate', () => {
    expect(metaQuadrantPicks(rows).popularWeak.map(r => r.championId)).toEqual([3, 4])
  })
  it('returns percent values and respects limit', () => {
    const r = metaQuadrantPicks(rows, 1)
    expect(r.gems).toEqual([{ championId: 1, winPct: 55, pickPct: 1 }])
    expect(metaQuadrantPicks([])).toEqual({ gems: [], popularWeak: [] })
  })
})
