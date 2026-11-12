import { describe, expect, it } from 'vitest'
import { defaultRuneTree, runeCardRows } from '../runeCardRows'

const path = {
  id: 8100,
  slots: [
    {
      runes: [
        { id: 1, name: 'A', icon: 'a' },
        { id: 2, name: 'B', icon: 'b' },
      ],
    },
    { runes: [{ id: 3, name: 'C', icon: 'c' }] },
  ],
}

describe('runeCardRows', () => {
  it('builds rows with bar relative to row max and delta vs baseline', () => {
    const rows = runeCardRows(
      path,
      { 1: { pickrate: 10, winrate: 50, games: 5 }, 2: { pickrate: 5, winrate: 48, games: 2 } },
      { 1: { pickrate: 9, winrate: 49.5, games: 4 } }
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]!.cards[0]).toMatchObject({ id: 1, pick: 10, wr: 50, bar: 100, delta: 0.5 })
    expect(rows[0]!.cards[1]).toMatchObject({ id: 2, bar: 50, delta: null })
  })

  it('keeps runes without stats with zero values', () => {
    const rows = runeCardRows(path, {}, {})
    expect(rows[1]!.cards[0]).toMatchObject({ id: 3, pick: null, wr: null, bar: 0, delta: null })
  })
})

describe('defaultRuneTree', () => {
  it('picks the tree whose keystones are the most picked', () => {
    const p2 = { id: 8200, slots: [{ runes: [{ id: 9, name: 'Z', icon: 'z' }] }] }
    expect(defaultRuneTree([path, p2], { 1: { pickrate: 3 }, 9: { pickrate: 20 } })).toBe(8200)
  })
  it('returns null without paths', () => {
    expect(defaultRuneTree([], {})).toBeNull()
  })
})
