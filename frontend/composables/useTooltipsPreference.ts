import { computed, onMounted, watch } from 'vue'
import { useStreamerMode } from '~/composables/useStreamerMode'

const TOOLTIPS_DISABLED_KEY = 'lelanation_tooltips_disabled'

export function useTooltipsPreference() {
  const tooltipsDisabled = useState<boolean>('tooltips-disabled', () => false)
  const initialized = useState<boolean>('tooltips-disabled-initialized', () => false)

  const { isStreamerMode } = useStreamerMode()

  // IMPORTANT: do not read localStorage before hydration, or SSR/CSR can diverge.
  if (import.meta.client) {
    onMounted(() => {
      if (initialized.value) return
      initialized.value = true
      try {
        const saved = localStorage.getItem(TOOLTIPS_DISABLED_KEY)
        tooltipsDisabled.value = saved === '1'
      } catch {
        // ignore
      }
    })
  }

  if (import.meta.client) {
    watch(
      tooltipsDisabled,
      value => {
        try {
          localStorage.setItem(TOOLTIPS_DISABLED_KEY, value ? '1' : '0')
        } catch {
          // ignore
        }
      },
      { flush: 'post' }
    )
  }

  // In streamer mode, tooltips are always disabled
  const tooltipsEnabled = computed(() => !tooltipsDisabled.value && !isStreamerMode.value)

  const setTooltipsDisabled = (value: boolean) => {
    tooltipsDisabled.value = value
  }

  const toggleTooltipsDisabled = () => {
    tooltipsDisabled.value = !tooltipsDisabled.value
  }

  return {
    tooltipsDisabled,
    tooltipsEnabled,
    setTooltipsDisabled,
    toggleTooltipsDisabled,
  }
}
