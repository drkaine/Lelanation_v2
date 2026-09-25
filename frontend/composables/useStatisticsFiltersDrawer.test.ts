import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { useStatisticsFiltersDrawer } from './useStatisticsFiltersDrawer'
import { useStatisticsUiStore } from '~/stores/StatisticsUiStore'

vi.mock('./useSimplifiedStatsPreference', () => ({
  useSimplifiedStatsPreference: () => ({ simplifiedStatsEnabled: ref(false) }),
}))

const escape = { key: 'Escape' } as KeyboardEvent

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('useStatisticsFiltersDrawer', () => {
  it('opens, closes and toggles the filters through the UI store', () => {
    const drawer = useStatisticsFiltersDrawer()
    const store = useStatisticsUiStore()
    drawer.openFilters()
    expect(store.filtersOpen).toBe(true)
    drawer.toggleFiltersOpen()
    expect(store.filtersOpen).toBe(false)
    drawer.toggleFiltersOpen()
    drawer.closeFilters()
    expect(drawer.filtersOpen.value).toBe(false)
  })

  it('closes on Escape only in the mobile bottom sheet', () => {
    const drawer = useStatisticsFiltersDrawer()
    drawer.openFilters()
    drawer.onFiltersEscapeKey(escape)
    expect(drawer.filtersOpen.value).toBe(true)
    drawer.filtersSheetMode.value = true
    drawer.onFiltersEscapeKey({ key: 'Enter' } as KeyboardEvent)
    expect(drawer.filtersOpen.value).toBe(true)
    drawer.onFiltersEscapeKey(escape)
    expect(drawer.filtersOpen.value).toBe(false)
  })
})
