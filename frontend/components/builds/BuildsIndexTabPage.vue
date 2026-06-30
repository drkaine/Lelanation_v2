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
    :builds-filtered-by-visibility="buildsFilteredByVisibility"
    :build-to-delete="buildToDelete"
    @update:active-tab="activeTab = $event"
    @update:my-builds-visibility-filter="myBuildsVisibilityFilter = $event"
    @create-build="goToCreateBuild"
    @clear-comparison="clearComparison"
    @confirm-delete="confirmDelete"
    @toggle-visibility="toggleBuildVisibility"
    @delete-build="deleteBuild"
    @close-delete-modal="buildToDelete = null"
  />
</template>

<script setup lang="ts">
import { toRef } from 'vue'
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
  confirmDelete,
  deleteBuild,
  toggleBuildVisibility,
  clearComparison,
} = useBuildsIndexPage(toRef(props, 'tab'))
</script>
