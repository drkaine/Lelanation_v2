export function usePresentationZoom() {
  const PRESENTATION_ZOOM_STORAGE_KEY = 'lelanation_presentation_zoom'
  const isPresentationZoom = useState<boolean>('presentation-zoom', () => false)
  const initialized = useState<boolean>('presentation-zoom-initialized', () => false)

  if (import.meta.client) {
    onMounted(() => {
      if (initialized.value) return
      initialized.value = true
      try {
        isPresentationZoom.value = localStorage.getItem(PRESENTATION_ZOOM_STORAGE_KEY) === '1'
      } catch {
        // ignore
      }
    })

    watch(
      isPresentationZoom,
      value => {
        try {
          localStorage.setItem(PRESENTATION_ZOOM_STORAGE_KEY, value ? '1' : '0')
        } catch {
          // ignore
        }
      },
      { flush: 'post' }
    )
  }

  const togglePresentationZoom = () => {
    isPresentationZoom.value = !isPresentationZoom.value
  }

  return {
    isPresentationZoom,
    togglePresentationZoom,
  }
}
