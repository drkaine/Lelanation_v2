<template>
  <div class="builds-page min-h-screen px-[10px] pb-4 text-text">
    <div class="max-w-8xl mx-auto px-0">
      <div class="flex justify-center">
        <div class="streamer-tabs">
          <button
            type="button"
            class="streamer-tab-button"
            :class="{ 'is-active': activeTab === 'discover' }"
            @click="activeTab = 'discover'"
          >
            {{ t('buildsPage.discover') }}
          </button>
          <button
            type="button"
            class="streamer-tab-button"
            :class="{ 'is-active': activeTab === 'my-builds' }"
            @click="activeTab = 'my-builds'"
          >
            {{ t('buildsPage.myBuilds') }}
          </button>
          <button
            v-if="favoriteBuilds.length > 0"
            type="button"
            class="streamer-tab-button"
            :class="{ 'is-active': activeTab === 'favoris' }"
            @click="activeTab = 'favoris'"
          >
            {{ t('buildsPage.myFavorites') }}
          </button>
          <NuxtLink :to="localePath('/builds/create')" class="streamer-tab-button">
            {{ t('buildsPage.createBuild') }}
          </NuxtLink>
        </div>
      </div>

      <!-- Tab Content: Discover -->
      <div v-if="activeTab === 'discover'" class="tab-content">
        <!-- Search and Filters -->
        <div class="mb-3">
          <div class="flex flex-wrap items-center gap-2">
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
        <BuildGrid :show-favorite-toggle="true" />
      </div>

      <!-- Tab Content: My Builds -->
      <div v-if="activeTab === 'my-builds'" class="tab-content">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <BuildSearch />
          <BuildFilters />
          <span class="text-sm text-text-secondary">
            {{ t('buildsPage.visibility') }}
          </span>
          <select
            v-model="myBuildsVisibilityFilter"
            class="filter-like-select md:hidden"
            :aria-label="t('buildsPage.visibility')"
          >
            <option v-for="opt in visibilityFilterOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <div class="filter-like-segmented hidden p-0.5 md:flex">
            <button
              v-for="opt in visibilityFilterOptions"
              :key="opt.value"
              :class="[
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                myBuildsVisibilityFilter === opt.value
                  ? 'bg-primary/30 text-text'
                  : 'text-text-secondary hover:bg-primary/20 hover:text-text',
              ]"
              @click="myBuildsVisibilityFilter = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
          <button
            v-if="adminMode"
            class="ml-auto flex min-h-[38px] items-center gap-2 rounded-lg border border-primary/80 bg-background/25 px-3 py-2 text-sm text-text transition-colors hover:bg-primary/20"
            :disabled="shareLoading"
            @click="shareBuilds"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M3 7a2 2 0 0 1 2-2h8l5 5v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
              <path d="M13 5v5h5" />
              <path d="m8 14 3 3 5-5" />
            </svg>
            {{ shareLoading ? 'Import en cours...' : "Importer dans l'app" }}
          </button>
        </div>

        <!-- Build Grid avec les builds de l'utilisateur -->
        <BuildGrid
          :custom-builds="buildsFilteredByVisibility"
          :show-user-actions="true"
          @delete-build="confirmDelete"
          @toggle-visibility="toggleBuildVisibility"
        />
      </div>

      <!-- Tab Content: Mes favoris -->
      <div v-if="activeTab === 'favoris'" class="tab-content">
        <div class="mb-3">
          <div class="flex flex-wrap items-center gap-2">
            <BuildSearch />
            <BuildFilters />
          </div>
        </div>
        <BuildGrid :custom-builds="favoriteBuilds" :show-favorite-toggle="true" />
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

    <!-- Share Code Modal -->
    <div
      v-if="shareCode"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      @click="shareCode = null"
    >
      <div
        class="mx-4 w-full max-w-sm rounded-lg bg-surface p-6 text-center"
        style="background-color: var(--color-surface); opacity: 1"
        @click.stop
      >
        <h3 class="mb-2 text-lg font-bold text-text">{{ t('buildsPage.shareCodeTitle') }}</h3>
        <p class="mb-4 text-sm text-text-secondary">
          {{ t('buildsPage.shareCodeDescription') }}
        </p>
        <div
          class="mx-auto mb-4 flex w-fit items-center gap-3 rounded-lg border-2 border-accent bg-background px-6 py-3 font-mono text-3xl font-bold tracking-[0.3em] text-accent"
        >
          {{ shareCode }}
          <button
            type="button"
            class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded p-1 text-text-secondary transition-colors hover:text-accent"
            :aria-label="t('buildsPage.shareCodeCopy')"
            :title="t('buildsPage.shareCodeCopy')"
            @click="copyShareCode"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        </div>
        <p v-if="shareCopied" class="mb-2 text-sm text-green-400">
          {{ t('buildsPage.shareCodeCopied') }}
        </p>
        <p class="mb-4 text-xs text-text-secondary">{{ t('buildsPage.shareCodeExpiry') }}</p>
        <button
          class="rounded-lg border border-accent/70 bg-surface px-4 py-2 text-sm text-text transition-colors hover:bg-accent/10"
          @click="shareCode = null"
        >
          {{ t('buildsPage.shareCodeClose') }}
        </button>
      </div>
    </div>

    <!-- Share Error Toast -->
    <div
      v-if="shareError"
      class="fixed bottom-4 right-4 z-50 rounded-lg bg-error px-4 py-3 text-sm text-white shadow-lg"
    >
      {{ shareError }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useBuildStore } from '~/stores/BuildStore'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useVoteStore } from '~/stores/VoteStore'
