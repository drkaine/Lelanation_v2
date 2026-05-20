import { onMounted, onUnmounted, ref } from 'vue'

export type OverviewFastStatView = 'cards' | 'table'

const OVERVIEW_VIEW_KEY = 'lelanation_stats_overview_view'
const MOBILE_TOAST_KEY = 'lelanation_stats_mobile_view_toast'

export function useStatisticsMobileViewport() {
  const isMobileViewport = ref(false)
  const overviewFastStatView = ref<OverviewFastStatView>('table')
  const showMobileViewToast = ref(false)

  function detectMobile(): boolean {
    if (!import.meta.client) return false
    return window.matchMedia('(max-width: 768px)').matches
  }

  function initFromStorage(): void {
    if (!import.meta.client) return
    isMobileViewport.value = detectMobile()
    const saved = localStorage.getItem(OVERVIEW_VIEW_KEY)
    if (saved === 'cards' || saved === 'table') {
      overviewFastStatView.value = saved
      return
    }
    if (isMobileViewport.value) {
      overviewFastStatView.value = 'cards'
      localStorage.setItem(OVERVIEW_VIEW_KEY, 'cards')
    }
    if (isMobileViewport.value && !localStorage.getItem(MOBILE_TOAST_KEY)) {
      showMobileViewToast.value = true
      localStorage.setItem(MOBILE_TOAST_KEY, '1')
    }
  }

  function setOverviewFastStatView(view: OverviewFastStatView): void {
    overviewFastStatView.value = view
    if (import.meta.client) localStorage.setItem(OVERVIEW_VIEW_KEY, view)
    showMobileViewToast.value = false
  }

  function dismissMobileViewToast(): void {
    showMobileViewToast.value = false
  }

  let mq: MediaQueryList | null = null
  const onMqChange = () => {
    isMobileViewport.value = detectMobile()
  }

  onMounted(() => {
    initFromStorage()
    mq = window.matchMedia('(max-width: 768px)')
    mq.addEventListener('change', onMqChange)
  })

  onUnmounted(() => {
    mq?.removeEventListener('change', onMqChange)
  })

  return {
    isMobileViewport,
    overviewFastStatView,
    showMobileViewToast,
    setOverviewFastStatView,
    dismissMobileViewToast,
  }
}
