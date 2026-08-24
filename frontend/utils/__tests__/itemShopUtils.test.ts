import { describe, expect, it, vi } from 'vitest'
import type { Item } from '@lelanation/shared-types'

import {
  filterShopItems,
  getCategoryDisplayOrder,
  getItemShopCategory,
  itemHasTag,
  itemMatchesRole,
  resolveShopItemsByIds,
  sortShopItemsByCategoryMode,
} from '../itemShopUtils'

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
})
