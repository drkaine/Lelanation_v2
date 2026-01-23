<template>
  <div class="champion-selector-container flex gap-4" style="background: transparent !important">
    <!-- Build Card (Left Side) -->
    <div v-if="selectedChampion" class="build-card-wrapper flex-shrink-0">
      <div
        class="build-card relative rounded-lg border border-accent bg-surface p-4"
        @mouseenter="showTooltip = true"
        @mouseleave="showTooltip = false"
      >
        <!-- Version (top right) -->
        <div class="absolute right-4 top-4 text-xs text-text/70">
          {{ version }}
        </div>

        <!-- Champion (center top) -->
        <div class="flex flex-col items-center pt-2">
          <div class="relative mb-2">
            <img
              :src="getChampionImageUrl(version, selectedChampion.image.full)"
              :alt="selectedChampion.name"
              class="champion-image rounded-full border-2 border-accent object-cover"
            />
          </div>
          <p class="text-center text-sm font-semibold text-text">
            {{ selectedChampion.name }}
          </p>
        </div>

        <!-- Lelanation (bottom right) -->
        <div class="absolute bottom-4 right-4 text-xs text-text/70">lelanation</div>

        <!-- Tooltip -->
        <div
          v-if="showTooltip && selectedChampion"
          ref="tooltipRef"
          class="tooltip-box absolute z-50 rounded-lg border border-accent bg-background shadow-lg"
          :class="tooltipPositionClass"
        >
          <!-- Top: Champion Image, Name, Title, Tags -->
          <div class="tooltip-top">
            <div class="tooltip-present">
              <img
                :src="getChampionImageUrl(version, selectedChampion.image.full)"
                :alt="selectedChampion.name"
                class="tooltip-champion-image"
              />
              <div class="tooltip-text">
                <div class="tooltip-champion-name">{{ selectedChampion.name }}</div>
                <div class="tooltip-champion-title">{{ selectedChampion.title }}</div>
              </div>
            </div>
            <div
              v-if="selectedChampion.tags && selectedChampion.tags.length > 0"
              class="tooltip-tags-container"
            >
              <div class="tooltip-tags">
                {{ translatedTags }}
              </div>
            </div>
          </div>

          <hr class="tooltip-separator" />

          <!-- Body: Passive and Spells -->
          <div class="tooltip-body">
            <div class="tooltip-spells">
              <!-- Passive -->
              <div
                v-if="selectedChampion.passive && selectedChampion.passive.image"
                class="tooltip-spell"
              >
                <div class="tooltip-spell-img-container">
                  <img
                    :src="getChampionImageUrl(version, selectedChampion.passive.image.full)"
                    :alt="selectedChampion.passive.name"
                    class="tooltip-spell-img"
                  />
                </div>
                <div class="tooltip-spell-content">
                  <div class="tooltip-spell-name">Passive: {{ selectedChampion.passive.name }}</div>
                  <div
                    v-if="formattedPassive"
                    class="tooltip-spell-description"
                    v-html="formattedPassive"
                  />
                </div>
              </div>

              <!-- Spells -->
              <div
                v-for="(spell, index) in formattedSpells"
                :key="spell.id || index"
                class="tooltip-spell"
              >
                <div v-if="spell && spell.image" class="tooltip-spell-wrapper">
                  <div
                    class="tooltip-spell-img-container"
                    :data-spell-key="['Q', 'W', 'E', 'R'][index]"
                  >
                    <img
                      :src="
                        getChampionSpellImageUrl(version, selectedChampion.id, spell.image.full)
                      "
                      :alt="spell.name"
                      class="tooltip-spell-img"
                    />
                  </div>
                  <div class="tooltip-spell-content">
                    <div class="tooltip-spell-name">
                      {{ ['Q', 'W', 'E', 'R'][index] }}: {{ spell.name }}
                    </div>
                    <div
                      v-if="spell.description"
                      class="tooltip-spell-description"
                      v-html="spell.description"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Champion Selector (Right Side) -->
    <div class="champion-selector flex-1" style="background: transparent !important">
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
          {{ role }} ×
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
          {{ role }}
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useBuildStore } from '~/stores/BuildStore'
import type { Champion } from '~/types/build'

