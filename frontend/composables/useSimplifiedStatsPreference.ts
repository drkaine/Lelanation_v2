import { computed, onMounted, watch } from 'vue'

const SIMPLIFIED_STATS_ENABLED_KEY = 'lelanation_simplified_stats_enabled'

export function useSimplifiedStatsPreference() {
  const simplifiedStatsEnabled = useState<boolean>('simplified-stats-enabled', () => false)
  const initialized = useState<boolean>('simplified-stats-enabled-initialized', () => false)

  const applyDocumentFlag = (enabled: boolean) => {
    if (!import.meta.client) return
    document.documentElement.dataset.statsCards = enabled ? '1' : '0'
  }

  if (import.meta.client) {
    onMounted(() => {
      if (initialized.value) {
        applyDocumentFlag(simplifiedStatsEnabled.value)
        return
      }
      initialized.value = true
      try {
        const saved = localStorage.getItem(SIMPLIFIED_STATS_ENABLED_KEY)
        simplifiedStatsEnabled.value = saved === '1'
      } catch {
        // ignore localStorage errors
      }
      applyDocumentFlag(simplifiedStatsEnabled.value)
    })
  }

  if (import.meta.client) {
    watch(
      simplifiedStatsEnabled,
      value => {
        applyDocumentFlag(value)
        try {
          localStorage.setItem(SIMPLIFIED_STATS_ENABLED_KEY, value ? '1' : '0')
        } catch {
          // ignore localStorage errors
        }
      },
      { flush: 'post' }
    )
  }

  const preferStatsCards = computed(() => simplifiedStatsEnabled.value)

  const setSimplifiedStatsEnabled = (value: boolean) => {
    simplifiedStatsEnabled.value = value
  }

  const toggleSimplifiedStatsEnabled = () => {
    simplifiedStatsEnabled.value = !simplifiedStatsEnabled.value
  }

  return {
    simplifiedStatsEnabled,
    preferStatsCards,
    setSimplifiedStatsEnabled,
    toggleSimplifiedStatsEnabled,
  }
}
