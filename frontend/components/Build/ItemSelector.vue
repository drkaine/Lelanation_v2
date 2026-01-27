<template>
  <div class="item-selector" style="background: transparent !important">
    <!-- Search Bar -->
    <div class="mb-2">
      <input
        v-model="searchQuery"
        type="text"
        :placeholder="t('common.search')"
        class="w-full rounded border border-primary/50 bg-transparent px-2 py-1 text-sm text-text placeholder:text-text/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
        @input="handleSearch"
      />
    </div>

    <!-- Tag Filters -->
    <div class="mb-3 flex flex-wrap gap-0">
      <button
        v-for="tag in availableTags"
        :key="tag"
        :class="[
          'rounded-lg border px-3 py-1.5 text-sm font-semibold transition-all',
          selectedTags.includes(tag)
            ? 'border-surface bg-accent text-background'
            : 'border-accent bg-surface text-text',
        ]"
        style="margin-right: -1px"
        @click="toggleTag(tag)"
      >
        {{ translateTag(tag) }}
      </button>
    </div>

    <div v-if="itemsStore.status === 'loading'" class="py-8 text-center">
      <p class="text-text">Loading items...</p>
    </div>

    <div v-else-if="itemsStore.status === 'error'" class="py-8 text-center">
      <p class="text-error">{{ itemsStore.error }}</p>
    </div>

    <div v-else class="items-list mt-2">
      <div
        v-for="item in allItems"
        :key="item.id"
        class="item-wrapper"
        :class="{ hide: !isFiltered(item) }"
        @mouseenter="handleItemHover(item, $event)"
        @mouseleave="hoveredItem = null"
        @mousemove="handleMouseMove($event)"
      >
        <button
          class="item"
          :disabled="!isSelected(item) && selectedItemsCount >= 6"
          @click="toggleItem(item)"
        >
          <img
            :src="getItemImageUrl(version, item.image.full)"
            :alt="item.name"
            loading="lazy"
            width="64"
            height="64"
            decoding="async"
          />
          <div v-if="isSelected(item)" class="item-selected">
            <span class="item-index">{{ getItemIndex(item) }}</span>
          </div>
        </button>
        <div class="item-price">{{ item.gold?.total || 0 }}</div>
      </div>

      <!-- Tooltip -->
      <div
        v-if="hoveredItem"
        ref="tooltipRef"
        class="item-tooltip pointer-events-none fixed z-50 rounded-lg border border-accent bg-background shadow-lg"
        :style="tooltipStyle"
      >
        <div class="item-tooltip-content">
          <div class="item-tooltip-header">
            <img
              :src="getItemImageUrl(version, hoveredItem.image.full)"
              :alt="hoveredItem.name"
              class="item-tooltip-image"
            />
            <div class="item-tooltip-text">
              <div class="item-tooltip-name">{{ hoveredItem.name }}</div>
              <div class="item-tooltip-price">
                {{ hoveredItem.gold?.total || 0 }}
              </div>
            </div>
          </div>
          <div v-if="hoveredItem.plaintext" class="item-tooltip-plaintext">
            {{ hoveredItem.plaintext }}
          </div>
          <!-- eslint-disable vue/no-v-html -->
          <div
            v-if="hoveredItem.description"
            class="item-tooltip-description"
            v-html="hoveredItem.description"
          />
          <!-- eslint-enable vue/no-v-html -->
        </div>
      </div>
    </div>

    <div v-if="filteredItems.length === 0" class="py-8 text-center">
      <p class="text-text">No items found</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useItemsStore } from '~/stores/ItemsStore'
import { useBuildStore } from '~/stores/BuildStore'
import type { Item } from '~/types/build'

import { getItemImageUrl } from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'
import { useDebounce } from '~/composables/useDebounce'

const itemsStore = useItemsStore()
const buildStore = useBuildStore()
const { t } = useI18n()

