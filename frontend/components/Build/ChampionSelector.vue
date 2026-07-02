<template>
  <div class="champion-selector" style="background: transparent !important">
    <!-- Search + role filters -->
    <div class="champion-toolbar mb-3">
      <label for="champion-search" class="sr-only">
        {{ t('common.search') }}
      </label>
      <input
        id="champion-search"
        v-model="searchQuery"
        type="text"
        :placeholder="t('common.search')"
        class="champion-search-input ui-build-card-surface rounded-lg px-2 py-1 text-sm text-text placeholder:text-text/50 focus:outline-none"
        @input="handleSearch"
      />
      <div class="champion-filter-bar flex flex-wrap">
        <button
          v-for="role in availableRoles"
          :key="role"
          type="button"
          :class="[
            'champion-filter-btn ui-build-card-button text-sm font-semibold',
            selectedRoles.includes(role) ? 'is-active' : '',
          ]"
          @click="toggleRole(role)"
        >
          {{ translateRole(role) }}
        </button>
      </div>
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
        :class="[
          'champ',
          !isFiltered(champion) ? 'hide' : '',
          hasSelectedChampion && !isSelected(champion) ? 'champ-dimmed' : '',
        ]"
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
import { championStatsDetailPath } from '~/utils/championStatsRoutes'

const props = withDefaults(
  defineProps<{
    /** Navigate to champion stats instead of updating the build draft. */
    navigateToStatistics?: boolean
  }>(),
  { navigateToStatistics: false }
)

const championsStore = useChampionsStore()
const buildStore = useBuildStore()
const { locale, t } = useI18n()
const localePath = useLocalePath()
const router = useRouter()
const route = useRoute()

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
  if (props.navigateToStatistics) return false
  return buildStore.currentBuild?.champion?.id === champion.id
}

const hasSelectedChampion = computed(() =>
  props.navigateToStatistics ? false : Boolean(buildStore.currentBuild?.champion?.id)
)

function statisticsSharedQuery(): Record<string, string> {
  const keys = ['version', 'role', 'otp', 'rankTier', 'tab'] as const
  const out: Record<string, string> = {}
  for (const key of keys) {
    const value = route.query[key]
    if (typeof value === 'string' && value.length > 0) out[key] = value
  }
  return out
}

const selectChampion = async (champion: Champion) => {
  if (props.navigateToStatistics) {
    const key = parseInt(String(champion.key), 10)
    if (!Number.isFinite(key) || key <= 0) return
    const path = championStatsDetailPath(
      key,
      localePath,
      championsStore.champions.map(c => ({ id: c.id, key: c.key }))
    )
    await router.push({
      path,
      query: statisticsSharedQuery(),
    })
    return
  }

  if (isSelected(champion)) {
    buildStore.clearChampion()
    return
  }
  const detailed =
    (await championsStore
      .loadChampionDetails(champion.id, currentLanguage.value)
      .catch(() => null)) ?? champion
  buildStore.setChampion(detailed as Champion)
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

.champion-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  width: 100%;
}

.champion-search-input {
  flex: 1 1 5rem;
  min-width: 5rem;
  max-width: 100%;
  width: auto;
}

.champion-filter-bar {
  flex: 0 1 auto;
  gap: 5px;
}

.champion-filter-btn {
  padding: 0.35rem 0.6rem;
  margin: 0;
}

.champions-list {
  --champSizeButton: 59px;
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

.champ img {
  display: block;
  height: 100%;
  width: 100%;
  object-fit: cover;
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.8));
}

.champ.hide img {
  filter: grayscale(1) brightness(0.4);
}

.champ-dimmed img {
  filter: grayscale(1) brightness(0.45);
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

  .champ-dimmed:hover img {
    filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.8));
  }
}

@media (max-width: 700px) {
  .champions-list {
    --champSizeButton: 48px;
  }
}
</style>
