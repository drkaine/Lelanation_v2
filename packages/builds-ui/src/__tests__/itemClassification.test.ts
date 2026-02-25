import { describe, it, expect } from 'vitest'
import { isBootsItem, isStarterItem } from '../utils/itemClassification'
import type { Item } from '@lelanation/shared-types'

function makeItem(id: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    name: `Item ${id}`,
    description: '',
    colloq: '',
    plaintext: '',
    image: { full: `${id}.png`, sprite: '', group: '', x: 0, y: 0, w: 0, h: 0 },
    gold: { base: 0, total: 0, sell: 0, purchasable: true },
    tags: [],
    depth: 1,
    ...overrides,
  }
}

describe('isBootsItem', () => {
  it('returns true for items tagged Boots', () => {
    expect(isBootsItem(makeItem('9999', { tags: ['Boots'] }))).toBe(true)
  })

  it('returns true for known boot IDs', () => {
    expect(isBootsItem(makeItem('1001'))).toBe(true)
    expect(isBootsItem(makeItem('3006'))).toBe(true)
    expect(isBootsItem(makeItem('3158'))).toBe(true)
  })

  it('returns true for items that build from boots', () => {
    expect(isBootsItem(makeItem('9999', { from: ['1001'] }))).toBe(true)
  })

  it('returns false for non-boot items', () => {
    expect(isBootsItem(makeItem('3031', { name: 'Infinity Edge' }))).toBe(false)
  })
})

describe('isStarterItem', () => {
  it('returns true for known starter IDs', () => {
    expect(isStarterItem(makeItem('1055', { name: "Doran's Blade" }))).toBe(true)
    expect(isStarterItem(makeItem('2003', { name: 'Health Potion' }))).toBe(true)
  })

  it('returns true for consumable items', () => {
    expect(isStarterItem(makeItem('9999', { name: 'Custom Pot', tags: ['Consumable'] }))).toBe(true)
  })

  it('returns true for name-pattern matches', () => {
    expect(isStarterItem(makeItem('9999', { name: 'Anneau de Doran' }))).toBe(true)
    expect(isStarterItem(makeItem('9999', { name: 'Potion de soin' }))).toBe(true)
  })

  it('returns false for atlas upgrades', () => {
    expect(isStarterItem(makeItem('3869', { name: 'Atlas Upgrade' }))).toBe(false)
    expect(isStarterItem(makeItem('3870', { name: 'Atlas Upgrade' }))).toBe(false)
  })

  it('returns false for regular items', () => {
    expect(isStarterItem(makeItem('3031', { name: 'Infinity Edge' }))).toBe(false)
  })
})