// Translate tag name - map actual item tags to translation keys
const translateTag = (tag: string): string => {
  const tagMap: Record<string, string> = {
    Boots: 'boots',
    Starter: 'starter',
    Basic: 'basic',
    Epic: 'epic',
    Legendary: 'legendary',
    Consumable: 'consumable',
    CriticalStrike: 'critical-strike',
    AttackSpeed: 'attack-speed',
    OnHit: 'on-hit',
    ArmorPenetration: 'armor-penetration',
    AbilityPower: 'ability-power',
    Mana: 'mana',
    ManaRegen: 'mana-regen',
    MagicPenetration: 'magic-penetration',
    Health: 'health',
    HealthRegen: 'health-regen',
    Armor: 'armor',
    SpellBlock: 'spell-block',
    MagicResist: 'magic-resist',
    AbilityHaste: 'ability-haste',
    NonbootsMovement: 'movement',
    LifeSteal: 'life-steal',
    SpellVamp: 'spell-vamp',
    Omnivamp: 'omnivamp',
    Damage: 'damage',
    Active: 'active',
    Aura: 'aura',
    CooldownReduction: 'ability-haste',
    GoldPer: 'gold-per',
    Jungle: 'jungle',
    Lane: 'lane',
    Slow: 'slow',
    SpellDamage: 'spell-damage',
    Stealth: 'stealth',
    Tenacity: 'tenacity',
    Trinket: 'trinket',
    Vision: 'vision',
  }

  const tagKey =
    tagMap[tag] ||
    tag
      .toLowerCase()
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
  const translation = t(`item.${tagKey}`)
  // If translation doesn't exist, return the original tag
  return translation !== `item.${tagKey}` ? translation : tag
}

const searchQuery = ref('')
const selectedTags = ref<string[]>([])
const debouncedSearch = useDebounce(searchQuery, 300)

const availableTags = computed(() => {
  const tags = new Set<string>()
  for (const item of itemsStore.items) {
    for (const tag of item.tags) {
      tags.add(tag)
    }
  }
  return Array.from(tags).sort()
})

const filteredItems = computed<Item[]>(() => {
  let filtered = itemsStore.items

  // Filter by tags
  if (selectedTags.value.length > 0) {
    filtered = filtered.filter((item: Item) =>
      selectedTags.value.some(tag => item.tags && item.tags.includes(tag))
    )
  }

  // Filter by search query (using debounced value)
  if (debouncedSearch.value && debouncedSearch.value.trim().length > 0) {
    const lowerQuery = debouncedSearch.value.toLowerCase().trim()
    filtered = filtered.filter(
      (item: Item) =>
        item.name.toLowerCase().includes(lowerQuery) ||
        item.colloq?.toLowerCase().includes(lowerQuery) ||
        item.plaintext?.toLowerCase().includes(lowerQuery)
    )
  }

  return filtered
})

// Item category types for sorting
type ItemCategory = 'starter' | 'boots' | 'basic' | 'epic' | 'legendary' | 'other'

// Get item category for sorting
const getItemCategory = (item: Item): ItemCategory => {
  // Starter items - identified by ID and name patterns
  const starterItemIds = new Set([
    '1054', // Bouclier de Doran
    '1055', // Lame de Doran
    '1056', // Anneau de Doran
    '1082', // Seau noir (Relic Shield)
    '1083', // Abatteur (Cull)
    '3070', // Larme de la déesse
    '3865', // Atlas
    '3866', // Faucheuse (Sickle)
    '3867', // Fragment (Shard)
    '3869', // Épée de voleur (Spellthief's Edge)
    '3870', // Fragment (Shard)
    '3871', // Fragment (Shard)
    '3876', // Fragment (Shard)
    '3877', // Fragment (Shard)
  ])

  const starterNamePatterns = [
    'seau',
    'anneau de doran',
    'lame de doran',
    'bouclier de doran',
    'larme de la déesse',
    'cull',
    'abatteur',
    'atlas',
    'épée de voleur',
    'faucheuse',
    'fragment',
  ]

  if (starterItemIds.has(item.id)) {
    return 'starter'
  }

  const itemNameLower = item.name.toLowerCase()
  if (starterNamePatterns.some(pattern => itemNameLower.includes(pattern))) {
    return 'starter'
  }

  // Boots - item 1001 and items that build from 1001
  if (item.id === '1001' || (item.from && item.from.includes('1001'))) {
    return 'boots'
  }

  // Basic items - no from array or empty from
  if (!item.from || item.from.length === 0) {
    return 'basic'
  }

  // Epic items - have from AND into with at least 1 element
  if (item.from && item.from.length > 0 && item.into && item.into.length > 0) {
    return 'epic'
  }

  // Legendary items - have from but no into (or empty into)
  if (item.from && item.from.length > 0 && (!item.into || item.into.length === 0)) {
    return 'legendary'
  }

  return 'other'
}