import { useFavoritesStore } from '~/stores/FavoritesStore'
import BuildSearch from '~/components/BuildDiscovery/BuildSearch.vue'
import BuildFilters from '~/components/BuildDiscovery/BuildFilters.vue'
import BuildGrid from '~/components/BuildDiscovery/BuildGrid.vue'
import type { Build } from '~/types/build'
import { serializeBuild } from '~/utils/buildSerialize'
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

const buildToDelete = ref<string | null>(null)
const shareCode = ref<string | null>(null)
const shareLoading = ref(false)
const shareError = ref<string | null>(null)
const shareCopied = ref(false)

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
  if (!hydrated.value) return []
  const version = buildStore.savedBuildsVersion
  const list = buildStore.getSavedBuilds()
  const filter = myBuildsVisibilityFilter.value
  if (filter === 'all') return list
  return list.filter(b => (b.visibility ?? 'public') === filter && version >= 0)
})
const comparisonBuilds = computed(() => discoveryStore.comparisonBuilds)

/** Builds favoris : intersection des IDs favoris avec les builds chargés (saved + discovery). */
const favoriteBuilds = computed(() => {
  if (!hydrated.value) return []
  const ids = new Set(favoritesStore.favoriteBuildIds)
  if (ids.size === 0) return []
  const saved = buildStore.getSavedBuilds()
  const fromDiscovery = discoveryStore.builds
  const byId = new Map<string, Build>()
  for (const b of saved) byId.set(b.id, b)
  for (const b of fromDiscovery) if (!byId.has(b.id)) byId.set(b.id, b)
  return favoritesStore.favoriteBuildIds
    .map((id: string) => byId.get(id))
    .filter((b: Build | undefined): b is Build => Boolean(b))
})

// Check if there are Lelariva builds (placeholder for now)
const _hasLelarivaBuilds = computed(() => {
  // TODO: Implement check for Lelariva builds when available
  return false
})

// SSR-safe initial tab: only route query (no localStorage before hydration)
const getInitialTabFromRoute = (): string => {
  if (route.query.tab && typeof route.query.tab === 'string') return route.query.tab
  return 'discover'
}

// Client-only initial tab: route -> localStorage fallback (after hydration)
const getInitialTabFromClient = (): string => {
  if (route.query.tab && typeof route.query.tab === 'string') return route.query.tab
  try {
    const savedTab = localStorage.getItem('lelanation_active_tab')
    if (savedTab && ['discover', 'my-builds', 'favoris', 'lelariva'].includes(savedTab)) {
      return savedTab
    }
  } catch {
    // ignore
  }
  return 'discover'
}

const activeTab = ref(getInitialTabFromRoute())

