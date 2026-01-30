<!-- eslint-disable vue/no-v-html -- rune descriptions from game data -->
<template>
  <div class="runesPage">
    <div v-if="runesStore.status === 'loading'" class="py-8 text-center">
      <p class="text-text">Loading runes...</p>
    </div>

    <div v-else-if="runesStore.status === 'error'" class="py-8 text-center">
      <p class="text-error">{{ runesStore.error }}</p>
    </div>

    <div v-else class="wrap">
      <div class="paths-container">
        <!-- Primary Path Section -->
        <div class="path-section">
          <!-- Primary Path Selection Row -->
          <div class="path" :class="{ 'no-selection': !selectedPrimaryPathId }">
            <button
              v-for="path in runesStore.runePaths"
              :key="`primary-${path.id}`"
              :class="[
                'rune',
                getPathName(path.id),
                'row',
                selectedPrimaryPathId === path.id ? 'selected chosen' : '',
              ]"
              @click="selectPrimaryPath(path.id)"
              @mouseenter="e => handlePathHover(path, e)"
              @mouseleave="handleRuneLeave"
              @mousemove="handleMouseMove"
            >
              <div class="rune">
                <div
                  class="path img"
                  :style="{ '--img': `url(${getRunePathImageUrl(version, path.icon)})` }"
                ></div>
              </div>
            </button>
          </div>

          <!-- Primary Runes Grid -->
          <div v-if="selectedPrimaryPath" class="runes" :style="{ '--rune-size': '48px' }">
            <div
              v-for="(slot, slotIndex) in selectedPrimaryPath.slots"
              :key="`slot-${slotIndex}`"
              class="rune-slot"
            >
              <button
                v-for="rune in slot.runes"
                :key="`rune-${rune.id}`"
                :class="[
                  'row',
                  'rune-button',
                  selectedPrimaryRunes[slotIndex] === rune.id ? 'selected' : '',
                  !selectedPrimaryRunes[slotIndex] ? 'bright' : '',
                ]"
                @click="selectPrimaryRune(slotIndex, rune.id)"
                @mouseenter="e => handleRuneHover(rune, e)"
                @mouseleave="handleRuneLeave"
                @mousemove="handleMouseMove"
              >
                <div class="rune">
                  <div
                    class="img"
                    :style="{ '--img': `url(${getRuneImageUrl(version, rune.icon)})` }"
                  ></div>
                </div>
              </button>
            </div>
          </div>

          <!-- Summoner Spells (sous le primary path) -->
          <div class="summoners-section">
            <div class="summoners-grid">
              <button
                v-for="spell in availableSpells"
                :key="`spell-${spell.id}`"
                :class="[
                  'summoner-button',
                  isSummonerSpellSelected(spell) ? 'selected' : '',
                  selectedSummonerSpells.length < 2 ? 'bright' : '',
                ]"
                @click="selectSummonerSpell(spell)"
                @mouseenter="e => handleSpellHover(spell, e)"
                @mouseleave="handleRuneLeave"
                @mousemove="handleMouseMove"
              >
                <img
                  :src="getSpellImageUrl(version, spell.image.full)"
                  :alt="spell.name"
                  class="summoner-icon"
                />
              </button>
            </div>
          </div>
        </div>

        <!-- Secondary Path Section -->
        <div class="path-section">
          <!-- Secondary Path Selection Row -->
          <div class="path" :class="{ 'no-selection': !selectedSecondaryPathId }">
            <button
              v-for="path in availableSecondaryPaths"
              :key="`secondary-${path.id}`"
              :class="[
                'rune',
                getPathName(path.id),
                'row',
                selectedSecondaryPathId === path.id ? 'selected' : '',
                selectedPrimaryPathId === path.id ? 'chosen' : '',
              ]"
              @click="selectSecondaryPath(path.id)"
              @mouseenter="e => handlePathHover(path, e)"
              @mouseleave="handleRuneLeave"
              @mousemove="handleMouseMove"
            >
              <div class="rune">
                <div
                  class="path img"
                  :style="{ '--img': `url(${getRunePathImageUrl(version, path.icon)})` }"
                ></div>
              </div>
            </button>
          </div>

          <!-- Secondary Runes Grid -->
          <div v-if="selectedSecondaryPath" class="runes" :style="{ '--rune-size': '48px' }">
            <!-- Ligne 1 vide (keystone) -->
            <div class="rune-slot empty-slot">
              <!-- Ligne vide pour le miroir -->
            </div>
            <!-- Lignes 2, 3, 4 avec les runes -->
            <div
              v-for="(slot, slotIndex) in filteredSecondarySlots"
              :key="`secondary-slot-${slotIndex}`"
              class="rune-slot"
            >
              <button
                v-for="rune in slot.runes"
                :key="`secondary-rune-${rune.id}`"
                :class="[
                  'row',
                  'rune-button',
                  isSecondaryRuneSelected(rune.id) ? 'selected' : '',
                  // Brillant seulement si aucune rune n'est sélectionnée OU si cette rune est sélectionnée
                  selectedSecondaryRunes.length === 0 || isSecondaryRuneSelected(rune.id)
                    ? 'bright'
                    : '',
                ]"
                @click="selectSecondaryRune(rune.id)"
                @mouseenter="e => handleRuneHover(rune, e)"
                @mouseleave="handleRuneLeave"
                @mousemove="handleMouseMove"
              >
                <div class="rune">
                  <div
                    class="img"
                    :style="{ '--img': `url(${getRuneImageUrl(version, rune.icon)})` }"
                  ></div>
                </div>
              </button>
            </div>
          </div>

          <!-- Shards (sous le secondary path) -->
          <div class="shards-section">
            <div class="shards-grid">
              <!-- Slot 1: Principal -->
              <button
                v-for="shard in slot1Options"
                :key="`shard-1-${shard.id}`"
                :class="['shard-button', selectedShards[1] === shard.id ? 'selected' : '']"
                @click="selectShard(1, shard.id)"
                @mouseenter="e => handleShardHover(shard, e)"
                @mouseleave="handleRuneLeave"
                @mousemove="handleMouseMove"
              >
                <img :src="shardIconSrc(shard.image)" :alt="shard.name" class="shard-icon" />
              </button>
              <!-- Slot 2: Second -->
              <button
                v-for="shard in slot2Options"
                :key="`shard-2-${shard.id}`"
                :class="['shard-button', selectedShards[2] === shard.id ? 'selected' : '']"
                @click="selectShard(2, shard.id)"
                @mouseenter="e => handleShardHover(shard, e)"
                @mouseleave="handleRuneLeave"
                @mousemove="handleMouseMove"
              >
                <img :src="shardIconSrc(shard.image)" :alt="shard.name" class="shard-icon" />
              </button>
              <!-- Slot 3: Third -->
              <button
                v-for="shard in slot3Options"
                :key="`shard-3-${shard.id}`"
                :class="['shard-button', selectedShards[3] === shard.id ? 'selected' : '']"
                @click="selectShard(3, shard.id)"
                @mouseenter="e => handleShardHover(shard, e)"
                @mouseleave="handleRuneLeave"
                @mousemove="handleMouseMove"
              >
                <img :src="shardIconSrc(shard.image)" :alt="shard.name" class="shard-icon" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tooltip -->
    <div
      v-if="hoveredItem"
      ref="tooltipRef"
      class="rune-tooltip pointer-events-none fixed z-50 rounded-lg border border-accent bg-background shadow-lg"
      :style="tooltipStyle"
    >
      <div class="rune-tooltip-content">
        <div class="rune-tooltip-header">
          <div class="rune-tooltip-name">{{ hoveredItem.name }}</div>
        </div>
        <div
          v-if="hoveredItem.description"
          class="rune-tooltip-description"
          v-html="hoveredItem.description"
        ></div>
        <div
          v-else-if="hoveredItem.shortDesc"
          class="rune-tooltip-description"
          v-html="hoveredItem.shortDesc"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick, onUnmounted } from 'vue'
