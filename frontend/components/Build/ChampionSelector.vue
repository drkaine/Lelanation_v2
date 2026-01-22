<template>
  <div class="champion-selector">
    <div class="mb-4">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search champions..."
        class="w-full rounded border border-primary bg-surface px-4 py-2 text-text"
        @input="handleSearch"
      />
    </div>

    <div v-if="selectedRole" class="mb-4">
      <button class="rounded bg-primary px-3 py-1 text-sm text-white" @click="selectedRole = null">
        Clear filter: {{ selectedRole }}
      </button>
    </div>

    <div class="mb-4 flex flex-wrap gap-2">
      <button
        v-for="role in availableRoles"
        :key="role"
        :class="[
          'rounded px-3 py-1 text-sm transition-colors',
          selectedRole === role
            ? 'bg-accent text-background'
            : 'bg-surface text-text hover:bg-primary hover:text-white',
        ]"
        @click="toggleRole(role)"
      >
        {{ role }}
      </button>
    </div>

    <div v-if="championsStore.status === 'loading'" class="py-8 text-center">
      <p class="text-text">Loading champions...</p>
    </div>

    <div v-else-if="championsStore.status === 'error'" class="py-8 text-center">
      <p class="text-error">{{ championsStore.error }}</p>
    </div>

    <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      <button
        v-for="champion in filteredChampions"
        :key="champion.id"
        :class="[
          'flex flex-col items-center rounded border-2 p-3 transition-all',
          isSelected(champion)
            ? 'border-accent bg-accent/20'
            : 'border-surface hover:border-primary',
        ]"
        @click="selectChampion(champion)"
      >
        <img
          :src="getChampionImageUrl(version, champion.image.full)"
          :alt="champion.name"
          class="mb-2 h-16 w-16 rounded"
        />
        <span class="text-center text-sm text-text">{{ champion.name }}</span>
      </button>
    </div>

    <div v-if="filteredChampions.length === 0" class="py-8 text-center">
      <p class="text-text">No champions found</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useBuildStore } from '~/stores/BuildStore'
import type { Champion } from '~/types/build'

import { getChampionImageUrl } from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'

const championsStore = useChampionsStore()
const buildStore = useBuildStore()

const searchQuery = ref('')
const selectedRole = ref<string | null>(null)

const availableRoles = computed(() => {
  const roles = new Set<string>()
  for (const champion of championsStore.champions) {
    for (const tag of champion.tags) {
      roles.add(tag)
    }
  }
  return Array.from(roles).sort()
})

const filteredChampions = computed(() => {
  return championsStore.searchChampions(searchQuery.value, selectedRole.value || undefined)
})

const isSelected = (champion: Champion): boolean => {
  return buildStore.currentBuild?.champion?.id === champion.id
}

const selectChampion = (champion: Champion) => {
  buildStore.setChampion(champion)
}

const toggleRole = (role: string) => {
  selectedRole.value = selectedRole.value === role ? null : role
}

const handleSearch = () => {
  // Search is reactive via computed property
}

const { version } = useGameVersion()

onMounted(() => {
  if (championsStore.champions.length === 0) {
    championsStore.loadChampions()
  }
})
</script>
