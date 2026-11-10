import { describe, expect, it } from 'vitest'
import { itemSetsForDisplay } from '../itemSetsDisplay'
import type { ItemKind } from '../itemTypeCounts'

const kinds: Record<number, ItemKind> = {
  1: 'final',
  2: 'final',
  3: 'boots',
  4: 'starter',
  9: 'core',
}
const kindOf = (id: number): ItemKind => kinds[id] ?? 'core'

describe('itemSetsForDisplay', () => {
  it('retire les composants et garde légendaires, bottes, starters', () => {
    const out = itemSetsForDisplay(
      [{ items: [4, 9, 1, 3], games: 10, wins: 6, pickrate: 1, winrate: 60 }],
      kindOf
    )
    expect(out).toEqual([{ items: [4, 1, 3], games: 10, wins: 6, pickrate: 1, winrate: 60 }])
  })

  it('fusionne les sets identiques une fois les composants retirés', () => {
    const out = itemSetsForDisplay(
      [
        { items: [1, 2, 9], games: 10, wins: 5, pickrate: 1, winrate: 50 },
        { items: [2, 1], games: 30, wins: 21, pickrate: 3, winrate: 70 },
      ],
      kindOf
    )
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ games: 40, wins: 26, pickrate: 4, winrate: 65 })
  })

  it('écarte un set sans objet légendaire et trie par parties', () => {
    const out = itemSetsForDisplay(
      [
        { items: [9, 3], games: 50, wins: 25, pickrate: 5, winrate: 50 },
        { items: [1], games: 5, wins: 1, pickrate: 0.5, winrate: 20 },
        { items: [2], games: 20, wins: 10, pickrate: 2, winrate: 50 },
      ],
      kindOf
    )
    expect(out.map(s => s.items)).toEqual([[2], [1]])
  })
})
