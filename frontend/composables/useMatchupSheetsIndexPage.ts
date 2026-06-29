import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { MatchupGuide } from '@lelanation/shared-types'
import { useAdminAuth } from '~/composables/useAdminAuth'
import { useClientHydrated } from '~/composables/useClientHydrated'
import { usePageOgImage } from '~/composables/usePageOgImage'
import { useMatchupGuideDiscoveryStore } from '~/stores/MatchupGuideDiscoveryStore'
import { useMatchupGuideFavoritesStore } from '~/stores/MatchupGuideFavoritesStore'
import { useMatchupGuideStore } from '~/stores/MatchupGuideStore'

export type MatchupSheetsTab = 'discover' | 'my-guides' | 'favoris'

const TAB_PATH_SEGMENTS: Record<MatchupSheetsTab, string> = {
  discover: '/matchups/sheets/discover',
  'my-guides': '/matchups/sheets/my-guides',
  favoris: '/matchups/sheets/favoris',
}

function tabFromPath(path: string): MatchupSheetsTab | undefined {
  if (path.endsWith('/matchups/sheets/discover') || path.endsWith('/matchups/sheets')) {
    return 'discover'
  }
  if (path.endsWith('/matchups/sheets/my-guides')) return 'my-guides'
  if (path.endsWith('/matchups/sheets/favoris')) return 'favoris'
  return undefined
}

export function useMatchupSheetsIndexPage(fixedTab?: MatchupSheetsTab) {
  const { t } = useI18n()
  const localePath = useLocalePath()
  const route = useRoute()
  const { isLoggedIn: isAdmin } = useAdminAuth()
  const { hydrated } = useClientHydrated()
  const discoveryStore = useMatchupGuideDiscoveryStore()
  const guideStore = useMatchupGuideStore()
  const favoritesStore = useMatchupGuideFavoritesStore()
  const requestFetch = useRequestFetch()

  const routeTab = computed(() => {
    if (fixedTab) return fixedTab
    return tabFromPath(route.path) ?? 'discover'
  })

  const activeTab = ref<MatchupSheetsTab>(routeTab.value)

  watch(routeTab, tab => {
    activeTab.value = tab
  })

  useSeoMeta({
    title: () => {
      if (routeTab.value === 'my-guides') return t('matchupGuidePage.myGuides')
      if (routeTab.value === 'favoris') return t('buildsPage.myFavorites')
      return t('matchupGuidePage.metaTitle')
    },
    description: () => t('matchupGuidePage.metaDescription'),
    robots: 'noindex, nofollow',
  })

  usePageOgImage({
    title: () => t('matchupGuidePage.metaTitle'),
    subtitle: () => t('matchupGuidePage.subtitle'),
  })

  useAsyncData(
    () => `matchup-sheets-${routeTab.value}`,
    async () => {
      discoveryStore.restorePaginationFromStorage()
      await discoveryStore.loadGuides({ fetcher: requestFetch })
      return discoveryStore.guides.length
    },
    { watch: [routeTab] }
  )

  const myGuides = computed<MatchupGuide[]>(() => {
    if (!hydrated.value) return []
    const { savedGuidesVersion } = guideStore
    return savedGuidesVersion >= 0 ? guideStore.getSavedGuides() : []
  })

  const favoriteGuides = computed<MatchupGuide[]>(() => {
    if (!hydrated.value) return []
    const ids = new Set(favoritesStore.favoriteGuideIds)
    const fromDiscovery = discoveryStore.guides.filter(g => ids.has(g.id))
    const fromLocal = guideStore.getSavedGuides().filter(g => ids.has(g.id))
    const merged = new Map<string, MatchupGuide>()
    for (const guide of [...fromDiscovery, ...fromLocal]) {
      merged.set(guide.id, guide)
    }
    return Array.from(merged.values())
  })

  async function setTab(tab: MatchupSheetsTab) {
    activeTab.value = tab
    const segment = TAB_PATH_SEGMENTS[tab]
    await navigateTo(localePath(segment), { replace: true })
  }

  async function goToCreateGuide() {
    await navigateTo(localePath('/matchups/sheets/create'))
  }

  if (fixedTab && activeTab.value !== fixedTab) {
    activeTab.value = fixedTab
  }

  onMounted(() => {
    favoritesStore.init()
  })

  return {
    t,
    isAdmin,
    activeTab,
    myGuides,
    favoriteGuides,
    setTab,
    goToCreateGuide,
  }
}
