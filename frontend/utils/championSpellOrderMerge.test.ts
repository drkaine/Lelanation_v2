import { describe, expect, it } from 'vitest'
import {
  extrapolateSpellOrder,
  mergeChampionSpellOrderRows,
  resolveCanonicalSpellOrder,
  resolveCanonicalSpellOrderKey,
} from './championSpellOrderMerge.js'

/** 18 montées (la chaîne historique du backend n’en avait que 17). */
const FULL = '1-2-1-3-1-4-1-2-1-2-4-2-3-3-4-3-3-3'.split('-').map(Number)

describe('championSpellOrderMerge', () => {
  it('extrapolates from level 14 to 18', () => {
    const prefix = FULL.slice(0, 14)
    const out = extrapolateSpellOrder(prefix)
    expect(out.length).toBe(18)
    expect(out.slice(0, 14)).toEqual(prefix)
    expect(out[15]).toBe(4)
  })

  it('does not extrapolate below level 14', () => {
    const short = FULL.slice(0, 13)
    expect(extrapolateSpellOrder(short)).toEqual(short)
  })

  it('merges prefix rows into extrapolated full order', () => {
    const prefix = FULL.slice(0, 14)
    const rows = [
      {
        key: prefix.join('-'),
        order: prefix,
        games: 40,
        wins: 22,
        pickrate: 4,
        winrate: 55,
      },
      {
        key: FULL.join('-'),
        order: FULL,
        games: 60,
        wins: 33,
        pickrate: 6,
        winrate: 55,
      },
    ]
    const merged = mergeChampionSpellOrderRows(rows, 1000)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.games).toBe(100)
    expect(merged[0]?.displayOrder.length).toBe(18)
    expect(merged[0]?.mergedFromPartial).toBe(40)
  })

  it('resolveCanonicalSpellOrder prefers longest prefix match', () => {
    const prefix = FULL.slice(0, 8)
    const full = [...FULL]
    const all = [prefix, full]
    expect(resolveCanonicalSpellOrder(prefix, all)).toEqual(full)
    expect(resolveCanonicalSpellOrder(full, all)).toEqual(full)
  })

  it('resolveCanonicalSpellOrderKey uses longest observed order', () => {
    const prefix = FULL.slice(0, 8)
    const full = [...FULL]
    expect(resolveCanonicalSpellOrderKey(prefix, [prefix, full])).toBe(full.join('-'))
  })
})
