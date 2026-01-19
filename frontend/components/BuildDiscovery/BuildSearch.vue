<template>
  <div class="build-search">
    <div class="relative">
      <input
        v-model="localSearchQuery"
        type="text"
        placeholder="Search builds by champion name..."
        class="w-full rounded border border-primary bg-surface px-4 py-3 pl-10 text-text"
        @input="handleSearch"
      />
      <span class="text-text/50 absolute left-3 top-1/2 -translate-y-1/2">🔍</span>
    </div>

    <div v-if="resultsCount > 0" class="text-text/70 mt-2 text-sm">
      {{ resultsCount }} build{{ resultsCount > 1 ? 's' : '' }} found
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useDebounce } from '~/composables/useDebounce'

const discoveryStore = useBuildDiscoveryStore()

const localSearchQuery = ref(discoveryStore.searchQuery)
const debouncedQuery = useDebounce(localSearchQuery, 300)

const resultsCount = computed(() => discoveryStore.filteredBuilds.length)

const handleSearch = () => {
  // Search is handled by debounced watcher
}

watch(debouncedQuery, newQuery => {
  discoveryStore.setSearchQuery(newQuery)
})
</script>
