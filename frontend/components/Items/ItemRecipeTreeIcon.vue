<template>
  <button
    type="button"
    class="item-recipe-tree-icon"
    :class="`item-recipe-tree-icon--${size}`"
    @click="emit('select', item)"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @mousemove="onMouseMove"
  >
    <img
      :src="getItemShopImageUrl(version, item)"
      :alt="item.name"
      :width="iconSize"
      :height="iconSize"
      loading="lazy"
      decoding="async"
    />
  </button>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import type { Item } from '~/types/build'
import { getItemShopImageUrl } from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'
import { ITEM_HOVER_TOOLTIP_KEY } from '~/composables/itemHoverTooltipKey'
import { ITEM_RECIPE_TREE_ICON_SIZE, type ItemRecipeTreeSize } from '~/utils/itemRecipeTree'

const props = defineProps<{
  item: Item
  size: ItemRecipeTreeSize
}>()

const emit = defineEmits<{
  select: [item: Item]
}>()

const itemHoverTooltip = inject(ITEM_HOVER_TOOLTIP_KEY, null)

const { version } = useGameVersion()
const iconSize = computed(() => ITEM_RECIPE_TREE_ICON_SIZE[props.size])

function onMouseEnter(event: MouseEvent) {
  itemHoverTooltip?.handleItemHover(props.item, event)
}

function onMouseLeave() {
  itemHoverTooltip?.clearItemHover()
}

function onMouseMove(event: MouseEvent) {
  itemHoverTooltip?.handleMouseMove(event)
}
</script>

<style scoped>
.item-recipe-tree-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(var(--rgb-accent) / 0.35);
  border-radius: 0.25rem;
  background: rgb(var(--rgb-background) / 0.55);
  padding: 0.1rem;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    transform 0.15s ease;
}

.item-recipe-tree-icon:hover {
  border-color: rgb(var(--rgb-accent) / 0.75);
  transform: translateY(-1px);
}

.item-recipe-tree-icon--lg {
  width: 3.625rem;
  height: 3.625rem;
}

.item-recipe-tree-icon--md {
  width: 2.625rem;
  height: 2.625rem;
}

.item-recipe-tree-icon--sm {
  width: 1.75rem;
  height: 1.75rem;
}

.item-recipe-tree-icon img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
