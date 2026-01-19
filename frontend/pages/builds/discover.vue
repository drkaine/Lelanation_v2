<template>
  <div class="build-discovery min-h-screen p-4 text-text">
    <div class="mx-auto max-w-7xl">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-3xl font-bold text-text">Discover Builds</h1>
        <NuxtLink
          to="/builds/create"
          class="rounded bg-accent px-6 py-2 text-background hover:bg-accent-dark"
        >
          Create Build
        </NuxtLink>
      </div>

      <!-- Search and Filters -->
      <div class="mb-6 space-y-4">
        <BuildSearch />
        <BuildFilters />
      </div>

      <!-- Comparison Bar -->
      <div
        v-if="comparisonBuilds.length > 0"
        class="bg-accent/20 mb-6 rounded-lg border-2 border-accent p-4"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="font-semibold text-text">
              {{ comparisonBuilds.length }} build{{ comparisonBuilds.length > 1 ? 's' : '' }} in
              comparison
            </p>
          </div>
          <div class="flex gap-2">
            <NuxtLink
              to="/builds/compare"
              class="rounded bg-accent px-4 py-2 text-background hover:bg-accent-dark"
            >
              Compare
            </NuxtLink>
            <button
              class="rounded bg-surface px-4 py-2 text-text hover:bg-primary hover:text-white"
              @click="clearComparison"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <!-- Build Grid -->
      <BuildGrid />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import BuildSearch from '~/components/BuildDiscovery/BuildSearch.vue'
import BuildFilters from '~/components/BuildDiscovery/BuildFilters.vue'
import BuildGrid from '~/components/BuildDiscovery/BuildGrid.vue'

const discoveryStore = useBuildDiscoveryStore()

const comparisonBuilds = computed(() => discoveryStore.comparisonBuilds)

const clearComparison = () => {
  discoveryStore.clearComparison()
}

onMounted(() => {
  discoveryStore.loadBuilds()
})
</script>
