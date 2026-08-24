<template>
  <div class="item-shop-browser" :class="{ 'item-shop-browser--layout-scaled': isLayoutScaled }">
    <div class="item-shop-browser__toolbar">
      <div class="item-shop-browser__role-row">
        <button
          v-for="role in ITEM_SHOP_ROLE_ORDER"
          :key="role"
          type="button"
          class="item-shop-browser__role-btn"
          :class="{ 'is-active': selectedRole === role }"
          @click="selectedRole = role"
        >
          {{ role === 'all' ? t('item.all') : t(`champion.${role}`) }}
        </button>
      </div>

      <div class="item-shop-browser__tag-row">
        <label for="item-shop-search" class="sr-only">{{ t('common.search') }}</label>
        <input
          id="item-shop-search"
          v-model="searchQuery"
          type="search"
          :placeholder="t('common.search')"
          class="item-shop-browser__search ui-build-card-surface rounded-lg px-3 py-2 text-sm text-text placeholder:text-text/50 focus:outline-none"
        />
        <ItemCategorySortButton
          :active="categorySortMode === 'legendary-first'"
          :title="categorySortToggleTitle"
          @click="toggleCategorySortMode"
        />
        <ItemFilterTagButton
          v-for="tag in availableTags"
          :key="tag"
          :label="translateItemTag(tag, t)"
          :icon-src="getItemTagIconSrc(tag)"
          :icon-tone-class="getItemTagIconToneClass(tag)"
          :icon-image-class="getItemTagIconImageClass(tag)"
          :active="selectedTags.includes(tag)"
          @click="toggleTag(tag)"
        />
        <ItemFilterTagButton
          :label="t('item.selector.showGoldValue')"
          :icon-src="goldStatIconSrc"
          icon-tone-class="stat-inline-icon--gold"
          :active="showGoldValue"
          @click="showGoldValue = !showGoldValue"
        />
        <ItemFilterTagButton
          :label="t('item.selector.showGoldEfficiency')"
          :icon-src="goldStatIconSrc"
          icon-tone-class="stat-inline-icon--gold"
          :active="showGoldEfficiency"
          @click="showGoldEfficiency = !showGoldEfficiency"
        />
      </div>
    </div>

    <div v-if="itemsStore.status === 'loading'" class="py-12 text-center text-text">
      {{ t('item.selector.loading') }}
    </div>

    <div v-else-if="itemsStore.status === 'error'" class="py-12 text-center text-error">
      {{ itemsStore.error }}
    </div>

    <div
      v-else
      class="item-shop-browser__layout"
      :class="{ 'item-shop-browser__layout--scaled': isLayoutScaled }"
    >
      <ItemShopDetailPanel
        :item="selectedItem"
        :all-items="catalogItems"
        :category-sort-mode="categorySortMode"
        :riot-locale="riotLocale"
        @select-item="selectItem"
        @reset="clearSelectedItem"
      />

      <div class="item-shop-browser__grid">
        <template v-for="category in categoryOrderKeys" :key="category">
          <section v-if="visibleItemsByCategory[category]?.length" class="category-section">
            <button
              v-if="!isLayoutScaled"
              type="button"
              class="category-header"
              :aria-expanded="isCategoryVisible(category)"
              @click="toggleCategory(category)"
            >
              <span>{{ getCategoryLabel(category) }}</span>
              <span
                class="category-toggle-icon"
                :class="{ collapsed: !isCategoryVisible(category) }"
              >
                ▼
              </span>
            </button>
            <div
              class="category-items"
              :class="{ collapsed: !isCategoryVisible(category) && !isLayoutScaled }"
            >
              <div
                v-for="item in visibleItemsByCategory[category]"
                :key="item.id"
                class="item-wrapper"
                @mouseenter="handleItemHover(item, $event)"
                @mouseleave="clearItemHover"
                @mousemove="handleMouseMove"
              >
                <button
                  type="button"
                  class="item"
                  :class="{ 'item--selected': selectedItemId === item.id }"
                  @click="selectItem(item)"
                >
                  <img
                    :src="getItemShopImageUrl(version, item)"
                    :alt="item.name"
                    loading="lazy"
                    width="40"
                    height="40"
                    decoding="async"
                  />
                </button>
                <div class="item-meta">
                  <div class="item-price">{{ item.gold?.total || 0 }}</div>
                  <div v-if="showGoldValue" class="item-gold-value">
                    {{ getItemGoldValue(item) }}
                  </div>
                  <div v-if="showGoldEfficiency" class="item-gold-efficiency">
                    {{ formatItemGoldEfficiency(item) }}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </template>

        <p v-if="filteredItems.length === 0" class="py-8 text-center text-text/70">
          {{ t('item.selector.noResults') }}
        </p>
      </div>
    </div>

    <ItemHoverTooltip
      v-model:tooltip-ref="tooltipRef"
      :item="hoveredItem"
      :tooltips-enabled="tooltipsEnabled"
      :tooltip-style="tooltipStyle"
      :riot-locale="riotLocale"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { Item } from '~/types/build'
