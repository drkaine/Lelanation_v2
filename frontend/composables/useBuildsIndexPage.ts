import { computed, resolveComponent, watch, type MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useBuildsIndexController } from '@lelanation/builds-ui'
import { useBuildStore } from '~/stores/BuildStore'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useVoteStore } from '~/stores/VoteStore'
import { useFavoritesStore } from '~/stores/FavoritesStore'
import BuildSearch from '~/components/BuildDiscovery/BuildSearch.vue'
import BuildFilters from '~/components/BuildDiscovery/BuildFilters.vue'
import BuildGrid from '~/components/BuildDiscovery/BuildGrid.vue'
import { filterStandaloneLibraryBuilds } from '~/utils/buildLibrary'
import { useAdminAuth } from '~/composables/useAdminAuth'
import { useClientHydrated } from '~/composables/useClientHydrated'
import { useStreamerMode } from '~/composables/useStreamerMode'
import { usePageOgImage } from '~/composables/usePageOgImage'
import { discoverSearchFromQuery } from '~/utils/homeHero'
import { buildsTabFromPath, buildsTabPath, type BuildsIndexTab } from '~/utils/buildsIndexTabs'

export function useBuildsIndexPage(fixedTab?: MaybeRefOrGetter<BuildsIndexTab | undefined>) {
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
  const fixedTabValue = computed(() => toValue(fixedTab))

  const routeTab = computed(() => {
    if (fixedTabValue.value) return fixedTabValue.value
    const fromPath = buildsTabFromPath(route.path)
    if (fromPath) return fromPath
    if (typeof route.query.tab === 'string') return route.query.tab
    return 'discover'
  })

  useSeoMeta({
    title: () => {
      if (routeTab.value === 'my-builds') return t('buildsPage.myBuilds')
      if (routeTab.value === 'favoris') return t('buildsPage.myFavorites')
      if (routeTab.value === 'team') return t('buildsPage.teamBuilds')
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
    { watch: [routeTab], lazy: true }
  )

  // ?q= (lien depuis la home) : préremplit la recherche de /builds/discover
  watch(
    () => route.query.q,
    q => {
      const search = discoverSearchFromQuery(q)
      if (search !== null) discoveryStore.setSearchQuery(search)
    },
    { immediate: true }
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
      await navigateTo(localePath(buildsTabPath(tab)), { replace: true })
    },
    t,
    buildStore: libraryBuildStore,
    discoveryStore,
    favoritesStore,
    voteStore,
  })

  watch(fixedTabValue, tab => {
    if (tab && controller.activeTab.value !== tab) {
      controller.activeTab.value = tab
    }
  })

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
