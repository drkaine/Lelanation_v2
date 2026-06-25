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
    :share-modal-mode="shareModalMode"
    :share-code="shareCode"
    :import-code="importCode"
    :share-copied="shareCopied"
    :share-error="shareError"
    @update:active-tab="activeTab = $event"
    @update:my-builds-visibility-filter="myBuildsVisibilityFilter = $event"
    @create-build="goToCreateBuild"
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
    @open-import-modal="openImportCodeModal"
  />
</template>

<script setup lang="ts">
import { BuildsIndexPageView } from '@lelanation/builds-ui'
import { useBuildsIndexPage, type BuildsIndexTab } from '~/composables/useBuildsIndexPage'

const props = defineProps<{ tab: BuildsIndexTab }>()

const {
  t,
  localePath,
  nuxtLinkComponent,
  adminMode,
  BuildSearch,
  BuildFilters,
  BuildGrid,
  activeTab,
  goToCreateBuild,
  favoriteBuilds,
  comparisonBuilds,
  myBuildsVisibilityFilter,
  visibilityFilterOptions,
  buildsFilteredByVisibility,
  buildToDelete,
  shareModalOpen,
  shareModalMode,
  shareCode,
  shareLoading,
  shareError,
  shareCopied,
  importCode,
  importLoading,
  shareBuilds,
  openImportCodeModal,
  importBuildsByCode,
  copyShareCode,
  closeShareModal,
  confirmDelete,
  deleteBuild,
  toggleBuildVisibility,
  clearComparison,
} = useBuildsIndexPage(props.tab)
</script>
