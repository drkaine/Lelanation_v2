<template>
  <div class="build-grid">
    <div v-if="builds.length === 0" class="py-12 text-center">
      <p class="text-lg text-text">No builds found</p>
      <p class="text-text/70 mt-2 text-sm">
        {{ hasActiveFilters ? 'Try adjusting your filters' : 'Create your first build!' }}
      </p>
      <NuxtLink
        v-if="!hasActiveFilters"
        to="/builds/create"
        class="mt-4 inline-block rounded bg-accent px-6 py-2 text-background hover:bg-accent-dark"
      >
        Create Build
      </NuxtLink>
    </div>

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      <BuildCard
        v-for="build in builds"
        :key="build.id"
        :build="build"
        :show-add-to-comparison="showComparisonButtons"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import BuildCard from './BuildCard.vue'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'

interface Props {
  showComparisonButtons?: boolean
}

withDefaults(defineProps<Props>(), {
  showComparisonButtons: true,
})

const discoveryStore = useBuildDiscoveryStore()

const builds = computed(() => discoveryStore.filteredBuilds)
const hasActiveFilters = computed(() => discoveryStore.hasActiveFilters)
</script>
