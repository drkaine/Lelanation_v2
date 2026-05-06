import { onMounted, watch } from 'vue'

const STREAMER_MODE_STORAGE_KEY = 'lelanation_streamer_mode'
const STREAMER_MODE_COOKIE_KEY = 'lelanation_streamer_mode'

export function useStreamerMode() {
  const route = useRoute()
  const modeCookie = useCookie<string | null>(STREAMER_MODE_COOKIE_KEY, {
    sameSite: 'lax',
    path: '/',
    default: () => null,
  })
  const isStreamerMode = useState<boolean>('streamer-mode', () => modeCookie.value === '1')
  const initialized = useState<boolean>('streamer-mode-initialized', () => false)
  const isMobileViewport = () =>
    import.meta.client && window.matchMedia('(max-width: 768px)').matches

  // IMPORTANT: do not read localStorage before hydration, or SSR/CSR can diverge.
  if (import.meta.client) {
    onMounted(() => {
      if (initialized.value) return
      initialized.value = true
      try {
        const forceFromQuery =
          route.query.app === 'on' ||
          route.query.streamer === '1' ||
          route.query.presentation === '1' ||
          route.query.mode === 'presentation'

        if (forceFromQuery) {
          isStreamerMode.value = true
          modeCookie.value = '1'
          localStorage.setItem(STREAMER_MODE_STORAGE_KEY, '1')
          return
        }

        // Le mode présentation n'est pas supporté sur mobile.
        if (isMobileViewport()) {
          isStreamerMode.value = false
          modeCookie.value = '0'
          localStorage.setItem(STREAMER_MODE_STORAGE_KEY, '0')
          return
        }

        const saved = localStorage.getItem(STREAMER_MODE_STORAGE_KEY)
        if (saved === '1' || saved === '0') {
          isStreamerMode.value = saved === '1'
          modeCookie.value = saved
        }
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
          modeCookie.value = value ? '1' : '0'
        } catch {
          // ignore
        }
      },
      { flush: 'post' }
    )
  }

  const setStreamerMode = (enabled: boolean) => {
    if (isMobileViewport()) {
      isStreamerMode.value = false
      return
    }
    isStreamerMode.value = enabled
  }

  const toggleStreamerMode = () => {
    if (isMobileViewport()) {
      isStreamerMode.value = false
      return
    }
    isStreamerMode.value = !isStreamerMode.value
  }

  return {
    isStreamerMode,
    setStreamerMode,
    toggleStreamerMode,
  }
}
