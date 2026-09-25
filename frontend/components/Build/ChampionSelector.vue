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
        class="champion-search-input ui-build-card-surface rounded-lg px-2 py-1 text-sm text-text placeholder:text-text/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
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
import { computed } from 'vue'
import { useChampionGridFilter } from '~/composables/useChampionGridFilter'
import { useBuildStore } from '~/stores/BuildStore'
import type { Champion } from '~/types/build'
import { getChampionImageUrl } from '~/utils/imageUrl'
import { championStatsDetailPath } from '~/utils/championStatsRoutes'

const props = withDefaults(
  defineProps<{
    /** Navigate to champion stats instead of updating the build draft. */
    navigateToStatistics?: boolean
  }>(),
  { navigateToStatistics: false }
)

const buildStore = useBuildStore()
const { t } = useI18n()
const localePath = useLocalePath()
const router = useRouter()
const route = useRoute()

const {
  championsStore,
  version,
  searchQuery,
  selectedRoles,
  availableRoles,
  filteredChampions,
  allChampions,
  isFiltered,
  toggleRole,
  translateRole,
  loadChampionDetails,
} = useChampionGridFilter()

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
  buildStore.setChampion(await loadChampionDetails(champion))
}
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
