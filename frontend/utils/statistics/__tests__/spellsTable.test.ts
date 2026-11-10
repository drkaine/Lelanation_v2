import { describe, expect, it } from 'vitest'
import { spellBarPct, spellSlotSplit, spellDeltaTone } from '../spellsTable'

describe('spellBarPct', () => {
  it('relatif au max, borné 0-100', () => {
    expect(spellBarPct(25, 50)).toBe(50)
    expect(spellBarPct(80, 50)).toBe(100)
    expect(spellBarPct(null, 50)).toBe(0)
    expect(spellBarPct(10, 0)).toBe(0)
  })
})

describe('spellSlotSplit', () => {
  it('normalise D/F en somme 100', () => {
    expect(spellSlotSplit(30, 10)).toEqual({ d: 75, f: 25 })
  })
  it('null si aucune donnée', () => {
    expect(spellSlotSplit(null, null)).toBeNull()
    expect(spellSlotSplit(0, 0)).toBeNull()
  })
  it('un côté manquant = 0', () => {
    expect(spellSlotSplit(40, null)).toEqual({ d: 100, f: 0 })
  })
})

describe('spellDeltaTone', () => {
  it('up / down / flat', () => {
    expect(spellDeltaTone(0.5)).toBe('up')
    expect(spellDeltaTone(-0.2)).toBe('down')
    expect(spellDeltaTone(0)).toBe('flat')
  })
})