import { useRunesStore } from '~/stores/RunesStore'
import { useBuildStore } from '~/stores/BuildStore'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'
import type { RuneSelection, SummonerSpell, ShardSelection } from '~/types/build'
import { getRunePathImageUrl, getRuneImageUrl, getSpellImageUrl } from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'

const { version } = useGameVersion()
const { locale, t } = useI18n()

const runesStore = useRunesStore()
const buildStore = useBuildStore()
const spellsStore = useSummonerSpellsStore()

const getRiotLanguage = (loc: string): string => (loc === 'en' ? 'en_US' : 'fr_FR')
const riotLocale = computed(() => getRiotLanguage(locale.value))

const selectedPrimaryPathId = ref<number | null>(null)
const selectedPrimaryRunes = ref<Record<number, number>>({})
const selectedSecondaryPathId = ref<number | null>(null)
const selectedSecondaryRunes = ref<number[]>([]) // Array of rune IDs (max 2)
const selectedSummonerSpells = ref<Array<SummonerSpell | null>>([null, null]) // Array of 2 spells
const selectedShards = ref<Record<number, number>>({
  1: 5008, // Default: Adaptive Force
  2: 5008, // Default: Adaptive Force
  3: 5001, // Default: Health
})

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

const getPathName = (pathId: number): string => {
  const path = runesStore.getRunePathById(pathId)
  if (!path) return ''
  // Map path IDs to names (approximate mapping)
  const pathNames: Record<number, string> = {
    8000: 'Precision',
    8100: 'Domination',
    8200: 'Sorcery',
    8300: 'Inspiration',
    8400: 'Resolve',
  }
  return pathNames[pathId] || path.name
}

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

