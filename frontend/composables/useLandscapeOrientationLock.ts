import { ref } from 'vue'
import { useMobileViewport } from '~/composables/useMobileViewport'

type OrientableScreen = Screen & {
  orientation?: ScreenOrientation & {
    lock?: (type: OrientationLockType) => Promise<void>
    unlock?: () => void
  }
}

function isPortraitViewport(): boolean {
  if (!import.meta.client) return false
  return window.matchMedia('(orientation: portrait)').matches
}

export function useLandscapeOrientationLock() {
  const { isMobileViewport } = useMobileViewport()
  const useCssFallback = ref(false)
  let enteredFullscreen = false

  async function lockLandscape(): Promise<void> {
    if (!import.meta.client || !isMobileViewport.value) return

    useCssFallback.value = false
    const orientation = (screen as OrientableScreen).orientation

    if (!orientation?.lock) {
      useCssFallback.value = isPortraitViewport()
      return
    }

    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
        enteredFullscreen = true
      }
      await orientation.lock('landscape')
    } catch {
      useCssFallback.value = isPortraitViewport()
      if (enteredFullscreen && document.exitFullscreen) {
        try {
          await document.exitFullscreen()
        } catch {
          /* ignore */
        }
        enteredFullscreen = false
      }
    }
  }

  async function unlockLandscape(): Promise<void> {
    if (!import.meta.client) return

    useCssFallback.value = false

    try {
      const orientation = (screen as OrientableScreen).orientation
      orientation?.unlock?.()
    } catch {
      /* ignore */
    }

    if (enteredFullscreen && document.fullscreenElement && document.exitFullscreen) {
      try {
        await document.exitFullscreen()
      } catch {
        /* ignore */
      }
    }
    enteredFullscreen = false
  }

  return { lockLandscape, unlockLandscape, useCssFallback }
}
