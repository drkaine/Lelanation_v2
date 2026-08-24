<template>
  <aside class="item-shop-detail-wrapper">
    <div class="item-shop-detail-toolbar">
      <div class="item-shop-detail-toolbar__actions">
        <button
          type="button"
          class="item-shop-detail-toolbar__btn"
          :class="{ 'item-shop-detail-toolbar__btn--active': isFlipped }"
          :disabled="!item"
          :title="isFlipped ? t('itemShopPage.showRecipe') : t('itemShopPage.showDescription')"
          :aria-label="isFlipped ? t('itemShopPage.showRecipe') : t('itemShopPage.showDescription')"
          @click="isFlipped = !isFlipped"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
        </button>
      </div>

      <button
        type="button"
        class="item-shop-detail-toolbar__btn item-shop-detail-toolbar__btn--reset"
        :disabled="!item"
        :title="t('itemShopPage.resetSelection')"
        :aria-label="t('itemShopPage.resetSelection')"
        @click="emit('reset')"
      >
        <Icon name="mdi:refresh" size="16px" aria-hidden="true" />
      </button>
    </div>

    <div class="item-shop-detail ui-build-card-surface">
      <header class="item-shop-detail__header">
        <div
          class="item-shop-detail__image-slot"
          :class="{ 'item-shop-detail__image-slot--empty': !item }"
        >
          <img
            v-if="item"
            class="item-shop-detail__image"
            :src="getItemShopImageUrl(version, item)"
            :alt="item.name"
            width="56"
            height="56"
          />
        </div>
        <div class="item-shop-detail__header-text">
          <h2 v-if="item" class="item-shop-detail__name">{{ item.name }}</h2>
          <p v-if="item" class="item-shop-detail__price">
            {{ item.gold?.total ?? 0 }}g ({{ formatItemGoldEfficiency(item) }})
          </p>
        </div>
      </header>

      <hr class="item-shop-detail__separator" />

      <div class="item-shop-detail__body">
        <template v-if="!item">
          <p class="item-shop-detail__empty-hint">{{ t('itemShopPage.selectItemHint') }}</p>
        </template>

        <template v-else>
          <section v-if="!isFlipped && recipeTree" class="item-shop-detail__section">
            <h3 v-if="recipeTree.children.length" class="item-shop-detail__section-title">
              {{ t('item.recipe') }}
            </h3>
            <ItemRecipeTree :root="recipeTree" @select-item="emit('select-item', $event)" />
          </section>

          <section v-else-if="isFlipped" class="item-shop-detail__descriptions">
            <p v-if="plaintext" class="item-shop-detail__plaintext">{{ plaintext }}</p>
            <hr
              v-if="plaintext && formattedDescription"
              class="item-shop-detail__separator item-shop-detail__separator--descriptions"
            />
            <!-- eslint-disable vue/no-v-html -->
            <div
              v-if="formattedDescription"
              class="item-shop-detail__description tooltip-game-description"
              v-html="formattedDescription"
            />
            <!-- eslint-enable vue/no-v-html -->
            <p
              v-if="!plaintext && !formattedDescription"
              class="item-shop-detail__description-empty"
            >
              {{ t('itemShopPage.noDescription') }}
            </p>
          </section>
        </template>
      </div>
    </div>

    <section v-if="item && buildIntoItems.length" class="item-shop-detail__transforms">
      <h3 class="item-shop-detail__section-title">{{ t('item.transforms-into') }}</h3>
      <div class="item-shop-detail__recipe">
        <button
          v-for="upgrade in buildIntoItems"
          :key="upgrade.id"
          type="button"
          class="item-shop-detail__recipe-item"
          @click="emit('select-item', upgrade)"
          @mouseenter="itemHoverTooltip?.handleItemHover(upgrade, $event)"
          @mouseleave="itemHoverTooltip?.clearItemHover()"
          @mousemove="itemHoverTooltip?.handleMouseMove($event)"
        >
          <span class="item-shop-detail__recipe-icon">
            <img
              :src="getItemShopImageUrl(version, upgrade)"
              :alt="upgrade.name"
              width="40"
              height="40"
            />
          </span>
          <span class="item-shop-detail__recipe-price">{{ upgrade.gold?.total ?? 0 }}</span>
        </button>
      </div>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Item } from '~/types/build'
import { getItemShopImageUrl } from '~/utils/imageUrl'
import { formatItemGoldEfficiency } from '~/utils/formatItemStats'
import { useGameVersion } from '~/composables/useGameVersion'
import { formatItemTooltipHtml } from '~/utils/formatTooltipMarkupHtml'
import { resolveItemDescription, resolveItemPlaintext } from '~/utils/itemDescriptionFallbacks'
import {
  resolveItemShopBuildInto,
  sortShopItemsByCategoryMode,
  type ItemShopCategorySortMode,
} from '~/utils/itemShopUtils'
import { buildItemRecipeTreeFromCatalog } from '~/utils/itemRecipeTree'
import ItemRecipeTree from '~/components/Items/ItemRecipeTree.vue'
import { ITEM_HOVER_TOOLTIP_KEY } from '~/composables/itemHoverTooltipKey'

const props = defineProps<{
  item: Item | null
  allItems: Item[]
  categorySortMode: ItemShopCategorySortMode
  riotLocale: string
}>()

const emit = defineEmits<{
  'select-item': [item: Item]
  reset: []
}>()

