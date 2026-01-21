<template>
  <div class="rune-shard-selector">
    <div class="mb-4">
      <p class="mb-2 text-text">Rune Shards</p>
      <p class="text-sm text-text/70">
        Select shards for the three shard slots. Each slot has different options.
      </p>
    </div>

    <div class="space-y-6">
      <!-- Slot 1: Adaptive Force, Attack Speed, Ability Haste -->
      <div>
        <p class="mb-2 text-sm font-semibold text-text">Slot 1</p>
        <div class="grid grid-cols-3 gap-3">
          <button
            v-for="shard in slot1Options"
            :key="shard.id"
            :class="[
              'flex flex-col items-center rounded border-2 p-3 transition-all',
              selectedShards[1] === shard.id
                ? 'border-accent bg-accent/20'
                : 'border-surface hover:border-primary',
            ]"
            @click="selectShard(1, shard.id)"
          >
            <img
              :src="shardIconSrc(shard.id)"
              :alt="shard.name"
              class="mb-2 h-9 w-9"
              loading="lazy"
            />
            <span class="text-center text-xs text-text">{{ shard.name }}</span>
          </button>
        </div>
      </div>

      <!-- Slot 2: Adaptive Force, Armor, Magic Resist -->
      <div>
        <p class="mb-2 text-sm font-semibold text-text">Slot 2</p>
        <div class="grid grid-cols-3 gap-3">
          <button
            v-for="shard in slot2Options"
            :key="shard.id"
            :class="[
              'flex flex-col items-center rounded border-2 p-3 transition-all',
              selectedShards[2] === shard.id
                ? 'border-accent bg-accent/20'
                : 'border-surface hover:border-primary',
            ]"
            @click="selectShard(2, shard.id)"
          >
            <img
              :src="shardIconSrc(shard.id)"
              :alt="shard.name"
              class="mb-2 h-9 w-9"
              loading="lazy"
            />
            <span class="text-center text-xs text-text">{{ shard.name }}</span>
          </button>
        </div>
      </div>

      <!-- Slot 3: Health, Armor, Magic Resist -->
      <div>
        <p class="mb-2 text-sm font-semibold text-text">Slot 3</p>
        <div class="grid grid-cols-3 gap-3">
          <button
            v-for="shard in slot3Options"
            :key="shard.id"
            :class="[
              'flex flex-col items-center rounded border-2 p-3 transition-all',
              selectedShards[3] === shard.id
                ? 'border-accent bg-accent/20'
                : 'border-surface hover:border-primary',
            ]"
            @click="selectShard(3, shard.id)"
          >
            <img
              :src="shardIconSrc(shard.id)"
              :alt="shard.name"
              class="mb-2 h-9 w-9"
              loading="lazy"
            />
            <span class="text-center text-xs text-text">{{ shard.name }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useBuildStore } from '~/stores/BuildStore'
import type { ShardSelection } from '~/types/build'

const buildStore = useBuildStore()

const selectedShards = ref<Record<number, number>>({
  1: 5008, // Default: Adaptive Force
  2: 5008, // Default: Adaptive Force
  3: 5001, // Default: Health
})

const shardIconSrc = (id: number): string => {
  // Uses local assets in /public/icons/shards
  switch (id) {
    case 5008:
      return '/icons/shards/adaptative.png'
    case 5005:
      return '/icons/shards/speed.png'
    case 5007:
      return '/icons/shards/cdr.png'
    case 5001:
      return '/icons/shards/hp.png'
    // Fallback mapping for defense shards (local icon set)
    case 5002:
      return '/icons/shards/growth.png'
    case 5003:
      return '/icons/shards/tenacity.png'
    default:
      return '/icons/shards/adaptative.png'
  }
}

const slot1Options = [
  { id: 5008, name: 'Adaptive Force' },
  { id: 5005, name: 'Attack Speed' },
  { id: 5007, name: 'Ability Haste' },
]

const slot2Options = [
  { id: 5008, name: 'Adaptive Force' },
  { id: 5002, name: 'Armor' },
  { id: 5003, name: 'Magic Resist' },
]

const slot3Options = [
  { id: 5001, name: 'Health' },
  { id: 5002, name: 'Armor' },
  { id: 5003, name: 'Magic Resist' },
]

const selectShard = (slot: number, shardId: number) => {
  selectedShards.value[slot] = shardId
  updateShardSelection()
}

const updateShardSelection = () => {
  const shardSelection: ShardSelection = {
    slot1: selectedShards.value[1],
    slot2: selectedShards.value[2],
    slot3: selectedShards.value[3],
  }
  buildStore.setShards(shardSelection)
}

// Load existing shard selection from build
watch(
  () => buildStore.currentBuild?.shards,
  shards => {
    if (shards) {
      selectedShards.value = {
        1: shards.slot1,
        2: shards.slot2,
        3: shards.slot3,
      }
    }
  },
  { immediate: true }
)
</script>
