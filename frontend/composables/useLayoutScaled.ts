import { computed } from 'vue'
import { usePresentationZoom } from '~/composables/usePresentationZoom'
import { useStreamerMode } from '~/composables/useStreamerMode'

export function useLayoutScaled() {
  const { isStreamerMode } = useStreamerMode()
  const { isPresentationZoom } = usePresentationZoom()

  const isLayoutScaled = computed(() => isStreamerMode.value || isPresentationZoom.value)

  return {
    isLayoutScaled,
  }
}
