import { describe, expect, it } from 'vitest'
import type { CalculatedStats, Champion, Item } from '@lelanation/shared-types'
import {
  applyTheorycraftItemPassives,
  getTheorycraftActivatableItemPassiveConfig,
  isTheorycraftActivatableItemPassive,
} from '../theorycraftItemPassives'

const champion = {
  id: 'Ornn',
  stats: {
    armor: 20,
    armorperlevel: 4,
    spellblock: 30,
    spellblockperlevel: 1.3,
  },
} as Champion

const baseStats: CalculatedStats = {
  health: 2000,
  mana: 0,
  armor: 120,
  magicResist: 80,
  attackDamage: 100,
  abilityPower: 0,
  attackSpeed: 0.625,
  movementSpeed: 340,
  critChance: 0,
  critDamage: 1.75,
  abilityHaste: 0,
  lethality: 0,
  armorPen: 0,
  magicPen: 0,
  magicPenPercent: 0,
  lifeSteal: 0,
  omnivamp: 0,
  tenacity: 0,
  healShieldPower: 0,
}

describe('theorycraftItemPassives', () => {
  it('detects Jak Sho and Sheen as activatable', () => {
    expect(isTheorycraftActivatableItemPassive('6665')).toBe(true)
    expect(isTheorycraftActivatableItemPassive('3057')).toBe(true)
    expect(getTheorycraftActivatableItemPassiveConfig('3057')?.kind).toBe('proc')
    expect(isTheorycraftActivatableItemPassive('1001')).toBe(false)
  })

  it('applies Jak Sho bonus only when passive is active', () => {
    const itemsWithIndex = [{ index: 3, item: { id: '6665', name: "Jak'Sho" } as Item }]
    const inactive = applyTheorycraftItemPassives({
      stats: baseStats,
      champion,
      level: 18,
      itemsWithIndex,
      activeByIndex: {},
      labels: {},
    })
    expect(inactive.lines).toHaveLength(0)
    expect(inactive.stats.armor).toBe(baseStats.armor)

    const active = applyTheorycraftItemPassives({
      stats: baseStats,
      champion,
      level: 18,
      itemsWithIndex,
      activeByIndex: { 3: true },
      labels: { 'theorycraft.items.passiveJaksho': "Jak'Sho" },
    })
    expect(active.lines).toHaveLength(1)
    expect(active.stats.armor).toBeGreaterThan(baseStats.armor)
    expect(active.stats.magicResist).toBeGreaterThan(baseStats.magicResist)
  })
})
