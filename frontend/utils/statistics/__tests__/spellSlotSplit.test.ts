import { describe, expect, it } from 'vitest'
import { spellSlotSplit } from '../spellSlotSplit'

describe('spellSlotSplit', () => {
  it('rapporte D et F à leur somme, arrondis à l’entier', () => {
    expect(spellSlotSplit(62.4, 37.6)).toEqual({ d: 62, f: 38 })
  })
  it('normalise quand la somme ne fait pas 100', () => {
    expect(spellSlotSplit(30, 10)).toEqual({ d: 75, f: 25 })
  })
  it('renvoie null sans données', () => {
    expect(spellSlotSplit(null, 40)).toBeNull()
    expect(spellSlotSplit(0, 0)).toBeNull()
  })
})
