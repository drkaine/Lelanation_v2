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
              type="button"
              :aria-label="path.name"
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
                  :style="{
                    '--img': `url(${getRunePathImageUrl(version, path.icon)})`,
                    '--path-color': getRunePathColor(path.icon, path.id, path.name),
                  }"
                ></div>
              </div>
            </button>
          </div>

          <!-- Primary Runes Grid -->
          <div v-if="selectedPrimaryPath" class="runes">
            <div
              v-for="(slot, slotIndex) in selectedPrimaryPath.slots"
              :key="`slot-${slotIndex}`"
              class="rune-slot"
            >
              <button
                v-for="rune in slot.runes"
                :key="`rune-${rune.id}`"
                type="button"
                :aria-label="rune.name"
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
                type="button"
                :aria-label="spell.name"
                :class="[
                  'summoner-button',
                  isSummonerSpellSelected(spell) ? 'selected' : '',
                  selectedSummonerSpellsCount === 0 ? 'bright' : '',
                  isSummonerSpellDisabled(spell) ? 'disabled' : '',
                ]"
                :disabled="isSummonerSpellDisabled(spell)"
                @click="selectSummonerSpell(spell)"
                @mouseenter="e => handleSpellHover(spell, e)"
                @mouseleave="handleRuneLeave"
                @mousemove="handleMouseMove"
              >
                <img
                  :src="getSpellImageUrl(version, spell.image.full)"
                  alt=""
                  class="summoner-icon"
                  role="presentation"
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
              type="button"
              :aria-label="path.name"
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
                  :style="{
                    '--img': `url(${getRunePathImageUrl(version, path.icon)})`,
                    '--path-color': getRunePathColor(path.icon, path.id, path.name),
                  }"
                ></div>
              </div>
            </button>
          </div>

          <!-- Secondary Runes Grid -->
          <div v-if="selectedSecondaryPath" class="runes">
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
                type="button"
                :aria-label="rune.name"
                :class="[
                  'row',
                  'rune-button',
                  isSecondaryRuneSelected(rune.id) ? 'selected' : '',
                  isSecondaryRuneSelected(rune.id) ||
                  (!secondarySelectionComplete && !secondaryRowHasSelection(slot.runes))
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
                type="button"
                :aria-label="shard.name"
                :class="['shard-button', selectedShards[1] === shard.id ? 'selected' : '']"
                @click="selectShard(1, shard.id)"
                @mouseenter="e => handleShardHover(shard, e)"
                @mouseleave="handleRuneLeave"
                @mousemove="handleMouseMove"
              >
                <img
                  :src="shardIconSrc(shard.image)"
                  alt=""
                  class="shard-icon"
                  role="presentation"
                />
              </button>
              <!-- Slot 2: Second -->
              <button
                v-for="shard in slot2Options"
                :key="`shard-2-${shard.id}`"
                type="button"
                :aria-label="shard.name"
                :class="['shard-button', selectedShards[2] === shard.id ? 'selected' : '']"
                @click="selectShard(2, shard.id)"
                @mouseenter="e => handleShardHover(shard, e)"
                @mouseleave="handleRuneLeave"
                @mousemove="handleMouseMove"
              >
                <img
                  :src="shardIconSrc(shard.image)"
                  alt=""
                  class="shard-icon"
                  role="presentation"
                />
              </button>
              <!-- Slot 3: Third -->
              <button
                v-for="shard in slot3Options"
                :key="`shard-3-${shard.id}`"
                type="button"
                :aria-label="shard.name"
                :class="['shard-button', selectedShards[3] === shard.id ? 'selected' : '']"
                @click="selectShard(3, shard.id)"
                @mouseenter="e => handleShardHover(shard, e)"
                @mouseleave="handleRuneLeave"
                @mousemove="handleMouseMove"
              >
                <img
                  :src="shardIconSrc(shard.image)"
                  alt=""
                  class="shard-icon"
                  role="presentation"
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tooltip -->
    <div
      v-if="hoveredItem && tooltipsEnabled"
      ref="tooltipRef"
      class="rune-tooltip pointer-events-none fixed z-50 rounded-lg border border-accent bg-background shadow-lg"
      :style="tooltipStyle"
    >
      <div class="rune-tooltip-content">
        <div class="rune-tooltip-header">
          <span
            v-if="hoveredItem.isPathIcon && hoveredItem.icon"
            class="rune-path-tooltip-icon"
            role="img"
            :aria-label="hoveredItem.name"
            :style="hoveredItem.pathMaskStyle"
          />
          <img
            v-else-if="hoveredItem.icon"
            :src="hoveredItem.icon"
            :alt="hoveredItem.name"
            class="rune-tooltip-image"
            loading="lazy"
          />
          <div class="rune-tooltip-name">{{ hoveredItem.name }}</div>
        </div>
        <div
          v-if="formattedHoveredDescription"
          class="rune-tooltip-description tooltip-game-description"
          v-html="formattedHoveredDescription"
        />
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
import {
  getRunePathImageUrl,
  getRunePathColor,
  getRunePathMaskStyle,
  getRuneImageUrl,
  getSpellImageUrl,
} from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'
import { useTooltipsPreference } from '~/composables/useTooltipsPreference'
import { formatSummonerSpellTooltipHtml } from '~/utils/gameTooltipFormatter'
import { formatRuneTooltipHtml } from '~/utils/formatTooltipMarkupHtml'
import { isSmiteSpell } from '~/utils/buildItemRules'
const { version } = useGameVersion()
const { locale, t } = useI18n()
const { tooltipsEnabled } = useTooltipsPreference()

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
  3: 5011, // Default: Health (flat)
})