import { useItemsStore } from '~/stores/ItemsStore'
import { getItemShopImageUrl } from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'
import { useLayoutScaled } from '~/composables/useLayoutScaled'
import { formatItemGoldEfficiency, getItemGoldValue } from '~/utils/formatItemStats'
import ItemShopDetailPanel from '~/components/Items/ItemShopDetailPanel.vue'
import ItemFilterTagButton from '~/components/Items/ItemFilterTagButton.vue'
import ItemCategorySortButton from '~/components/Items/ItemCategorySortButton.vue'
import ItemHoverTooltip from '~/components/Items/ItemHoverTooltip.vue'
import { useItemHoverTooltip } from '~/composables/useItemHoverTooltip'
import { ITEM_HOVER_TOOLTIP_KEY } from '~/composables/itemHoverTooltipKey'
import { getChampionStatIconSrc } from '~/utils/championStatIcons'
import {
  getItemTagIconImageClass,
  getItemTagIconSrc,
  getItemTagIconToneClass,
} from '~/utils/itemTagStatIcons'
import { enrichItemShopCatalog } from '~/utils/itemShopEvolutions'
import {
  ITEM_SHOP_ALLOWED_TAGS,
  ITEM_SHOP_ROLE_ORDER,
  filterShopItems,
  getCategoryDisplayOrder,
  groupItemsByCategory,
  itemHasTag,
  translateItemTag,
  type ItemShopCategory,
  type ItemShopCategorySortMode,
  type ItemShopRoleId,
} from '~/utils/itemShopUtils'

const itemsStore = useItemsStore()
const { locale, t } = useI18n()
const { version } = useGameVersion()
const { isLayoutScaled } = useLayoutScaled()
const route = useRoute()
const router = useRouter()

const searchQuery = ref('')
const selectedTags = ref<string[]>([])
const selectedRole = ref<ItemShopRoleId>('all')
const showGoldValue = ref(false)
const showGoldEfficiency = ref(false)
const selectedItemId = ref<string | null>(null)
const categorySortMode = ref<ItemShopCategorySortMode>('legendary-first')

const riotLocale = computed(() => (locale.value === 'en' ? 'en_US' : 'fr_FR'))

const {
  tooltipsEnabled,
  hoveredItem,
  tooltipRef,
  tooltipStyle,
  handleItemHover,
  handleMouseMove,
  clearItemHover,
} = useItemHoverTooltip()

provide(ITEM_HOVER_TOOLTIP_KEY, {
  tooltipsEnabled,
  hoveredItem,
  tooltipRef,
  tooltipStyle,
  handleItemHover,
  handleMouseMove,
  clearItemHover,
})

const catalogItems = computed(() => enrichItemShopCatalog(itemsStore.items, riotLocale.value))

const filteredItems = computed(() =>
  filterShopItems({
    items: catalogItems.value,
    searchQuery: searchQuery.value,
    selectedTags: selectedTags.value,
    role: selectedRole.value,
    excludeMasterwork: false,
  })
)

const visibleItemsByCategory = computed(() => groupItemsByCategory(filteredItems.value))

const categoryOrderKeys = computed(() => getCategoryDisplayOrder(categorySortMode.value))

const goldStatIconSrc = getChampionStatIconSrc('goldValue')

const categorySortToggleTitle = computed(() =>
  categorySortMode.value === 'legendary-first'
    ? t('itemShopPage.sortClassicHint')
    : t('itemShopPage.sortLegendaryFirstHint')
)

const availableTags = computed(() =>
  ITEM_SHOP_ALLOWED_TAGS.filter(tag => catalogItems.value.some(item => itemHasTag(item, tag)))
)

const selectedItem = computed(
  () => catalogItems.value.find(item => item.id === selectedItemId.value) ?? null
)

const categoryVisibility = ref<Record<ItemShopCategory, boolean>>({
  starter: true,
  boots: true,
  basic: true,
  epic: true,
  legendary: true,
  other: true,
})

function isCategoryVisible(category: ItemShopCategory): boolean {
  return categoryVisibility.value[category] ?? true
}

function toggleCategory(category: ItemShopCategory) {
  categoryVisibility.value[category] = !categoryVisibility.value[category]
}

function toggleCategorySortMode() {
  categorySortMode.value =
    categorySortMode.value === 'legendary-first' ? 'classic' : 'legendary-first'
}

function getCategoryLabel(category: ItemShopCategory): string {
  const labels: Record<ItemShopCategory, string> = {
    starter: t('item.starter'),
    boots: t('item.boots'),
    basic: t('item.basic'),
    epic: t('item.epic'),
    legendary: t('item.legendary'),
    other: t('item.other'),
  }
  return labels[category]
}

