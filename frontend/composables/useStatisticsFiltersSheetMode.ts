import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSimplifiedStatsPreference } from './useSimplifiedStatsPreference'

/**
 * Classes of the filters sheet: full-width bottom sheet below lg ; on desktop (stats simplifiées)
 * a compact floating panel so it does not cover the page.
 */
export function statisticsFiltersSheetPanelClass(): string {
  return [
    'statistics-filters-sheet fixed inset-x-0 bottom-0 top-auto z-[10051] max-h-[85vh] w-full rounded-t-2xl bg-surface shadow-lg',
    'lg:inset-x-auto lg:bottom-16 lg:left-4 lg:max-h-[70vh] lg:w-80 lg:rounded-2xl lg:border lg:border-primary/30',
  ].join(' ')
}

export function useStatisticsFiltersSheetMode() {
  const filtersSheetMode = ref(false)
  let filtersSheetMq: MediaQueryList | null = null
  const onFiltersSheetMqChange = () => {
    filtersSheetMode.value = filtersSheetMq?.matches ?? false
  }

  const { simplifiedStatsEnabled } = useSimplifiedStatsPreference()

  /** Bottom sheet on mobile, or on desktop when stats simplifiées (cartes) are active. */
  const effectiveFiltersSheetMode = computed(
    () => filtersSheetMode.value || simplifiedStatsEnabled.value
  )

  /** Explicit « Fermer » button: needed whenever the panel is a sheet (desktop simplified too). */
  const showFiltersCloseFooter = computed(() => effectiveFiltersSheetMode.value)

  const showDesktopFiltersTrigger = computed(() => !simplifiedStatsEnabled.value)

  const filtersFabClass = computed(() =>
    effectiveFiltersSheetMode.value ? 'flex' : 'flex lg:hidden'
  )

  /** Dimmed backdrop only on mobile — desktop sheet modes must not block tabs/nav clicks. */
  const showFiltersBackdrop = computed(() => filtersSheetMode.value)

  /** Body scroll lock only for the mobile bottom sheet. */
  const lockPageScrollForFilters = computed(() => filtersSheetMode.value)

  onMounted(() => {
    if (!import.meta.client) return
    filtersSheetMq = window.matchMedia('(max-width: 1023px)')
    onFiltersSheetMqChange()
    filtersSheetMq.addEventListener('change', onFiltersSheetMqChange)
  })

  onUnmounted(() => {
    filtersSheetMq?.removeEventListener('change', onFiltersSheetMqChange)
  })

  return {
    filtersSheetMode,
    effectiveFiltersSheetMode,
    showFiltersBackdrop,
    lockPageScrollForFilters,
    showDesktopFiltersTrigger,
    showFiltersCloseFooter,
    filtersFabClass,
  }
}
