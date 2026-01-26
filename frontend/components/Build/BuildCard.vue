<template>
  <div class="build-card relative rounded-lg border border-accent bg-surface p-4">
    <!-- Version (top right) -->
    <div class="absolute right-0 top-0 px-1 text-xs text-text/70">
      {{ version }}
    </div>

    <!-- Champion (center top) -->
    <div v-if="selectedChampion" class="flex flex-col items-center pt-2">
      <div class="relative mb-2">
        <img
          :src="getChampionImageUrl(version, selectedChampion.image.full)"
          :alt="selectedChampion.name"
          class="champion-image cursor-pointer rounded-full border-2 border-accent object-cover"
          @mouseenter="showTooltip = true"
          @mouseleave="showTooltip = false"
        />
      </div>
      <p class="text-center text-sm font-semibold text-text">
        {{ selectedChampion.name }}
      </p>
    </div>

    <!-- Runes, Spells, Shards Display -->
    <div class="build-selections mt-4 space-y-3">
      <!-- Primary Runes -->
      <div v-if="selectedPrimaryRunes" class="primary-runes-display">
        <div class="flex items-center gap-2">
          <img
            v-if="primaryPathIcon"
            :src="primaryPathIcon"
            :alt="primaryPathName"
            class="primary-path-icon"
          />
          <div class="primary-runes-grid">
            <img
              v-for="(runeId, index) in filteredPrimaryRuneIds"
              :key="index"
              :src="getRuneIconById(runeId)"
              :alt="`Rune ${index + 1}`"
              class="primary-rune-icon"
            />
          </div>
        </div>
      </div>

      <!-- Secondary Runes -->
      <div v-if="selectedSecondaryRunes" class="secondary-runes-display">
        <div class="flex items-center gap-2">
          <img
            v-if="secondaryPathIcon"
            :src="secondaryPathIcon"
            :alt="secondaryPathName"
            class="secondary-path-icon"
          />
          <div class="secondary-runes-grid">
            <img
              v-for="(runeId, index) in filteredSecondaryRuneIds"
              :key="index"
              :src="getRuneIconById(runeId)"
              :alt="`Secondary Rune ${index + 1}`"
              class="secondary-rune-icon"
            />
          </div>
        </div>
      </div>

      <!-- Summoner Spells -->
      <div v-if="selectedSummonerSpells.length > 0" class="summoner-spells-display">
        <div class="summoner-spells-grid">
          <img
            v-for="(spell, index) in filteredSummonerSpells"
            :key="index"
            :src="spell ? getSpellImageUrl(version, spell.image.full) : ''"
            :alt="spell?.name || ''"
            class="summoner-spell-icon"
          />
        </div>
      </div>

      <!-- Shards -->
      <div v-if="selectedShards" class="shards-display">
        <div class="shards-grid">
          <img
            v-for="(shardId, index) in filteredShardIds"
            :key="index"
            :src="getShardIconById(shardId)"
            :alt="`Shard ${index + 1}`"
            class="shard-icon"
          />
        </div>
      </div>
    </div>

    <!-- Lelanation (bottom right) -->
    <div class="absolute bottom-0 right-0 px-1 text-xs text-text/70">lelanation.fr</div>

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
                :src="getChampionPassiveImageUrl(version, selectedChampion.passive.image.full)"
                :alt="selectedChampion.passive.name"
                class="tooltip-spell-img"
              />
            </div>
            <div class="tooltip-spell-content">
              <div class="tooltip-spell-name">Passive: {{ selectedChampion.passive.name }}</div>
              <!-- eslint-disable vue/no-v-html -->
              <div
                v-if="formattedPassive"
                class="tooltip-spell-description"
                v-html="formattedPassive"
              />
              <!-- eslint-enable vue/no-v-html -->
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
                  :src="getChampionSpellImageUrl(version, selectedChampion.id, spell.image.full)"
                  :alt="spell.name"
                  class="tooltip-spell-img"
                />
              </div>
              <div class="tooltip-spell-content">
                <div class="tooltip-spell-name">
                  {{ ['Q', 'W', 'E', 'R'][index] }}: {{ spell.name }}
                </div>
                <!-- eslint-disable vue/no-v-html -->
                <div
                  v-if="spell.description"
                  class="tooltip-spell-description"
                  v-html="spell.description"
                />
                <!-- eslint-enable vue/no-v-html -->
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted, onMounted } from 'vue'
import { useBuildStore } from '~/stores/BuildStore'
import { useRunesStore } from '~/stores/RunesStore'
import {
  getChampionImageUrl,
  getChampionSpellImageUrl,
  getChampionPassiveImageUrl,
  getSpellImageUrl,
  getRunePathImageUrl,
  getRuneImageUrl,
} from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'

const buildStore = useBuildStore()
const runesStore = useRunesStore()

const showTooltip = ref(false)
const tooltipRef = ref<HTMLElement | null>(null)
const tooltipPosition = ref<'right' | 'left'>('right')
const tooltipVerticalPosition = ref<'top' | 'bottom'>('top')

const selectedChampion = computed(() => {
  return buildStore.currentBuild?.champion || null
})

const { version } = useGameVersion()