function toggleTag(tag: string) {
  if (selectedTags.value.includes(tag)) {
    selectedTags.value = selectedTags.value.filter(value => value !== tag)
  } else {
    selectedTags.value = [...selectedTags.value, tag]
  }
}

function selectItem(item: Item) {
  selectedItemId.value = item.id
  router.replace({ query: { ...route.query, item: item.id } }).catch(() => undefined)
}

function clearSelectedItem() {
  selectedItemId.value = null
  clearItemHover()
  const { item: _item, ...restQuery } = route.query
  router.replace({ query: restQuery }).catch(() => undefined)
}

function syncSelectedFromQuery() {
  const queryItem = route.query.item
  if (typeof queryItem !== 'string' || !queryItem.trim()) return
  const match = catalogItems.value.find(item => item.id === queryItem.trim())
  if (match) selectedItemId.value = match.id
}

watch(
  () => [catalogItems.value.length, route.query.item] as const,
  () => syncSelectedFromQuery(),
  { immediate: true }
)

onMounted(() => {
  itemsStore.loadItems(riotLocale.value).catch(() => undefined)
})

watch(locale, () => {
  itemsStore.loadItems(riotLocale.value).catch(() => undefined)
})

watch(isLayoutScaled, enabled => {
  if (enabled) {
    clearItemHover()
  }
})
</script>

<style scoped>
.item-shop-browser {
  width: 100%;
  --build-card-width: 300px;
}

.item-shop-browser--layout-scaled {
  --build-card-width: 390px;
}

.item-shop-browser__toolbar {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  margin-bottom: 0.75rem;
}

.item-shop-browser__role-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.item-shop-browser__role-btn {
  border: 1px solid rgb(var(--rgb-accent) / 0.25);
  border-radius: 9999px;
  background: rgb(var(--rgb-background) / 0.35);
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgb(var(--rgb-text) / 0.8);
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.item-shop-browser__role-btn.is-active,
.item-shop-browser__role-btn:hover {
  border-color: rgb(var(--rgb-accent) / 0.65);
  background: rgb(var(--rgb-accent) / 0.15);
  color: var(--color-accent);
}

.item-shop-browser__tag-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.item-shop-browser__search {
  flex: 0 0 auto;
  width: 10.5rem;
  min-width: 8rem;
  max-width: 10.5rem;
}

.item-shop-browser__layout {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.item-shop-browser__layout > :first-child {
  order: 1;
  width: var(--build-card-width, 300px);
  max-width: 100%;
}

.item-shop-browser__grid {
  order: 2;
  width: 100%;
  min-width: 0;
  flex: 1 1 auto;
}

@media (min-width: 769px) {
  .item-shop-browser__layout {
    flex-direction: row;
  }

  .item-shop-browser__grid {
    flex: 1 1 0;
  }
}

.category-section {
  margin-bottom: 1rem;
}

.category-header {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  border: none;
  background: transparent;
  padding: 0.25rem 0;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgb(var(--rgb-text) / 0.85);
  cursor: pointer;
}

.category-toggle-icon {
  font-size: 0.6rem;
  transition: transform 0.3s ease;
}

.category-toggle-icon.collapsed {
  transform: rotate(-90deg);
}

.category-items {
  --itemSizeButton: 40px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(calc(var(--itemSizeButton) + 0.5rem), 1fr));
  gap: 0.5rem;
  max-height: 2000px;
  overflow: hidden;
  opacity: 1;
  transition:
    max-height 0.3s ease,
    opacity 0.3s ease;
}

.item-shop-browser--layout-scaled .category-items {
  grid-template-columns: repeat(auto-fit, var(--itemSizeButton));
  justify-content: flex-start;
  width: 100%;
}

.category-items.collapsed {
  max-height: 0;
  opacity: 0;
}

.item-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.item {
  width: var(--itemSizeButton);
  height: var(--itemSizeButton);
  border: 1px solid rgb(var(--rgb-accent) / 0.2);
  border-radius: 0.25rem;
  background: rgb(var(--rgb-background) / 0.55);
  padding: 0.15rem;
  cursor: pointer;
  transition: border-color 0.15s ease;
  overflow: hidden;
}

.item--selected {
  border-color: rgb(var(--rgb-accent));
  box-shadow: 0 0 0 1px rgb(var(--rgb-accent) / 0.35);
}

.item img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.item-meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
}

.item-price {
  font-size: 0.72rem;
  color: rgb(var(--rgb-text) / 0.8);
}

.item-gold-value,
.item-gold-efficiency {
  font-size: 0.62rem;
  font-weight: 600;
  color: rgb(var(--rgb-primary-light));
}

@media (max-width: 768px) {
  .item-shop-browser--layout-scaled {
    --build-card-width: calc(100vw - 1.5rem);
  }

  .item-shop-browser__layout > :first-child {
    width: 100%;
    max-width: 100%;
  }
}

@media (max-width: 700px) {
  .category-items {
    --itemSizeButton: 36px;
  }
}
</style>
