import { computed, resolveComponent } from 'vue'
import { useRoute } from 'vue-router'
import { useBuildsIndexController } from '@lelanation/builds-ui'
import type { Build } from '@lelanation/shared-types'
import { useBuildStore } from '~/stores/BuildStore'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useVoteStore } from '~/stores/VoteStore'
import { useFavoritesStore } from '~/stores/FavoritesStore'
import BuildSearch from '~/components/BuildDiscovery/BuildSearch.vue'
import BuildFilters from '~/components/BuildDiscovery/BuildFilters.vue'
import BuildGrid from '~/components/BuildDiscovery/BuildGrid.vue'
import { serializeBuild, hydrateBuild, isStoredBuild } from '~/utils/buildSerialize'
import { filterStandaloneLibraryBuilds } from '~/utils/buildLibrary'
import { useAdminAuth } from '~/composables/useAdminAuth'
import { useClientHydrated } from '~/composables/useClientHydrated'
import { useStreamerMode } from '~/composables/useStreamerMode'
import { usePageOgImage } from '~/composables/usePageOgImage'

export type BuildsIndexTab = 'discover' | 'my-builds' | 'favoris' | 'lelariva'

const TAB_PATH_SEGMENTS: Record<BuildsIndexTab, string> = {
  discover: '/builds/discover',
  'my-builds': '/builds/my-builds',
  favoris: '/builds/favoris',
  lelariva: '/statistics/lelariva',
}

function tabFromPath(path: string): BuildsIndexTab | undefined {
  if (path.endsWith('/builds/discover')) return 'discover'
  if (path.endsWith('/builds/my-builds')) return 'my-builds'
  if (path.endsWith('/builds/favoris')) return 'favoris'
  return undefined
}

export function useBuildsIndexPage(fixedTab?: BuildsIndexTab) {
  const buildStore = useBuildStore()
  const discoveryStore = useBuildDiscoveryStore()
  const voteStore = useVoteStore()
  const favoritesStore = useFavoritesStore()
  const route = useRoute()
  const localePath = useLocalePath()
  const { isLoggedIn: adminMode } = useAdminAuth()
  const { hydrated } = useClientHydrated()
  const { isStreamerMode } = useStreamerMode()
  const nuxtLinkComponent = resolveComponent('NuxtLink')
  const { t } = useI18n()

  const routeTab = computed(() => {
    if (fixedTab) return fixedTab
    const fromPath = tabFromPath(route.path)
    if (fromPath) return fromPath
    if (typeof route.query.tab === 'string') return route.query.tab
    return 'discover'
  })

  useSeoMeta({
    title: () => {
      if (routeTab.value === 'my-builds') return t('buildsPage.myBuilds')
      if (routeTab.value === 'favoris') return t('buildsPage.myFavorites')
      return t('buildsPage.metaTitle')
    },
    description: () => t('buildsPage.metaDescription'),
    ogTitle: () => t('buildsPage.metaTitle'),
    ogDescription: () => t('buildsPage.metaDescription'),
    ogType: 'website',
  })

  const buildsOgTitle = computed(() => {
    if (routeTab.value === 'my-builds') return t('buildsPage.myBuilds')
    if (routeTab.value === 'favoris') return t('buildsPage.myFavorites')
    return t('buildsPage.metaTitle')
  })
  usePageOgImage({
    title: buildsOgTitle,
    subtitle: () => t('buildsPage.metaDescription'),
  })

  const requestFetch = useRequestFetch()

  useAsyncData(
    () => `builds-index-${routeTab.value}`,
    async () => {
      await discoveryStore.loadBuilds({ fetcher: requestFetch })
      return discoveryStore.builds.length
    },
    { watch: [routeTab] }
  )

  const libraryBuildStore = {
    ...buildStore,
    getSavedBuilds: () => filterStandaloneLibraryBuilds(buildStore.getSavedBuilds()),
  }

  const controller = useBuildsIndexController({
    hydrated,
    isStreamerMode,
    routeTab,
    updateRouteTab: async tab => {
      const segment = TAB_PATH_SEGMENTS[tab as BuildsIndexTab] ?? TAB_PATH_SEGMENTS.discover
      await navigateTo(localePath(segment), { replace: true })
    },
    t,
    buildStore: libraryBuildStore,
    discoveryStore,
    favoritesStore,
    voteStore,
    serializeBuild,
    shareBuildsRequest: payload =>
      $fetch<{ code: string; expiresAt: string }>('/api/share-builds', {
        method: 'POST',
        body: payload,
      }),
    importBuildsByCodeRequest: code =>
      $fetch<{ builds: unknown[]; favoriteIds?: string[] }>(
        `/api/share-builds/${encodeURIComponent(code)}`
      ),
    hydrateSharedBuild: raw => {
      if (!raw || typeof raw !== 'object') return null
      if (isStoredBuild(raw)) return hydrateBuild(raw)
      return raw as Build
    },
  })

  if (fixedTab && controller.activeTab.value !== fixedTab) {
    controller.activeTab.value = fixedTab
  }

  const goToCreateBuild = async () => {
    await navigateTo(localePath('/builds/create'))
  }

  return {
    t,
    localePath,
    nuxtLinkComponent,
    goToCreateBuild,
    adminMode,
    BuildSearch,
    BuildFilters,
    BuildGrid,
    ...controller,
  }
}