// Get selected runes, spells, and shards
const selectedPrimaryRunes = computed(() => buildStore.currentBuild?.runes)
const selectedSecondaryRunes = computed(() => buildStore.currentBuild?.runes)
const selectedSummonerSpells = computed(() => buildStore.currentBuild?.summonerSpells || [])
const filteredSummonerSpells = computed(() => {
  return selectedSummonerSpells.value.filter(spell => spell !== null && spell !== undefined)
})
const selectedShards = computed(() => buildStore.currentBuild?.shards)

// Primary rune path
const primaryPath = computed(() => {
  if (!selectedPrimaryRunes.value?.primary?.pathId) return null
  return runesStore.getRunePathById(selectedPrimaryRunes.value.primary.pathId)
})

const primaryPathIcon = computed(() => {
  if (!primaryPath.value) return null
  return getRunePathImageUrl(version.value, primaryPath.value.icon)
})

const primaryPathName = computed(() => {
  return primaryPath.value?.name || ''
})

const filteredPrimaryRuneIds = computed(() => {
  if (!selectedPrimaryRunes.value?.primary) return []
  return [
    selectedPrimaryRunes.value.primary.keystone,
    selectedPrimaryRunes.value.primary.slot1,
    selectedPrimaryRunes.value.primary.slot2,
    selectedPrimaryRunes.value.primary.slot3,
  ].filter(id => id && id !== 0)
})

// Secondary rune path
const secondaryPath = computed(() => {
  if (!selectedSecondaryRunes.value?.secondary?.pathId) return null
  return runesStore.getRunePathById(selectedSecondaryRunes.value.secondary.pathId)
})

const secondaryPathIcon = computed(() => {
  if (!secondaryPath.value) return null
  return getRunePathImageUrl(version.value, secondaryPath.value.icon)
})

const secondaryPathName = computed(() => {
  return secondaryPath.value?.name || ''
})

const filteredSecondaryRuneIds = computed(() => {
  if (!selectedSecondaryRunes.value?.secondary) return []
  return [
    selectedSecondaryRunes.value.secondary.slot1,
    selectedSecondaryRunes.value.secondary.slot2,
  ].filter(id => id && id !== 0)
})

// Get rune icon by ID
const getRuneIconById = (runeId: number): string => {
  if (!primaryPath.value && !secondaryPath.value) {
    return ''
  }

  // Search in primary path
  if (primaryPath.value) {
    for (const slot of primaryPath.value.slots) {
      for (const rune of slot.runes) {
        if (rune.id === runeId) {
          return getRuneImageUrl(version.value, rune.icon)
        }
      }
    }
  }

  // Search in secondary path
  if (secondaryPath.value) {
    for (const slot of secondaryPath.value.slots) {
      for (const rune of slot.runes) {
        if (rune.id === runeId) {
          return getRuneImageUrl(version.value, rune.icon)
        }
      }
    }
  }

  return ''
}

// Get shard icon by ID
const getShardIconById = (shardId: number): string => {
  const shardMap: Record<number, string> = {
    5008: '/icons/shards/adaptative.png',
    5005: '/icons/shards/speed.png',
    5007: '/icons/shards/cdr.png',
    5001: '/icons/shards/hp.png',
    5002: '/icons/shards/growth.png',
    5003: '/icons/shards/tenacity.png',
  }
  return shardMap[shardId] || '/icons/shards/adaptative.png'
}

const filteredShardIds = computed(() => {
  if (!selectedShards.value) return []
  return [
    selectedShards.value.slot1,
    selectedShards.value.slot2,
    selectedShards.value.slot3,
  ].filter(id => id && id !== 0)
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

// Load runes if not already loaded
onMounted(() => {
  if (runesStore.runePaths.length === 0) {
    runesStore.loadRunes()
  }
})
</script>

<style scoped>
.build-card {
  width: 293.9px;
  height: 405px;
}

.champion-image {
  width: 57.75px;
  height: 57.75px;
}

.champion-image:not(img) {
  display: flex;
  align-items: center;
  justify-content: center;
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

.build-selections {
  margin-top: 1rem;
}

.primary-runes-display,
.secondary-runes-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.primary-path-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  border: 2px solid rgb(var(--rgb-accent));
  object-fit: cover;
}

.secondary-path-icon {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 1px solid rgb(var(--rgb-accent));
  object-fit: cover;
}

.primary-runes-grid,
.secondary-runes-grid {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.primary-rune-icon {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  border: 1px solid rgb(var(--rgb-accent));
  object-fit: cover;
}

.secondary-rune-icon {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  border: 1px solid rgb(var(--rgb-accent));
  object-fit: cover;
}

.summoner-spells-display {
  display: flex;
  gap: 0.25rem;
}

.summoner-spells-grid {
  display: flex;
  gap: 0.25rem;
}

.summoner-spell-icon {
  width: 2rem;
  height: 2rem;
  border-radius: 4px;
  border: 1px solid rgb(var(--rgb-accent));
  object-fit: cover;
}

.shards-display {
  display: flex;
  gap: 0.25rem;
}

.shards-grid {
  display: flex;
  gap: 0.25rem;
}

.shard-icon {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 4px;
  border: 1px solid rgb(var(--rgb-accent));
  object-fit: cover;
}
</style>
