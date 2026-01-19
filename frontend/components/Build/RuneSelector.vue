<template>
  <div class="rune-selector">
    <div v-if="runesStore.status === 'loading'" class="py-8 text-center">
      <p class="text-text">Loading runes...</p>
    </div>

    <div v-else-if="runesStore.status === 'error'" class="py-8 text-center">
      <p class="text-error">{{ runesStore.error }}</p>
    </div>

    <div v-else>
      <!-- Primary Rune Tree -->
      <div class="mb-8">
        <h3 class="mb-4 text-lg font-bold text-text">Primary Rune Tree</h3>
        <div class="mb-4">
          <p class="text-text/70 mb-2 text-sm">Select primary path:</p>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            <button
              v-for="path in runesStore.runePaths"
              :key="path.id"
              :class="[
                'flex flex-col items-center rounded border-2 p-3 transition-all',
                selectedPrimaryPathId === path.id
                  ? 'bg-accent/20 border-accent'
                  : 'border-surface hover:border-primary',
              ]"
              @click="selectPrimaryPath(path.id)"
            >
              <img
                :src="getRunePathImageUrl(path.icon)"
                :alt="path.name"
                class="mb-2 h-12 w-12 rounded"
              />
              <span class="text-center text-xs text-text">{{ path.name }}</span>
            </button>
          </div>
        </div>

        <div v-if="selectedPrimaryPath" class="space-y-4">
          <!-- Keystone (Slot 0) -->
          <div>
            <p class="mb-2 text-sm font-semibold text-text">Keystone (Slot 0)</p>
            <div class="grid grid-cols-3 gap-3 sm:grid-cols-4">
              <button
                v-for="rune in selectedPrimaryPath.slots[0]?.runes || []"
                :key="rune.id"
                :class="[
                  'flex flex-col items-center rounded border-2 p-2 transition-all',
                  selectedPrimaryRunes[0] === rune.id
                    ? 'bg-accent/20 border-accent'
                    : 'border-surface hover:border-primary',
                ]"
                @click="selectPrimaryRune(0, rune.id)"
              >
                <img
                  :src="getRuneImageUrl(rune.icon)"
                  :alt="rune.name"
                  class="mb-1 h-10 w-10 rounded"
                />
                <span class="text-center text-xs text-text">{{ rune.name }}</span>
              </button>
            </div>
          </div>

          <!-- Minor Runes (Slots 1-3) -->
          <div v-for="slotIndex in [1, 2, 3]" :key="slotIndex">
            <p class="mb-2 text-sm font-semibold text-text">Slot {{ slotIndex }}</p>
            <div class="grid grid-cols-3 gap-3 sm:grid-cols-4">
              <button
                v-for="rune in selectedPrimaryPath.slots[slotIndex]?.runes || []"
                :key="rune.id"
                :class="[
                  'flex flex-col items-center rounded border-2 p-2 transition-all',
                  selectedPrimaryRunes[slotIndex] === rune.id
                    ? 'bg-accent/20 border-accent'
                    : 'border-surface hover:border-primary',
                ]"
                @click="selectPrimaryRune(slotIndex, rune.id)"
              >
                <img
                  :src="getRuneImageUrl(rune.icon)"
                  :alt="rune.name"
                  class="mb-1 h-10 w-10 rounded"
                />
                <span class="text-center text-xs text-text">{{ rune.name }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Secondary Rune Tree -->
      <div>
        <h3 class="mb-4 text-lg font-bold text-text">Secondary Rune Tree</h3>
        <div class="mb-4">
          <p class="text-text/70 mb-2 text-sm">Select secondary path:</p>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            <button
              v-for="path in availableSecondaryPaths"
              :key="path.id"
              :class="[
                'flex flex-col items-center rounded border-2 p-3 transition-all',
                selectedSecondaryPathId === path.id
                  ? 'bg-accent/20 border-accent'
                  : 'border-surface hover:border-primary',
              ]"
              @click="selectSecondaryPath(path.id)"
            >
              <img
                :src="getRunePathImageUrl(path.icon)"
                :alt="path.name"
                class="mb-2 h-12 w-12 rounded"
              />
              <span class="text-center text-xs text-text">{{ path.name }}</span>
            </button>
          </div>
        </div>

        <div v-if="selectedSecondaryPath" class="space-y-4">
          <!-- Minor Runes (Slots 1-2) -->
          <div v-for="slotIndex in [1, 2]" :key="slotIndex">
            <p class="mb-2 text-sm font-semibold text-text">Slot {{ slotIndex }}</p>
            <div class="grid grid-cols-3 gap-3 sm:grid-cols-4">
              <button
                v-for="rune in selectedSecondaryPath.slots[slotIndex]?.runes || []"
                :key="rune.id"
                :class="[
                  'flex flex-col items-center rounded border-2 p-2 transition-all',
                  selectedSecondaryRunes[slotIndex] === rune.id
                    ? 'bg-accent/20 border-accent'
                    : 'border-surface hover:border-primary',
                ]"
                @click="selectSecondaryRune(slotIndex, rune.id)"
              >
                <img
                  :src="getRuneImageUrl(rune.icon)"
                  :alt="rune.name"
                  class="mb-1 h-10 w-10 rounded"
                />
                <span class="text-center text-xs text-text">{{ rune.name }}</span>
              </button>
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

const runesStore = useRunesStore()
const buildStore = useBuildStore()

const selectedPrimaryPathId = ref<number | null>(null)
const selectedPrimaryRunes = ref<Record<number, number>>({})
const selectedSecondaryPathId = ref<number | null>(null)
const selectedSecondaryRunes = ref<Record<number, number>>({})

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

const selectPrimaryPath = (pathId: number) => {
  selectedPrimaryPathId.value = pathId
  selectedPrimaryRunes.value = {}
  updateRuneSelection()
}

const selectPrimaryRune = (slot: number, runeId: number) => {
  selectedPrimaryRunes.value[slot] = runeId
  updateRuneSelection()
}

const selectSecondaryPath = (pathId: number) => {
  selectedSecondaryPathId.value = pathId
  selectedSecondaryRunes.value = {}
  updateRuneSelection()
}

const selectSecondaryRune = (slot: number, runeId: number) => {
  selectedSecondaryRunes.value[slot] = runeId
  updateRuneSelection()
}

const updateRuneSelection = () => {
  if (!selectedPrimaryPathId.value || !selectedPrimaryRunes.value[0]) {
    return
  }

  const runeSelection: RuneSelection = {
    primary: {
      pathId: selectedPrimaryPathId.value,
      keystone: selectedPrimaryRunes.value[0],
      slot1: selectedPrimaryRunes.value[1] || 0,
      slot2: selectedPrimaryRunes.value[2] || 0,
      slot3: selectedPrimaryRunes.value[3] || 0,
    },
    secondary: {
      pathId: selectedSecondaryPathId.value || 0,
      slot1: selectedSecondaryRunes.value[1] || 0,
      slot2: selectedSecondaryRunes.value[2] || 0,
    },
  }

  buildStore.setRunes(runeSelection)
}

const getRunePathImageUrl = (icon: string): string => {
  // TODO: Use actual Data Dragon CDN URL
  return `https://ddragon.leagueoflegends.com/cdn/img/${icon}`
}

const getRuneImageUrl = (icon: string): string => {
  // TODO: Use actual Data Dragon CDN URL
  return `https://ddragon.leagueoflegends.com/cdn/img/${icon}`
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
      selectedSecondaryRunes.value = {
        1: runes.secondary.slot1,
        2: runes.secondary.slot2,
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
