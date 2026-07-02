import { computed, onMounted, ref, watch, type Ref } from 'vue'
import type { Build } from '@lelanation/shared-types'

export type VisibilityFilterValue = 'all' | 'private' | 'public'

type TabValue = 'discover' | 'my-builds' | 'favoris' | 'lelariva' | string

export interface BuildStoreLike {
  savedBuildsVersion: number
  getSavedBuilds: () => Build[]
  deleteBuild: (buildId: string) => Promise<boolean>
  setSavedBuildVisibility: (buildId: string, visibility: 'public' | 'private') => Promise<boolean>
  upsertImportedBuild?: (build: Build) => string | null
}

export interface BuildDiscoveryStoreLike {
  builds: Build[]
  comparisonBuilds: unknown[]
  restorePaginationFromStorage: () => void
  loadBuilds: () => Promise<void> | void
  clearComparison: () => void
}

export interface FavoritesStoreLike {
  favoriteBuildIds: string[]
  init: () => void
}

export interface VoteStoreLike {
  init: () => void
}

export interface UseBuildsIndexControllerOptions {
  hydrated: Ref<boolean>
  isStreamerMode: Ref<boolean>
  routeTab: Ref<string | undefined>
  updateRouteTab: (tab: string) => Promise<void> | void
  t: (key: string) => string
  buildStore: BuildStoreLike
  discoveryStore: BuildDiscoveryStoreLike
  favoritesStore: FavoritesStoreLike
  voteStore: VoteStoreLike
}

const isTabValue = (value: string): value is TabValue => {
  return ['discover', 'my-builds', 'favoris', 'lelariva'].includes(value)
}

export function useBuildsIndexController(options: UseBuildsIndexControllerOptions) {
  const {
    hydrated,
    isStreamerMode,
    routeTab,
    updateRouteTab,
    t,
    buildStore,
    discoveryStore,
    favoritesStore,
    voteStore,
  } = options

  const buildToDelete = ref<string | null>(null)
  const myBuildsVisibilityFilter = ref<VisibilityFilterValue>('all')

  const visibilityFilterOptions = computed<{ value: VisibilityFilterValue; label: string }[]>(() => [
    { value: 'all', label: t('buildsPage.all') },
    { value: 'private', label: t('buildsPage.private') },
    { value: 'public', label: t('buildsPage.public') },
  ])

  const getInitialTabFromRoute = (): string => {
    if (routeTab.value && typeof routeTab.value === 'string') return routeTab.value
    return 'discover'
  }

  const getInitialTabFromClient = (): string => {
    if (routeTab.value && typeof routeTab.value === 'string') return routeTab.value
    try {
      const savedTab = localStorage.getItem('lelanation_active_tab')
      if (savedTab && isTabValue(savedTab)) return savedTab
    } catch {
      // ignore
    }
    return 'discover'
  }

  const activeTab = ref(getInitialTabFromRoute())

  const buildsFilteredByVisibility = computed<Build[]>(() => {
    if (!hydrated.value) return []
    const version = buildStore.savedBuildsVersion
    const list = buildStore.getSavedBuilds()
    const filter = myBuildsVisibilityFilter.value
    if (filter === 'all') return list
    return list.filter(b => (b.visibility ?? 'public') === filter && version >= 0)
  })

  const userBuilds = computed<Build[]>(() => {
    if (!hydrated.value) return []
    const version = buildStore.savedBuildsVersion
    return version >= 0 ? buildStore.getSavedBuilds() : []
  })

  const comparisonBuilds = computed(() => discoveryStore.comparisonBuilds)

  const favoriteBuilds = computed<Build[]>(() => {
    if (!hydrated.value) return []
    const ids = new Set(favoritesStore.favoriteBuildIds)
    if (ids.size === 0) return []
    const saved = buildStore.getSavedBuilds()
    const fromDiscovery = discoveryStore.builds
    const byId = new Map<string, Build>()
    for (const b of saved) byId.set(b.id, b)
    for (const b of fromDiscovery) if (!byId.has(b.id)) byId.set(b.id, b)
    return favoritesStore.favoriteBuildIds
      .map(id => byId.get(id))
      .filter((b: Build | undefined): b is Build => Boolean(b))
  })

  if (typeof window !== 'undefined') {
    watch(activeTab, async newTab => {
      try {
        localStorage.setItem('lelanation_active_tab', newTab)
      } catch {
        // ignore
      }
      await updateRouteTab(newTab)
    })
  }

  watch(routeTab, newTab => {
    if (newTab && typeof newTab === 'string' && newTab !== activeTab.value) {
      activeTab.value = newTab
    }
  })

  watch(
    isStreamerMode,
    enabled => {
      if (enabled && !['discover', 'my-builds'].includes(activeTab.value)) {
        activeTab.value = 'discover'
      }
    },
    { immediate: true }
  )

  const confirmDelete = (buildId: string) => {
    buildToDelete.value = buildId
  }

  const deleteBuild = async () => {
    if (buildToDelete.value) {
      const success = await buildStore.deleteBuild(buildToDelete.value)
      if (success) {
        await discoveryStore.loadBuilds()
        buildToDelete.value = null
      }
    }
  }

  const toggleBuildVisibility = async (buildId: string) => {
    if (!hydrated.value) return
    const target = buildStore.getSavedBuilds().find(b => b.id === buildId)
    if (!target) return
    const nextVisibility: 'public' | 'private' =
      (target.visibility ?? 'public') === 'private' ? 'public' : 'private'
    const success = await buildStore.setSavedBuildVisibility(buildId, nextVisibility)
    if (success) await discoveryStore.loadBuilds()
  }

  const clearComparison = () => {
    discoveryStore.clearComparison()
  }

  onMounted(() => {
    favoritesStore.init()
    voteStore.init()
    discoveryStore.restorePaginationFromStorage()
    discoveryStore.loadBuilds()
    activeTab.value = getInitialTabFromClient()
  })

  return {
    activeTab,
    myBuildsVisibilityFilter,
    visibilityFilterOptions,
    buildsFilteredByVisibility,
    userBuilds,
    comparisonBuilds,
    favoriteBuilds,
    buildToDelete,
    confirmDelete,
    deleteBuild,
    toggleBuildVisibility,
    clearComparison,
  }
}
