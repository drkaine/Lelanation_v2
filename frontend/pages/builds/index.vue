<template>
  <div class="builds-page min-h-screen p-4 text-text">
    <div class="max-w-8xl mx-auto px-2">
      <!-- Tabs -->
      <div v-if="tabs.length > 0" class="mb-6 border-b-2 border-accent/70">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex gap-2 overflow-x-auto pb-2 sm:gap-4 sm:overflow-visible sm:pb-0">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              :class="[
                'flex-shrink-0 whitespace-nowrap px-4 py-2 text-sm font-semibold transition-colors sm:px-6 sm:py-3 sm:text-base',
                activeTab === tab.id
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-text-secondary hover:text-text-primary',
              ]"
              @click="handleTabClick(tab.id)"
            >
              {{ tab.label }}
            </button>
          </div>
          <NuxtLink
            :to="localePath('/builds/create')"
            class="flex-shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm text-background transition-colors hover:bg-accent-dark sm:ml-4"
          >
            {{ t('buildsPage.createBuild') }}
          </NuxtLink>
        </div>
      </div>

      <!-- Tab Content: Discover -->
      <div v-if="activeTab === 'discover'" class="tab-content">
        <!-- Search and Filters -->
        <div class="mb-6 space-y-4">
          <div class="flex flex-wrap items-center gap-4">
            <BuildSearch />
            <BuildFilters />
          </div>
        </div>

        <!-- Comparison Bar -->
        <div
          v-if="comparisonBuilds.length > 0"
          class="mb-6 rounded-lg border-2 border-accent bg-accent/20 p-4"
        >
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="font-semibold text-text">
                {{ comparisonBuilds.length }}
                {{
                  comparisonBuilds.length === 1
                    ? t('buildsPage.buildsInComparison')
                    : t('buildsPage.buildsInComparison_other')
                }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <NuxtLink
                :to="localePath('/builds/compare')"
                class="rounded-lg bg-accent px-4 py-2 text-background transition-colors hover:bg-accent-dark"
              >
                {{ t('buildsPage.compare') }}
              </NuxtLink>
              <button
                class="rounded-lg border border-accent/70 bg-surface px-4 py-2 text-text transition-colors hover:bg-accent/10"
                @click="clearComparison"
              >
                {{ t('buildsPage.clear') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Build Grid -->
        <BuildGrid />
      </div>

      <!-- Tab Content: My Builds -->
      <div v-if="activeTab === 'my-builds'" class="tab-content">
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <span class="text-sm text-text-secondary">{{ t('buildsPage.visibility') }}</span>
          <div class="flex rounded-lg border border-accent/50 bg-surface/50 p-0.5">
            <button
              v-for="opt in visibilityFilterOptions"
              :key="opt.value"
              :class="[
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                myBuildsVisibilityFilter === opt.value
                  ? 'bg-accent text-background'
                  : 'text-text-secondary hover:bg-accent/20 hover:text-text',
              ]"
              @click="myBuildsVisibilityFilter = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
        <!-- Search and Filters -->
        <div class="mb-6 space-y-4">
          <div class="flex flex-wrap items-center gap-4">
            <BuildSearch />
            <BuildFilters />
          </div>
        </div>

        <!-- Build Grid avec les builds de l'utilisateur -->
        <BuildGrid
          :custom-builds="buildsFilteredByVisibility"
          :show-user-actions="true"
          @delete-build="confirmDelete"
        />
      </div>

      <div v-if="activeTab === 'lelariva'" class="tab-content">
        <div class="py-12 text-center">
          <p class="mb-4 text-lg text-text-secondary">{{ t('buildsPage.lelarivaBuilds') }}</p>
          <p class="text-text-secondary">{{ t('buildsPage.lelarivaComingSoon') }}</p>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div
      v-if="buildToDelete"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black"
      @click="buildToDelete = null"
    >
      <div
        class="mx-4 w-full max-w-md rounded-lg bg-surface p-6"
        style="background-color: var(--color-surface); opacity: 1"
        @click.stop
      >
        <h3 class="mb-4 text-lg font-bold text-text">{{ t('buildsPage.deleteBuildTitle') }}</h3>
        <p class="mb-6 text-text">
          {{ t('buildsPage.deleteBuildConfirm') }}
        </p>
        <div class="flex gap-4">
          <button
            class="rounded-lg bg-error px-4 py-2 text-text transition-colors hover:bg-error/80"
            @click="deleteBuild"
          >
            {{ t('buildsPage.delete') }}
          </button>
          <button
            class="rounded-lg border border-accent/70 bg-surface px-4 py-2 text-text transition-colors hover:bg-accent/10"
            @click="buildToDelete = null"
          >
            {{ t('buildsPage.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useBuildStore } from '~/stores/BuildStore'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useVoteStore } from '~/stores/VoteStore'
import BuildSearch from '~/components/BuildDiscovery/BuildSearch.vue'
import BuildFilters from '~/components/BuildDiscovery/BuildFilters.vue'
import BuildGrid from '~/components/BuildDiscovery/BuildGrid.vue'
import type { Build } from '~/types/build'
import { useStreamerMode } from '~/composables/useStreamerMode'

const buildStore = useBuildStore()
const discoveryStore = useBuildDiscoveryStore()
const voteStore = useVoteStore()
const route = useRoute()
const localePath = useLocalePath()
const { isStreamerMode } = useStreamerMode()

const buildToDelete = ref<string | null>(null)

/** Filtre visibilité pour l'onglet Mes Builds */
type VisibilityFilterValue = 'all' | 'private' | 'public'
const myBuildsVisibilityFilter = ref<VisibilityFilterValue>('all')
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

const visibilityFilterOptions = computed<{ value: VisibilityFilterValue; label: string }[]>(() => [
  { value: 'all', label: t('buildsPage.all') },
  { value: 'private', label: t('buildsPage.private') },
  { value: 'public', label: t('buildsPage.public') },
])

/** Builds de l'onglet Mes Builds, filtrés par visibilité (dépend de savedBuildsVersion pour refresh après delete/save) */
const buildsFilteredByVisibility = computed<Build[]>(() => {
  const version = buildStore.savedBuildsVersion
  const list = buildStore.getSavedBuilds()
  const filter = myBuildsVisibilityFilter.value
  if (filter === 'all') return list
  return list.filter(b => (b.visibility ?? 'public') === filter && version >= 0)
})
const comparisonBuilds = computed(() => discoveryStore.comparisonBuilds)

// Check if there are Lelariva builds (placeholder for now)
const hasLelarivaBuilds = computed(() => {
  // TODO: Implement check for Lelariva builds when available
  return false
})

const tabs = computed(() => {
  if (isStreamerMode.value) {
    return [{ id: 'my-builds', label: t('buildsPage.myBuilds') }]
  }

  const availableTabs = [
    { id: 'discover', label: t('buildsPage.discover') },
    { id: 'my-builds', label: t('buildsPage.myBuilds') },
  ]

  if (hasLelarivaBuilds.value) {
    availableTabs.push({ id: 'lelariva', label: t('buildsPage.lelarivaBuilds') })
  }

  return availableTabs
})

// Initialiser activeTab depuis l'URL, localStorage, ou par défaut 'discover'
const getInitialTab = (): string => {
  if (isStreamerMode.value) {
    return 'my-builds'
  }

  // Priorité 1: URL query parameter
  if (route.query.tab && typeof route.query.tab === 'string') {
    return route.query.tab
  }
  // Priorité 2: localStorage
  try {
    const savedTab = localStorage.getItem('lelanation_active_tab')
    if (savedTab && ['discover', 'my-builds', 'lelariva'].includes(savedTab)) {
      return savedTab
    }
  } catch {
    // Ignore localStorage errors
  }
  // Priorité 3: Défaut
  return 'discover'
}

const activeTab = ref(getInitialTab())

// Gérer le clic sur un onglet (désélectionner si déjà actif)
const handleTabClick = (tabId: string) => {
  if (activeTab.value === tabId) {
    // Si l'onglet est déjà actif, le désélectionner en revenant à 'discover'
    activeTab.value = 'discover'
  } else {
    activeTab.value = tabId
  }
}

// Sauvegarder l'onglet actif dans localStorage et mettre à jour l'URL
watch(activeTab, async newTab => {
  try {
    localStorage.setItem('lelanation_active_tab', newTab)
  } catch {
    // Ignore localStorage errors
  }
  // Mettre à jour l'URL sans recharger la page
  await navigateTo({ query: { tab: newTab } }, { replace: true })
})

watch(
  isStreamerMode,
  async enabled => {
    if (enabled && activeTab.value !== 'my-builds') {
      activeTab.value = 'my-builds'
      await navigateTo({ query: { tab: 'my-builds' } }, { replace: true })
    }
  },
  { immediate: true }
)

// Mettre à jour activeTab quand l'URL change (pour les liens directs)
watch(
  () => route.query.tab,
  async newTab => {
    if (isStreamerMode.value) {
      if (newTab !== 'my-builds') {
        activeTab.value = 'my-builds'
        await navigateTo({ query: { tab: 'my-builds' } }, { replace: true })
      }
      return
    }

    if (newTab && typeof newTab === 'string' && newTab !== activeTab.value) {
      activeTab.value = newTab
    }
  }
)

const confirmDelete = (buildId: string) => {
  buildToDelete.value = buildId
}

const deleteBuild = async () => {
  if (buildToDelete.value) {
    const success = await buildStore.deleteBuild(buildToDelete.value)
    if (success) {
      // Recharger la liste des builds pour mettre à jour l'affichage
      await discoveryStore.loadBuilds()
      buildToDelete.value = null
    }
  }
}

const clearComparison = () => {
  discoveryStore.clearComparison()
}

// Watch for changes in tabs to update active tab if current tab becomes unavailable
watch(
  () => tabs.value.map(t => t.id),
  availableTabIds => {
    if (!availableTabIds.includes(activeTab.value)) {
      activeTab.value = isStreamerMode.value ? 'my-builds' : 'discover'
    }
  }
)

onMounted(() => {
  voteStore.init()
  discoveryStore.loadBuilds()
})
</script>

<style scoped>
.tab-content {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
