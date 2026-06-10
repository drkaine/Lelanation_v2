import { onMounted, watch } from 'vue'

const SPLIT_TRANSFORM_ENABLED_KEY = 'lelanation_stats_split_transform'

export function useStatisticsSplitTransformPreference() {
  const statsSplitTransformEnabled = useState<boolean>('stats-split-transform-enabled', () => false)
  const initialized = useState<boolean>('stats-split-transform-initialized', () => false)

  if (import.meta.client) {
    onMounted(() => {
      if (initialized.value) return
      initialized.value = true
      try {
        const saved = localStorage.getItem(SPLIT_TRANSFORM_ENABLED_KEY)
        statsSplitTransformEnabled.value = saved === '1'
      } catch {
        // ignore localStorage errors
      }
    })
  }

  if (import.meta.client) {
    watch(
      statsSplitTransformEnabled,
      value => {
        try {
          localStorage.setItem(SPLIT_TRANSFORM_ENABLED_KEY, value ? '1' : '0')
        } catch {
          // ignore localStorage errors
        }
      },
      { flush: 'post' }
    )
  }

  const setStatsSplitTransformEnabled = (value: boolean) => {
    statsSplitTransformEnabled.value = value
  }

  const toggleStatsSplitTransformEnabled = () => {
    statsSplitTransformEnabled.value = !statsSplitTransformEnabled.value
  }

  return {
    statsSplitTransformEnabled,
    setStatsSplitTransformEnabled,
    toggleStatsSplitTransformEnabled,
  }
}
