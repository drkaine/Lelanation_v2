import { computed } from 'vue'
import { useMobileViewport } from '~/composables/useMobileViewport'
import { usePresentationZoom } from '~/composables/usePresentationZoom'
import { useStreamerMode } from '~/composables/useStreamerMode'

export function useLayoutScaled() {
  const { isStreamerMode } = useStreamerMode()
  const { isPresentationZoom } = usePresentationZoom()
  const { isMobileViewport } = useMobileViewport()

  const isLayoutScaled = computed(
    () => isStreamerMode.value || isPresentationZoom.value || isMobileViewport.value
  )

  return {
    isLayoutScaled,
  }
}
