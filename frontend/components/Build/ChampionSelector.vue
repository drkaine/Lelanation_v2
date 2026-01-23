<template>
  <div class="champion-selector" style="background: transparent !important">
    <!-- Search Bar -->
    <div class="mb-2">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search"
        class="w-full rounded border border-primary/50 bg-transparent px-2 py-1 text-sm text-text placeholder:text-text/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
        @input="handleSearch"
      />
    </div>

    <!-- Active Filters Display -->
    <div v-if="selectedRoles.length > 0" class="mb-2 flex flex-wrap gap-2">
      <span class="text-xs text-text/70">Filtres actifs:</span>
      <button
        v-for="role in selectedRoles"
        :key="role"
        class="rounded border border-accent bg-accent px-2 py-0.5 text-xs text-background"
        @click="toggleRole(role)"
      >
        {{ translateRole(role) }} ×
      </button>
    </div>

    <!-- Role Filters -->
    <div class="mb-3 flex flex-wrap gap-0">
      <button
        v-for="role in availableRoles"
        :key="role"
        :class="[
          'rounded-lg border px-3 py-1.5 text-sm font-semibold transition-all',
          selectedRoles.includes(role)
            ? 'border-surface bg-accent text-background'
            : 'border-accent bg-surface text-text',
        ]"
        style="margin-right: -1px"
        @click="toggleRole(role)"
      >
        {{ translateRole(role) }}
      </button>
    </div>

    <div v-if="championsStore.status === 'loading'" class="py-8 text-center">
      <p class="text-text">Loading champions...</p>
    </div>

    <div v-else-if="championsStore.status === 'error'" class="py-8 text-center">
      <p class="text-error">{{ championsStore.error }}</p>
    </div>

    <div v-else class="champions-list mt-2">
      <button
        v-for="champion in allChampions"
        :key="champion.id"
        :class="['champ', !isFiltered(champion) ? 'hide' : '']"
        @click="selectChampion(champion)"
      >
        <img
          :src="getChampionImageUrl(version, champion.image.full)"
          :alt="champion.name"
          loading="lazy"
          width="48"
          height="48"
          decoding="async"
        />
        <div v-if="isSelected(champion)" class="champ-selected" />
      </button>
    </div>

    <div v-if="filteredChampions.length === 0" class="py-8 text-center">
      <p class="text-text">No champions found</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useBuildStore } from '~/stores/BuildStore'
import type { Champion } from '~/types/build'

import { getChampionImageUrl } from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'

const championsStore = useChampionsStore()
const buildStore = useBuildStore()
const { locale, t } = useI18n()

const searchQuery = ref('')
const selectedRoles = ref<string[]>([])

// Translate role name
const translateRole = (role: string): string => {
  const roleKey = role.toLowerCase()
  return t(`champion.${roleKey}`, role)
}

// Convert i18n locale to Riot Games locale code
const getRiotLanguage = (locale: string): string => {
  const localeMap: Record<string, string> = {
    fr: 'fr_FR',
    en: 'en_US',
  }
  return localeMap[locale] || 'fr_FR'
}

const currentLanguage = computed(() => getRiotLanguage(locale.value))

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
  return championsStore.searchChampions(
    searchQuery.value,
    selectedRoles.value.length > 0 ? selectedRoles.value : undefined
  )
})

// All champions for display (filtered ones in color, others in grayscale)
const allChampions = computed(() => {
  return championsStore.champions
})

// Check if champion matches current filters
const isFiltered = (champion: Champion): boolean => {
  // If no filters, all champions are "filtered" (visible in color)
  if (selectedRoles.value.length === 0 && !searchQuery.value) {
    return true
  }

  // Check if champion is in filtered results
  return filteredChampions.value.some(c => c.id === champion.id)
}

const isSelected = (champion: Champion): boolean => {
  return buildStore.currentBuild?.champion?.id === champion.id
}

const selectChampion = (champion: Champion) => {
  buildStore.setChampion(champion)
}

const toggleRole = (role: string) => {
  const index = selectedRoles.value.indexOf(role)
  if (index > -1) {
    // Remove role if already selected
    selectedRoles.value.splice(index, 1)
  } else {
    // Add role if not selected
    selectedRoles.value.push(role)
  }
}

const handleSearch = () => {
  // Search is reactive via computed property
}

const { version } = useGameVersion()

// Load champions on mount and when language changes
const loadChampionsForCurrentLanguage = async () => {
  const language = currentLanguage.value
  await championsStore.loadChampions(language)
}

onMounted(() => {
  loadChampionsForCurrentLanguage()
})

// Watch for language changes and reload champions
watch(locale, () => {
  loadChampionsForCurrentLanguage()
})
</script>

<style scoped>
.champion-selector {
  background: transparent !important;
}

.champions-list {
  --champSizeButton: 51px;
  display: grid;
  grid-template-columns: repeat(auto-fit, var(--champSizeButton));
  place-content: center;
  width: 100%;
  gap: 0;
}

.champ {
  border: 1px solid transparent;
  position: relative;
  height: var(--champSizeButton);
  width: var(--champSizeButton);
  background-color: unset;
  display: inline-block;
  line-height: 1rem;
  border-radius: 0;
  appearance: none;
  cursor: pointer;
  padding: 0;
  margin: 0;
  transition: border-color 0.2s;
}

.champ.hide img {
  filter: grayscale(1) brightness(0.4);
}

.champ img {
  display: block;
  height: 100%;
  width: 100%;
  object-fit: cover;
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.8));
}

.champ-selected {
  position: absolute;
  inset: 0;
  border: 2px solid rgb(var(--rgb-accent));
  pointer-events: none;
}

@media (hover: hover) {
  .champ:hover {
    border-color: rgb(var(--rgb-accent));
    z-index: 1;
  }
}

@media (max-width: 700px) {
  .champions-list {
    --champSizeButton: 43px;
  }
}
</style>
