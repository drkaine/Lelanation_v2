import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Build } from '@lelanation/shared-types'
import { useBuildDiscoveryStore } from './BuildDiscoveryStore'

function builds(): Build[] {
  return JSON.parse(
    JSON.stringify([
      { id: 'a', name: 'Alpha', author: 'x', createdAt: '2026-01-02', updatedAt: '2026-01-02' },
      { id: 'b', name: 'Beta', author: 'y', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    ])
  )
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('BuildDiscoveryStore : pas de copie des builds dans le state (payload SSR)', () => {
  it('le state ne contient pas filteredBuilds', () => {
    const store = useBuildDiscoveryStore()
    store.builds = builds()
    store.applyFilters()
    expect(Object.keys(store.$state)).not.toContain('filteredBuilds')
  })

  it('filteredBuilds suit la recherche sans appel explicite', () => {
    const store = useBuildDiscoveryStore()
    store.builds = builds()
    expect(store.filteredBuilds.map(b => b.id).sort()).toEqual(['a', 'b'])
    store.searchQuery = 'beta'
    expect(store.filteredBuilds.map(b => b.id)).toEqual(['b'])
    expect(store.totalFilteredCount).toBe(1)
  })

  it('applyFilters remet la page à 1', () => {
    const store = useBuildDiscoveryStore()
    store.builds = builds()
    store.currentPage = 3
    store.applyFilters()
    expect(store.currentPage).toBe(1)
  })
})
