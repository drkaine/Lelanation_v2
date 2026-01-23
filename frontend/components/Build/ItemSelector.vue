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
        @mouseenter="hoveredItem = item"
        @mouseleave="hoveredItem = null"
      >
        <button
          :class="['item', !isFiltered(item) ? 'hide' : '']"
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
            <span class="item-index">{{ getItemIndex(item) + 1 }}</span>
          </div>
        </button>
        <div class="item-price">{{ item.gold?.total || 0 }} <span class="gold-icon">🪙</span></div>
      </div>

      <!-- Tooltip -->
      <div
        v-if="hoveredItem"
        ref="tooltipRef"
        class="item-tooltip absolute z-50 rounded-lg border border-accent bg-background shadow-lg"
        :class="tooltipPositionClass"
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
                {{ hoveredItem.gold?.total || 0 }} <span class="gold-icon">🪙</span>
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
  const translation = t(`item.${tagKey}`, null)
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

  if (selectedTags.value.length > 0) {
    filtered = filtered.filter((item: Item) =>
      selectedTags.value.some(tag => item.tags.includes(tag))
    )
  }

  if (debouncedSearch.value) {
    const lowerQuery = debouncedSearch.value.toLowerCase()
    filtered = filtered.filter(
      (item: Item) =>
        item.name.toLowerCase().includes(lowerQuery) ||
        item.colloq?.toLowerCase().includes(lowerQuery) ||
        item.plaintext?.toLowerCase().includes(lowerQuery)
    )
  }

  return filtered
})

// All items for display (filtered ones in color, others in grayscale)
const allItems = computed(() => {
  return itemsStore.items
})

// Check if item matches current filters
const isFiltered = (item: Item): boolean => {
  // If no filters, all items are "filtered" (visible in color)
  if (selectedTags.value.length === 0 && !debouncedSearch.value) {
    return true
  }

  // Check if item is in filtered results
  return filteredItems.value.some(i => i.id === item.id)
}

const selectedItemsCount = computed(() => {
  return buildStore.currentBuild?.items.length || 0
})

const isSelected = (item: Item): boolean => {
  return buildStore.currentBuild?.items.some(i => i.id === item.id) || false
}

const getItemIndex = (item: Item): number => {
  return buildStore.currentBuild?.items.findIndex(i => i.id === item.id) ?? -1
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
const tooltipPosition = ref<'right' | 'left'>('right')
const tooltipVerticalPosition = ref<'top' | 'bottom'>('top')

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
  if (!tooltipRef.value || !hoveredItem.value) return

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
watch(hoveredItem, async newValue => {
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

.item.hide img {
  filter: grayscale(1) brightness(0.4);
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

.gold-icon {
  font-size: 0.7rem;
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