if (import.meta.client) {
  // Sauvegarder l'onglet actif dans localStorage et mettre à jour l'URL
  watch(activeTab, async newTab => {
    try {
      localStorage.setItem('lelanation_active_tab', newTab)
    } catch {
      // ignore
    }
    await navigateTo({ query: { tab: newTab } }, { replace: true })
  })
}

// Mettre à jour activeTab quand l'URL change (pour les liens directs)
watch(
  () => route.query.tab,
  newTab => {
    if (newTab && typeof newTab === 'string' && newTab !== activeTab.value) {
      activeTab.value = newTab
    }
  }
)

watch(
  isStreamerMode,
  enabled => {
    if (enabled && !['discover', 'my-builds'].includes(activeTab.value)) {
      activeTab.value = 'discover'
    }
  },
  { immediate: true }
)

const shareBuilds = async () => {
  const allBuilds = buildStore.getSavedBuilds()
  if (allBuilds.length === 0) {
    shareError.value = t('buildsPage.shareNoBuilds')
    setTimeout(() => {
      shareError.value = null
    }, 3000)
    return
  }

  shareLoading.value = true
  shareError.value = null
  try {
    const stored = allBuilds.map(b => serializeBuild(b))
    const buildIds = new Set(allBuilds.map(b => b.id))
    const favoriteIds = favoritesStore.favoriteBuildIds.filter(id => buildIds.has(id))
    const res = await $fetch<{ code: string; expiresAt: string }>('/api/share-builds', {
      method: 'POST',
      body: { builds: stored, favoriteIds },
    })
    shareCode.value = res.code
    shareCopied.value = false
  } catch {
    shareError.value = t('buildsPage.shareError')
    setTimeout(() => {
      shareError.value = null
    }, 4000)
  } finally {
    shareLoading.value = false
  }
}

const copyShareCode = async () => {
  if (!shareCode.value) return
  try {
    await navigator.clipboard.writeText(shareCode.value)
    shareCopied.value = true
    setTimeout(() => {
      shareCopied.value = false
    }, 2000)
  } catch {
    // Fallback: select text for manual copy
  }
}

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

const toggleBuildVisibility = async (buildId: string) => {
  if (!hydrated.value) return
  const target = buildStore.getSavedBuilds().find(b => b.id === buildId)
  if (!target) return
  const nextVisibility: 'public' | 'private' =
    (target.visibility ?? 'public') === 'private' ? 'public' : 'private'
  const success = await buildStore.setSavedBuildVisibility(buildId, nextVisibility)
  if (success) {
    await discoveryStore.loadBuilds()
  }
}

const clearComparison = () => {
  discoveryStore.clearComparison()
}

onMounted(() => {
  favoritesStore.init()
  voteStore.init()
  discoveryStore.restorePaginationFromStorage()
  discoveryStore.loadBuilds()
  // Apply client-side tab preference after hydration to avoid SSR/CSR mismatch
  activeTab.value = getInitialTabFromClient()
})
</script>

<style scoped>
.tab-content {
  animation: fadeIn 0.3s ease-in;
}

.builds-page {
  padding-top: 10px;
}

.streamer-tabs {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  border: 1px solid rgb(var(--rgb-accent) / 0.2);
  border-radius: 9999px;
  background: rgb(var(--rgb-background) / 0.22);
  padding: 0.2rem;
  max-width: 100%;
}

.streamer-tab-button {
  border: none;
  border-radius: 9999px;
  background: transparent;
  min-height: 36px;
  padding: 0.45rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.1;
  color: rgb(var(--rgb-text) / 0.75);
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}

.streamer-tab-button.is-active {
  background: rgb(var(--rgb-accent) / 0.2);
  color: var(--color-accent);
}

.filter-like-select {
  border-radius: 0.5rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.8);
  background: rgb(var(--rgb-background) / 0.25);
  padding: 0.45rem 0.75rem;
  font-size: 0.875rem;
  color: rgb(var(--rgb-text));
}

.filter-like-segmented {
  border-radius: 0.5rem;
  border: 1px solid rgb(var(--rgb-primary) / 0.8);
  background: rgb(var(--rgb-background) / 0.25);
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