const selectedPrimaryPath = computed(() => {
  if (!selectedPrimaryPathId.value) return null
  return runesStore.getRunePathById(selectedPrimaryPathId.value)
})

const selectedSecondaryPath = computed(() => {
  if (!selectedSecondaryPathId.value) return null
  return runesStore.getRunePathById(selectedSecondaryPathId.value)
})

const selectedSummonerSpellsCount = computed(
  () => selectedSummonerSpells.value.filter(Boolean).length
)

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

const secondaryRowHasSelection = (runes: Array<{ id: number }>): boolean => {
  return runes.some(rune => selectedSecondaryRunes.value.includes(rune.id))
}

const secondarySelectionComplete = computed(() => selectedSecondaryRunes.value.length >= 2)

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

const hasJungleRole = computed(() => buildStore.currentBuild?.roles?.includes('jungle') ?? false)

const isSummonerSpellDisabled = (spell: SummonerSpell): boolean =>
  isSmiteSpell(spell) && !hasJungleRole.value

const selectSummonerSpell = (spell: SummonerSpell) => {
  if (isSummonerSpellDisabled(spell)) {
    return
  }

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
    id: 5010,
    name: t('runes.shards.5010.name'),
    image: 'move.png',
    description: t('runes.shards.5010.desc'),
  },
  {
    id: 5001,
    name: t('runes.shards.5001.name'),
    image: 'growth.png',
    description: t('runes.shards.5001.desc'),
  },
])

const slot3Options = computed<ShardOption[]>(() => [
  {
    id: 5011,
    name: t('runes.shards.5011.name'),
    image: 'hp.png',
    description: t('runes.shards.5011.desc'),
  },
  {
    id: 5013,
    name: t('runes.shards.5013.name'),
    image: 'tenacity.png',
    description: t('runes.shards.5013.desc'),
  },
  {
    id: 5001,
    name: t('runes.shards.5001.name'),
    image: 'growth.png',
    description: t('runes.shards.5001.desc'),
  },
])