// Category order for sorting
const categoryOrder: Record<ItemCategory, number> = {
  starter: 1,
  boots: 2,
  basic: 3,
  epic: 4,
  legendary: 5,
  other: 6,
}

// All items for display (filtered ones in color, others in grayscale)
// Sorted by category, then by name within each category
const allItems = computed(() => {
  const items = [...itemsStore.items]

  return items.sort((a, b) => {
    const categoryA = getItemCategory(a)
    const categoryB = getItemCategory(b)

    // First sort by category
    const categoryDiff = categoryOrder[categoryA] - categoryOrder[categoryB]
    if (categoryDiff !== 0) {
      return categoryDiff
    }

    // Then sort by name within the same category
    return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
  })
})

// Check if item matches current filters
const isFiltered = (item: Item): boolean => {
  // If no filters, all items are "filtered" (visible in color)
  const hasActiveFilters =
    selectedTags.value.length > 0 ||
    (debouncedSearch.value && debouncedSearch.value.trim().length > 0)

  if (!hasActiveFilters) {
    return true // All items visible when no filters
  }

  // When filters are active, only show items that match
  return filteredItems.value.some(i => i.id === item.id)
}

const selectedItemsCount = computed(() => {
  return buildStore.currentBuild?.items.length || 0
})

const isSelected = (item: Item): boolean => {
  if (!buildStore.currentBuild?.items) return false
  return buildStore.currentBuild.items.some(i => i.id === item.id)
}

const getItemIndex = (item: Item): number => {
  if (!buildStore.currentBuild?.items) return 0
  const index = buildStore.currentBuild.items.findIndex(i => i.id === item.id)
  // Return index + 1 for display (1-based), or 0 if not found
  // This should only be called when isSelected(item) is true
  return index >= 0 ? index + 1 : 0
}

const toggleItem = (item: Item) => {
  if (isSelected(item)) {
    buildStore.removeItem(item.id)
  } else if (selectedItemsCount.value < 6) {
    buildStore.addItem(item)
  }
}

const toggleTag = (tag: string) => {
  const index = selectedTags.value.indexOf(tag)
  if (index >= 0) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tag)
  }
}

const handleSearch = () => {
  // Search is reactive via computed property
}

const { version } = useGameVersion()

// Tooltip state
const hoveredItem = ref<Item | null>(null)
const tooltipRef = ref<HTMLElement | null>(null)
const tooltipPosition = ref({ x: 0, y: 0 })
const tooltipOffset = 15 // Offset from cursor in pixels

// Calculate and update tooltip position
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

// Tooltip style computed from mouse position (initial position)
const tooltipStyle = computed(() => {
  if (!hoveredItem.value) return {}
  return {
    left: `${tooltipPosition.value.x + tooltipOffset}px`,
    top: `${tooltipPosition.value.y + tooltipOffset}px`,
  }
})

// Handle mouse move to update tooltip position
const handleMouseMove = (event: MouseEvent) => {
  if (hoveredItem.value) {
    tooltipPosition.value = {
      x: event.clientX,
      y: event.clientY,
    }
    nextTick(() => {
      updateTooltipPosition()
    })
  }
}

