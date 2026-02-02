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
      <template v-for="category in categoryOrderKeys" :key="category">
        <div v-if="itemsByCategory[category]?.length > 0" class="category-section">
          <button class="category-header" @click="toggleCategory(category)">
            <span>{{ getCategoryLabel(category) }}</span>
            <span class="category-toggle-icon" :class="{ collapsed: !isCategoryVisible(category) }">
              ▼
            </span>
          </button>
          <div class="category-items" :class="{ collapsed: !isCategoryVisible(category) }">
            <div
              v-for="item in itemsByCategory[category]"
              :key="item.id"
              class="item-wrapper"
              :class="{ hide: !isItemFiltered(item) }"
              @mouseenter="handleItemHover(item, $event)"
              @mouseleave="hoveredItem = null"
              @mousemove="handleMouseMove($event)"
            >
              <button
                class="item"
                :disabled="
                  (!isSelected(item) && availableSlots >= 9 && !isBootsItem(item)) ||
                  (!isSelected(item) && !canAddItem(item))
                "
                :title="
                  !isSelected(item) && !canAddItem(item) ? getItemValidationError(item) || '' : ''
                "
                @click="toggleItem(item)"
              >
                <img
                  :src="getItemImageUrl(version, item.image.full)"
                  :alt="item.name"
                  loading="lazy"
                  width="32"
                  height="32"
                  decoding="async"
                />
                <div v-if="isSelected(item)" class="item-selected">
                  <span class="item-index">{{ getItemIndex(item) }}</span>
                </div>
              </button>
              <div class="item-price">{{ item.gold?.total || 0 }}</div>
            </div>
          </div>
        </div>
      </template>

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
          <!-- Validation error message -->
          <div
            v-if="!isSelected(hoveredItem) && !canAddItem(hoveredItem)"
            class="item-tooltip-error mt-2 rounded border border-error/50 bg-error/20 p-2 text-sm text-error"
          >
            ⚠️ {{ getItemValidationError(hoveredItem) }}
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

const itemsStore = useItemsStore()
const buildStore = useBuildStore()
const { locale, t } = useI18n()

const getRiotLanguage = (loc: string): string => (loc === 'en' ? 'en_US' : 'fr_FR')
const riotLocale = computed(() => getRiotLanguage(locale.value))

// Translate tag name - map actual item tags to translation keys
const translateTag = (tag: string): string => {
  const tagMap: Record<string, string> = {
    Damage: 'damage', // Attack Damage
    CriticalStrike: 'critical-strike',
    AttackSpeed: 'attack-speed',
    OnHit: 'on-hit',
    ArmorPenetration: 'armor-penetration', // Armor Pen
    AbilityPower: 'ability-power',
    Mana: 'mana',
    MagicPenetration: 'magic-penetration', // Magic Pen
    Health: 'health',
    Armor: 'armor',
    MagicResist: 'magic-resist',
    AbilityHaste: 'ability-haste',
    NonbootsMovement: 'movement', // Movement
    LifeSteal: 'life-steal',
    Omnivamp: 'omnivamp',
  }

  const tagKey = tagMap[tag]
  if (!tagKey) {
    // Fallback: convert camelCase to kebab-case
    return tag
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '')
  }

  const translation = t(`item.${tagKey}`)
  // If translation doesn't exist, return a formatted version of the tag
  if (translation === `item.${tagKey}`) {
    // Format tag name for display
    return tag
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/^./, str => str.toUpperCase())
  }
  return translation
}

const searchQuery = ref('')
const selectedTags = ref<string[]>([])

// Allowed tags to display
const allowedTags = [
  'Damage', // Attack Damage
  'CriticalStrike',
  'AttackSpeed',
  'OnHit',
  'ArmorPenetration', // Armor Pen
  'AbilityPower',
  'Mana',
  'MagicPenetration', // Magic Pen
  'Health',
  'Armor',
  'MagicResist',
  'AbilityHaste',
  'NonbootsMovement', // Movement
  'LifeSteal',
  'Omnivamp',
]

const availableTags = computed(() => {
  return allowedTags.filter(tag => {
    // Check if at least one item has this tag
    return itemsStore.items.some(item => item.tags && item.tags.includes(tag))
  })
})

