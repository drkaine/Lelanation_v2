import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { useChampionGridFilter } from './useChampionGridFilter'
import { useChampionsStore } from '~/stores/ChampionsStore'
import type { Champion } from '~/types/build'

const locale = ref('fr')
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ locale, t: (key: string, fallback?: string) => fallback ?? key }),
}))

function champ(id: string, tags: string[]): Champion {
  return { id, key: id, name: id, tags, image: { full: `${id}.png` } } as unknown as Champion
}

beforeEach(() => {
  setActivePinia(createPinia())
  const store = useChampionsStore()
  store.champions = [champ('Ahri', ['Mage', 'Assassin']), champ('Garen', ['Fighter', 'Tank'])]
  vi.spyOn(store, 'loadChampions').mockResolvedValue(undefined)
})

describe('useChampionGridFilter', () => {
  it('lists the sorted roles of all champions', () => {
    const grid = useChampionGridFilter()
    expect(grid.availableRoles.value).toEqual(['Assassin', 'Fighter', 'Mage', 'Tank'])
  })

  it('keeps every champion visible until a filter is set', () => {
    const grid = useChampionGridFilter()
    expect(grid.isFiltered(champ('Garen', []))).toBe(true)
    grid.toggleRole('Mage')
    expect(grid.filteredChampions.value.map(c => c.id)).toEqual(['Ahri'])
    expect(grid.isFiltered(champ('Garen', []))).toBe(false)
    grid.toggleRole('Mage')
    expect(grid.selectedRoles.value).toEqual([])
  })

  it('searches by name', () => {
    const grid = useChampionGridFilter()
    grid.searchQuery.value = 'gar'
    expect(grid.filteredChampions.value.map(c => c.id)).toEqual(['Garen'])
  })

  it('maps the locale to the Riot language and translates roles', () => {
    const grid = useChampionGridFilter()
    expect(grid.currentLanguage.value).toBe('fr_FR')
    expect(grid.translateRole('Mage')).toBe('Mage')
  })
})
