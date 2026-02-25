import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useBuildsCore } from '../composables/useBuildsCore'
import type { Build, Champion, Item } from '@lelanation/shared-types'

function makeBuild(overrides: Partial<Build> = {}): Build {
  return {
    id: 'test-1',
    name: 'Test Build',
    champion: null,
    items: [],
    runes: null,
    shards: null,
    summonerSpells: [null, null],
    skillOrder: null,
    roles: [],
    upvote: 0,
    downvote: 0,
    gameVersion: '16.3.1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

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

function makeChampion(): Champion {
  return {
    id: 'Ahri',
    key: '103',
    name: 'Ahri',
    title: 'the Nine-Tailed Fox',
    image: { full: 'Ahri.png', sprite: '', group: '', x: 0, y: 0, w: 0, h: 0 },
    stats: {} as Champion['stats'],
    spells: [
      { id: 'Q', name: 'Orb of Deception', image: { full: 'AhriQ.png' } } as any,
      { id: 'W', name: 'Fox-Fire', image: { full: 'AhriW.png' } } as any,
      { id: 'E', name: 'Charm', image: { full: 'AhriE.png' } } as any,
      { id: 'R', name: 'Spirit Rush', image: { full: 'AhriR.png' } } as any,
    ],
    passive: { name: 'Essence Theft', description: '', image: { full: '', sprite: '', group: '', x: 0, y: 0, w: 0, h: 0 } },
    tags: ['Mage', 'Assassin'],
  }
}

describe('useBuildsCore', () => {
  it('returns empty computed values for null build', () => {
    const build = ref<Build | null>(null)
    const core = useBuildsCore(build)

    expect(core.buildItems.value).toEqual([])
    expect(core.selectedChampion.value).toBeNull()
    expect(core.startingItems.value).toEqual([])
    expect(core.bootsItems.value).toEqual([])
    expect(core.coreItems.value).toEqual([])
    expect(core.keystoneRuneId.value).toBeNull()
    expect(core.primaryRunesRow.value).toEqual([])
    expect(core.secondaryRuneIds.value).toEqual([])
    expect(core.shardIds.value).toEqual([])
    expect(core.selectedRoles.value).toEqual([])
    expect(core.summonerSpells.value).toEqual([])
  })

  it('classifies boots items correctly', () => {
    const boots = makeItem('3006', { tags: ['Boots'], name: 'Berserker Greaves' })
    const sword = makeItem('3031', { name: 'Infinity Edge' })

    const build = ref<Build | null>(makeBuild({ items: [boots, sword] }))
    const core = useBuildsCore(build)

    expect(core.bootsItems.value).toHaveLength(1)
    expect(core.bootsItems.value[0].id).toBe('3006')
  })

  it('classifies starter items correctly', () => {
    const doranBlade = makeItem('1055', { name: "Doran's Blade" })
    const potion = makeItem('2003', { name: 'Health Potion', tags: ['Consumable'] })
    const ie = makeItem('3031', { name: 'Infinity Edge' })

    const build = ref<Build | null>(makeBuild({ items: [doranBlade, potion, ie] }))
    const core = useBuildsCore(build)

    expect(core.startingItems.value).toHaveLength(2)
    expect(core.startingItems.value.map(i => i.id)).toEqual(['1055', '2003'])
  })

  it('splits core items into two paths', () => {
    const items: Item[] = [
      makeItem('3031', { name: 'IE' }),
      makeItem('3032', { name: 'Item2' }),
      makeItem('3033', { name: 'Item3' }),
      makeItem('3034', { name: 'Item4' }),
      makeItem('3035', { name: 'Item5' }),
      makeItem('3036', { name: 'Item6' }),
    ]

    const build = ref<Build | null>(makeBuild({ items }))
    const core = useBuildsCore(build)

    expect(core.coreItemsPath1.value).toHaveLength(3)
    expect(core.coreItemsPath2.value).toHaveLength(3)
    expect(core.coreItemsPath1.value.map(i => i.id)).toEqual(['3031', '3032', '3033'])
    expect(core.coreItemsPath2.value.map(i => i.id)).toEqual(['3034', '3035', '3036'])
  })

  it('computes firstThreeUps abilities', () => {
    const champion = makeChampion()
    const build = ref<Build | null>(makeBuild({
      champion,
      skillOrder: {
        firstThreeUps: ['Q', 'W', 'Q'],
        skillUpOrder: ['Q', 'W', 'E'],
      },
    }))
    const core = useBuildsCore(build)

    expect(core.firstThreeUpsAbilities.value).toHaveLength(3)
    expect(core.firstThreeUpsAbilities.value[0].key).toBe('Q')
    expect(core.firstThreeUpsAbilities.value[1].key).toBe('W')
    expect(core.firstThreeUpsAbilities.value[2].key).toBe('Q')
  })

  it('computes skillOrderAbilities', () => {
    const champion = makeChampion()
    const build = ref<Build | null>(makeBuild({
      champion,
      skillOrder: {
        firstThreeUps: ['Q', 'W', 'E'],
        skillUpOrder: ['E', 'Q', 'W'],
      },
    }))
    const core = useBuildsCore(build)

    expect(core.skillOrderAbilities.value).toHaveLength(3)
    expect(core.skillOrderAbilities.value.map(a => a.key)).toEqual(['E', 'Q', 'W'])
  })

  it('extracts rune data correctly', () => {
    const build = ref<Build | null>(makeBuild({
      runes: {
        primary: { pathId: 8100, keystone: 8112, slot1: 8126, slot2: 8138, slot3: 8135 },
        secondary: { pathId: 8200, slot1: 8226, slot2: 8233 },
      },
      shards: { slot1: 5008, slot2: 5002, slot3: 5001 },
    }))
    const core = useBuildsCore(build)

    expect(core.keystoneRuneId.value).toBe(8112)
    expect(core.primaryRunesRow.value).toEqual([8126, 8138, 8135])
    expect(core.secondaryRuneIds.value).toEqual([8226, 8233])
    expect(core.shardIds.value).toEqual([5008, 5002, 5001])
  })

  it('extracts roles', () => {
    const build = ref<Build | null>(makeBuild({ roles: ['mid', 'support'] }))
    const core = useBuildsCore(build)
    expect(core.selectedRoles.value).toEqual(['mid', 'support'])
  })
})