const filteredItems = computed<Item[]>(() => {
  if (!itemsStore.items || itemsStore.items.length === 0) {
    return []
  }

  let filtered = [...itemsStore.items]

  // Filter by tags (if any selected)
  if (selectedTags.value.length > 0) {
    filtered = filtered.filter((item: Item) => {
      if (!item.tags || item.tags.length === 0) return false
      // L'item doit contenir TOUS les tags sélectionnés (ET logique)
      return selectedTags.value.every(tag => item.tags!.includes(tag))
    })
  }

  // Filter by search query (if any)
  const searchTerm = searchQuery.value?.trim()
  if (searchTerm && searchTerm.length > 0) {
    const lowerQuery = searchTerm.toLowerCase()
    filtered = filtered.filter(
      (item: Item) =>
        item.name?.toLowerCase().includes(lowerQuery) ||
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
    '1036', // Épée longue (Long Sword)
    '1054', // Bouclier de Doran
    '1055', // Lame de Doran
    '1056', // Anneau de Doran
    '1082', // Seau noir (Relic Shield)
    '1083', // Abatteur (Cull)
    '3070', // Larme de la déesse
    // Support starting lines (base items uniquement)
    '3865', // Atlas
    '3866', // Base support item (sickle line)
    '3867', // Base support item (spellthief/other line)
    // Jungle pets (bébé chardent, bébé sautes-nuage, bébé ixamandre)
    '1101', // Scorchclaw Pup / Bébé chardent
    '1102', // Gustwalker Hatchling / Bébé sautes-nuage
    '1103', // Mosstomper Seedling / Bébé ixamandre
  ])

  const starterNamePatterns = [
    'seau', // couvre "sceau noir" (Dark Seal FR)
    'dark seal',
    'anneau de doran',
    'lame de doran',
    'bouclier de doran',
    'larme de la déesse',
    'cull',
    'abatteur',
    'atlas',
    'épée de voleur',
    'épée longue', // Long Sword
    'long sword',
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

  // Boots - base boots and ALL items that build from any boot
  // Preferred signal: Riot tag "Boots" (covers most upgrades)
  if (item.tags && item.tags.includes('Boots')) {
    return 'boots'
  }

  // Known boot IDs (basic boots + all tier-2 boots)
  const bootIds = new Set([
    '1001', // Bottes
    '3005', // Bottes du vigilant
    '3006', // Jambières du berzerker
    '3009', // Sandales de mercure
    '3010', // Bottes de lucidité
    '3020', // Chaussures du sorcier
    '3047', // Coques en acier renforcé
    '3111', // Sandales de mercure
    '3117', // Bottes de mobilité
    '3158', // Bottes de lucidité (CDR)
  ])

  if (bootIds.has(item.id)) {
    return 'boots'
  }

  // Check if item directly builds from any boot (covers items like "Jambières de métal")
  if (item.from && item.from.some(parentId => bootIds.has(parentId))) {
    return 'boots'
  }

  // Consumables (potions, control ward, etc.) - check tags first
  if (item.tags && item.tags.includes('Consumable')) {
    // Common consumable IDs
    const consumableIds = new Set([
      '2003', // Health Potion
      '2009', // Total Biscuit of Everlasting Will
      '2010', // Total Biscuit of Rejuvenation
      '2031', // Refillable Potion
      '2032', // Hunter's Potion
      '2033', // Corrupting Potion
      '2055', // Control Ward
      '2060', // Stealth Ward (if not excluded)
      '2061', // Shurelya's Battlesong (if not excluded)
      '2138', // Elixir of Iron
      '2139', // Elixir of Sorcery
      '2140', // Elixir of Wrath
    ])
    const consumablePatterns = ['potion', 'ward', 'elixir', 'biscuit']
    if (
      consumableIds.has(item.id) ||
      consumablePatterns.some(pattern => item.name.toLowerCase().includes(pattern))
    ) {
      return 'starter'
    }
  }

  // Basic items - no from array or empty from (but not consumables)
  if (!item.from || item.from.length === 0) {
    return 'basic'
  }

  // Manual overrides for items dont classification (design choice, non Data-Dragon)
  const forcedLegendaryIds = new Set([
    '2526', // Diadème des murmures (doit être légendaire)
  ])
  if (forcedLegendaryIds.has(item.id)) {
    return 'legendary'
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
// Sorted by category, then by price within each category
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

    // Then sort by price (ascending) within the same category
    const priceA = a.gold?.total || 0
    const priceB = b.gold?.total || 0
    return priceA - priceB // Ascending order (cheapest first)
  })
})

