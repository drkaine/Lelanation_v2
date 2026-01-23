<template>
  <div class="rune-selector">
    <div v-if="runesStore.status === 'loading'" class="py-8 text-center">
      <p class="text-text">Loading runes...</p>
    </div>

    <div v-else-if="runesStore.status === 'error'" class="py-8 text-center">
      <p class="text-error">{{ runesStore.error }}</p>
    </div>

    <div v-else class="rune-selector-content">
      <!-- Primary and Secondary Path Selection (Side by Side) -->
      <div class="rune-paths-container">
        <!-- Primary Rune Path Selection -->
        <div class="rune-path-section">
          <div class="rune-paths-row">
            <button
              v-for="path in runesStore.runePaths"
              :key="path.id"
              :class="[
                'rune-path-button',
                selectedPrimaryPathId === path.id ? 'rune-path-selected' : 'rune-path-unselected',
              ]"
              @click="selectPrimaryPath(path.id)"
            >
              <img
                :src="getRunePathImageUrl(version, path.icon)"
                :alt="path.name"
                class="rune-path-icon"
              />
            </button>
          </div>

          <!-- Primary Runes by Tier -->
          <div v-if="selectedPrimaryPath" class="primary-runes-tiers">
            <div
              v-for="(slot, slotIndex) in selectedPrimaryPath.slots"
              :key="slotIndex"
              class="rune-tier"
            >
              <div class="rune-tier-row">
                <button
                  v-for="rune in slot.runes"
                  :key="rune.id"
                  :class="[
                    'rune-button primary-rune-button',
                    selectedPrimaryRunes[slotIndex] === rune.id
                      ? 'rune-selected'
                      : 'rune-unselected',
                  ]"
                  @click="selectPrimaryRune(slotIndex, rune.id)"
                >
                  <img
                    :src="getRuneImageUrl(version, rune.icon)"
                    :alt="rune.name"
                    class="rune-icon"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Secondary Rune Path Selection -->
        <div class="rune-path-section">
          <div class="rune-paths-row secondary-paths">
            <button
              v-for="path in availableSecondaryPaths"
              :key="path.id"
              :class="[
                'rune-path-button secondary-path-button',
                selectedSecondaryPathId === path.id ? 'rune-path-selected' : 'rune-path-unselected',
              ]"
              @click="selectSecondaryPath(path.id)"
            >
              <img
                :src="getRunePathImageUrl(version, path.icon)"
                :alt="path.name"
                class="rune-path-icon"
              />
            </button>
          </div>

          <!-- Secondary Runes by Tier (can select 2 total, not one per tier) - Skip first tier -->
          <div v-if="selectedSecondaryPath" class="secondary-runes-tiers">
            <div
              v-for="(slot, slotIndex) in filteredSecondarySlots"
              :key="slotIndex"
              class="rune-tier"
            >
              <div class="rune-tier-row">
                <button
                  v-for="rune in slot.runes"
                  :key="rune.id"
                  :class="[
                    'rune-button',
                    isSecondaryRuneSelected(rune.id) ? 'rune-selected' : 'rune-unselected',
                    canSelectSecondaryRune() || isSecondaryRuneSelected(rune.id)
                      ? ''
                      : 'rune-disabled',
                  ]"
                  :disabled="!canSelectSecondaryRune() && !isSecondaryRuneSelected(rune.id)"
                  @click="toggleSecondaryRune(rune.id)"
                >
                  <img
                    :src="getRuneImageUrl(version, rune.icon)"
                    :alt="rune.name"
                    class="rune-icon"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRunesStore } from '~/stores/RunesStore'
import { useBuildStore } from '~/stores/BuildStore'
import type { RuneSelection } from '~/types/build'
import { getRunePathImageUrl, getRuneImageUrl } from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'

const { version } = useGameVersion()

const runesStore = useRunesStore()
const buildStore = useBuildStore()

const selectedPrimaryPathId = ref<number | null>(null)
const selectedPrimaryRunes = ref<Record<number, number>>({})
const selectedSecondaryPathId = ref<number | null>(null)
const selectedSecondaryRunes = ref<number[]>([]) // Array of rune IDs (max 2)

const selectedPrimaryPath = computed(() => {
  if (!selectedPrimaryPathId.value) return null
  return runesStore.getRunePathById(selectedPrimaryPathId.value)
})

const selectedSecondaryPath = computed(() => {
  if (!selectedSecondaryPathId.value) return null
  return runesStore.getRunePathById(selectedSecondaryPathId.value)
})

const availableSecondaryPaths = computed(() => {
  // Secondary path cannot be the same as primary
  return runesStore.runePaths.filter(path => path.id !== selectedPrimaryPathId.value)
})

const filteredSecondarySlots = computed(() => {
  if (!selectedSecondaryPath.value) return []
  return selectedSecondaryPath.value.slots.filter((_slot, index) => index > 0)
})

