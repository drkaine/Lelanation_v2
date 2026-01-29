<template>
  <div class="builds-page min-h-screen p-4 text-text">
    <div class="max-w-8xl mx-auto px-2">
      <!-- Tabs -->
      <div v-if="tabs.length > 1" class="mb-6 border-b-2 border-accent/70">
        <div class="flex items-center justify-between">
          <div class="flex gap-4">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              :class="[
                'px-6 py-3 font-semibold transition-colors',
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
            to="/builds/create"
            class="rounded-lg bg-accent px-3 py-1.5 text-sm text-background transition-colors hover:bg-accent-dark"
          >
            Créer un Build
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
                {{ comparisonBuilds.length }} build{{ comparisonBuilds.length > 1 ? 's' : '' }} en
                comparaison
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <NuxtLink
                to="/builds/compare"
                class="rounded-lg bg-accent px-4 py-2 text-background transition-colors hover:bg-accent-dark"
              >
                Comparer
              </NuxtLink>
              <button
                class="rounded-lg border border-accent/70 bg-surface px-4 py-2 text-text transition-colors hover:bg-accent/10"
                @click="clearComparison"
              >
                Effacer
              </button>
            </div>
          </div>
        </div>

        <!-- Build Grid -->
        <BuildGrid />
      </div>

      <!-- Tab Content: My Builds -->
      <div v-if="activeTab === 'my-builds'" class="tab-content">
        <!-- Search and Filters -->
        <div class="mb-6 space-y-4">
          <div class="flex flex-wrap items-center gap-4">
            <BuildSearch />
            <BuildFilters />
          </div>
        </div>

        <!-- Build Grid avec les builds de l'utilisateur -->
        <BuildGrid
          :custom-builds="builds"
          :show-user-actions="true"
          @delete-build="confirmDelete"
        />
      </div>

      <!-- Tab Content: Lelariva Builds -->
      <div v-if="activeTab === 'lelariva'" class="tab-content">
        <div class="py-12 text-center">
          <p class="mb-4 text-lg text-text-secondary">Builds de Lelariva</p>
          <p class="text-text-secondary">Cette section sera disponible prochainement</p>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div
      v-if="buildToDelete"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click="buildToDelete = null"
    >
      <div
        class="mx-4 w-full max-w-md rounded-lg bg-surface p-6"
        style="background-color: var(--color-surface); opacity: 1"
        @click.stop
      >
        <h3 class="mb-4 text-lg font-bold text-text">Supprimer le build ?</h3>
        <p class="mb-6 text-text">
          Êtes-vous sûr de vouloir supprimer ce build ? Cette action est irréversible.
        </p>
        <div class="flex gap-4">
          <button
            class="rounded-lg bg-error px-4 py-2 text-text transition-colors hover:bg-error/80"
            @click="deleteBuild"
          >
            Supprimer
          </button>
          <button
            class="rounded-lg border border-accent/70 bg-surface px-4 py-2 text-text transition-colors hover:bg-accent/10"
            @click="buildToDelete = null"
          >
            Annuler
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

const buildStore = useBuildStore()
const discoveryStore = useBuildDiscoveryStore()
const voteStore = useVoteStore()
const route = useRoute()

const buildToDelete = ref<string | null>(null)

const builds = computed<Build[]>(() => buildStore.getSavedBuilds())
const comparisonBuilds = computed(() => discoveryStore.comparisonBuilds)

// Check if there are Lelariva builds (placeholder for now)
const hasLelarivaBuilds = computed(() => {
  // TODO: Implement check for Lelariva builds when available
  return false
})

// Filter tabs based on available builds
const tabs = computed(() => {
  const availableTabs = [{ id: 'discover', label: 'Découvrir' }]

  if (builds.value.length > 0) {
    availableTabs.push({ id: 'my-builds', label: 'Mes Builds' })
  }

  if (hasLelarivaBuilds.value) {
    availableTabs.push({ id: 'lelariva', label: 'Builds de Lelariva' })
  }

  return availableTabs
})

// Initialiser activeTab depuis l'URL, localStorage, ou par défaut 'discover'
const getInitialTab = (): string => {
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

// Mettre à jour activeTab quand l'URL change (pour les liens directs)
watch(
  () => route.query.tab,
  newTab => {
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
      activeTab.value = 'discover'
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
