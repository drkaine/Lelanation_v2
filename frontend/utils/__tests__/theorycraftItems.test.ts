import { describe, expect, it } from 'vitest'
import type { Item } from '@lelanation/shared-types'
import { mergeItemWithCatalog, resolveBuildItemsWithCatalog } from '../theorycraftItems'

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

  it('resolveBuildItemsWithCatalog resolves each item', () => {
    const refs = [{ id: '3041', name: '3041' } as Item]
    const resolved = resolveBuildItemsWithCatalog(refs, id =>
      id === '3041' ? catalogMejai : undefined
    )
    expect(resolved[0]?.stats?.FlatMagicDamageMod).toBe(20)
  })
})
