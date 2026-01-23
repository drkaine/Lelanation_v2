<template>
  <div class="build-card relative rounded-lg border border-accent bg-surface p-4">
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
          class="champion-image cursor-pointer rounded-full border-2 border-accent object-cover"
          @mouseenter="showTooltip = true"
          @mouseleave="showTooltip = false"
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
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { useBuildStore } from '~/stores/BuildStore'
import {
  getChampionImageUrl,
  getChampionSpellImageUrl,
  getChampionPassiveImageUrl,
} from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'

const buildStore = useBuildStore()

const showTooltip = ref(false)
const tooltipRef = ref<HTMLElement | null>(null)
const tooltipPosition = ref<'right' | 'left'>('right')
const tooltipVerticalPosition = ref<'top' | 'bottom'>('top')

const selectedChampion = computed(() => {
  return buildStore.currentBuild?.champion || null
})

const { version } = useGameVersion()

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
