<template>
  <div class="rune-shard-selector">
    <div class="mb-4">
      <p class="mb-2 text-text">Rune Shards</p>
      <p class="text-text/70 text-sm">
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
                ? 'bg-accent/20 border-accent'
                : 'border-surface hover:border-primary',
            ]"
            @click="selectShard(1, shard.id)"
          >
            <span class="mb-2 text-2xl">{{ shard.icon }}</span>
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
                ? 'bg-accent/20 border-accent'
                : 'border-surface hover:border-primary',
            ]"
            @click="selectShard(2, shard.id)"
          >
            <span class="mb-2 text-2xl">{{ shard.icon }}</span>
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
                ? 'bg-accent/20 border-accent'
                : 'border-surface hover:border-primary',
            ]"
            @click="selectShard(3, shard.id)"
          >
            <span class="mb-2 text-2xl">{{ shard.icon }}</span>
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

const slot1Options = [
  { id: 5008, name: 'Adaptive Force', icon: '⚔️' },
  { id: 5005, name: 'Attack Speed', icon: '⚡' },
  { id: 5007, name: 'Ability Haste', icon: '🔄' },
]

const slot2Options = [
  { id: 5008, name: 'Adaptive Force', icon: '⚔️' },
  { id: 5002, name: 'Armor', icon: '🛡️' },
  { id: 5003, name: 'Magic Resist', icon: '✨' },
]

const slot3Options = [
  { id: 5001, name: 'Health', icon: '❤️' },
  { id: 5002, name: 'Armor', icon: '🛡️' },
  { id: 5003, name: 'Magic Resist', icon: '✨' },
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
