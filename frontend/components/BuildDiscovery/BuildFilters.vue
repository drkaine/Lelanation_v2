<template>
  <div class="build-filters">
    <div class="mb-4 flex flex-wrap items-center gap-4">
      <!-- Up-to-date toggle -->
      <label class="flex cursor-pointer items-center gap-2">
        <input
          v-model="onlyUpToDate"
          type="checkbox"
          class="rounded border-primary"
          @change="handleUpToDateChange"
        />
        <span class="text-sm text-text">À jour</span>
      </label>

      <!-- Champion filter -->
      <div class="flex items-center gap-2">
        <label class="text-sm text-text">Champion:</label>
        <select
          v-model="selectedChampion"
          class="rounded border border-primary bg-surface px-3 py-1 text-sm text-text"
          @change="handleChampionChange"
        >
          <option :value="null">All Champions</option>
          <option v-for="champion in availableChampions" :key="champion.id" :value="champion.id">
            {{ champion.name }}
          </option>
        </select>
      </div>

      <!-- Role filter -->
      <div class="flex items-center gap-2">
        <label class="text-sm text-text">Role:</label>
        <select
          v-model="selectedRole"
          class="rounded border border-primary bg-surface px-3 py-1 text-sm text-text"
          @change="handleRoleChange"
        >
          <option :value="null">All Roles</option>
          <option value="top">Top</option>
          <option value="jungle">Jungle</option>
          <option value="mid">Mid</option>
          <option value="adc">ADC</option>
          <option value="support">Support</option>
        </select>
      </div>

      <!-- Sort -->
      <div class="flex items-center gap-2">
        <label class="text-sm text-text">Sort:</label>
        <select
          v-model="sortBy"
          class="rounded border border-primary bg-surface px-3 py-1 text-sm text-text"
          @change="handleSortChange"
        >
          <option value="recent">Most Recent</option>
          <option value="popular">Most Popular</option>
          <option value="name">Name (A-Z)</option>
        </select>
      </div>

      <!-- Clear filters -->
      <button
        v-if="hasActiveFilters"
        class="rounded bg-surface px-3 py-1 text-sm text-text hover:bg-primary hover:text-white"
        @click="clearFilters"
      >
        Clear Filters
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useChampionsStore } from '~/stores/ChampionsStore'
import type { FilterRole, SortOption } from '~/stores/BuildDiscoveryStore'

const discoveryStore = useBuildDiscoveryStore()
const championsStore = useChampionsStore()

const onlyUpToDate = ref(discoveryStore.onlyUpToDate)
const selectedChampion = ref<string | null>(discoveryStore.selectedChampion)
const selectedRole = ref<FilterRole>(discoveryStore.selectedRole)
const sortBy = ref<SortOption>(discoveryStore.sortBy)

const hasActiveFilters = computed(() => discoveryStore.hasActiveFilters)

const availableChampions = computed(() => {
  // Get unique champions from builds
  const championIds = new Set(
    discoveryStore.builds.map(build => build.champion?.id).filter(Boolean) as string[]
  )
  return championsStore.champions.filter(champion => championIds.has(champion.id))
})

const handleUpToDateChange = () => {
  discoveryStore.setOnlyUpToDate(onlyUpToDate.value)
}

const handleChampionChange = () => {
  discoveryStore.setSelectedChampion(selectedChampion.value)
}

const handleRoleChange = () => {
  discoveryStore.setSelectedRole(selectedRole.value)
}

const handleSortChange = () => {
  discoveryStore.setSortBy(sortBy.value)
}

const clearFilters = () => {
  discoveryStore.clearAllFilters()
  onlyUpToDate.value = false
  selectedChampion.value = null
  selectedRole.value = null
  sortBy.value = 'recent'
}

onMounted(() => {
  if (championsStore.champions.length === 0) {
    championsStore.loadChampions()
  }
})
</script>
