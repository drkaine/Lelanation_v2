<template>
  <div class="item-selector">
    <div class="mb-4">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search items..."
        class="w-full rounded border border-primary bg-surface px-4 py-2 text-text"
        @input="handleSearch"
      />
    </div>

    <div class="mb-4 flex flex-wrap gap-2">
      <button
        v-for="tag in availableTags"
        :key="tag"
        :class="[
          'rounded px-3 py-1 text-sm transition-colors',
          selectedTags.includes(tag)
            ? 'bg-accent text-background'
            : 'bg-surface text-text hover:bg-primary hover:text-white',
        ]"
        @click="toggleTag(tag)"
      >
        {{ tag }}
      </button>
    </div>

    <div v-if="itemsStore.status === 'loading'" class="py-8 text-center">
      <p class="text-text">Loading items...</p>
    </div>

    <div v-else-if="itemsStore.status === 'error'" class="py-8 text-center">
      <p class="text-error">{{ itemsStore.error }}</p>
    </div>

    <div v-else class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
      <button
        v-for="item in filteredItems"
        :key="item.id"
        :class="[
          'relative flex flex-col items-center rounded border-2 p-2 transition-all',
          isSelected(item) ? 'border-accent bg-accent/20' : 'border-surface hover:border-primary',
        ]"
        :disabled="!isSelected(item) && selectedItemsCount >= 6"
        @click="toggleItem(item)"
      >
        <img
          :src="getItemImageUrl(version, item.image.full)"
          :alt="item.name"
          class="mb-1 h-12 w-12 rounded"
        />
        <span class="line-clamp-2 text-center text-xs text-text">{{ item.name }}</span>
        <span
          v-if="isSelected(item)"
          class="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-background"
        >
          {{ getItemIndex(item) + 1 }}
        </span>
      </button>
    </div>

    <div v-if="filteredItems.length === 0" class="py-8 text-center">
      <p class="text-text">No items found</p>
    </div>

    <div
      v-if="selectedItemsCount >= 6"
      class="mt-4 rounded border border-warning bg-warning/20 p-3"
    >
      <p class="text-sm text-warning">Maximum 6 items selected</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useItemsStore } from '~/stores/ItemsStore'
import { useBuildStore } from '~/stores/BuildStore'
import type { Item } from '~/types/build'

import { getItemImageUrl } from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'

const itemsStore = useItemsStore()
const buildStore = useBuildStore()

const searchQuery = ref('')
const selectedTags = ref<string[]>([])

const availableTags = computed(() => {
  const tags = new Set<string>()
  for (const item of itemsStore.items) {
    for (const tag of item.tags) {
      tags.add(tag)
    }
  }
  return Array.from(tags).sort()
})

const filteredItems = computed(() => {
  return itemsStore.searchItems(
    searchQuery.value,
    selectedTags.value.length > 0 ? selectedTags.value : undefined
  )
})

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

onMounted(() => {
  if (itemsStore.items.length === 0) {
    itemsStore.loadItems()
  }
})
</script>