const selectShard = (slot: number, shardId: number) => {
  selectedShards.value[slot] = shardId
  const shardSelection: ShardSelection = {
    slot1: selectedShards.value[1] ?? 5008,
    slot2: selectedShards.value[2] ?? 5008,
    slot3: selectedShards.value[3] ?? 5011,
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

const resetRuneSelectionUi = () => {
  selectedPrimaryPathId.value = null
  selectedPrimaryRunes.value = {}
  selectedSecondaryPathId.value = null
  selectedSecondaryRunes.value = []
}

// Load existing rune selection from build ou variante affichée
watch(
  () => buildStore.displayedBuild?.runes,
  runes => {
    if (runes && runes.primary.pathId && runes.primary.keystone) {
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
    } else {
      // Quand on passe sur une variante vide (sans runes), vider l'affichage local.
      resetRuneSelectionUi()
    }
  },
  { immediate: true }
)

// Load existing summoner spells from build ou variante affichée
watch(
  () => buildStore.displayedBuild?.summonerSpells,
  spells => {
    if (spells) {
      selectedSummonerSpells.value = [spells[0] || null, spells[1] || null]
    }
  },
  { immediate: true }
)

// Load existing shards from build ou variante affichée
watch(
  () => buildStore.displayedBuild?.shards,
  shards => {
    if (shards) {
      selectedShards.value = {
        1: shards.slot1 || 5008,
        2: shards.slot2 || 5008,
        3: shards.slot3 || 5011,
      }
    }
  },
  { immediate: true }
)

// Tooltip state
interface TooltipItem {
  name: string
  icon?: string
  description?: string
  shortDesc?: string
  longDesc?: string
  isPathIcon?: boolean
  pathMaskStyle?: Record<string, string>
}

const hoveredItem = ref<TooltipItem | null>(null)
const tooltipRef = ref<HTMLElement | null>(null)
const tooltipPosition = ref({ x: 0, y: 0 })
const tooltipOffset = 15

const handlePathHover = (path: { id: number; name: string; icon?: string }, event: MouseEvent) => {
  if (!tooltipsEnabled.value) return
  const icon = path.icon
    ? getRunePathImageUrl(version.value, path.icon, path.id, path.name)
    : undefined
  hoveredItem.value = {
    name: path.name,
    icon,
    description: undefined,
    isPathIcon: true,
    pathMaskStyle: path.icon
      ? getRunePathMaskStyle(version.value, path.icon, path.id, path.name)
      : undefined,
  }
  tooltipPosition.value = { x: event.clientX, y: event.clientY }
  nextTick(() => {
    updateTooltipPosition()
  })
}

const handleRuneHover = (
  rune: { name: string; icon?: string; shortDesc?: string; longDesc?: string },
  event: MouseEvent
) => {
  if (!tooltipsEnabled.value) return
  hoveredItem.value = {
    name: rune.name,
    icon: rune.icon ? getRuneImageUrl(version.value, rune.icon) : undefined,
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
  if (!tooltipsEnabled.value) return
  hoveredItem.value = {
    name: spell.name,
    icon: getSpellImageUrl(version.value, spell.image.full),
    description: formatSummonerSpellTooltipHtml(spell),
  }
  tooltipPosition.value = { x: event.clientX, y: event.clientY }
  nextTick(() => {
    updateTooltipPosition()
  })
}

const handleShardHover = (shard: ShardOption, event: MouseEvent) => {
  if (!tooltipsEnabled.value) return
  hoveredItem.value = {
    name: shard.name,
    icon: shardIconSrc(shard.image),
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
  if (!tooltipsEnabled.value) return
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

const formattedHoveredDescription = computed(() => {
  const item = hoveredItem.value
  if (!item) return ''
  // Summoner spell hovers store pre-rendered HTML in description (with CD/cost/range).
  if (item.description && item.icon && !item.longDesc && !item.shortDesc) {
    return item.description
  }
  return formatRuneTooltipHtml(item)
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

watch(tooltipsEnabled, enabled => {
  if (!enabled) {
    hoveredItem.value = null
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
  width: 100%;
  max-width: 100%;
  margin: 0.5em auto 1em;
  text-align: center;
  --path-size: var(--selector-path-size, clamp(44px, calc(28px + 1.6vw), 72px));
  --rune-size: var(--selector-rune-size, clamp(48px, calc(30px + 1.8vw), 72px));
  --square-size: var(--selector-square-size, clamp(48px, calc(30px + 1.7vw), 68px));
  --selector-gap: var(--selector-gap-size, clamp(0.2rem, 0.2rem + 0.2vw, 0.45rem));
}

.wrap {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  height: 100%;
  width: 100%;
}

.paths-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

/* Sur grand écran, les runes primaires et secondaires sont côte à côte */
@media (min-width: 768px) {
  .paths-container {
    flex-direction: row;
    align-items: stretch;
    gap: 3rem;
  }

  .path-section {
    flex: 1;
    max-width: 50%;
    height: 100%;
    justify-content: space-between;
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
  gap: var(--selector-gap);
  justify-content: center;
  margin-bottom: 0.5rem;
}

.path button.rune {
  width: var(--path-size);
  height: var(--path-size);
  border: 1.5px solid var(--color-gold-500);
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
  width: 82%;
  height: 82%;
  border-radius: 50%;
  background-color: var(--path-color, #eab308);
  -webkit-mask-image: var(--img);
  mask-image: var(--img);
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-position: center center;
  mask-position: center center;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}

.path button.rune:not(.Domination) .path.img {
  transform: translateY(5px);
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
  gap: var(--selector-gap);
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
  border: 1.5px solid var(--color-gold-500);
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

.runes .rune-button:not(.selected):not(.bright) .img {
  filter: grayscale(1) brightness(0.7);
}

.runes .rune-button:hover .img {
  filter: none;
}

/* Summoner Spells Section */
.summoners-section {
  margin-top: 1rem;
  width: 100%;
}

.summoners-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(var(--square-size), 1fr));
  gap: var(--selector-gap);
  max-width: calc((var(--square-size) * 3) + (var(--selector-gap) * 2));
  margin: 0 auto;
}

.summoner-button {
  min-width: var(--square-size);
  min-height: var(--square-size);
  width: 100%;
  aspect-ratio: 1;
  border: 1.5px solid var(--color-gold-500);
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

.summoner-button.disabled,
.summoner-button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  pointer-events: none;
}

.summoner-button:hover {
  opacity: 1;
}

.summoner-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 2px;
}

.summoner-button:not(.selected):not(.bright) .summoner-icon {
  filter: grayscale(1) brightness(0.7);
}

.summoner-button:hover .summoner-icon {
  filter: none;
}

.summoner-button:not(.selected):hover .summoner-icon {
  filter: none;
}

/* Shards Section - Ronds, alignés avec summoners, taille réduite de moitié */
.shards-section {
  margin-top: 1rem;
  width: 100%;
}

.shards-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(var(--square-size), 1fr));
  gap: var(--selector-gap);
  max-width: calc((var(--square-size) * 3) + (var(--selector-gap) * 2));
  margin: 0 auto;
}

.shard-button {
  min-width: var(--square-size);
  min-height: var(--square-size);
  width: 100%;
  aspect-ratio: 1;
  border: 1.5px solid var(--color-gold-500);
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
  opacity: 1;
}

.shard-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%; /* Ronds */
}

.shard-button:not(.selected) .shard-icon {
  filter: grayscale(1) brightness(0.7);
}

.shard-button:hover .shard-icon {
  filter: none;
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

.rune-tooltip-image {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: 1px solid rgb(var(--rgb-accent) / 0.55);
  object-fit: cover;
  flex-shrink: 0;
}

.rune-path-tooltip-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 50%;
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

.rune-tooltip-description :deep(.tooltip-spell-meta-key) {
  color: rgb(252 211 77 / 1) !important;
  font-weight: 700 !important;
}

.rune-tooltip-description :deep(.tooltip-spell-meta-line) {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
</style>