// Handle item hover
const handleItemHover = (item: Item, event: MouseEvent) => {
  hoveredItem.value = item
  tooltipPosition.value = {
    x: event.clientX,
    y: event.clientY,
  }
  nextTick(() => {
    updateTooltipPosition()
  })
}

// Watch for tooltip visibility and recalculate position
watch(hoveredItem, async newValue => {
  if (newValue) {
    await nextTick()
    updateTooltipPosition()

    // Recalculate on scroll and resize
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

onMounted(() => {
  if (itemsStore.items.length === 0) {
    itemsStore.loadItems()
  }
})
</script>

<style scoped>
.item-selector {
  background: transparent !important;
}

.items-list {
  --itemSizeButton: 64px;
  display: grid;
  grid-template-columns: repeat(auto-fit, var(--itemSizeButton));
  place-content: center;
  width: 100%;
  gap: 0.5rem;
  position: relative;
}

.item-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  position: relative;
}

.item {
  border: 1px solid transparent;
  position: relative;
  height: var(--itemSizeButton);
  width: var(--itemSizeButton);
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

.item-price {
  font-size: 0.75rem;
  color: rgb(var(--rgb-text) / 0.8);
  text-align: center;
  white-space: nowrap;
}

.gold-icon {
  font-size: 0.7rem;
}

.item:disabled {
  cursor: not-allowed;
}

.item-wrapper.hide {
  opacity: 0.3;
  pointer-events: none;
}

.item-wrapper.hide .item {
  cursor: default;
}

.item-wrapper.hide img {
  filter: grayscale(1) brightness(0.4);
}

/* Only gray out items that don't match filters, not all items */
.item-wrapper:not(.hide) img {
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.8));
}

.item img {
  display: block;
  height: 100%;
  width: 100%;
  object-fit: cover;
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.8));
}

.item-selected {
  position: absolute;
  inset: 0;
  border: 2px solid rgb(var(--rgb-accent));
  pointer-events: none;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 2px;
}

.item-index {
  background: rgb(var(--rgb-accent));
  color: rgb(var(--rgb-background));
  font-size: 0.75rem;
  font-weight: 600;
  width: 1.25rem;
  height: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid rgb(var(--rgb-background));
}

@media (hover: hover) {
  .item:hover:not(:disabled) {
    border-color: rgb(var(--rgb-accent));
    z-index: 1;
  }
}

.item-price {
  font-size: 0.75rem;
  color: rgb(var(--rgb-text) / 0.8);
  text-align: center;
  white-space: nowrap;
}

.item-tooltip {
  width: min(320px, calc(100vw - 2rem));
  max-width: min(320px, calc(100vw - 2rem));
  min-width: 280px;
  padding: 1em;
  display: flex;
  flex-direction: column;
  overflow: visible;
}

.item-tooltip-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.item-tooltip-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.item-tooltip-image {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  border: 1px solid rgb(var(--rgb-accent));
  object-fit: cover;
  flex-shrink: 0;
}

.item-tooltip-text {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.item-tooltip-name {
  font-size: 1rem;
  font-weight: 600;
  color: rgb(var(--rgb-accent));
  line-height: 1.2;
  margin-bottom: 0.25rem;
}

.item-tooltip-price {
  font-size: 0.875rem;
  color: rgb(var(--rgb-text) / 0.8);
  line-height: 1.3;
}

.item-tooltip-plaintext {
  font-size: 0.875rem;
  color: rgb(var(--rgb-text) / 0.9);
  line-height: 1.4;
  font-style: italic;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.item-tooltip-description {
  font-size: 0.8rem;
  color: rgb(var(--rgb-text) / 0.7);
  line-height: 1.4;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

@media (max-width: 768px) {
  .item-tooltip {
    width: calc(100vw - 2rem);
    max-width: calc(100vw - 2rem);
    min-width: 250px;
    padding: 0.8em;
  }
}

@media (max-width: 700px) {
  .items-list {
    --itemSizeButton: 54px;
  }
}
</style>
