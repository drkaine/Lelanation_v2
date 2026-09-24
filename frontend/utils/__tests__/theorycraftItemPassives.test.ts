import { describe, expect, it } from 'vitest'
import type { Champion, Item } from '@lelanation/shared-types'
import {
  applyTheorycraftItemPassives,
  getTheorycraftActivatableItemPassiveConfig,
  isTheorycraftActivatableItemPassive,
} from '../theorycraftItemPassives'
import { makeCalculatedStats } from './fixtures/calculatedStats'

const champion = {
  id: 'Ornn',
  stats: {
    armor: 20,
    armorperlevel: 4,
    spellblock: 30,
    spellblockperlevel: 1.3,
  },
} as Champion

const baseStats = makeCalculatedStats({
  health: 2000,
  armor: 120,
  magicResist: 80,
  attackDamage: 100,
})

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