const selectSecondaryRune = (runeId: number) => {
  const index = selectedSecondaryRunes.value.indexOf(runeId)

  if (index > -1) {
    // Si la rune est déjà sélectionnée, on la retire
    selectedSecondaryRunes.value.splice(index, 1)
  } else if (selectedSecondaryRunes.value.length < 2) {
    // Système de roulement (FIFO) - Si moins de 2 runes, on ajoute simplement
    selectedSecondaryRunes.value.push(runeId)
  } else {
    // Si 2 runes déjà sélectionnées, on fait un roulement : [1, 2] -> [2, nouvelle]
    selectedSecondaryRunes.value.shift() // Retire la première
    selectedSecondaryRunes.value.push(runeId) // Ajoute la nouvelle à la fin
  }
  updateRuneSelection()
}

// Summoner Spells
const availableSpells = computed(() => {
  return spellsStore.spells
})

const isSummonerSpellSelected = (spell: SummonerSpell): boolean => {
  return (
    selectedSummonerSpells.value[0]?.id === spell.id ||
    selectedSummonerSpells.value[0]?.key === spell.key ||
    selectedSummonerSpells.value[1]?.id === spell.id ||
    selectedSummonerSpells.value[1]?.key === spell.key ||
    false
  )
}

const selectSummonerSpell = (spell: SummonerSpell) => {
  const index0 =
    selectedSummonerSpells.value[0]?.id === spell.id ||
    selectedSummonerSpells.value[0]?.key === spell.key
  const index1 =
    selectedSummonerSpells.value[1]?.id === spell.id ||
    selectedSummonerSpells.value[1]?.key === spell.key

  if (index0 || index1) {
    // Si le sort est déjà sélectionné, on le retire
    if (index0) {
      selectedSummonerSpells.value[0] = null
      buildStore.setSummonerSpell(0, null)
    } else if (index1) {
      selectedSummonerSpells.value[1] = null
      buildStore.setSummonerSpell(1, null)
    }
  } else if (selectedSummonerSpells.value[0] === null) {
    // Système de roulement (FIFO) - Premier slot vide
    selectedSummonerSpells.value[0] = spell
    buildStore.setSummonerSpell(0, spell)
  } else if (selectedSummonerSpells.value[1] === null) {
    // Deuxième slot vide
    selectedSummonerSpells.value[1] = spell
    buildStore.setSummonerSpell(1, spell)
  } else {
    // Si 2 sorts déjà sélectionnés, on fait un roulement : [1, 2] -> [2, nouvelle]
    const firstSpell = selectedSummonerSpells.value[1] || null
    selectedSummonerSpells.value[0] = firstSpell
    selectedSummonerSpells.value[1] = spell
    buildStore.setSummonerSpell(0, firstSpell)
    buildStore.setSummonerSpell(1, spell)
  }
}

