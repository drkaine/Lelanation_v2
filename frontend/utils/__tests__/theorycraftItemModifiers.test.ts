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
