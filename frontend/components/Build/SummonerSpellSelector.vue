<template>
  <div class="summoner-spell-selector">
    <div v-if="spellsStore.status === 'loading'" class="py-8 text-center">
      <p class="text-text">Loading summoner spells...</p>
    </div>

    <div v-else-if="spellsStore.status === 'error'" class="py-8 text-center">
      <p class="text-error">{{ spellsStore.error }}</p>
    </div>

    <div v-else class="summoner-spells-grid">
      <button
        v-for="spell in availableSpells"
        :key="spell.id"
        :class="[
          'summoner-spell-button',
          isSelected(spell) ? 'spell-selected' : 'spell-unselected',
          isDisabled(spell) ? 'spell-disabled' : '',
        ]"
        :disabled="isDisabled(spell)"
        @click="selectSpell(spell)"
      >
        <img
          :src="getSpellImageUrl(version, spell.image.full)"
          :alt="spell.name"
          class="summoner-spell-icon"
        />
        <span v-if="isSelected(spell)" class="spell-slot-badge">
          {{ getSpellSlot(spell) }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'
import { useBuildStore } from '~/stores/BuildStore'
import type { SummonerSpell } from '~/types/build'
import { getSpellImageUrl } from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'

const spellsStore = useSummonerSpellsStore()
const buildStore = useBuildStore()
const { version } = useGameVersion()
const { locale } = useI18n()

const getRiotLanguage = (loc: string): string => (loc === 'en' ? 'en_US' : 'fr_FR')
const riotLocale = computed(() => getRiotLanguage(locale.value))

// Spells are already filtered by backend (only CLASSIC mode)
const availableSpells = computed(() => {
  return spellsStore.spells
})

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

const loadSpellsForLocale = async () => {
  await spellsStore.loadSummonerSpells(riotLocale.value)
}

onMounted(() => {
  loadSpellsForLocale()
})

watch(locale, () => {
  loadSpellsForLocale()
})
</script>

<style scoped>
.summoner-spells-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(3rem, 1fr));
  gap: 0.5rem;
  max-width: 100%;
}

.summoner-spell-button {
  position: relative;
  width: 3rem;
  height: 3rem;
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

.summoner-spell-button.spell-selected {
  background: rgb(var(--rgb-accent));
  box-shadow: 0 0 8px rgba(var(--rgb-accent-rgb), 0.6);
}

.summoner-spell-button.spell-unselected {
  background: rgb(var(--rgb-surface));
  opacity: 0.6;
}

.summoner-spell-button.spell-disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.summoner-spell-button:hover:not(.spell-disabled) {
  transform: scale(1.1);
  opacity: 1;
}

.summoner-spell-icon {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  object-fit: cover;
}

.spell-slot-badge {
  position: absolute;
  right: -0.25rem;
  top: -0.25rem;
  width: 1.25rem;
  height: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgb(var(--rgb-accent));
  color: rgb(var(--rgb-background));
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid rgb(var(--rgb-background));
}
</style>
