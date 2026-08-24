import { describe, expect, it } from 'vitest'
import type { Item } from '@lelanation/shared-types'
import {
  enrichItemShopCatalog,
  getItemShopIntoIds,
  isItemShopSyntheticItem,
  ITEM_SHOP_EVOLUTION_INTO,
} from '../itemShopEvolutions'
import { getItemShopImageUrl } from '../imageUrl'

const makeItem = (overrides: Partial<Item> & Pick<Item, 'id'>): Item =>
  ({
    name: overrides.id,
    tags: [],
    gold: { total: 1000, base: 1000, sell: 400, purchasable: true },
    image: { full: `${overrides.id}.png`, sprite: '', group: 'item', x: 0, y: 0, w: 48, h: 48 },
    ...overrides,
  }) as Item

describe('itemShopEvolutions', () => {
  it('merges stack transform into links', () => {
    expect(getItemShopIntoIds(makeItem({ id: '3003' }))).toEqual(['3040'])
    expect(getItemShopIntoIds(makeItem({ id: '3119' }))).toEqual(['3121'])
  })

  it('builds atlas quest chain', () => {
    expect(ITEM_SHOP_EVOLUTION_INTO['3865']).toEqual(['3866'])
    expect(ITEM_SHOP_EVOLUTION_INTO['3866']).toEqual(['3867'])
    expect(ITEM_SHOP_EVOLUTION_INTO['3867']).toEqual(['3869', '3870', '3871', '3876', '3877'])
  })

  it('adds synthetic evolution items to the shop catalog', () => {
    const catalog = enrichItemShopCatalog(
      [
        makeItem({ id: '3003', name: "Bâton de l'archange" }),
        makeItem({ id: '3119', name: "Approche de l'hiver" }),
        makeItem({
          id: '3865',
          name: 'Atlas',
          gold: { total: 400, base: 400, sell: 160, purchasable: true },
        }),
        makeItem({ id: '3869', name: 'Upgrade' }),
      ],
      'fr_FR'
    )

    const byId = new Map(catalog.map(item => [item.id, item]))
    expect(byId.get('3040')?.name).toBe('Étreinte du séraphin')
    expect(byId.get('3121')?.name).toBe('Fimbulvetr')
    expect(byId.get('3866')?.name).toBe('Boussole runique')
    expect(byId.get('3867')?.name).toBe('Trésor des mondes')
    expect(byId.get('3003')?.into).toEqual(['3040'])
    expect(byId.get('3865')?.into).toEqual(['3866'])
  })

  it('uses ddragon icons for synthetic evolution items', () => {
    expect(isItemShopSyntheticItem('3040')).toBe(true)
    expect(isItemShopSyntheticItem('3003')).toBe(false)

    const url = getItemShopImageUrl('16.16.1', makeItem({ id: '3040' }))
    expect(url).toContain('ddragon.leagueoflegends.com')
    expect(url).toContain('3040.png')

    const localUrl = getItemShopImageUrl('16.16.1', makeItem({ id: '3003' }))
    expect(localUrl).toContain('/images/game/latest/item/3003.png')
  })

  it('resolves build-into upgrades from enriched links', () => {
    const catalog = enrichItemShopCatalog(
      [
        makeItem({ id: '3865', name: 'Atlas' }),
        makeItem({ id: '3869', name: 'Opposition céleste' }),
        makeItem({ id: '3870', name: 'Rêve éveillé' }),
      ],
      'fr_FR'
    )
    const atlas = catalog.find(item => item.id === '3865')!
    const intoIds = getItemShopIntoIds(atlas)
    expect(intoIds[0]).toBe('3866')
    expect(catalog.some(item => item.id === '3866')).toBe(true)
  })
})
