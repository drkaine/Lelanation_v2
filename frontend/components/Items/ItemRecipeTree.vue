<template>
  <div class="item-recipe-tree">
    <div class="item-recipe-tree__root">
      <ItemRecipeTreeIcon :item="root.item" size="lg" @select="emit('select-item', $event)" />
    </div>

    <template v-if="root.children.length">
      <div
        class="item-recipe-tree__connector item-recipe-tree__connector--root"
        aria-hidden="true"
      />

      <div
        class="item-recipe-tree__branches"
        :class="{ 'item-recipe-tree__branches--single': root.children.length === 1 }"
      >
        <div
          v-for="(child, index) in root.children"
          :key="`${child.item.id}-${index}`"
          class="item-recipe-tree__branch"
        >
          <div class="item-recipe-tree__branch-line" aria-hidden="true" />
          <ItemRecipeTreeIcon :item="child.item" size="md" @select="emit('select-item', $event)" />

          <div
            v-if="child.children.length"
            class="item-recipe-tree__connector item-recipe-tree__connector--mid"
            aria-hidden="true"
          />

          <div
            class="item-recipe-tree__leaves"
            :class="
              child.children.length > 1
                ? 'item-recipe-tree__leaves--multi'
                : 'item-recipe-tree__leaves--single'
            "
          >
            <div
              v-for="(sub, subIndex) in child.children"
              :key="`${sub.item.id}-${subIndex}`"
              class="item-recipe-tree__leaf"
            >
              <div class="item-recipe-tree__leaf-line" aria-hidden="true" />
              <ItemRecipeTreeIcon
                :item="sub.item"
                size="sm"
                @select="emit('select-item', $event)"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Item } from '~/types/build'
import type { ItemRecipeTreeNode } from '~/utils/itemRecipeTree'
import ItemRecipeTreeIcon from '~/components/Items/ItemRecipeTreeIcon.vue'

defineProps<{
  root: ItemRecipeTreeNode
}>()

const emit = defineEmits<{
  'select-item': [item: Item]
}>()
</script>

<style scoped>
.item-recipe-tree {
  --tree-line: rgb(var(--rgb-accent) / 0.5);
  --tree-icon-md: 2.625rem;
  --tree-icon-sm: 1.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.item-recipe-tree__root {
  display: flex;
  justify-content: center;
}

.item-recipe-tree__connector {
  width: 1px;
  background: var(--tree-line);
  flex-shrink: 0;
}

.item-recipe-tree__connector--root {
  height: 0.65rem;
}

.item-recipe-tree__connector--mid {
  height: 0.45rem;
}

.item-recipe-tree__branches {
  position: relative;
  display: flex;
  justify-content: center;
  width: 100%;
  padding-top: 0;
}

.item-recipe-tree__branches::before {
  content: '';
  position: absolute;
  top: 0;
  left: calc(var(--tree-icon-md) / 2);
  right: calc(var(--tree-icon-md) / 2);
  height: 1px;
  background: var(--tree-line);
}

.item-recipe-tree__branches--single::before {
  display: none;
}

.item-recipe-tree__branch {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  min-width: var(--tree-icon-md);
  max-width: 5.5rem;
}

.item-recipe-tree__branch-line,
.item-recipe-tree__leaf-line {
  width: 1px;
  background: var(--tree-line);
  flex-shrink: 0;
}

.item-recipe-tree__branch-line {
  height: 0.65rem;
}

.item-recipe-tree__leaves {
  display: flex;
  justify-content: center;
  width: 100%;
  min-height: calc(var(--tree-icon-sm) + 0.65rem);
}

.item-recipe-tree__leaves--single:not(:has(.item-recipe-tree__leaf)) {
  min-height: calc(var(--tree-icon-sm) + 0.65rem);
}

.item-recipe-tree__leaves--multi {
  position: relative;
  padding-top: 0;
}

.item-recipe-tree__leaves--multi::before {
  content: '';
  position: absolute;
  top: 0;
  left: calc(var(--tree-icon-sm) / 2);
  right: calc(var(--tree-icon-sm) / 2);
  height: 1px;
  background: var(--tree-line);
}

.item-recipe-tree__leaf {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  min-width: var(--tree-icon-sm);
}

.item-recipe-tree__leaf-line {
  height: 0.65rem;
}

.item-recipe-tree__leaves--single .item-recipe-tree__leaf-line {
  height: 0.65rem;
}
</style>
