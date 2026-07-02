import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAdminAuth } from '~/composables/useAdminAuth'
import { useClientHydrated } from '~/composables/useClientHydrated'
import { useFavoritesStore } from '~/stores/FavoritesStore'
import { useBuildStore } from '~/stores/BuildStore'
import { useMatchupGuideStore } from '~/stores/MatchupGuideStore'
import { useMatchupGuideFavoritesStore } from '~/stores/MatchupGuideFavoritesStore'
import { filterStandaloneLibraryBuilds } from '~/utils/buildLibrary'
import { useStatisticsUiStore } from '~/stores/StatisticsUiStore'

export type AppMobileTabId = 'builds' | 'guides' | 'statistics' | 'videos' | 'patchNotes'

export type AppMobileTab = {
  id: AppMobileTabId
  path: string
  labelKey: string
  icon: string
  badge?: number
  hasSubmenu?: boolean
}

export type AppMobileTabSubmenuItem = {
  id: string
  path: string
  labelKey: string
  badge?: number
  adminOnly?: boolean
}

function pickStatisticsSharedQuery(
  routeQuery: Record<string, string | string[] | undefined>,
  keys: readonly string[]
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  for (const key of keys) {
    const value = routeQuery[key]
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    out[key] = value
  }
  return out
}

export function useAppMobileTabBar() {
  const route = useRoute()
  const localePath = useLocalePath()
  const { isLoggedIn: isAdminLoggedIn } = useAdminAuth()
  const favoritesStore = useFavoritesStore()
  const buildStore = useBuildStore()
  const matchupGuideStore = useMatchupGuideStore()
  const matchupGuideFavoritesStore = useMatchupGuideFavoritesStore()
  const statisticsUiStore = useStatisticsUiStore()
  const surveillanceAlertStore = useStatisticsSurveillanceAlertStore()
  const buildSurveillanceStore = useStatisticsBuildSurveillanceStore()
  const { hydrated: clientHydrated } = useClientHydrated()
  const openSubmenuTabId = ref<AppMobileTabId | null>(null)

  const surveillanceAlertCount = computed(() =>
    clientHydrated.value ? surveillanceAlertStore.alertCount + buildSurveillanceStore.alertCount : 0
  )

  const hasFavorites = computed(() => favoritesStore.favoriteBuildIds.length > 0)
  const hasUserBuilds = computed(
    () =>
      clientHydrated.value && filterStandaloneLibraryBuilds(buildStore.getSavedBuilds()).length > 0
  )
  const hasMyGuides = computed(
    () => clientHydrated.value && matchupGuideStore.getSavedGuides().length > 0
  )
  const hasFavoriteGuides = computed(() => matchupGuideFavoritesStore.favoriteGuideIds.length > 0)
  const hasWatchedChampions = computed(
    () => clientHydrated.value && statisticsUiStore.watchedChampionIds.length > 0
  )

  const statisticsIndexLink = computed(() =>
    localePath({
      path: '/statistics',
      query: pickStatisticsSharedQuery(
        route.query as Record<string, string | string[] | undefined>,
        ['version', 'role', 'otp', 'rankTier', 'tab']
      ),
    })
  )

  const statisticsTierListLink = computed(() =>
    localePath({
      path: '/statistics/tier-list',
      query: pickStatisticsSharedQuery(
        route.query as Record<string, string | string[] | undefined>,
        ['version', 'role', 'otp', 'rankTier', 'sort', 'view']
      ),
    })
  )

  const statisticsSurveillanceLink = computed(() =>
    localePath({
      path: '/statistics/surveillance',
      query: pickStatisticsSharedQuery(
        route.query as Record<string, string | string[] | undefined>,
        ['version', 'role', 'otp', 'rankTier']
      ),
    })
  )

  const currentBuildsTab = computed(() => {
    if (route.path.endsWith('/builds/discover')) return 'discover'
    if (route.path.endsWith('/builds/my-builds')) return 'my-builds'
    if (route.path.endsWith('/builds/favoris')) return 'favoris'
    if (!route.path.includes('/builds') || route.path.includes('/builds/create')) return null
    return typeof route.query.tab === 'string' ? route.query.tab : 'discover'
  })

  const currentGuidesTab = computed(() => {
    const path = route.path
    if (!path.includes('/matchups/sheets')) return null
    if (path.includes('/matchups/sheets/create')) return 'create'
    if (path.endsWith('/matchups/sheets/my-guides')) return 'my-guides'
    if (path.endsWith('/matchups/sheets/favoris')) return 'favoris'
    if (path.endsWith('/matchups/sheets/discover') || path.endsWith('/matchups/sheets')) {
      return 'discover'
    }
    return null
  })

  const tabs = computed((): AppMobileTab[] => {
    const items: AppMobileTab[] = [
      {
        id: 'builds',
        path: localePath('/builds/discover'),
        labelKey: 'nav.builds',
        icon: 'mdi:hammer-wrench',
        hasSubmenu: true,
      },
    ]

    if (isAdminLoggedIn.value) {
      items.push({
        id: 'guides',
        path: localePath('/matchups/sheets/discover'),
        labelKey: 'mobileTabBar.guidesShort',
        icon: 'mdi:sword-cross',
        hasSubmenu: true,
      })
    }

    items.push(
      {
        id: 'statistics',
        path: statisticsIndexLink.value,
        labelKey: 'mobileTabBar.statisticsShort',
        icon: 'mdi:chart-bar',
        badge: surveillanceAlertCount.value > 0 ? surveillanceAlertCount.value : undefined,
        hasSubmenu: true,
      },
      {
        id: 'videos',
        path: localePath('/videos'),
        labelKey: 'nav.videos',
        icon: 'mdi:play-circle-outline',
      },
      {
        id: 'patchNotes',
        path: localePath('/patch-notes'),
        labelKey: 'mobileTabBar.patchNotesShort',
        icon: 'mdi:script-text-outline',
      }
    )

    return items
  })

  const buildsSubmenuItems = computed((): AppMobileTabSubmenuItem[] => {
    const items: AppMobileTabSubmenuItem[] = [
      {
        id: 'create',
        path: localePath('/builds/create'),
        labelKey: 'buildsPage.createBuild',
      },
      {
        id: 'discover',
        path: localePath('/builds/discover'),
        labelKey: 'buildsPage.discover',
      },
    ]

    if (hasUserBuilds.value) {
      items.push({
        id: 'my-builds',
        path: localePath('/builds/my-builds'),
        labelKey: 'buildsPage.myBuilds',
      })
    }

    if (hasFavorites.value) {
      items.push({
        id: 'favoris',
        path: localePath('/builds/favoris'),
        labelKey: 'buildsPage.myFavorites',
      })
    }

    items.push({
      id: 'theorycraft',
      path: localePath('/builds/theorycraft'),
      labelKey: 'nav.theorycraft',
    })

    return items
  })

  const guidesSubmenuItems = computed((): AppMobileTabSubmenuItem[] => {
    const items: AppMobileTabSubmenuItem[] = [
      {
        id: 'create',
        path: localePath('/matchups/sheets/create'),
        labelKey: 'matchupGuidePage.createGuide',
      },
      {
        id: 'discover',
        path: localePath('/matchups/sheets/discover'),
        labelKey: 'buildsPage.discover',
      },
    ]

    if (hasMyGuides.value) {
      items.push({
        id: 'my-guides',
        path: localePath('/matchups/sheets/my-guides'),
        labelKey: 'matchupGuidePage.myGuides',
      })
    }

    if (hasFavoriteGuides.value) {
      items.push({
        id: 'favoris',
        path: localePath('/matchups/sheets/favoris'),
        labelKey: 'buildsPage.myFavorites',
      })
    }

    return items
  })

  const statisticsSubmenuItems = computed((): AppMobileTabSubmenuItem[] => {
    const items: AppMobileTabSubmenuItem[] = [
      {
        id: 'overview',
        path: statisticsIndexLink.value,
        labelKey: 'nav.statistics',
      },
      {
        id: 'tier-list',
        path: statisticsTierListLink.value,
        labelKey: 'nav.tierList',
      },
    ]

    if (hasWatchedChampions.value) {
      items.push({
        id: 'surveillance',
        path: statisticsSurveillanceLink.value,
        labelKey: 'nav.statisticsSurveillance',
        badge: surveillanceAlertCount.value > 0 ? surveillanceAlertCount.value : undefined,
      })
    }

    return items
  })

  const activeSubmenuItems = computed(() => {
    if (openSubmenuTabId.value === 'builds') return buildsSubmenuItems.value
    if (openSubmenuTabId.value === 'guides') return guidesSubmenuItems.value
    if (openSubmenuTabId.value === 'statistics') return statisticsSubmenuItems.value
    return []
  })

  function isTabActive(tabId: AppMobileTabId): boolean {
    const path = route.path
    switch (tabId) {
      case 'builds':
        return path.includes('/builds')
      case 'guides':
        return path.includes('/matchups/sheets')
      case 'statistics':
        return path.includes('/statistics')
      case 'videos':
        return path.includes('/videos')
      case 'patchNotes':
        return path.includes('/patch-notes')
      default:
        return false
    }
  }

  function isSubmenuItemActive(parentTabId: AppMobileTabId, itemId: string): boolean {
    if (parentTabId === 'builds') {
      switch (itemId) {
        case 'discover':
          return currentBuildsTab.value === 'discover'
        case 'my-builds':
          return currentBuildsTab.value === 'my-builds'
        case 'favoris':
          return currentBuildsTab.value === 'favoris'
        case 'create':
          return route.path.includes('/builds/create')
        case 'theorycraft':
          return route.path.includes('/builds/theorycraft')
        default:
          return false
      }
    }

    if (parentTabId === 'guides') {
      switch (itemId) {
        case 'discover':
          return currentGuidesTab.value === 'discover'
        case 'my-guides':
          return currentGuidesTab.value === 'my-guides'
        case 'favoris':
          return currentGuidesTab.value === 'favoris'
        case 'create':
          return currentGuidesTab.value === 'create'
        default:
          return false
      }
    }

    if (parentTabId === 'statistics') {
      const base = localePath('/statistics')
      switch (itemId) {
        case 'overview':
          return (
            route.path === base ||
            (route.path.startsWith(`${base}/`) &&
              !route.path.includes('/tier-list') &&
              !route.path.includes('/surveillance'))
          )
        case 'tier-list':
          return route.path === localePath('/statistics/tier-list')
        case 'surveillance':
          return route.path === localePath('/statistics/surveillance')
        default:
          return false
      }
    }

    return false
  }

  function toggleSubmenu(tabId: AppMobileTabId) {
    if (tabId !== 'builds' && tabId !== 'guides' && tabId !== 'statistics') return
    openSubmenuTabId.value = openSubmenuTabId.value === tabId ? null : tabId
  }

  function closeSubmenu() {
    openSubmenuTabId.value = null
  }

  watch(
    () => route.path,
    () => {
      closeSubmenu()
    }
  )

  return {
    tabs,
    isTabActive,
    openSubmenuTabId,
    activeSubmenuItems,
    toggleSubmenu,
    closeSubmenu,
    isSubmenuItemActive,
    surveillanceAlertCount,
  }
}
