<template>
  <div class="builds-by-champion min-h-screen p-4 text-text">
    <div class="max-w-8xl mx-auto px-2">
      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-wrap items-center gap-3">
          <NuxtLink
            to="/builds"
            class="rounded-lg bg-surface px-4 py-2 text-text transition-colors hover:bg-primary hover:text-white"
          >
            ← Retour
          </NuxtLink>
          <h1 class="text-xl font-bold text-text sm:text-2xl">
            Builds: {{ championName || championId }}
          </h1>
        </div>
      </div>

      <div class="mb-6 space-y-4">
        <BuildSearch />
        <BuildFilters />
      </div>

      <BuildGrid />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import BuildSearch from '~/components/BuildDiscovery/BuildSearch.vue'
import BuildFilters from '~/components/BuildDiscovery/BuildFilters.vue'
import BuildGrid from '~/components/BuildDiscovery/BuildGrid.vue'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useChampionsStore } from '~/stores/ChampionsStore'

const route = useRoute()
const discoveryStore = useBuildDiscoveryStore()
const championsStore = useChampionsStore()

const championId = computed(() => route.params.id as string)

const championName = computed(() => {
  const champ = championsStore.champions.find(c => c.id === championId.value)
  return champ?.name || null
})

onMounted(async () => {
  await discoveryStore.loadBuilds()
  discoveryStore.setSelectedChampion(championId.value)

  if (championsStore.champions.length === 0) {
    championsStore.loadChampions()
  }
})
</script>
