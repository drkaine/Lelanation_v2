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
    :user-builds="userBuilds"
    :comparison-builds="comparisonBuilds"
    :my-builds-visibility-filter="myBuildsVisibilityFilter"
    :visibility-filter-options="visibilityFilterOptions"
    :admin-mode="adminMode"
    :builds-filtered-by-visibility="buildsFilteredByVisibility"
    :build-to-delete="buildToDelete"
    :show-team-tab="showTeamBuildsTab(sessionRole)"
    @update:active-tab="activeTab = $event"
    @update:my-builds-visibility-filter="myBuildsVisibilityFilter = $event"
    @create-build="goToCreateBuild"
    @clear-comparison="clearComparison"
    @confirm-delete="confirmDelete"
    @toggle-visibility="toggleBuildVisibility"
    @delete-build="deleteBuildThenRedirect"
    @close-delete-modal="buildToDelete = null"
  >
    <template #team><slot name="team" /></template>
  </BuildsIndexPageView>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { BuildsIndexPageView } from '@lelanation/builds-ui'
import { useBuildsIndexPage } from '~/composables/useBuildsIndexPage'
import { useUserSession } from '~/composables/useUserSession'
import {
  buildsTabPath,
  showTeamBuildsTab,
  tabAfterBuildChange,
  type BuildsIndexTab,
} from '~/utils/buildsIndexTabs'
import { useBuildStore } from '~/stores/BuildStore'

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
  userBuilds,
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
const { role: sessionRole } = useUserSession()
const buildStore = useBuildStore()

/** Supprimer un build d'équipe depuis Mes builds ramène sur l'onglet Team. */
async function deleteBuildThenRedirect() {
  const id = buildToDelete.value
  const target = buildStore.getSavedBuilds().find(b => b.id === id)
  const tab = tabAfterBuildChange(target)
  await deleteBuild()
  if (tab === 'team' && buildToDelete.value === null) {
    await navigateTo(localePath(buildsTabPath(tab)))
  }
}
</script>