const selectPrimaryPath = (pathId: number) => {
  selectedPrimaryPathId.value = pathId
  selectedPrimaryRunes.value = {}
  updateRuneSelection()
}

const selectPrimaryRune = (slot: number, runeId: number) => {
  // Only one rune per tier for primary
  selectedPrimaryRunes.value[slot] = runeId
  updateRuneSelection()
}

const selectSecondaryPath = (pathId: number) => {
  selectedSecondaryPathId.value = pathId
  selectedSecondaryRunes.value = []
  updateRuneSelection()
}

const isSecondaryRuneSelected = (runeId: number): boolean => {
  return selectedSecondaryRunes.value.includes(runeId)
}

const canSelectSecondaryRune = (): boolean => {
  // Can select if less than 2 runes selected
  return selectedSecondaryRunes.value.length < 2
}

const toggleSecondaryRune = (runeId: number) => {
  const index = selectedSecondaryRunes.value.indexOf(runeId)
  if (index > -1) {
    // Remove if already selected
    selectedSecondaryRunes.value.splice(index, 1)
  } else if (canSelectSecondaryRune()) {
    // Add if not selected and we have space
    selectedSecondaryRunes.value.push(runeId)
  }
  updateRuneSelection()
}

const updateRuneSelection = () => {
  if (!selectedPrimaryPathId.value || !selectedPrimaryRunes.value[0]) {
    return
  }

  const runeSelection: RuneSelection = {
    primary: {
      pathId: selectedPrimaryPathId.value,
      keystone: selectedPrimaryRunes.value[0] || 0,
      slot1: selectedPrimaryRunes.value[1] || 0,
      slot2: selectedPrimaryRunes.value[2] || 0,
      slot3: selectedPrimaryRunes.value[3] || 0,
    },
    secondary: {
      pathId: selectedSecondaryPathId.value || 0,
      slot1: selectedSecondaryRunes.value[0] || 0,
      slot2: selectedSecondaryRunes.value[1] || 0,
    },
  }

  buildStore.setRunes(runeSelection)
}

// Load existing rune selection from build
watch(
  () => buildStore.currentBuild?.runes,
  runes => {
    if (runes) {
      selectedPrimaryPathId.value = runes.primary.pathId
      selectedPrimaryRunes.value = {
        0: runes.primary.keystone,
        1: runes.primary.slot1,
        2: runes.primary.slot2,
        3: runes.primary.slot3,
      }
      selectedSecondaryPathId.value = runes.secondary.pathId
      // Reconstruct secondary runes array from slots
      selectedSecondaryRunes.value = []
      if (runes.secondary.slot1 && runes.secondary.slot1 !== 0) {
        selectedSecondaryRunes.value.push(runes.secondary.slot1)
      }
      if (runes.secondary.slot2 && runes.secondary.slot2 !== 0) {
        selectedSecondaryRunes.value.push(runes.secondary.slot2)
      }
    }
  },
  { immediate: true }
)

onMounted(() => {
  if (runesStore.runePaths.length === 0) {
    runesStore.loadRunes()
  }
})
</script>

<style scoped>
.rune-selector-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.rune-paths-container {
  display: flex;
  gap: 2rem;
  align-items: flex-start;
}

.rune-path-section {
  flex: 1;
}

.rune-paths-row {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.rune-path-button {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  border: 2px solid rgb(var(--rgb-accent));
  background: transparent;
  padding: 0;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.rune-path-button.rune-path-selected {
  background: rgb(var(--rgb-accent));
  box-shadow: 0 0 10px rgba(var(--rgb-accent-rgb), 0.5);
}

.rune-path-button.rune-path-unselected {
  background: rgb(var(--rgb-surface));
  opacity: 0.7;
}

.rune-path-button:hover {
  transform: scale(1.1);
  opacity: 1;
}

.rune-path-icon {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.secondary-paths .rune-path-button {
  width: 2.5rem;
  height: 2.5rem;
}

.rune-tier {
  margin-bottom: 0.5rem;
}

.rune-tier-row {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
}

.rune-button {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  border: 1px solid rgb(var(--rgb-accent));
  background: transparent;
  padding: 0;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.rune-button.primary-rune-button {
  background: #000;
  width: 2rem;
  height: 2rem;
}

.rune-button.rune-selected {
  background: rgb(var(--rgb-accent));
  box-shadow: 0 0 8px rgba(var(--rgb-accent-rgb), 0.6);
}

.rune-button.rune-unselected {
  background: rgb(var(--rgb-surface));
  opacity: 0.6;
}

.rune-button.primary-rune-button.rune-unselected {
  background: #000;
  opacity: 0.8;
}

.rune-button.rune-disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.rune-button:hover:not(.rune-disabled) {
  transform: scale(1.1);
  opacity: 1;
}

.rune-icon {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.primary-runes-tiers {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.secondary-runes-tiers {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