// Shards
const shardIconSrc = (image: string): string => {
  return `/icons/shards/${image}`
}

interface ShardOption {
  id: number
  name: string
  image: string
  description: string
}

const slot1Options = computed<ShardOption[]>(() => [
  {
    id: 5008,
    name: t('runes.shards.5008.name'),
    image: 'adaptative.png',
    description: t('runes.shards.5008.desc'),
  },
  {
    id: 5005,
    name: t('runes.shards.5005.name'),
    image: 'speed.png',
    description: t('runes.shards.5005.desc'),
  },
  {
    id: 5007,
    name: t('runes.shards.5007.name'),
    image: 'cdr.png',
    description: t('runes.shards.5007.desc'),
  },
])

const slot2Options = computed<ShardOption[]>(() => [
  {
    id: 5008,
    name: t('runes.shards.5008.name'),
    image: 'adaptative.png',
    description: t('runes.shards.5008.desc'),
  },
  {
    id: 5006,
    name: t('runes.shards.5006.name'),
    image: 'move.png',
    description: t('runes.shards.5006.desc'),
  },
  {
    id: 5002,
    name: t('runes.shards.5002.name'),
    image: 'growth.png',
    description: t('runes.shards.5002.desc'),
  },
])

const slot3Options = computed<ShardOption[]>(() => [
  {
    id: 5001,
    name: t('runes.shards.5001.name'),
    image: 'hp.png',
    description: t('runes.shards.5001.desc'),
  },
  {
    id: 5003,
    name: t('runes.shards.5003.name'),
    image: 'tenacity.png',
    description: t('runes.shards.5003.desc'),
  },
  {
    id: 5002,
    name: t('runes.shards.5002.name'),
    image: 'growth.png',
    description: t('runes.shards.5002.desc'),
  },
])