import { getChampionImageUrl, getChampionSpellImageUrl } from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'

const championsStore = useChampionsStore()
const buildStore = useBuildStore()
const { locale } = useI18n()

const searchQuery = ref('')
const selectedRoles = ref<string[]>([])
const showTooltip = ref(false)
const tooltipRef = ref<HTMLElement | null>(null)
const tooltipPosition = ref<'right' | 'left'>('right')
const tooltipVerticalPosition = ref<'top' | 'bottom'>('top')

// Convert i18n locale to Riot Games locale code
const getRiotLanguage = (locale: string): string => {
  const localeMap: Record<string, string> = {
    fr: 'fr_FR',
    en: 'en_US',
  }
  return localeMap[locale] || 'fr_FR'
}

const currentLanguage = computed(() => getRiotLanguage(locale.value))

// Compute tooltip position class
const tooltipPositionClass = computed(() => {
  const classes: string[] = []

  if (tooltipPosition.value === 'right') {
    classes.push('left-full', 'ml-2')
  } else {
    classes.push('right-full', 'mr-2')
  }

  if (tooltipVerticalPosition.value === 'top') {
    classes.push('top-0')
  } else {
    classes.push('bottom-0')
  }

  return classes.join(' ')
})

// Calculate tooltip position to avoid going off-screen
const calculateTooltipPosition = async () => {
  if (!tooltipRef.value || !showTooltip.value) return

  await nextTick()

  const tooltip = tooltipRef.value
  const rect = tooltip.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  // Check horizontal position
  if (rect.right > viewportWidth) {
    tooltipPosition.value = 'left'
  } else {
    tooltipPosition.value = 'right'
  }

  // Check vertical position
  if (rect.bottom > viewportHeight) {
    tooltipVerticalPosition.value = 'bottom'
  } else {
    tooltipVerticalPosition.value = 'top'
  }
}

// Watch for tooltip visibility and recalculate position
watch(showTooltip, async newValue => {
  if (newValue) {
    await nextTick()
    calculateTooltipPosition()

    // Recalculate on scroll and resize
    window.addEventListener('scroll', calculateTooltipPosition, true)
    window.addEventListener('resize', calculateTooltipPosition)
  } else {
    window.removeEventListener('scroll', calculateTooltipPosition, true)
    window.removeEventListener('resize', calculateTooltipPosition)
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', calculateTooltipPosition, true)
  window.removeEventListener('resize', calculateTooltipPosition)
})

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

const selectedChampion = computed(() => {
  return buildStore.currentBuild?.champion || null
})

// Translate tags
const translatedTags = computed(() => {
  if (!selectedChampion.value?.tags) return ''
  return selectedChampion.value.tags
    .map((tag: string) => (tag === 'Fighter' ? 'Combattant' : tag === 'Marksman' ? 'Tireur' : tag))
    .join(', ')
})

// Format passive description with HTML
const formattedPassive = computed(() => {
  if (!selectedChampion.value?.passive?.description) return ''
  // The description from Data Dragon usually contains HTML tags
  return selectedChampion.value.passive.description
})

// Format spells with HTML descriptions
const formattedSpells = computed(() => {
  if (!selectedChampion.value?.spells) return []
  return selectedChampion.value.spells.map(spell => ({
    ...spell,
    description: spell.description || '',
  }))
})

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
.champion-selector-container {
  background: transparent !important;
}

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

  .champion-selector-container {
    flex-direction: column;
  }

  .build-card-wrapper {
    width: 100%;
  }
}

.build-card-wrapper {
  width: 293.9px;
}

.build-card {
  width: 293.9px;
  height: 405px;
}

.champion-image {
  width: 57.75px;
  height: 57.75px;
}

.tooltip-box {
  width: min(680px, calc(100vw - 2rem));
  max-width: min(680px, calc(100vw - 2rem));
  min-width: 320px;
  padding: 1.2em;
  display: flex;
  flex-direction: column;
  overflow: visible;
}

@media (max-width: 768px) {
  .tooltip-box {
    width: calc(100vw - 2rem);
    max-width: calc(100vw - 2rem);
    min-width: 280px;
    padding: 1em;
  }
}

