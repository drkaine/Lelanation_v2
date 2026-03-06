import { onMounted, watch } from 'vue'

const STREAMER_MODE_STORAGE_KEY = 'lelanation_streamer_mode'

export function useStreamerMode() {
  const isStreamerMode = useState<boolean>('streamer-mode', () => false)
  const initialized = useState<boolean>('streamer-mode-initialized', () => false)

  // IMPORTANT: do not read localStorage before hydration, or SSR/CSR can diverge.
  if (import.meta.client) {
    onMounted(() => {
      if (initialized.value) return
      initialized.value = true
      try {
        const saved = localStorage.getItem(STREAMER_MODE_STORAGE_KEY)
        isStreamerMode.value = saved === '1'
      } catch {
        // ignore
      }
    })
  }

  if (import.meta.client) {
    watch(
      isStreamerMode,
      value => {
        try {
          localStorage.setItem(STREAMER_MODE_STORAGE_KEY, value ? '1' : '0')
        } catch {
          // ignore
        }
      },
      { flush: 'post' }
    )
  }

  const setStreamerMode = (enabled: boolean) => {
    isStreamerMode.value = enabled
  }

  const toggleStreamerMode = () => {
    isStreamerMode.value = !isStreamerMode.value
  }

  return {
    isStreamerMode,
    setStreamerMode,
    toggleStreamerMode,
  }
}