// Group items by category
const itemsByCategory = computed(() => {
  const grouped: Record<ItemCategory, Item[]> = {
    starter: [],
    boots: [],
    basic: [],
    epic: [],
    legendary: [],
    other: [],
  }

  // Use allItems which is already sorted and reactive
  const items = allItems.value
  for (const item of items) {
    const category = getItemCategory(item)
    grouped[category].push(item)
  }

  return grouped
})

// Category order keys for template iteration
const categoryOrderKeys = computed(() => {
  return Object.keys(categoryOrder).sort(
    (a, b) => categoryOrder[a as ItemCategory] - categoryOrder[b as ItemCategory]
  ) as ItemCategory[]
})

// Get category label for display
const getCategoryLabel = (category: ItemCategory): string => {
  const labels: Record<ItemCategory, string> = {
    starter: t('item.starter'),
    boots: t('item.boots'),
    basic: t('item.basic'),
    epic: t('item.epic'),
    legendary: t('item.legendary'),
    other: 'Other',
  }
  return labels[category] || category
}

// Category visibility state
const categoryVisibility = ref<Record<ItemCategory, boolean>>({
  starter: true,
  boots: true,
  basic: true,
  epic: true,
  legendary: true,
  other: true,
})

const isCategoryVisible = (category: ItemCategory): boolean => {
  return categoryVisibility.value[category] ?? true
}

const toggleCategory = (category: ItemCategory) => {
  categoryVisibility.value[category] = !categoryVisibility.value[category]
}

// Check if item matches current filters
const isItemFiltered = (item: Item): boolean => {
  // Check if there are any active filters
  const hasActiveFilters =
    selectedTags.value.length > 0 || (searchQuery.value && searchQuery.value.trim().length > 0)

  // If no filters, all items are visible (filtered = true)
  if (!hasActiveFilters) {
    return true
  }

  // Check if item matches tag filters
  let matchesTags = true
  if (selectedTags.value.length > 0) {
    if (!item.tags || item.tags.length === 0) {
      matchesTags = false
    } else {
      // L'item doit contenir TOUS les tags sélectionnés (ET logique)
      matchesTags = selectedTags.value.every(tag => item.tags!.includes(tag))
    }
  }

  // Check if item matches search query
  let matchesSearch = true
  const searchTerm = searchQuery.value?.trim()
  if (searchTerm && searchTerm.length > 0) {
    const lowerQuery = searchTerm.toLowerCase()
    matchesSearch =
      item.name?.toLowerCase().includes(lowerQuery) ||
      item.colloq?.toLowerCase().includes(lowerQuery) ||
      item.plaintext?.toLowerCase().includes(lowerQuery) ||
      false
  }

  // Item is filtered (visible) if it matches both tag and search filters
  return matchesTags && matchesSearch
}

const availableSlots = computed(() => {
  const items = buildStore.currentBuild?.items || []
  const starterItems = items.filter(i => isStarterItem(i))
  const bootsItems = items.filter(i => isBootsItem(i))
  const otherItems = items.filter(i => !isStarterItem(i) && !isBootsItem(i))
  // Count slots: starter (max 2) + boots (1 slot for up to 2 boots) + other items (max 6)
  // Total max = 2 + 1 + 6 = 9 slots, but can have up to 10 items (2 starter + 2 boots + 6 other)
  return starterItems.length + (bootsItems.length > 0 ? 1 : 0) + otherItems.length
})

// Helper functions to check item types
const isStarterItem = (item: Item): boolean => {
  return getItemCategory(item) === 'starter'
}

const isBootsItem = (item: Item): boolean => {
  return getItemCategory(item) === 'boots'
}

// Items that can be in core items even if classified as starter
// (when starter slots are full)
const canBeInCoreItems = (item: Item): boolean => {
  // IDs that can be in core items
  const flexibleStarterIds = new Set([
    '1036', // Épée longue (Long Sword)
    '1082', // Sceau noir (Dark Seal)
    '1083', // Cull
    '3070', // Larme de la déesse
  ])

  if (flexibleStarterIds.has(item.id)) {
    return true
  }

  // Pattern-based check for Dark Seal (Sceau noir) - fallback if ID doesn't match
  const itemNameLower = item.name.toLowerCase()
  if (itemNameLower.includes('dark seal') || itemNameLower.includes('sceau noir')) {
    return true
  }

  // Pattern-based check for Long Sword (Épée longue) - fallback if ID doesn't match
  if (itemNameLower.includes('épée longue') || itemNameLower.includes('long sword')) {
    return true
  }

  return false
}

