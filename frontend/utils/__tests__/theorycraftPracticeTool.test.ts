import { describe, expect, it } from 'vitest'
import {
  addSplit,
  applyHitToDummy,
  buildDummyBar,
  dominantDamageType,
  dpsOf,
  emptySplit,
  mitigateDamage,
  mitigateSplit,
  splitShares,
  sumSplit,
} from '../theorycraftPracticeTool'

describe('theorycraftPracticeTool', () => {
  describe('mitigateDamage', () => {
    it('applies armor to physical damage', () => {
      expect(mitigateDamage(200, 'physical', { armor: 100 })).toBeCloseTo(100)
    })

    it('applies magic resist to magic damage', () => {
      expect(mitigateDamage(300, 'magic', { magicResist: 50 })).toBeCloseTo(200)
    })

    it('ignores resistances for true damage', () => {
      expect(mitigateDamage(150, 'true', { armor: 300, magicResist: 300 })).toBeCloseTo(150)
    })

    it('applies percent and flat penetration', () => {
      const dmg = mitigateDamage(
        200,
        'magic',
        { magicResist: 100 },
        { magicPenetration: 0.4, flatMagicPenetration: 10 }
      )
      expect(dmg).toBeCloseTo(200 * (100 / 150))
    })

    it('scales lethality with attacker level', () => {
      const lvl18 = mitigateDamage(100, 'physical', { armor: 50 }, { lethality: 30 }, 18)
      expect(lvl18).toBeCloseTo(100 * (100 / 120))
      const lvl1 = mitigateDamage(100, 'physical', { armor: 50 }, { lethality: 30 }, 1)
      expect(lvl1).toBeLessThan(lvl18)
    })

    it('applies damage reduction after resistances, capped at 95%', () => {
      expect(mitigateDamage(100, 'true', { damageReduction: 0.2 })).toBeCloseTo(80)
      expect(mitigateDamage(100, 'true', { damageReduction: 2 })).toBeCloseTo(5)
    })

    it('returns 0 for invalid input', () => {
      expect(mitigateDamage(-5, 'physical', {})).toBe(0)
      expect(mitigateDamage(Number.NaN, 'magic', {})).toBe(0)
    })
  })

  it('mitigates each part of a split separately', () => {
    const split = mitigateSplit(
      { physical: 200, magic: 300, true: 50 },
      { armor: 100, magicResist: 50 }
    )
    expect(split.physical).toBeCloseTo(100)
    expect(split.magic).toBeCloseTo(200)
    expect(split.true).toBeCloseTo(50)
  })

  it('adds and sums splits', () => {
    const total = addSplit(emptySplit(), { physical: 10, magic: 5, true: 1 })
    expect(addSplit(total, total)).toEqual({ physical: 20, magic: 10, true: 2 })
    expect(sumSplit(total)).toBe(16)
  })

  it('computes split shares in percent', () => {
    expect(splitShares({ physical: 50, magic: 25, true: 25 })).toEqual({
      physical: 50,
      magic: 25,
      true: 25,
    })
    expect(splitShares(emptySplit())).toEqual({ physical: 0, magic: 0, true: 0 })
  })

  it('finds the dominant damage type', () => {
    expect(dominantDamageType({ physical: 1, magic: 9, true: 3 })).toBe('magic')
    expect(dominantDamageType(emptySplit())).toBeNull()
  })

  describe('applyHitToDummy', () => {
    it('drains shield before HP', () => {
      expect(applyHitToDummy({ hp: 1000, shield: 100 }, 250)).toEqual({
        hp: 850,
        shield: 0,
        absorbed: 100,
        hpLost: 150,
      })
    })

    it('never goes below zero', () => {
      expect(applyHitToDummy({ hp: 50, shield: 0 }, 500)).toEqual({
        hp: 0,
        shield: 0,
        absorbed: 0,
        hpLost: 50,
      })
    })
  })

  it('computes DPS and guards zero elapsed time', () => {
    expect(dpsOf(500, 2)).toBe(250)
    expect(dpsOf(500, 0)).toBe(0)
  })

  describe('buildDummyBar', () => {
    it('splits the bar into remaining HP, shield and damage taken by type', () => {
      const bar = buildDummyBar({
        maxHp: 1000,
        maxShield: 0,
        hp: 600,
        shield: 0,
        dealt: { physical: 300, magic: 100, true: 0 },
      })
      expect(bar.hp).toBeCloseTo(60)
      expect(bar.shield).toBe(0)
      expect(bar.lost).toEqual({ physical: 30, magic: 10, true: 0 })
    })

    it('scales overkill damage to the lost part of the bar', () => {
      const bar = buildDummyBar({
        maxHp: 800,
        maxShield: 200,
        hp: 0,
        shield: 0,
        dealt: { physical: 1000, magic: 1000, true: 0 },
      })
      expect(bar.hp).toBe(0)
      expect(bar.lost.physical).toBeCloseTo(50)
      expect(bar.lost.magic).toBeCloseTo(50)
    })

    it('includes the remaining shield', () => {
      const bar = buildDummyBar({
        maxHp: 900,
        maxShield: 100,
        hp: 900,
        shield: 50,
        dealt: { physical: 0, magic: 0, true: 50 },
      })
      expect(bar.hp).toBeCloseTo(90)
      expect(bar.shield).toBeCloseTo(5)
      expect(bar.lost.true).toBeCloseTo(5)
    })
  })
})
