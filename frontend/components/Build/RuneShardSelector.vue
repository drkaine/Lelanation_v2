<template>
  <div class="rune-shard-selector">
    <div class="shards-rows">
      <!-- Row 1: Offense (Adaptive Force, Attack Speed, Ability Haste) -->
      <div class="shard-row">
        <div class="shard-row-label">{{ t('runes.stat-selection') }}</div>
        <div class="shard-row-buttons">
          <button
            v-for="shard in slot1Options"
            :key="shard.id"
            :class="[
              'shard-button',
              selectedShards[1] === shard.id ? 'shard-selected' : 'shard-unselected',
            ]"
            @click="selectShard(1, shard.id)"
          >
            <img
              :src="shardIconSrc(shard.id)"
              :alt="shard.name"
              class="shard-icon"
              loading="lazy"
            />
          </button>
        </div>
      </div>

      <!-- Row 2: Flex (Adaptive Force, Armor, Magic Resist) -->
      <div class="shard-row">
        <div class="shard-row-label">{{ t('runes.stat-selection') }}</div>
        <div class="shard-row-buttons">
          <button
            v-for="shard in slot2Options"
            :key="shard.id"
            :class="[
              'shard-button',
              selectedShards[2] === shard.id ? 'shard-selected' : 'shard-unselected',
            ]"
            @click="selectShard(2, shard.id)"
          >
            <img
              :src="shardIconSrc(shard.id)"
              :alt="shard.name"
              class="shard-icon"
              loading="lazy"
            />
          </button>
        </div>
      </div>

      <!-- Row 3: Defense (Health, Armor, Magic Resist) -->
      <div class="shard-row">
        <div class="shard-row-label">{{ t('runes.stat-selection') }}</div>
        <div class="shard-row-buttons">
          <button
            v-for="shard in slot3Options"
            :key="shard.id"
            :class="[
              'shard-button',
              selectedShards[3] === shard.id ? 'shard-selected' : 'shard-unselected',
            ]"
            @click="selectShard(3, shard.id)"
          >
            <img
              :src="shardIconSrc(shard.id)"
              :alt="shard.name"
              class="shard-icon"
              loading="lazy"
            />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBuildStore } from '~/stores/BuildStore'
import type { ShardSelection } from '~/types/build'

const buildStore = useBuildStore()
const { t } = useI18n()

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

<style scoped>
.shards-rows {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.shard-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.shard-row-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(var(--rgb-text));
  min-width: 4rem;
}

.shard-row-buttons {
  display: flex;
  gap: 0.25rem;
}

.shard-button {
  width: 2rem;
  height: 2rem;
  border-radius: 4px;
  border: 1px solid rgb(var(--rgb-accent));
  background: transparent;
  padding: 0;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.shard-button.shard-selected {
  background: rgb(var(--rgb-accent));
  box-shadow: 0 0 6px rgba(var(--rgb-accent-rgb), 0.5);
}

.shard-button.shard-unselected {
  background: rgb(var(--rgb-surface));
  opacity: 0.6;
}

.shard-button:hover {
  transform: scale(1.1);
  opacity: 1;
}

.shard-icon {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  object-fit: cover;
}
</style>