@media (max-width: 480px) {
  .tooltip-box {
    width: calc(100vw - 1rem);
    max-width: calc(100vw - 1rem);
    min-width: 250px;
    padding: 0.8em;
  }
}

.tooltip-top {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.tooltip-present {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;
  margin-bottom: 1em;
}

.tooltip-champion-image {
  width: 45px;
  height: 45px;
  border-radius: 50%;
  border: 1px solid rgb(var(--rgb-accent));
  object-fit: cover;
  flex-shrink: 0;
}

.tooltip-text {
  display: flex;
  flex-direction: column;
  text-align: right;
  flex: 1;
}

.tooltip-champion-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: rgb(var(--rgb-accent));
  line-height: 1.2;
}

.tooltip-champion-title {
  font-size: 0.8rem;
  color: rgb(var(--rgb-text) / 0.8);
  line-height: 1.3;
}

.tooltip-tags-container {
  width: 100%;
  padding-top: 0.5em;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.tooltip-tags {
  font-size: 0.8rem;
  color: rgb(var(--rgb-text) / 0.7);
  line-height: 1.4;
}

.tooltip-separator {
  background-color: rgb(var(--rgb-accent));
  width: 100%;
  height: 1px;
  border: 0;
  margin: 0.5em 0;
  opacity: 0.2;
  flex-shrink: 0;
}

.tooltip-body {
  flex: 1;
  overflow: visible;
  min-height: 0;
}

.tooltip-spells {
  display: flex;
  flex-direction: column;
  gap: 0.8em;
  margin-top: 1em;
}

.tooltip-spell {
  flex-shrink: 0;
  display: flex;
  gap: 0.75em;
}

.tooltip-spell-wrapper {
  display: flex;
  gap: 0.75em;
  width: 100%;
}

.tooltip-spell-img-container {
  border: 1px solid rgb(var(--rgb-accent));
  position: relative;
  margin-top: 0.1em;
  height: 2.5em;
  width: 2.5em;
  flex-shrink: 0;
  border-radius: 4px;
}

.tooltip-spell-img-container[data-spell-key='Q']::before {
  content: 'Q';
  color: rgb(var(--rgb-accent));
  position: absolute;
  font-size: 0.75rem;
  font-weight: 400;
  bottom: -0.15em;
  left: 0.1em;
  text-shadow:
    1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px -1px 0 rgba(0, 0, 0, 0.8),
    1px -1px 0 rgba(0, 0, 0, 0.8);
  z-index: 1;
}

.tooltip-spell-img-container[data-spell-key='W']::before {
  content: 'W';
  color: rgb(var(--rgb-accent));
  position: absolute;
  font-size: 0.75rem;
  font-weight: 400;
  bottom: -0.15em;
  left: 0.1em;
  text-shadow:
    1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px -1px 0 rgba(0, 0, 0, 0.8),
    1px -1px 0 rgba(0, 0, 0, 0.8);
  z-index: 1;
}

.tooltip-spell-img-container[data-spell-key='E']::before {
  content: 'E';
  color: rgb(var(--rgb-accent));
  position: absolute;
  font-size: 0.75rem;
  font-weight: 400;
  bottom: -0.15em;
  left: 0.1em;
  text-shadow:
    1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px -1px 0 rgba(0, 0, 0, 0.8),
    1px -1px 0 rgba(0, 0, 0, 0.8);
  z-index: 1;
}

.tooltip-spell-img-container[data-spell-key='R']::before {
  content: 'R';
  color: rgb(var(--rgb-accent));
  position: absolute;
  font-size: 0.75rem;
  font-weight: 400;
  bottom: -0.15em;
  left: 0.1em;
  text-shadow:
    1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px -1px 0 rgba(0, 0, 0, 0.8),
    1px -1px 0 rgba(0, 0, 0, 0.8);
  z-index: 1;
}

.tooltip-spell-img {
  display: block;
  height: 100%;
  width: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.tooltip-spell-content {
  flex: 1;
  min-width: 0;
}

.tooltip-spell-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgb(var(--rgb-text));
  line-height: 1.3;
  margin-bottom: 4px;
}

.tooltip-spell-description {
  font-size: 0.8rem;
  color: rgb(var(--rgb-text) / 0.7);
  line-height: 1.4;
}
</style>
