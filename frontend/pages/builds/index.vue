<template>
  <div class="builds-page min-h-screen p-4 text-text">
    <div class="mx-auto max-w-2xl px-2">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-3xl font-bold text-text-accent">Les Builds</h1>
        <NuxtLink
          to="/builds/create"
          class="rounded-lg bg-accent px-6 py-2 text-background transition-colors hover:bg-accent-dark"
        >
          Créer un Build
        </NuxtLink>
      </div>

      <!-- Tabs -->
      <div v-if="tabs.length > 1" class="mb-6 border-b-2 border-accent/70">
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
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>

      <!-- Tab Content: Discover -->
      <div v-if="activeTab === 'discover'" class="tab-content">
        <!-- Search and Filters -->
        <div class="mb-6 space-y-4">
          <BuildSearch />
          <BuildFilters />
        </div>

        <!-- Comparison Bar -->
        <div
          v-if="comparisonBuilds.length > 0"
          class="mb-6 rounded-lg border-2 border-accent bg-accent/20 p-4"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="font-semibold text-text">
                {{ comparisonBuilds.length }} build{{ comparisonBuilds.length > 1 ? 's' : '' }} en
                comparaison
              </p>
            </div>
            <div class="flex gap-2">
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
        <div v-if="builds.length === 0" class="py-12 text-center">
          <p class="mb-4 text-lg text-text-secondary">Aucun build sauvegardé</p>
          <NuxtLink
            to="/builds/create"
            class="inline-block rounded-lg bg-accent px-6 py-2 text-background transition-colors hover:bg-accent-dark"
          >
            Créer votre premier build
          </NuxtLink>
        </div>

        <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="build in builds"
            :key="build.id"
            class="rounded-lg border-2 border-primary bg-surface p-4 transition-colors hover:border-accent"
          >
            <div class="mb-3 flex items-start justify-between">
              <h3 class="text-lg font-bold text-text">{{ build.name }}</h3>
              <button
                class="text-sm text-error transition-colors hover:text-error/70"
                @click="confirmDelete(build.id)"
              >
                Supprimer
              </button>
            </div>

            <div v-if="build.champion" class="mb-3 flex items-center gap-3">
              <img
                :src="getChampionImageUrl(version, build.champion.image.full)"
                :alt="build.champion.name"
                class="h-12 w-12 rounded"
              />
              <div>
                <p class="font-semibold text-text">{{ build.champion.name }}</p>
                <p class="text-sm text-text/70">{{ build.champion.title }}</p>
              </div>
            </div>

            <div class="mb-3 flex gap-2">
              <img
                v-for="item in build.items.slice(0, 6)"
                :key="item.id"
                :src="getItemImageUrl(version, item.image.full)"
                :alt="item.name"
                class="h-8 w-8 rounded"
              />
            </div>

            <div class="mb-3 flex gap-2">
              <NuxtLink
                :to="`/builds/edit/${build.id}`"
                class="rounded-lg bg-accent px-4 py-2 text-sm text-background transition-colors hover:bg-accent-dark"
              >
                Modifier
              </NuxtLink>
              <button
                class="rounded-lg border border-accent/70 bg-surface px-4 py-2 text-sm text-text transition-colors hover:bg-accent/10"
                @click="loadBuild(build.id)"
              >
                Voir
              </button>
            </div>

            <p class="text-xs text-text/50">Créé le : {{ formatDate(build.createdAt) }}</p>
          </div>
        </div>
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
      <div class="mx-4 w-full max-w-md rounded-lg bg-surface p-6" @click.stop>
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
import { useBuildStore } from '~/stores/BuildStore'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useVoteStore } from '~/stores/VoteStore'
import BuildSearch from '~/components/BuildDiscovery/BuildSearch.vue'
import BuildFilters from '~/components/BuildDiscovery/BuildFilters.vue'
import BuildGrid from '~/components/BuildDiscovery/BuildGrid.vue'
import type { Build } from '~/types/build'
import { useGameVersion } from '~/composables/useGameVersion'

import { getChampionImageUrl, getItemImageUrl } from '~/utils/imageUrl'

const buildStore = useBuildStore()
const discoveryStore = useBuildDiscoveryStore()
const voteStore = useVoteStore()
const { version } = useGameVersion()

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

const activeTab = ref('discover')

const confirmDelete = (buildId: string) => {
  buildToDelete.value = buildId
}

const deleteBuild = () => {
  if (buildToDelete.value) {
    buildStore.deleteBuild(buildToDelete.value)
    buildToDelete.value = null
  }
}

const loadBuild = (buildId: string) => {
  buildStore.loadBuild(buildId)
  navigateTo(`/builds/edit/${buildId}`)
}

const clearComparison = () => {
  discoveryStore.clearComparison()
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('fr-FR')
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