const isSelected = (item: Item): boolean => {
  if (!buildStore.currentBuild?.items || !item?.id) return false
  // Compare by ID to ensure exact match (strict equality)
  return buildStore.currentBuild.items.some(i => i && i.id === item.id)
}

const getItemIndex = (item: Item): number => {
  if (!buildStore.currentBuild?.items) return 0
  const index = buildStore.currentBuild.items.findIndex(i => i.id === item.id)
  // Return index + 1 for display (1-based), or 0 if not found
  // This should only be called when isSelected(item) is true
  return index >= 0 ? index + 1 : 0
}

// Validation rules
const isJunglePet = (item: Item): boolean => {
  const junglePetIds = ['1101', '1102', '1103']
  return junglePetIds.includes(item.id)
}

const isAtlas = (item: Item): boolean => {
  return item.id === '3865'
}

const isAtlasUpgrade = (item: Item): boolean => {
  const atlasUpgradeIds = ['3869', '3870', '3871', '3876', '3877']
  return atlasUpgradeIds.includes(item.id)
}

const hasSmite = (): boolean => {
  const spells = buildStore.currentBuild?.summonerSpells || []
  if (!spells || spells.length === 0) return false

  return spells.some(spell => {
    if (!spell) return false

    // Dans Data Dragon API: id="11", key="SummonerSmite"
    // Dans builds sauvegardés: id="SummonerSmite", key="11"
    // On doit vérifier les deux champs dans les deux sens

    const spellId = String(spell.id || '')
      .trim()
      .toLowerCase()
    const spellKey = String(spell.key || '')
      .trim()
      .toLowerCase()

    // Vérifier si id ou key contient "11" (ID numérique de Smite)
    if (spellId === '11' || spellKey === '11') {
      return true
    }

    // Vérifier si id ou key contient "summonersmite" (clé de Smite)
    if (
      spellId === 'summonersmite' ||
      spellKey === 'summonersmite' ||
      spellId.includes('smite') ||
      spellKey.includes('smite')
    ) {
      return true
    }

    // Vérifier le nom (name) - "smite" ou "punition" (FR) / "châtiment" (FR)
    const name = (spell.name || '').toLowerCase().trim()
    if (name.includes('smite') || name.includes('punition') || name.includes('châtiment')) {
      return true
    }

    return false
  })
}

const hasSupportRole = (): boolean => {
  const roles = buildStore.currentBuild?.roles || []
  return roles.includes('support')
}

const hasMidRole = (): boolean => {
  const roles = buildStore.currentBuild?.roles || []
  return roles.includes('mid')
}

// Tier-2 boot IDs (boots that build from 1001). Tier-3 boots build FROM one of these.
const tier2BootIds = new Set([
  '3005',
  '3006',
  '3009',
  '3010',
  '3020',
  '3047',
  '3111',
  '3117',
  '3158',
])

const isTier3Boots = (item: Item): boolean => {
  if (!isBootsItem(item)) return false
  return !!(item.from && item.from.some(parentId => tier2BootIds.has(parentId)))
}

const hasAtlasInStarters = (): boolean => {
  const items = buildStore.currentBuild?.items || []
  const starterItems = items.filter(i => isStarterItem(i))
  return starterItems.some(i => isAtlas(i))
}

const hasAtlasUpgrade = (excludeItemId?: string): boolean => {
  const items = buildStore.currentBuild?.items || []
  return items.some(i => isAtlasUpgrade(i) && i.id !== excludeItemId)
}

const getItemValidationError = (item: Item): string | null => {
  // Rule 1: Bébés nécessitent Smite
  if (isJunglePet(item) && !hasSmite()) {
    return 'Les jungle pets nécessitent le sort Smite'
  }

  // Rule 2: Bottes tier 3 (améliorations type Jambières de métal, Chaussures du sorcier améliorées) nécessitent le rôle Mid
  if (isTier3Boots(item) && !hasMidRole()) {
    return "Les bottes tier 3 ne peuvent être sélectionnées qu'avec le rôle Mid"
  }

  // Rule 3: Atlas et améliorations nécessitent le rôle support
  if ((isAtlas(item) || isAtlasUpgrade(item)) && !hasSupportRole()) {
    return 'Atlas et ses améliorations nécessitent le rôle Support'
  }

  // Rule 4: On ne peut pas prendre plusieurs améliorations d'Atlas
  if (isAtlasUpgrade(item) && hasAtlasUpgrade(item.id)) {
    return "Vous ne pouvez avoir qu'une seule amélioration d'Atlas"
  }

  // Rule 5: On ne peut prendre une amélioration d'Atlas que si on a Atlas en starter
  if (isAtlasUpgrade(item) && !hasAtlasInStarters()) {
    return 'Vous devez avoir Atlas dans vos items de départ pour prendre une amélioration'
  }

  return null
}

