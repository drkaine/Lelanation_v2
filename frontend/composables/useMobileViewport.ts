import { onMounted, onUnmounted } from 'vue'

export const MOBILE_VIEWPORT_MEDIA_QUERY = '(max-width: 768px)'

export function useMobileViewport() {
  const isMobileViewport = useState<boolean>('mobile-viewport', () => false)

  if (import.meta.client) {
    onMounted(() => {
      const mq = window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY)
      const sync = () => {
        isMobileViewport.value = mq.matches
      }
      sync()
      mq.addEventListener('change', sync)
      onUnmounted(() => mq.removeEventListener('change', sync))
    })
  }

  return { isMobileViewport }
}
