import { watch } from 'vue'

const STREAMER_MODE_STORAGE_KEY = 'lelanation_streamer_mode'

export function useStreamerMode() {
  const isStreamerMode = useState<boolean>('streamer-mode', () => false)
  const initialized = useState<boolean>('streamer-mode-initialized', () => false)

  if (import.meta.client && !initialized.value) {
    initialized.value = true
    const saved = localStorage.getItem(STREAMER_MODE_STORAGE_KEY)
    isStreamerMode.value = saved === '1'
  }

  if (import.meta.client) {
    watch(
      isStreamerMode,
      value => {
        localStorage.setItem(STREAMER_MODE_STORAGE_KEY, value ? '1' : '0')
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
