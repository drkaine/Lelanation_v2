import { describe, expect, it } from 'vitest'
import { foldRunePositions, foldShardsByKeystone } from '../../../../src/stats/runePositionStats.js'

describe('foldRunePositions', () => {
  it('positions 1-4 are primary, 5-6 secondary', () => {
    const out = foldRunePositions([
      { runeId: 8126, pos: 2, games: 10, wins: 6 },
      { runeId: 8126, pos: 5, games: 4, wins: 1 },
      { runeId: 8126, pos: 6, games: 2, wins: 1 },
      { runeId: 8112, pos: 1, games: 8, wins: 4 },
    ], 100)
    expect(out.find(r => r.runeId === 8126)).toEqual({
      runeId: 8126,
      primary: { games: 10, wins: 6, pickrate: 10, winrate: 60 },
      secondary: { games: 6, wins: 2, pickrate: 6, winrate: 33.33 },
    })
    expect(out.find(r => r.runeId === 8112)?.secondary).toEqual({ games: 0, wins: 0, pickrate: 0, winrate: 0 })
  })
  it('ignores invalid ids and zero total', () => {
    expect(foldRunePositions([{ runeId: 0, pos: 1, games: 3, wins: 1 }], 0)).toEqual([])
    expect(foldRunePositions([{ runeId: 8112, pos: 1, games: 3, wins: 3 }], 0)[0]!.primary.pickrate).toBe(0)
  })
})

describe('foldShardsByKeystone', () => {
  it('sums rows per keystone/shard/slot with rates vs keystone games', () => {
    const out = foldShardsByKeystone(
      [
        { keystoneId: 8112, shardId: 5008, slot: 0, games: 6, wins: 3 },
        { keystoneId: 8112, shardId: 5008, slot: 0, games: 2, wins: 2 },
        { keystoneId: 8112, shardId: 5005, slot: 0, games: 2, wins: 0 },
      ]
    )
    expect(out).toEqual([
      { keystoneId: 8112, shardId: 5008, slot: 0, games: 8, wins: 5 },
      { keystoneId: 8112, shardId: 5005, slot: 0, games: 2, wins: 0 },
    ])
  })
})
