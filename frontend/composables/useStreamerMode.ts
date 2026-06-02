import { onMounted, watch } from 'vue'
import { MOBILE_VIEWPORT_MEDIA_QUERY, useMobileViewport } from '~/composables/useMobileViewport'

const STREAMER_MODE_STORAGE_KEY = 'lelanation_streamer_mode'
const STREAMER_MODE_COOKIE_KEY = 'lelanation_streamer_mode'

export function useStreamerMode() {
  const route = useRoute()
  const { isMobileViewport } = useMobileViewport()
  const modeCookie = useCookie<string | null>(STREAMER_MODE_COOKIE_KEY, {
    sameSite: 'lax',
    path: '/',
    default: () => null,
  })
  const isStreamerMode = useState<boolean>('streamer-mode', () => modeCookie.value === '1')
  const initialized = useState<boolean>('streamer-mode-initialized', () => false)

  const isMobilePresentationViewport = () =>
    isMobileViewport.value ||
    (import.meta.client && window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY).matches)

  const enableMobilePresentation = () => {
    if (!isMobilePresentationViewport()) return
    isStreamerMode.value = true
    modeCookie.value = '1'
  }

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

        if (isMobilePresentationViewport()) {
          enableMobilePresentation()
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
        if (isMobileViewport.value) return
        try {
          localStorage.setItem(STREAMER_MODE_STORAGE_KEY, value ? '1' : '0')
          modeCookie.value = value ? '1' : '0'
        } catch {
          // ignore
        }
      },
      { flush: 'post' }
    )

    watch(isMobileViewport, mobile => {
      if (mobile) enableMobilePresentation()
    })
  }

  const setStreamerMode = (enabled: boolean) => {
    if (isMobilePresentationViewport()) {
      enableMobilePresentation()
      return
    }
    isStreamerMode.value = enabled
  }

  const toggleStreamerMode = () => {
    if (isMobilePresentationViewport()) return
    isStreamerMode.value = !isStreamerMode.value
  }

  return {
    isStreamerMode,
    setStreamerMode,
    toggleStreamerMode,
  }
}
