<template>
  <div class="summoner-spell-selector">
    <div v-if="spellsStore.status === 'loading'" class="py-8 text-center">
      <p class="text-text">Loading summoner spells...</p>
    </div>

    <div v-else-if="spellsStore.status === 'error'" class="py-8 text-center">
      <p class="text-error">{{ spellsStore.error }}</p>
    </div>

    <div v-else class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
      <button
        v-for="spell in spellsStore.spells"
        :key="spell.id"
        :class="[
          'flex flex-col items-center rounded border-2 p-3 transition-all',
          isSelected(spell) ? 'border-accent bg-accent/20' : 'border-surface hover:border-primary',
          isDisabled(spell) ? 'cursor-not-allowed opacity-50' : '',
        ]"
        :disabled="isDisabled(spell)"
        @click="selectSpell(spell)"
      >
        <img
          :src="getSpellImageUrl(spell.image.full)"
          :alt="spell.name"
          class="mb-2 h-12 w-12 rounded"
        />
        <span class="text-center text-xs text-text">{{ spell.name }}</span>
        <span
          v-if="isSelected(spell)"
          class="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-background"
        >
          {{ getSpellSlot(spell) }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'
import { useBuildStore } from '~/stores/BuildStore'
import type { SummonerSpell } from '~/types/build'

const spellsStore = useSummonerSpellsStore()
const buildStore = useBuildStore()

const isSelected = (spell: SummonerSpell): boolean => {
  const spells = buildStore.currentBuild?.summonerSpells
  return (
    spells?.[0]?.id === spell.id ||
    spells?.[0]?.key === spell.key ||
    spells?.[1]?.id === spell.id ||
    spells?.[1]?.key === spell.key ||
    false
  )
}

const isDisabled = (spell: SummonerSpell): boolean => {
  // Disable if already selected in both slots
  const spells = buildStore.currentBuild?.summonerSpells
  const isInSlot0 = spells?.[0]?.id === spell.id || spells?.[0]?.key === spell.key
  const isInSlot1 = spells?.[1]?.id === spell.id || spells?.[1]?.key === spell.key

  // If both slots are filled and this spell is not in either slot, disable
  if (spells?.[0] && spells?.[1] && !isInSlot0 && !isInSlot1) {
    return true
  }

  return false
}

const getSpellSlot = (spell: SummonerSpell): number => {
  const spells = buildStore.currentBuild?.summonerSpells
  if (spells?.[0]?.id === spell.id || spells?.[0]?.key === spell.key) {
    return 1
  }
  if (spells?.[1]?.id === spell.id || spells?.[1]?.key === spell.key) {
    return 2
  }
  return 0
}

const selectSpell = (spell: SummonerSpell) => {
  const spells = buildStore.currentBuild?.summonerSpells

  // If spell is already selected, remove it
  if (isSelected(spell)) {
    if (spells?.[0]?.id === spell.id || spells?.[0]?.key === spell.key) {
      buildStore.setSummonerSpell(0, null)
    } else if (spells?.[1]?.id === spell.id || spells?.[1]?.key === spell.key) {
      buildStore.setSummonerSpell(1, null)
    }
    return
  }

  // Find empty slot or replace first slot
  if (!spells?.[0]) {
    buildStore.setSummonerSpell(0, spell)
  } else if (!spells?.[1]) {
    buildStore.setSummonerSpell(1, spell)
  } else {
    // Both slots filled, replace first slot
    buildStore.setSummonerSpell(0, spell)
  }
}

onMounted(() => {
  if (spellsStore.spells.length === 0) {
    spellsStore.loadSummonerSpells()
  }
})
</script>
