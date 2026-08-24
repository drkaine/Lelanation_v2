import { describe, expect, it, vi } from 'vitest'
import type { Item } from '@lelanation/shared-types'

import {
  filterShopItems,
  getCategoryDisplayOrder,
  getItemShopCategory,
  groupItemsByCategory,
  itemHasTag,
  itemMatchesRole,
  resolveShopItemsByIds,
  sortShopItemsByCategoryMode,
} from '../itemShopUtils'
import { enrichItemShopCatalog } from '../itemShopEvolutions'

vi.mock('../multilingualEntitySearch', () => ({
  matchesItemSearch: (query: string, item: { name?: string }) =>
    (item.name ?? '').toLowerCase().includes(query.toLowerCase()),
}))

const makeItem = (overrides: Partial<Item> & Pick<Item, 'id'>): Item =>
  ({
    name: overrides.id,
    tags: [],
    gold: { total: 1000 },
    image: { full: `${overrides.id}.png` },
    ...overrides,
  }) as Item

describe('itemShopUtils', () => {
  it('classifies boots and legendary items', () => {
    expect(getItemShopCategory(makeItem({ id: '1001', tags: ['Boots'] }))).toBe('boots')
    expect(getItemShopCategory(makeItem({ id: '3031', from: ['1038', '1037'], into: [] }))).toBe(
      'legendary'
    )
    expect(getItemShopCategory(makeItem({ id: '1038', from: ['1036'], into: ['3031'] }))).toBe(
      'epic'
    )
  })

  it('matches tags with aliases', () => {
    const item = makeItem({ id: '3089', tags: ['SpellDamage'] })
    expect(itemHasTag(item, 'AbilityPower')).toBe(true)
  })

  it('filters by role and selected tags', () => {
    const items = [
      makeItem({ id: '1', tags: ['Damage', 'CriticalStrike'] }),
      makeItem({ id: '2', tags: ['AbilityPower', 'Mana'] }),
      makeItem({ id: '3', tags: ['Health', 'Armor'] }),
    ]

    expect(itemMatchesRole(items[0]!, 'marksman')).toBe(true)
    expect(itemMatchesRole(items[1]!, 'marksman')).toBe(false)

    const filtered = filterShopItems({
      items,
      role: 'mage',
      selectedTags: ['Mana'],
    })
    expect(filtered.map(item => item.id)).toEqual(['2'])
  })

  it('resolves build components by id', () => {
    const items = [
      makeItem({ id: '1036' }),
      makeItem({ id: '1038' }),
      makeItem({ id: '3031', from: ['1038', '1037'] }),
    ]
    expect(resolveShopItemsByIds(items, ['1038', '9999']).map(item => item.id)).toEqual(['1038'])
  })

  it('orders categories with legendaries first by default mode', () => {
    expect(getCategoryDisplayOrder('legendary-first')[0]).toBe('legendary')
    expect(getCategoryDisplayOrder('classic')[0]).toBe('starter')
  })

  it('sorts items by category mode for transforms', () => {
    const legendary = makeItem({
      id: '3031',
      from: ['1038', '1037'],
      into: [],
      gold: { total: 3400 },
    })
    const epic = makeItem({ id: '1038', from: ['1036'], into: ['3031'], gold: { total: 1300 } })

    expect(
      sortShopItemsByCategoryMode([epic, legendary], 'legendary-first').map(item => item.id)
    ).toEqual(['3031', '1038'])
    expect(sortShopItemsByCategoryMode([epic, legendary], 'classic').map(item => item.id)).toEqual([
      '1038',
      '3031',
    ])
  })

  it('classifies stack transform bases as epic even without ddragon into', () => {
    const archangel = makeItem({ id: '3003', from: ['1027', '3024'] })
    const manamune = makeItem({ id: '3004', from: ['1036', '3070'] })
    const wintersApproach = makeItem({ id: '3119', from: ['3024', '1028'] })

    expect(getItemShopCategory(archangel)).toBe('epic')
    expect(getItemShopCategory(manamune)).toBe('epic')
    expect(getItemShopCategory(wintersApproach)).toBe('epic')
  })

  it('classifies synthetic shop evolutions in epic and legendary sections', () => {
    const catalog = enrichItemShopCatalog(
      [
        makeItem({ id: '3003', name: "Bâton de l'archange", from: ['1026', '1027'] }),
        makeItem({ id: '3004', name: 'Muramana', from: ['1026', '1033'] }),
        makeItem({ id: '3119', name: "Approche de l'hiver", from: ['3024', '1028'] }),
        makeItem({ id: '2526', name: 'Diadème des murmures', from: ['3108', '3113'] }),
        makeItem({
          id: '3865',
          name: 'Atlas',
          gold: { total: 400, base: 400, sell: 160, purchasable: true },
        }),
        makeItem({ id: '3869', name: 'Opposition céleste', from: ['3867'] }),
      ],
      'fr_FR'
    )

    const grouped = groupItemsByCategory(catalog)

    expect(getItemShopCategory(catalog.find(item => item.id === '3865')!)).toBe('starter')
    expect(grouped.epic.map(item => item.id)).toEqual(
      expect.arrayContaining(['3866', '3867', '3003', '3004', '3119'])
    )
    expect(grouped.legendary.map(item => item.id)).toEqual(
      expect.arrayContaining(['3040', '3042', '3121', '2530'])
    )
    expect(grouped.basic.map(item => item.id)).not.toEqual(
      expect.arrayContaining(['3040', '3042', '3121', '2530', '3866', '3867'])
    )
  })
})
