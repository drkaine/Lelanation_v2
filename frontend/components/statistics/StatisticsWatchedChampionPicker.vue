<template>
  <div class="watched-champion-picker">
    <div class="champion-toolbar mb-3">
      <label for="watched-champion-search" class="sr-only">
        {{ t('common.search') }}
      </label>
      <input
        id="watched-champion-search"
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
            'champion-filter-btn ui-build-card-button px-2 py-1 text-sm font-semibold',
            selectedRoles.includes(role) ? 'is-active' : '',
          ]"
          @click="toggleRole(role)"
        >
          {{ translateRole(role) }}
        </button>
      </div>
      <div class="champion-action-bar flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          class="ui-build-card-button px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="championsStore.status !== 'success' || allFilteredSelected"
          @click="selectAllFiltered"
        >
          {{ t('statisticsPage.settingsWatchlistSelectAll') }}
        </button>
        <button
          v-if="hasSelection"
          type="button"
          class="ui-build-card-button px-2.5 py-1 text-xs"
          @click="clearAll"
        >
          {{ t('statisticsPage.settingsWatchlistClear') }}
        </button>
      </div>
    </div>

    <div v-if="championsStore.status === 'loading'" class="py-8 text-center">
      <p class="text-sm text-text/70">{{ t('statisticsPage.recapLoading') }}</p>
    </div>

    <div v-else-if="championsStore.status === 'error'" class="py-8 text-center">
      <p class="text-sm text-error">{{ championsStore.error }}</p>
    </div>

    <div v-else class="champions-list mt-2">
      <button
        v-for="champion in allChampions"
        :key="champion.id"
        type="button"
        :class="[
          'champ',
          !isFiltered(champion) ? 'hide' : '',
          hasSelection && !isSelected(champion) ? 'champ-dimmed' : '',
        ]"
        :aria-pressed="isSelected(champion)"
        :title="champion.name"
        @click="toggleChampion(champion)"
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

    <div
      v-if="filteredChampions.length === 0 && championsStore.status === 'success'"
      class="py-8 text-center"
    >
      <p class="text-sm text-text/70">{{ t('statisticsPage.settingsWatchlistNoResults') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChampionsStore } from '~/stores/ChampionsStore'
import type { Champion } from '~/types/build'
import { getChampionImageUrl } from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'

const props = defineProps<{
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const championsStore = useChampionsStore()
const { locale, t } = useI18n()

const searchQuery = ref('')
const selectedRoles = ref<string[]>([])

const translateRole = (role: string): string => {
  const roleKey = role.toLowerCase()
  return t(`champion.${roleKey}`, role)
}

const getRiotLanguage = (localeCode: string): string => {
  const localeMap: Record<string, string> = {
    fr: 'fr_FR',
    en: 'en_US',
  }
  return localeMap[localeCode] || 'fr_FR'
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

const filteredChampions = computed(() =>
  championsStore.searchChampions(
    searchQuery.value,
    selectedRoles.value.length > 0 ? selectedRoles.value : undefined
  )
)

const allChampions = computed(() => championsStore.champions)

const hasSelection = computed(() => props.modelValue.length > 0)

const allFilteredSelected = computed(() => {
  const filtered = filteredChampions.value
  if (filtered.length === 0) return true
  return filtered.every(champion => props.modelValue.includes(champion.id))
})

const isFiltered = (champion: Champion): boolean => {
  if (selectedRoles.value.length === 0 && !searchQuery.value) return true
  return filteredChampions.value.some(c => c.id === champion.id)
}

const isSelected = (champion: Champion): boolean => props.modelValue.includes(champion.id)

const toggleChampion = (champion: Champion) => {
  const next = isSelected(champion)
    ? props.modelValue.filter(id => id !== champion.id)
    : [...props.modelValue, champion.id]
  emit('update:modelValue', next)
}

const toggleRole = (role: string) => {
  const index = selectedRoles.value.indexOf(role)
  if (index > -1) selectedRoles.value.splice(index, 1)
  else selectedRoles.value.push(role)
}

function selectAllFiltered(): void {
  const ids = new Set(props.modelValue)
  for (const champion of filteredChampions.value) {
    ids.add(champion.id)
  }
  emit('update:modelValue', Array.from(ids))
}

function clearAll(): void {
  emit('update:modelValue', [])
}

const { version } = useGameVersion()

const loadChampionsForCurrentLanguage = async () => {
  await championsStore.loadChampions(currentLanguage.value)
}

onMounted(() => {
  loadChampionsForCurrentLanguage()
})

watch(locale, () => {
  loadChampionsForCurrentLanguage()
})
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
  width: auto;
}

.champion-filter-bar {
  flex: 0 1 auto;
  gap: 5px;
}

.champion-action-bar {
  flex: 0 1 auto;
}

.champion-filter-btn {
  padding: 5px;
  margin: 0;
}

.champions-list {
  --champSizeButton: 59px;
  display: grid;
  grid-template-columns: repeat(auto-fit, var(--champSizeButton));
  place-content: start;
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
