import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import {
  statisticsFiltersSheetPanelClass,
  useStatisticsFiltersSheetMode,
} from './useStatisticsFiltersSheetMode'

const simplified = ref(false)
vi.mock('./useSimplifiedStatsPreference', () => ({
  useSimplifiedStatsPreference: () => ({ simplifiedStatsEnabled: simplified }),
}))

beforeEach(() => {
  simplified.value = false
})

describe('statisticsFiltersSheetPanelClass', () => {
  it('keeps the full-width bottom sheet below lg', () => {
    const cls = statisticsFiltersSheetPanelClass()
    expect(cls).toContain('inset-x-0')
    expect(cls).toContain('max-h-[85vh]')
  })

  it('shrinks to a compact floating panel on desktop (stats simplifiées)', () => {
    const cls = statisticsFiltersSheetPanelClass()
    expect(cls).toContain('lg:w-80')
    expect(cls).toContain('lg:inset-x-auto')
    expect(cls).toContain('lg:max-h-[70vh]')
  })
})

describe('useStatisticsFiltersSheetMode', () => {
  it('shows the close footer in every sheet mode, desktop simplified included', () => {
    const sheet = useStatisticsFiltersSheetMode()
    expect(sheet.showFiltersCloseFooter.value).toBe(false)
    simplified.value = true
    expect(sheet.showFiltersCloseFooter.value).toBe(true)
    simplified.value = false
    sheet.filtersSheetMode.value = true
    expect(sheet.showFiltersCloseFooter.value).toBe(true)
  })
})