const { t } = useI18n()
const { version } = useGameVersion()
const itemHoverTooltip = inject(ITEM_HOVER_TOOLTIP_KEY, null)
const isFlipped = ref(false)

watch(
  () => props.item?.id,
  () => {
    isFlipped.value = false
  }
)

const buildIntoItems = computed(() =>
  sortShopItemsByCategoryMode(
    resolveItemShopBuildInto(props.item, props.allItems),
    props.categorySortMode
  )
)

const recipeTree = computed(() => {
  if (!props.item) return null
  return buildItemRecipeTreeFromCatalog(props.item, props.allItems)
})

const plaintext = computed(() => resolveItemPlaintext(props.item, props.riotLocale))

const formattedDescription = computed(() => {
  if (!props.item) return ''
  const raw = resolveItemDescription(props.item, props.riotLocale)
  return raw ? formatItemTooltipHtml(raw) : ''
})
</script>

<style scoped>
.item-shop-detail-wrapper {
  position: sticky;
  top: 1rem;
  width: 100%;
  flex-shrink: 0;
}

.item-shop-detail-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  margin-bottom: 0.5rem;
}

.item-shop-detail-toolbar__actions {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.item-shop-detail-toolbar__btn {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 0.5rem;
  border: 1px solid rgb(200 155 60 / 0.5);
  background: var(--color-background, #0a1428);
  color: rgb(255 255 255 / 0.85);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease,
    transform 0.15s ease;
}

.item-shop-detail-toolbar__btn:hover:not(:disabled),
.item-shop-detail-toolbar__btn--active {
  border-color: var(--color-accent, #c89b3c);
  background: rgb(200 155 60 / 0.15);
  color: var(--color-accent, #c89b3c);
}

.item-shop-detail-toolbar__btn--reset {
  margin-left: auto;
}

.item-shop-detail-toolbar__btn--reset:hover:not(:disabled) {
  transform: rotate(180deg);
}

.item-shop-detail-toolbar__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.item-shop-detail {
  display: flex;
  width: 100%;
  height: 450px;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 6px;
}

.item-shop-detail__header {
  display: flex;
  flex-shrink: 0;
  align-items: flex-start;
  gap: 0.65rem;
  min-height: 56px;
}

.item-shop-detail__image-slot {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border: 1px solid rgb(var(--rgb-accent) / 0.35);
  border-radius: 0.25rem;
  background: rgb(var(--rgb-background) / 0.55);
}

.item-shop-detail__image-slot--empty {
  border-style: dashed;
  border-color: rgb(var(--rgb-accent) / 0.25);
  background: rgb(var(--rgb-background) / 0.25);
}

.item-shop-detail__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.item-shop-detail__header-text {
  min-width: 0;
}

.item-shop-detail__name {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-accent);
  line-height: 1.2;
}

.item-shop-detail__price {
  margin-top: 0.2rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: rgb(var(--rgb-primary-light));
}

.item-shop-detail__separator {
  flex-shrink: 0;
  margin: 0;
  border: none;
  border-top: 1px solid rgb(var(--rgb-accent) / 0.25);
}

.item-shop-detail__separator--descriptions {
  width: 100%;
  margin: 0.15rem 0;
}

.item-shop-detail__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-right: 0.15rem;
}

.item-shop-detail__empty-hint {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.45;
  color: rgb(var(--rgb-text) / 0.6);
}

.item-shop-detail__section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.item-shop-detail__section-title {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgb(var(--rgb-text) / 0.7);
}

.item-shop-detail__section :deep(.item-recipe-tree) {
  padding: 0.5rem 0.25rem;
  border: 1px solid rgb(var(--rgb-accent) / 0.2);
  border-radius: 0.5rem;
  background: rgb(var(--rgb-background) / 0.35);
}

.item-shop-detail__descriptions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.item-shop-detail__plaintext {
  font-size: 0.85rem;
  font-style: italic;
  line-height: 1.45;
  color: rgb(var(--rgb-text) / 0.75);
}

.item-shop-detail__description {
  font-size: 0.85rem;
  line-height: 1.45;
  color: rgb(var(--rgb-text) / 0.85);
}

.item-shop-detail__description-empty {
  font-size: 0.85rem;
  color: rgb(var(--rgb-text) / 0.6);
}

.item-shop-detail__transforms {
  margin-top: 0.75rem;
  width: 100%;
}

.item-shop-detail__recipe {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.item-shop-detail__recipe-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  border: 1px solid transparent;
  background: transparent;
  padding: 0.15rem;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    transform 0.15s ease;
}

.item-shop-detail__recipe-item:hover {
  border-color: rgb(var(--rgb-accent) / 0.55);
  transform: translateY(-1px);
}

.item-shop-detail__recipe-icon {
  display: flex;
  width: 2.5rem;
  height: 2.5rem;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(var(--rgb-accent) / 0.25);
  border-radius: 0.25rem;
  background: rgb(var(--rgb-background) / 0.55);
  padding: 0.15rem;
}

.item-shop-detail__recipe-icon img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.item-shop-detail__recipe-price {
  font-size: 0.7rem;
  font-weight: 600;
  color: rgb(var(--rgb-text) / 0.75);
}

@media (max-width: 768px) {
  .item-shop-detail-wrapper {
    position: static;
    margin: 0 auto;
  }
}
</style>
