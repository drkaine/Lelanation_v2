import { describe, expect, it } from 'vitest'
import type { Item } from '@lelanation/shared-types'
import { buildItemRecipeTreeFromCatalog } from '../itemRecipeTree'

const makeItem = (overrides: Partial<Item> & Pick<Item, 'id'>): Item =>
  ({
    name: overrides.id,
    tags: [],
    gold: { total: 1000 },
    image: { full: `${overrides.id}.png` },
    ...overrides,
  }) as Item

describe('itemRecipeTree', () => {
  it('builds a 3-tier tree for composite items', () => {
    const catalog = [
      makeItem({ id: '2510', from: ['3057', '1026', '3067', '1042'] }),
      makeItem({ id: '3057', from: ['2022'] }),
      makeItem({ id: '2022' }),
      makeItem({ id: '1026' }),
      makeItem({ id: '3067', from: ['1028', '2022'] }),
      makeItem({ id: '1028' }),
      makeItem({ id: '1042' }),
    ]

    const tree = buildItemRecipeTreeFromCatalog(catalog[0]!, catalog)
    expect(tree.item.id).toBe('2510')
    expect(tree.children.map(node => node.item.id)).toEqual(['3057', '1026', '3067', '1042'])
    expect(tree.children[0]?.children.map(node => node.item.id)).toEqual(['2022'])
    expect(tree.children[2]?.children.map(node => node.item.id)).toEqual(['1028', '2022'])
    expect(tree.children[1]?.children).toEqual([])
  })
})
