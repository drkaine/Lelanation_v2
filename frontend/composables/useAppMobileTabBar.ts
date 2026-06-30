import { computed } from 'vue'
import { useRoute } from 'vue-router'

export type AppMobileTabId = 'builds' | 'videos' | 'statistics' | 'tierList' | 'matchups'

export type AppMobileTab = {
  id: AppMobileTabId
  path: string
  labelKey: string
  icon: string
  badge?: number
}

export function useAppMobileTabBar() {
  const route = useRoute()
  const localePath = useLocalePath()
  const surveillanceAlertStore = useStatisticsSurveillanceAlertStore()
  const buildSurveillanceStore = useStatisticsBuildSurveillanceStore()
  const { hydrated: clientHydrated } = useClientHydrated()

  const surveillanceAlertCount = computed(() =>
    clientHydrated.value ? surveillanceAlertStore.alertCount + buildSurveillanceStore.alertCount : 0
  )

  const tabs = computed((): AppMobileTab[] => [
    {
      id: 'builds',
      path: localePath('/builds/discover'),
      labelKey: 'nav.builds',
      icon: 'mdi:hammer-wrench',
    },
    {
      id: 'videos',
      path: localePath('/videos'),
      labelKey: 'nav.videos',
      icon: 'mdi:play-circle-outline',
    },
    {
      id: 'statistics',
      path: localePath('/statistics'),
      labelKey: 'mobileTabBar.statisticsShort',
      icon: 'mdi:chart-bar',
      badge: surveillanceAlertCount.value > 0 ? surveillanceAlertCount.value : undefined,
    },
    {
      id: 'tierList',
      path: localePath('/statistics/tier-list'),
      labelKey: 'mobileTabBar.tierListShort',
      icon: 'mdi:trophy-outline',
    },
    {
      id: 'matchups',
      path: localePath('/matchups/sheets/discover'),
      labelKey: 'mobileTabBar.matchupsShort',
      icon: 'mdi:sword-cross',
    },
  ])

  function isTabActive(tabId: AppMobileTabId): boolean {
    const path = route.path
    switch (tabId) {
      case 'builds':
        return path.includes('/builds')
      case 'videos':
        return path.includes('/videos')
      case 'statistics': {
        const tierListPath = localePath('/statistics/tier-list')
        if (path === tierListPath || path.startsWith(`${tierListPath}/`)) return false
        return path.includes('/statistics')
      }
      case 'tierList':
        return path.includes('/statistics/tier-list')
      case 'matchups':
        return path.includes('/matchups/')
      default:
        return false
    }
  }

  return { tabs, isTabActive, surveillanceAlertCount }
}
