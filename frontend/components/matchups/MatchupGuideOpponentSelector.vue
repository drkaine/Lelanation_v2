<template>
  <div class="matchup-opponent-selector">
    <div class="champion-toolbar mb-3">
      <label for="matchup-opponent-search" class="sr-only">{{ t('common.search') }}</label>
      <input
        id="matchup-opponent-search"
        v-model="searchQuery"
        type="text"
        :placeholder="t('common.search')"
        class="champion-search-input rounded border border-primary/50 bg-transparent px-2 py-1 text-sm text-text placeholder:text-text/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
      />
      <div class="champion-filter-bar flex flex-wrap">
        <button
          v-for="role in availableRoles"
          :key="role"
          type="button"
          :class="[
            'champion-filter-btn rounded-lg border text-sm font-semibold transition-all',
            selectedRoles.includes(role)
              ? 'border-surface bg-accent text-background'
              : 'border-accent bg-surface text-text',
          ]"
          @click="toggleRole(role)"
        >
          {{ translateRole(role) }}
        </button>
      </div>
    </div>

    <div v-if="championsStore.status === 'loading'" class="py-8 text-center">
      <p class="text-text">{{ t('matchupGuideDiscovery.loading') }}</p>
    </div>

    <div v-else class="champions-list mt-2">
      <button
        v-for="champion in allChampions"
        :key="champion.id"
        type="button"
        :disabled="isExcluded(champion) || isRanked(champion)"
        :class="[
          'champ',
          !isFiltered(champion) ? 'hide' : '',
          isRanked(champion) ? 'champ-ranked' : '',
          isExcluded(champion) ? 'champ-excluded' : '',
        ]"
        :title="championTitle(champion)"
        @click="selectOpponent(champion)"
      >
        <img
          :src="getChampionImageUrl(version, champion.image.full)"
          :alt="champion.name"
          loading="lazy"
          width="48"
          height="48"
          decoding="async"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useMatchupGuideDraftStore } from '~/stores/MatchupGuideDraftStore'
import type { Champion } from '~/types/build'
import { championToRef } from '~/utils/matchupGuideFromBuild'
import { getChampionImageUrl } from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'

const props = defineProps<{
  excludeChampionId?: string | null
}>()

const { t, locale } = useI18n()
const championsStore = useChampionsStore()
const draftStore = useMatchupGuideDraftStore()
const searchQuery = ref('')
const selectedRoles = ref<string[]>([])
const { version } = useGameVersion()

function getRiotLanguage(loc: string): string {
  return loc === 'en' ? 'en_US' : 'fr_FR'
}

const currentLanguage = computed(() => getRiotLanguage(locale.value))

const availableRoles = computed(() => {
  const roles = new Set<string>()
  for (const champion of championsStore.champions) {
    for (const tag of champion.tags) roles.add(tag)
  }
  return Array.from(roles).sort()
})

const filteredChampions = computed(() =>
  championsStore.searchChampions(
    searchQuery.value,
    selectedRoles.value.length > 0 ? selectedRoles.value : undefined
  )
)

const allChampions = computed(() => championsStore.champions)

function isFiltered(champion: Champion): boolean {
  if (selectedRoles.value.length === 0 && !searchQuery.value) return true
  return filteredChampions.value.some(c => c.id === champion.id)
}

function isExcluded(champion: Champion): boolean {
  return Boolean(props.excludeChampionId && champion.id === props.excludeChampionId)
}

function isRanked(champion: Champion): boolean {
  return draftStore.rankedOpponentIds.has(champion.id)
}

function championTitle(champion: Champion): string {
  if (isExcluded(champion)) return t('matchupGuideCreate.cannotRankSelf')
  if (isRanked(champion)) return t('matchupGuideCreate.alreadyRanked')
  return champion.name
}

function translateRole(role: string): string {
  return t(`champion.${role.toLowerCase()}`, role)
}

async function selectOpponent(champion: Champion) {
  if (isExcluded(champion) || isRanked(champion)) return
  const detailed =
    (await championsStore
      .loadChampionDetails(champion.id, currentLanguage.value)
      .catch(() => null)) ?? champion
  draftStore.addOpponent(championToRef(detailed as Champion))
}

function toggleRole(role: string) {
  const index = selectedRoles.value.indexOf(role)
  if (index > -1) selectedRoles.value.splice(index, 1)
  else selectedRoles.value.push(role)
}

async function loadChampionsForCurrentLanguage() {
  await championsStore.loadChampions(currentLanguage.value)
}

onMounted(loadChampionsForCurrentLanguage)
watch(locale, loadChampionsForCurrentLanguage)
</script>

<style scoped>
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
}

.champion-filter-bar {
  flex: 0 1 auto;
  gap: 5px;
}

.champion-filter-btn {
  padding: 5px;
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
  cursor: pointer;
  padding: 0;
  margin: 0;
}

.champ img {
  display: block;
  height: 100%;
  width: 100%;
  object-fit: cover;
}

.champ.hide img {
  filter: grayscale(1) brightness(0.4);
}

.champ-ranked img,
.champ-excluded img {
  filter: grayscale(1) brightness(0.35);
  opacity: 0.65;
}

.champ:disabled {
  cursor: not-allowed;
}

@media (hover: hover) {
  .champ:not(:disabled):hover {
    border-color: rgb(var(--rgb-accent));
    z-index: 1;
  }
}

@media (max-width: 700px) {
  .champions-list {
    --champSizeButton: 48px;
  }
}
</style>