const selectShard = (slot: number, shardId: number) => {
  selectedShards.value[slot] = shardId
  const shardSelection: ShardSelection = {
    slot1: selectedShards.value[1] ?? 5008,
    slot2: selectedShards.value[2] ?? 5008,
    slot3: selectedShards.value[3] ?? 5001,
  }
  buildStore.setShards(shardSelection)
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

// Load existing summoner spells from build
watch(
  () => buildStore.currentBuild?.summonerSpells,
  spells => {
    if (spells) {
      selectedSummonerSpells.value = [spells[0] || null, spells[1] || null]
    }
  },
  { immediate: true }
)

// Load existing shards from build
watch(
  () => buildStore.currentBuild?.shards,
  shards => {
    if (shards) {
      selectedShards.value = {
        1: shards.slot1 || 5008,
        2: shards.slot2 || 5008,
        3: shards.slot3 || 5001,
      }
    }
  },
  { immediate: true }
)

// Tooltip state
interface TooltipItem {
  name: string
  description?: string
  shortDesc?: string
  longDesc?: string
}

const hoveredItem = ref<TooltipItem | null>(null)
const tooltipRef = ref<HTMLElement | null>(null)
const tooltipPosition = ref({ x: 0, y: 0 })
const tooltipOffset = 15

const handlePathHover = (path: { name: string }, event: MouseEvent) => {
  hoveredItem.value = {
    name: path.name,
    description: undefined,
  }
  tooltipPosition.value = { x: event.clientX, y: event.clientY }
  nextTick(() => {
    updateTooltipPosition()
  })
}

const handleRuneHover = (
  rune: { name: string; shortDesc?: string; longDesc?: string },
  event: MouseEvent
) => {
  hoveredItem.value = {
    name: rune.name,
    description: rune.longDesc || rune.shortDesc,
    shortDesc: rune.shortDesc,
    longDesc: rune.longDesc,
  }
  tooltipPosition.value = { x: event.clientX, y: event.clientY }
  nextTick(() => {
    updateTooltipPosition()
  })
}

const handleSpellHover = (spell: SummonerSpell, event: MouseEvent) => {
  hoveredItem.value = {
    name: spell.name,
    description: spell.description || spell.tooltip,
  }
  tooltipPosition.value = { x: event.clientX, y: event.clientY }
  nextTick(() => {
    updateTooltipPosition()
  })
}

const handleShardHover = (shard: ShardOption, event: MouseEvent) => {
  hoveredItem.value = {
    name: shard.name,
    description: shard.description,
  }
  tooltipPosition.value = { x: event.clientX, y: event.clientY }
  nextTick(() => {
    updateTooltipPosition()
  })
}

const handleRuneLeave = () => {
  hoveredItem.value = null
}

const handleMouseMove = (event: MouseEvent) => {
  if (hoveredItem.value) {
    tooltipPosition.value = { x: event.clientX, y: event.clientY }
    nextTick(() => {
      updateTooltipPosition()
    })
  }
}

const updateTooltipPosition = () => {
  if (!tooltipRef.value || !hoveredItem.value) return

  const tooltip = tooltipRef.value
  const rect = tooltip.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  let x = tooltipPosition.value.x + tooltipOffset
  let y = tooltipPosition.value.y + tooltipOffset

  // Adjust horizontal position if tooltip goes off-screen
  if (x + rect.width > viewportWidth) {
    x = tooltipPosition.value.x - rect.width - tooltipOffset
  }

  // Adjust vertical position if tooltip goes off-screen
  if (y + rect.height > viewportHeight) {
    y = tooltipPosition.value.y - rect.height - tooltipOffset
  }

  // Ensure tooltip doesn't go off-screen on the left
  if (x < 0) {
    x = tooltipOffset
  }

  // Ensure tooltip doesn't go off-screen on the top
  if (y < 0) {
    y = tooltipOffset
  }

  // Update tooltip position
  tooltip.style.left = `${x}px`
  tooltip.style.top = `${y}px`
}

const tooltipStyle = computed(() => {
  if (!hoveredItem.value) return {}
  return {
    left: `${tooltipPosition.value.x + tooltipOffset}px`,
    top: `${tooltipPosition.value.y + tooltipOffset}px`,
  }
})

watch(hoveredItem, async newValue => {
  if (newValue) {
    await nextTick()
    updateTooltipPosition()
    window.addEventListener('scroll', updateTooltipPosition, true)
    window.addEventListener('resize', updateTooltipPosition)
  } else {
    window.removeEventListener('scroll', updateTooltipPosition, true)
    window.removeEventListener('resize', updateTooltipPosition)
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', updateTooltipPosition, true)
  window.removeEventListener('resize', updateTooltipPosition)
})

const loadGameDataForLocale = async () => {
  const lang = riotLocale.value
  await runesStore.loadRunes(lang)
  await spellsStore.loadSummonerSpells(lang)
}

onMounted(() => {
  loadGameDataForLocale()
})

watch(locale, () => {
  loadGameDataForLocale()
})
</script>

<style scoped>
.runesPage {
  font-family: var(--font, system-ui, -apple-system, sans-serif);
  color-scheme: dark only;
  line-height: 1.5;
  font-weight: 400;
  font-size: 16px;
  color: rgb(var(--rgb-primary-light));
  box-sizing: border-box;
  max-width: min-content;
  margin: 0.5em auto 1em;
  text-align: center;
}

.wrap {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}

.paths-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  align-items: center;
  justify-content: center;
  width: 100%;
}

/* Sur grand écran, les runes primaires et secondaires sont côte à côte */
@media (min-width: 768px) {
  .paths-container {
    flex-direction: row;
    align-items: flex-start;
    gap: 3rem;
  }

  .path-section {
    flex: 1;
    max-width: 50%;
  }
}

.path-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
  width: 100%;
  max-width: 100%;
}

