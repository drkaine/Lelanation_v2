import { computed, onMounted, ref, watch, type MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { MatchupGuide } from '@lelanation/shared-types'
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

export function useMatchupSheetsIndexPage(
  fixedTab?: MaybeRefOrGetter<MatchupSheetsTab | undefined>
) {
  const { t } = useI18n()
  const localePath = useLocalePath()
  const route = useRoute()
  const { hydrated } = useClientHydrated()
  const discoveryStore = useMatchupGuideDiscoveryStore()
  const guideStore = useMatchupGuideStore()
  const favoritesStore = useMatchupGuideFavoritesStore()
  const requestFetch = useRequestFetch()
  const fixedTabValue = computed(() => toValue(fixedTab))

  const routeTab = computed(() => {
    if (fixedTabValue.value) return fixedTabValue.value
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
    { watch: [routeTab], lazy: true }
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

  const guideToDelete = ref<string | null>(null)

  function confirmDeleteGuide(guideId: string) {
    guideToDelete.value = guideId
  }

  async function deleteGuide() {
    if (!guideToDelete.value) return
    const success = await guideStore.deleteGuide(guideToDelete.value)
    if (success) {
      guideToDelete.value = null
      await discoveryStore.loadGuides({ fetcher: requestFetch }).catch(() => undefined)
    }
  }

  async function toggleGuideVisibility(guideId: string) {
    if (!hydrated.value) return
    const success = await guideStore.toggleGuideVisibility(guideId)
    if (success) {
      await discoveryStore.loadGuides({ fetcher: requestFetch }).catch(() => undefined)
    }
  }

  watch(fixedTabValue, tab => {
    if (tab && activeTab.value !== tab) {
      activeTab.value = tab
    }
  })

  onMounted(() => {
    favoritesStore.init()
  })

  return {
    t,
    activeTab,
    myGuides,
    favoriteGuides,
    setTab,
    goToCreateGuide,
    guideToDelete,
    confirmDeleteGuide,
    deleteGuide,
    toggleGuideVisibility,
  }
}
