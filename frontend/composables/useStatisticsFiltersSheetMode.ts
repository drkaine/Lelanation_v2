import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSimplifiedStatsPreference } from './useSimplifiedStatsPreference'

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

  const showDesktopFiltersTrigger = computed(() => !simplifiedStatsEnabled.value)

  const filtersFabClass = computed(() =>
    effectiveFiltersSheetMode.value ? 'flex' : 'flex lg:hidden'
  )

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
    showDesktopFiltersTrigger,
    filtersFabClass,
  }
}
