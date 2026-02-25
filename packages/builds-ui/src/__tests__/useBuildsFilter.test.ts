import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useBuildsFilter } from '../composables/useBuildsFilter'
import type { Build } from '@lelanation/shared-types'

function makeBuild(overrides: Partial<Build> & { id: string }): Build {
  return {
    name: 'Build',
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

describe('useBuildsFilter', () => {
  const b1 = makeBuild({
    id: '1',
    name: 'Ahri Mid',
    author: 'Alice',
    champion: { id: 'Ahri', name: 'Ahri', key: '103', title: '', image: { full: 'Ahri.png', sprite: '', group: '', x: 0, y: 0, w: 0, h: 0 }, stats: {} as any, spells: [], passive: {} as any, tags: [] },
    roles: ['mid'],
    createdAt: '2026-01-02T00:00:00Z',
    gameVersion: '16.3.1',
  })
  const b2 = makeBuild({
    id: '2',
    name: 'Jinx ADC',
    author: 'Bob',
    champion: { id: 'Jinx', name: 'Jinx', key: '222', title: '', image: { full: 'Jinx.png', sprite: '', group: '', x: 0, y: 0, w: 0, h: 0 }, stats: {} as any, spells: [], passive: {} as any, tags: [] },
    roles: ['adc'],
    createdAt: '2026-01-01T00:00:00Z',
    gameVersion: '16.2.1',
  })
  const b3 = makeBuild({
    id: '3',
    name: 'Thresh Support',
    author: 'Charlie',
    champion: { id: 'Thresh', name: 'Thresh', key: '412', title: '', image: { full: 'Thresh.png', sprite: '', group: '', x: 0, y: 0, w: 0, h: 0 }, stats: {} as any, spells: [], passive: {} as any, tags: [] },
    roles: ['support'],
    createdAt: '2026-01-03T00:00:00Z',
    gameVersion: '16.3.1',
  })

  it('returns all builds when no filters', () => {
    const builds = ref([b1, b2, b3])
    const { filteredBuilds } = useBuildsFilter(builds)
    expect(filteredBuilds.value).toHaveLength(3)
  })

  it('filters by search query (champion name)', () => {
    const builds = ref([b1, b2, b3])
    const { filteredBuilds, searchQuery } = useBuildsFilter(builds)
    searchQuery.value = 'ahri'
    expect(filteredBuilds.value).toHaveLength(1)
    expect(filteredBuilds.value[0].id).toBe('1')
  })

  it('filters by search query (author)', () => {
    const builds = ref([b1, b2, b3])
    const { filteredBuilds, searchQuery } = useBuildsFilter(builds)
    searchQuery.value = 'bob'
    expect(filteredBuilds.value).toHaveLength(1)
    expect(filteredBuilds.value[0].id).toBe('2')
  })

  it('filters by role', () => {
    const builds = ref([b1, b2, b3])
    const { filteredBuilds, selectedRole } = useBuildsFilter(builds)
    selectedRole.value = 'support'
    expect(filteredBuilds.value).toHaveLength(1)
    expect(filteredBuilds.value[0].id).toBe('3')
  })

  it('filters by champion ID', () => {
    const builds = ref([b1, b2, b3])
    const { filteredBuilds, selectedChampion } = useBuildsFilter(builds)
    selectedChampion.value = 'Jinx'
    expect(filteredBuilds.value).toHaveLength(1)
    expect(filteredBuilds.value[0].id).toBe('2')
  })

  it('filters by up-to-date version', () => {
    const builds = ref([b1, b2, b3])
    const currentVersion = ref<string | null>('16.3.1')
    const { filteredBuilds, onlyUpToDate } = useBuildsFilter(builds, { currentVersion })
    onlyUpToDate.value = true
    expect(filteredBuilds.value).toHaveLength(2)
    expect(filteredBuilds.value.map(b => b.id).sort()).toEqual(['1', '3'])
  })

  it('sorts by most recent', () => {
    const builds = ref([b1, b2, b3])
    const { filteredBuilds, sortBy } = useBuildsFilter(builds)
    sortBy.value = 'recent'
    expect(filteredBuilds.value.map(b => b.id)).toEqual(['3', '1', '2'])
  })

  it('sorts by name (champion name)', () => {
    const builds = ref([b1, b2, b3])
    const { filteredBuilds, sortBy } = useBuildsFilter(builds)
    sortBy.value = 'name'
    expect(filteredBuilds.value.map(b => b.champion?.name)).toEqual(['Ahri', 'Jinx', 'Thresh'])
  })

  it('sorts by popular using vote provider', () => {
    const builds = ref([b1, b2, b3])
    const voteProvider = {
      getVoteCount: (id: string) => (id === '2' ? 10 : id === '3' ? 5 : 1),
    }
    const { filteredBuilds, sortBy } = useBuildsFilter(builds, { voteProvider })
    sortBy.value = 'popular'
    expect(filteredBuilds.value.map(b => b.id)).toEqual(['2', '3', '1'])
  })

  it('hasActiveFilters is true when filters are set', () => {
    const builds = ref([b1, b2, b3])
    const { hasActiveFilters, searchQuery } = useBuildsFilter(builds)
    expect(hasActiveFilters.value).toBe(false)
    searchQuery.value = 'test'
    expect(hasActiveFilters.value).toBe(true)
  })

  it('clearFilters resets all filters', () => {
    const builds = ref([b1, b2, b3])
    const { hasActiveFilters, searchQuery, selectedRole, clearFilters } = useBuildsFilter(builds)
    searchQuery.value = 'test'
    selectedRole.value = 'mid'
    expect(hasActiveFilters.value).toBe(true)
    clearFilters()
    expect(hasActiveFilters.value).toBe(false)
    expect(searchQuery.value).toBe('')
    expect(selectedRole.value).toBeNull()
  })
})
