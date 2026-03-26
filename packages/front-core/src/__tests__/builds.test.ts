import { describe, expect, it } from 'vitest'
import { filterAndSortBuilds } from '../builds'
import type { Build } from '@lelanation/shared-types'

const build = (overrides: Partial<Build>): Build =>
  ({
    id: '1',
    name: 'Test Build',
    champion: { id: 'Aatrox', key: '266', name: 'Aatrox', title: '', image: { full: '', sprite: '', group: '', x: 0, y: 0, w: 0, h: 0 }, stats: {} as any, spells: [], passive: { name: '', description: '', image: { full: '', sprite: '', group: '', x: 0, y: 0, w: 0, h: 0 } }, tags: [] },
    items: [],
    runes: null,
    shards: null,
    summonerSpells: [null, null],
    skillOrder: null,
    roles: ['top'],
    upvote: 0,
    downvote: 0,
    gameVersion: '15.6',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) as Build

describe('filterAndSortBuilds', () => {
  it('filters by query and role', () => {
    const source = [
      build({ id: '1', name: 'Aatrox Top', roles: ['top'] }),
      build({ id: '2', name: 'Jungle Path', roles: ['jungle'] }),
    ]
    const result = filterAndSortBuilds(source, {
      searchQuery: 'aat',
      selectedChampion: null,
      selectedRole: 'top',
      selectedVersion: null,
      sortBy: 'recent',
    })
    expect(result.map(b => b.id)).toEqual(['1'])
  })
})
