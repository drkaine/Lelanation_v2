import { describe, expect, it } from 'vitest'
import {
  abilityItemDamage,
  amplifyItemDamage,
  onHitItemDamage,
  spellbladeDamage,
} from '../theorycraftItemEffects'

const attacker = { level: 18, baseAD: 100, bonusAD: 50, AP: 200, maxHp: 3000, ranged: false }
const target = { maxHp: 2000, currentHp: 1000 }

describe('onHitItemDamage', () => {
  it('adds every on-hit item', () => {
    const split = onHitItemDamage(['3153', '3091', '3115', '1043'], attacker, target)
    expect(split.physical).toBeCloseTo(90 + 15) // BotRK 9% current HP + Recurve Bow
    expect(split.magic).toBeCloseTo(45 + 15 + 40) // Wit's End + Nashor's 15 + 20% AP
  })

  it('BotRK is 6% current HP for ranged champions', () => {
    expect(onHitItemDamage(['3153'], { ...attacker, ranged: true }, target).physical).toBeCloseTo(
      60
    )
  })

  it('ignores unknown items', () => {
    expect(onHitItemDamage(['9999'], attacker, target)).toEqual({ physical: 0, magic: 0, true: 0 })
  })
})

describe('spellbladeDamage', () => {
  it('keeps the strongest Spellblade only', () => {
    expect(spellbladeDamage(['3057', '3078'], attacker).physical).toBeCloseTo(200) // Trinity 200% base AD
  })

  it('Lich Bane is magic', () => {
    expect(spellbladeDamage(['3100'], attacker).magic).toBeCloseTo(75 + 90)
  })

  it('no Spellblade item gives nothing', () => {
    expect(spellbladeDamage(['3153'], attacker)).toEqual({ physical: 0, magic: 0, true: 0 })
  })
})

describe('abilityItemDamage', () => {
  it("Liandry's burns 6% max HP over 3 s", () => {
    expect(abilityItemDamage(['6653'], target).magic).toBeCloseTo(120)
  })
})

describe('amplifyItemDamage', () => {
  it('Abyssal Mask adds 12% magic damage', () => {
    const split = amplifyItemDamage(['8020'], { physical: 100, magic: 100, true: 100 }, target)
    expect(split.physical).toBe(100)
    expect(split.magic).toBeCloseTo(112)
    expect(split.true).toBe(100)
  })

  it('Shadowflame adds 20% magic and true damage under 40% HP', () => {
    const low = amplifyItemDamage(
      ['4645'],
      { physical: 100, magic: 100, true: 100 },
      { maxHp: 2000, currentHp: 700 }
    )
    expect(low.magic).toBeCloseTo(120)
    expect(low.true).toBeCloseTo(120)
    const high = amplifyItemDamage(['4645'], { physical: 100, magic: 100, true: 100 }, target)
    expect(high.magic).toBe(100)
  })
})
