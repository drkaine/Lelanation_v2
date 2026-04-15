<template>
  <BuildsIndexPageView
    :t="t"
    :locale-path="localePath"
    :link-component="nuxtLinkComponent"
    :build-search-component="BuildSearch"
    :build-filters-component="BuildFilters"
    :build-grid-component="BuildGrid"
    :active-tab="activeTab"
    :favorite-builds="favoriteBuilds"
    :comparison-builds="comparisonBuilds"
    :my-builds-visibility-filter="myBuildsVisibilityFilter"
    :visibility-filter-options="visibilityFilterOptions"
    :admin-mode="adminMode"
    :allow-share="true"
    :share-loading="shareLoading"
    :import-loading="importLoading"
    :builds-filtered-by-visibility="buildsFilteredByVisibility"
    :build-to-delete="buildToDelete"
    :share-modal-open="shareModalOpen"
    :share-code="shareCode"
    :import-code="importCode"
    :share-copied="shareCopied"
    :share-error="shareError"
    @update:active-tab="activeTab = $event"
    @update:my-builds-visibility-filter="myBuildsVisibilityFilter = $event"
    @share-builds="shareBuilds"
    @clear-comparison="clearComparison"
    @confirm-delete="confirmDelete"
    @toggle-visibility="toggleBuildVisibility"
    @delete-build="deleteBuild"
    @close-delete-modal="buildToDelete = null"
    @close-share-code="closeShareModal"
    @copy-share-code="copyShareCode"
    @update:import-code="importCode = $event"
    @import-by-code="importBuildsByCode"
  />
</template>

<script setup lang="ts">
import { computed, resolveComponent } from 'vue'
import { useRoute } from 'vue-router'
import { BuildsIndexPageView, useBuildsIndexController } from '@lelanation/builds-ui'
import type { Build } from '@lelanation/shared-types'
import { useBuildStore } from '~/stores/BuildStore'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useVoteStore } from '~/stores/VoteStore'
import { useFavoritesStore } from '~/stores/FavoritesStore'
import BuildSearch from '~/components/BuildDiscovery/BuildSearch.vue'
import BuildFilters from '~/components/BuildDiscovery/BuildFilters.vue'
import BuildGrid from '~/components/BuildDiscovery/BuildGrid.vue'
import { serializeBuild, hydrateBuild, isStoredBuild } from '~/utils/buildSerialize'
import { useAdminAuth } from '~/composables/useAdminAuth'
import { useClientHydrated } from '~/composables/useClientHydrated'
import { useStreamerMode } from '~/composables/useStreamerMode'

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

useHead({
  title: () => t('buildsPage.metaTitle'),
  meta: [{ name: 'description', content: () => t('buildsPage.metaDescription') }],
})
useSeoMeta({
  ogTitle: () => t('buildsPage.metaTitle'),
  ogDescription: () => t('buildsPage.metaDescription'),
  ogType: 'website',
})

const {
  activeTab,
  myBuildsVisibilityFilter,
  visibilityFilterOptions,
  buildsFilteredByVisibility,
  comparisonBuilds,
  favoriteBuilds,
  buildToDelete,
  shareModalOpen,
  shareCode,
  shareLoading,
  shareError,
  shareCopied,
  importCode,
  importLoading,
  shareBuilds,
  importBuildsByCode,
  copyShareCode,
  closeShareModal,
  confirmDelete,
  deleteBuild,
  toggleBuildVisibility,
  clearComparison,
} = useBuildsIndexController({
  hydrated,
  isStreamerMode,
  routeTab: computed(() => (typeof route.query.tab === 'string' ? route.query.tab : undefined)),
  updateRouteTab: async tab => {
    await navigateTo({ query: { tab } }, { replace: true })
  },
  t,
  buildStore,
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
</script>
