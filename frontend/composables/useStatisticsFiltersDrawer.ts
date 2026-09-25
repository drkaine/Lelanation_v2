import { onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useStatisticsFiltersSheetMode } from '~/composables/useStatisticsFiltersSheetMode'
import { useStatisticsUiStore } from '~/stores/StatisticsUiStore'

/**
 * Open state of the statistics filters panel (shared UI store) and its drawer behaviour:
 * Escape closes the mobile bottom sheet, page scroll is locked while the sheet is open.
 */
export function useStatisticsFiltersDrawer() {
  const statisticsUiStore = useStatisticsUiStore()
  const { filtersOpen } = storeToRefs(statisticsUiStore)
  const sheet = useStatisticsFiltersSheetMode()

  function closeFilters(): void {
    statisticsUiStore.setFiltersOpen(false)
  }

  function openFilters(): void {
    statisticsUiStore.setFiltersOpen(true)
  }

  function toggleFiltersOpen(): void {
    if (filtersOpen.value) closeFilters()
    else openFilters()
  }

  function onFiltersEscapeKey(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !filtersOpen.value || !sheet.filtersSheetMode.value) return
    closeFilters()
  }

  watch([filtersOpen, sheet.lockPageScrollForFilters], () => {
    if (!import.meta.client) return
    const lock = sheet.lockPageScrollForFilters.value && filtersOpen.value
    document.body.style.overflow = lock ? 'hidden' : ''
  })

  onMounted(() => {
    if (import.meta.client) document.addEventListener('keydown', onFiltersEscapeKey)
  })

  onUnmounted(() => {
    if (!import.meta.client) return
    document.removeEventListener('keydown', onFiltersEscapeKey)
    document.body.style.overflow = ''
  })

  return {
    ...sheet,
    filtersOpen,
    closeFilters,
    openFilters,
    toggleFiltersOpen,
    onFiltersEscapeKey,
  }
}