/* Path Selection Rows */
.path {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.path button.rune {
  width: 52px;
  height: 52px;
  border: 2px solid var(--color-gold-300);
  background: rgba(0, 0, 0, 0.4);
  padding: 0;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.path button.rune.row {
  opacity: 0.4; /* Ternes par défaut */
}

.path button.rune.row.selected {
  /* Pas de filtre doré, juste l'opacité */
  opacity: 1; /* Brillant quand sélectionné */
}

.path button.rune.row.chosen:not(.selected) {
  opacity: 0.4; /* Ternes si déjà choisi comme primary mais pas sélectionné */
}

.path button.rune.row.selected.chosen {
  opacity: 1; /* Brillant quand sélectionné, même si choisi */
}

/* Si aucun path n'est sélectionné, tous brillants */
.path.no-selection button.rune.row:not(.chosen) {
  opacity: 1;
}

.path button.rune.row:hover {
  transform: scale(1.1);
  opacity: 1;
}

.path button.rune .rune {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.path button.rune .path.img {
  width: 90%;
  height: 90%;
  border-radius: 50%;
  background-image: var(--img);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

/* Runes Grid - Layout horizontal (côte à côte) */
.runes {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0.5rem 0;
  align-items: center;
}

.rune-slot {
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
  justify-content: center;
  align-items: center;
}

.rune-slot.empty-slot {
  min-height: var(--rune-size, 48px);
  /* Ligne vide pour le miroir avec les runes principales */
}

.runes .rune-button {
  width: var(--rune-size, 48px);
  height: var(--rune-size, 48px);
  border: 2px solid var(--color-gold-300);
  background: rgba(0, 0, 0, 0.4);
  padding: 0;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 50%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.runes .rune-button.row {
  opacity: 0.4; /* Ternes par défaut */
}

.runes .rune-button.row.selected {
  /* Pas de filtre doré, juste le bord et l'opacité */
  opacity: 1; /* Brillant quand sélectionné */
}

/* Si aucune rune n'est sélectionnée dans le slot, toutes brillantes */
.runes .rune-button.row.bright {
  opacity: 1;
}

.runes .rune-button.row:hover {
  transform: scale(1.1);
  opacity: 1;
}

.runes .rune-button .rune {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.runes .rune-button .img {
  width: 90%;
  height: 90%;
  border-radius: 50%;
  background-image: var(--img);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

/* Summoner Spells Section */
.summoners-section {
  margin-top: 1rem;
  width: 100%;
}

.summoners-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  max-width: 100px; /* Réduit de moitié (200px -> 100px) */
  margin: 0 auto;
}

.summoner-button {
  width: 100%;
  aspect-ratio: 1;
  border: 2px solid var(--color-gold-300);
  background: rgba(0, 0, 0, 0.4);
  padding: 0;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 4px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  opacity: 0.4; /* Ternes par défaut */
}

.summoner-button.selected {
  opacity: 1; /* Brillant quand sélectionné */
}

.summoner-button.bright {
  opacity: 1; /* Brillant quand moins de 2 sélectionnés */
}

.summoner-button:hover {
  transform: scale(1.1);
  opacity: 1;
}

.summoner-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 2px;
}

/* Shards Section - Ronds, alignés avec summoners, taille réduite de moitié */
.shards-section {
  margin-top: 1rem;
  width: 100%;
}

.shards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  max-width: 100px; /* Réduit de moitié (200px -> 100px) */
  margin: 0 auto;
}

.shard-button {
  width: 100%;
  aspect-ratio: 1;
  border: 2px solid var(--color-gold-300);
  background: rgba(0, 0, 0, 0.4);
  padding: 0;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 50%; /* Ronds */
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  opacity: 0.4; /* Ternes par défaut */
}

.shard-button.selected {
  opacity: 1; /* Brillant quand sélectionné */
}

.shard-button:hover {
  transform: scale(1.1);
  opacity: 1;
}

.shard-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%; /* Ronds */
}

/* Tooltip Styles */
.rune-tooltip {
  max-width: 300px;
  padding: 0.75rem;
  pointer-events: none;
}

.rune-tooltip-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.rune-tooltip-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.rune-tooltip-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgb(var(--rgb-accent));
  line-height: 1.2;
}

.rune-tooltip-description {
  font-size: 0.8rem;
  color: rgb(var(--rgb-text));
  line-height: 1.4;
  opacity: 0.9;
}
</style>
