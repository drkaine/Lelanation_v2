import { describe, it, expect } from 'vitest'
import { serializeBuild, hydrateBuild, isStoredBuild } from '../utils/serialize'
import type { Build, Champion, Item, SummonerSpell } from '@lelanation/shared-types'

const fakeChampion: Champion = {
  id: 'Ahri', key: '103', name: 'Ahri', title: '',
  image: { full: 'Ahri.png', sprite: '', group: '', x: 0, y: 0, w: 0, h: 0 },
  stats: {} as Champion['stats'],
  spells: [], passive: { name: '', description: '', image: { full: '', sprite: '', group: '', x: 0, y: 0, w: 0, h: 0 } },
  tags: [],
}

const fakeItem: Item = {
  id: '3031', name: 'IE', description: '', colloq: '', plaintext: '',
  image: { full: '3031.png', sprite: '', group: '', x: 0, y: 0, w: 0, h: 0 },
  gold: { base: 0, total: 3400, sell: 2380, purchasable: true },
  tags: [], depth: 3,
}

const fakeSpell: SummonerSpell = {
  id: 'SummonerFlash', key: '4', name: 'Flash', description: '', tooltip: '',
  maxrank: 1, cooldown: [300], cooldownBurn: '300', cost: [0], costBurn: '0',
  datavalues: {}, effect: [], effectBurn: [], vars: [], summonerLevel: 7,
  modes: [], costType: '', maxammo: '', range: [0], rangeBurn: '0',
  image: { full: 'SummonerFlash.png', sprite: '', group: '', x: 0, y: 0, w: 0, h: 0 },
  resource: '',
}

const fullBuild: Build = {
  id: 'b1', name: 'My Build', author: 'Test',
  champion: fakeChampion,
  items: [fakeItem],
  runes: null, shards: null,
  summonerSpells: [fakeSpell, null],
  skillOrder: null, roles: ['mid'],
  upvote: 5, downvote: 1,
  gameVersion: '16.3.1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('serializeBuild', () => {
  it('strips full data from items and champion', () => {
    const stored = serializeBuild(fullBuild)
    expect(stored.id).toBe('b1')
    expect(stored.champion?.id).toBe('Ahri')
    expect(stored.items[0]).not.toHaveProperty('gold')
    expect(stored.items[0].id).toBe('3031')
    expect(stored.summonerSpells[0]?.id).toBe('SummonerFlash')
    expect(stored.summonerSpells[1]).toBeNull()
  })
})

describe('hydrateBuild', () => {
  it('restores full data using catalogs', () => {
    const stored = serializeBuild(fullBuild)
    const hydrated = hydrateBuild(stored, {
      champions: [fakeChampion],
      items: [fakeItem],
      getSpellById: (id: string) => id === 'SummonerFlash' ? fakeSpell : undefined,
    })
    expect(hydrated.champion?.name).toBe('Ahri')
    expect(hydrated.items[0].gold.total).toBe(3400)
    expect(hydrated.summonerSpells[0]?.name).toBe('Flash')
  })

  it('creates fallback when catalog is missing', () => {
    const stored = serializeBuild(fullBuild)
    const hydrated = hydrateBuild(stored, {
      champions: [],
      items: [],
      getSpellById: () => undefined,
    })
    expect(hydrated.champion?.id).toBe('Ahri')
    expect(hydrated.items[0].id).toBe('3031')
    expect(hydrated.summonerSpells[0]?.id).toBe('SummonerFlash')
  })
})

describe('isStoredBuild', () => {
  it('detects stored builds (no gold property)', () => {
    const stored = serializeBuild(fullBuild)
    expect(isStoredBuild(stored)).toBe(true)
  })

  it('rejects full builds (has gold property)', () => {
    expect(isStoredBuild(fullBuild)).toBe(false)
  })

  it('rejects non-objects', () => {
    expect(isStoredBuild(null)).toBe(false)
    expect(isStoredBuild('string')).toBe(false)
    expect(isStoredBuild(42)).toBe(false)
  })
})
