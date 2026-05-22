import { describe, expect, it } from 'vitest'
import type { Item } from '@lelanation/shared-types'
import {
  countActiveNonStarterItems,
  isWithinActiveItemLimit,
  mergeItemWithCatalog,
  resolveBuildItemsWithCatalog,
} from '../theorycraftItems'

const catalogMejai = {
  id: '3041',
  name: "Mejai's Soulstealer",
  stats: { FlatMagicDamageMod: 20, FlatHPPoolMod: 100 },
  image: { full: '3041.png' },
} as Item

describe('theorycraftItems', () => {
  it('mergeItemWithCatalog fills missing stats from catalog', () => {
    const ref = { id: '3041', name: '3041', image: { full: '3041.png' } } as Item
    const merged = mergeItemWithCatalog(ref, catalogMejai)
    expect(merged.stats).toEqual(catalogMejai.stats)
    expect(merged.name).toBe("Mejai's Soulstealer")
  })

  it('starters do not count toward the 6 active item limit', () => {
    const doran = { id: '1055', tags: ['Starter'] } as Item
    const core = (id: string) => ({ id, tags: ['Damage'] }) as Item
    const items = [doran, ...Array.from({ length: 6 }, (_, i) => core(`core-${i}`))]
    const disabled = new Set<number>()
    expect(countActiveNonStarterItems(items, disabled).total).toBe(6)
    expect(isWithinActiveItemLimit(items, disabled, ['top'])).toBe(true)
    expect(isWithinActiveItemLimit(items, disabled, ['adc'])).toBe(true)
  })

  it('boots count toward the 6 active slots for non-ADC roles', () => {
    const boot = { id: '1001', tags: ['Boots'] } as Item
    const core = (id: string) => ({ id, tags: ['Damage'] }) as Item
    const items = [boot, ...Array.from({ length: 6 }, (_, i) => core(`core-${i}`))]
    const disabled = new Set<number>()
    expect(countActiveNonStarterItems(items, disabled).total).toBe(7)
    expect(isWithinActiveItemLimit(items, disabled, ['top'])).toBe(false)
  })

  it('enabling a starter does not hit the 6-item limit when 6 core items are active', () => {
    const doran = { id: '1055', tags: ['Starter'] } as Item
    const core = (id: string) => ({ id, tags: ['Damage'] }) as Item
    const items = [doran, ...Array.from({ length: 6 }, (_, i) => core(`core-${i}`))]
    const disabled = new Set([0])
    expect(isWithinActiveItemLimit(items, disabled, ['top'])).toBe(true)
  })

  it('resolveBuildItemsWithCatalog resolves each item', () => {
    const refs = [{ id: '3041', name: '3041' } as Item]
    const resolved = resolveBuildItemsWithCatalog(refs, id =>
      id === '3041' ? catalogMejai : undefined
    )
    expect(resolved[0]?.stats?.FlatMagicDamageMod).toBe(20)
  })
})
