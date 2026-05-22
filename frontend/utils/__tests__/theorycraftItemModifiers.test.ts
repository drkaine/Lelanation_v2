import { describe, expect, it } from 'vitest'
import type { CalculatedStats, Item } from '@lelanation/shared-types'
import {
  applyTheorycraftItemModifiers,
  getTheorycraftItemStackStats,
  getTheorycraftTransformDisplayItemId,
  isTheorycraftStackableItem,
  resolveTheorycraftItemImageFull,
  shouldShowTheorycraftTransformedImage,
} from '../theorycraftItemModifiers'

const baseStats: CalculatedStats = {
  health: 2000,
  mana: 800,
  attackDamage: 100,
  abilityPower: 300,
  armor: 100,
  magicResist: 50,
  attackSpeed: 0.625,
  critChance: 0,
  critDamage: 1.75,
  lifeSteal: 0,
  spellVamp: 0,
  cooldownReduction: 0,
  movementSpeed: 335,
  healthRegen: 0,
  manaRegen: 0,
  armorPenetration: 0,
  flatArmorPenetration: 0,
  magicPenetration: 0,
  flatMagicPenetration: 0,
  tenacity: 0,
  lethality: 0,
  percentLethality: 0,
  omnivamp: 0,
  shield: 0,
  healShieldPower: 0,
  goldPer10: 0,
}

const rabadon = { id: '3089', name: 'Rabadon' } as Item
const archangel = { id: '3003', name: 'Archangel' } as Item

describe('theorycraftItemModifiers', () => {
  it('detects stackable items', () => {
    expect(isTheorycraftStackableItem('3041')).toBe(true)
    expect(isTheorycraftStackableItem('9999')).toBe(false)
  })

  it('adds Mejai AP per glory stack', () => {
    const bonus = getTheorycraftItemStackStats('3041', 20)
    expect(bonus.abilityPower).toBe(100)
  })

  it('adds Mejai base AP and HP when item stats are missing', () => {
    const mejai = { id: '3041', name: "Mejai's" } as Item
    const result = applyTheorycraftItemModifiers({
      stats: baseStats,
      items: [mejai],
      itemStacksById: {},
      transformedById: {},
      labels: {},
    })
    expect(result.stats.abilityPower).toBe(320)
    expect(result.stats.health).toBe(2100)
  })

  it('does not double-count Mejai base AP when catalog stats are present', () => {
    const mejai = {
      id: '3041',
      name: "Mejai's",
      stats: { FlatMagicDamageMod: 20, FlatHPPoolMod: 100 },
    } as Item
    const result = applyTheorycraftItemModifiers({
      stats: { ...baseStats, abilityPower: 320, health: 2100 },
      items: [mejai],
      itemStacksById: {},
      transformedById: {},
      labels: {},
    })
    expect(result.stats.abilityPower).toBe(320)
    expect(result.stats.health).toBe(2100)
  })

  it('adds Dark Seal base AP even with zero stacks', () => {
    const darkSeal = {
      id: '1082',
      name: 'Dark Seal',
      stats: { FlatMagicDamageMod: 15, FlatHPPoolMod: 50 },
    } as Item
    const result = applyTheorycraftItemModifiers({
      stats: baseStats,
      items: [darkSeal],
      itemStacksById: {},
      transformedById: {},
      labels: {},
    })
    expect(result.stats.abilityPower).toBe(315)
    expect(result.stats.health).toBe(2050)
  })

  it('adds Dark Seal AP per glory stack', () => {
    expect(isTheorycraftStackableItem('1082')).toBe(true)
    const bonus = getTheorycraftItemStackStats('1082', 10)
    expect(bonus.abilityPower).toBe(50)
  })

  it('applies Rabadon percent AP bonus', () => {
    const result = applyTheorycraftItemModifiers({
      stats: baseStats,
      items: [rabadon],
      itemStacksById: {},
      transformedById: {},
      labels: {},
    })
    expect(result.stats.abilityPower).toBe(390)
    expect(result.lines.some(line => line.itemId === '3089')).toBe(true)
  })

  it('resolves Seraphin image for transformed archangel', () => {
    const archangelWithImage = {
      id: '3003',
      image: { full: '3003.png' },
    } as Item

    expect(getTheorycraftTransformDisplayItemId('3003')).toBe('3040')
    expect(getTheorycraftTransformDisplayItemId('3004')).toBe('3042')
    expect(getTheorycraftTransformDisplayItemId('3070', ['3004'])).toBe('3042')

    expect(shouldShowTheorycraftTransformedImage('3003', 0, true)).toBe(true)
    expect(shouldShowTheorycraftTransformedImage('3003', 360, false)).toBe(true)
    expect(shouldShowTheorycraftTransformedImage('3003', 100, false)).toBe(false)

    expect(
      resolveTheorycraftItemImageFull(archangelWithImage, { stacks: 360, transformed: true }, id =>
        id === '3040' ? { image: { full: '3040.png' } } : null
      )
    ).toBe('3040.png')
  })

  it('compounds Heartsteel stacks as 20% of bonus health per proc', () => {
    const heartsteel = { id: '3084', name: 'Heartsteel' } as Item
    const result = applyTheorycraftItemModifiers({
      stats: baseStats,
      items: [heartsteel],
      itemStacksById: { '3084': 2 },
      transformedById: {},
      labels: {},
      championBaseHealth: 1000,
    })
    // bonus HP before stacks = 1000 → stack1 +200, stack2 +240 (20% of 1200)
    expect(result.stats.health).toBe(2440)
    expect(
      result.lines.some(line => line.itemId === '3084' && line.detail.includes('+440 PV'))
    ).toBe(true)
  })

  it('applies tear mana stacks and archangel transform delta', () => {
    const result = applyTheorycraftItemModifiers({
      stats: baseStats,
      items: [archangel],
      itemStacksById: { '3003': 360 },
      transformedById: { '3003': true },
      labels: {},
    })
    expect(result.stats.mana).toBeGreaterThan(baseStats.mana)
    expect(result.lines.some(line => line.detail.includes('Transformed'))).toBe(true)
  })
})