const canAddItem = (item: Item): boolean => {
  return getItemValidationError(item) === null
}

const toggleItem = (item: Item) => {
  if (isSelected(item)) {
    // Remove item
    buildStore.removeItem(item.id)
  } else {
    // Check validation rules
    const validationError = getItemValidationError(item)
    if (validationError) {
      // Show error message (could use a toast/notification system)
      // eslint-disable-next-line no-console
      console.warn(validationError)
      // For now, we'll just prevent adding the item
      return
    }

    // Add item with special logic
    const currentItems = buildStore.currentBuild?.items || []
    const starterItems = currentItems.filter(i => isStarterItem(i))
    const bootsItems = currentItems.filter(i => isBootsItem(i))
    const otherItems = currentItems.filter(i => !isStarterItem(i) && !isBootsItem(i))

    // Check if we can add this item
    if (isStarterItem(item)) {
      // Max 2 starter items
      if (starterItems.length < 2) {
        // Insert at the beginning (positions 0-1)
        const newItems = [...starterItems, item, ...bootsItems, ...otherItems]
        buildStore.setItems(newItems)
      } else if (canBeInCoreItems(item)) {
        // If starter slots are full but item can be in core items, add it there
        const totalSlots = starterItems.length + (bootsItems.length > 0 ? 1 : 0) + otherItems.length
        if (totalSlots < 9) {
          // Insert after starter and boots
          const newItems = [...starterItems, ...bootsItems, ...otherItems, item]
          buildStore.setItems(newItems)
        }
      }
    } else if (isBootsItem(item)) {
      // Max 2 boots (they share 1 slot, so we can have 2 boots + 5 other items = 6 slots)
      if (bootsItems.length < 2) {
        // Insert after starter items
        const newItems = [...starterItems, ...bootsItems, item, ...otherItems]
        buildStore.setItems(newItems)
      }
    } else {
      // Other items: check total slots
      // Max slots = 2 starter + 1 boots slot + 6 other = 9 slots total
      // But can have up to 10 items: 2 starter + 2 boots + 6 other
      const totalSlots = starterItems.length + (bootsItems.length > 0 ? 1 : 0) + otherItems.length
      if (totalSlots < 9) {
        // Insert after starter and boots
        const newItems = [...starterItems, ...bootsItems, ...otherItems, item]
        buildStore.setItems(newItems)
      }
    }
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
  // Force reactivity update - search is reactive via computed property
  // This function is called on @input but v-model already handles reactivity
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

const loadItemsForLocale = async () => {
  await itemsStore.loadItems(riotLocale.value)
}

onMounted(() => {
  loadItemsForLocale()
})

watch(locale, () => {
  loadItemsForLocale()
})
</script>

<style scoped>
.item-selector {
  background: transparent !important;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  position: relative;
}

.category-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.category-header {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(var(--rgb-accent));
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  transition: color 0.2s ease;
}

.category-header:hover {
  color: rgb(var(--rgb-accent) / 0.8);
}

.category-toggle-icon {
  font-size: 0.6rem;
  transition: transform 0.3s ease;
  display: inline-block;
}

.category-toggle-icon.collapsed {
  transform: rotate(-90deg);
}

.category-items {
  --itemSizeButton: 32px;
  display: grid;
  grid-template-columns: repeat(auto-fit, var(--itemSizeButton));
  justify-content: flex-start;
  width: 100%;
  gap: 0.5rem;
  max-height: 1000px;
  overflow: hidden;
  transition:
    max-height 0.3s ease,
    opacity 0.3s ease;
  opacity: 1;
}

.category-items.collapsed {
  max-height: 0;
  opacity: 0;
  margin: 0;
  padding: 0;
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
  opacity: 0.5;
  filter: grayscale(0.5);
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

.item-tooltip-error {
  font-size: 0.875rem;
  line-height: 1.4;
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
  .category-items {
    --itemSizeButton: 28px;
  }
}
</style>
