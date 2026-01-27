<template>
  <div class="skill-order-selector">
    <div v-if="!champion" class="py-8 text-center">
      <p class="text-text">Please select a champion first</p>
    </div>

    <div v-else>
      <div class="mb-4">
        <p class="mb-2 text-text">Skill Upgrade Order (Levels 1-18)</p>
        <p class="text-sm text-text/70">
          Click on abilities to set the upgrade order. All 18 levels must be assigned.
        </p>
      </div>

      <div class="mb-4 grid grid-cols-9 gap-2">
        <div
          v-for="level in 18"
          :key="level"
          class="flex flex-col items-center rounded border border-primary bg-surface p-2"
        >
          <span class="mb-1 text-xs text-text">L{{ level }}</span>
          <button
            v-if="getSkillForLevel(level)"
            :class="[
              'flex h-10 w-10 items-center justify-center rounded border-2 text-lg font-bold',
              getSkillColor(getSkillForLevel(level)!),
            ]"
            @click="clearLevel(level)"
          >
            {{ getSkillForLevel(level) }}
          </button>
          <div v-else class="h-10 w-10 rounded border-2 border-dashed border-text/30"></div>
        </div>
      </div>

      <div class="mb-4">
        <p class="mb-2 text-text">Available Abilities</p>
        <div class="flex gap-3">
          <button
            v-for="spell in availableSpells"
            :key="spell.id"
            :class="[
              'flex flex-col items-center rounded border-2 p-3 transition-all',
              selectedAbility === spell.id
                ? 'border-accent bg-accent/20'
                : 'border-surface hover:border-primary',
            ]"
            @click="selectedAbility = spell.id"
          >
            <img
              v-if="spell.image"
              :src="getSpellImageUrl(version, spell.image?.full || '')"
              :alt="spell.name"
              class="mb-1 h-12 w-12 rounded"
            />
            <span class="text-xs text-text">{{ spell.id }}</span>
          </button>
        </div>
      </div>

      <div v-if="selectedAbility" class="mb-4">
        <p class="mb-2 text-text">Click on a level to assign {{ selectedAbility }}</p>
        <div class="grid grid-cols-9 gap-2">
          <button
            v-for="level in 18"
            :key="level"
            :class="[
              'rounded border-2 p-2 transition-all',
              getSkillForLevel(level) === selectedAbility
                ? 'border-accent bg-accent/20'
                : 'border-surface hover:border-primary',
            ]"
            @click="assignSkill(level, selectedAbility)"
          >
            L{{ level }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useBuildStore } from '~/stores/BuildStore'
import type { SkillOrder } from '~/types/build'

import { getSpellImageUrl } from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'

const buildStore = useBuildStore()

const selectedAbility = ref<string | null>(null)

const champion = computed(() => buildStore.currentBuild?.champion)

const availableSpells = computed(() => {
  if (!champion.value) return []
  return [
    {
      id: 'Q',
      name: champion.value.spells[0]?.name || 'Q',
      image: champion.value.spells[0]?.image,
    },
    {
      id: 'W',
      name: champion.value.spells[1]?.name || 'W',
      image: champion.value.spells[1]?.image,
    },
    {
      id: 'E',
      name: champion.value.spells[2]?.name || 'E',
      image: champion.value.spells[2]?.image,
    },
    {
      id: 'R',
      name: champion.value.spells[3]?.name || 'R',
      image: champion.value.spells[3]?.image,
    },
  ].filter(spell => spell.image)
})

const getSkillForLevel = (level: number): 'Q' | 'W' | 'E' | 'R' | null => {
  const skillOrder = buildStore.currentBuild?.skillOrder
  if (!skillOrder) return null
  const levelKey = `level${level}` as keyof SkillOrder
  return skillOrder[levelKey] || null
}

const assignSkill = (level: number, ability: string) => {
  if (!buildStore.currentBuild) return

  const skillOrder = buildStore.currentBuild.skillOrder || ({} as SkillOrder)
  const levelKey = `level${level}` as keyof SkillOrder

  if (ability === 'Q' || ability === 'W' || ability === 'E' || ability === 'R') {
    skillOrder[levelKey] = ability
    buildStore.setSkillOrder(skillOrder)
  }
}

const clearLevel = (level: number) => {
  if (!buildStore.currentBuild?.skillOrder) return

  const skillOrder = { ...buildStore.currentBuild.skillOrder }
  const levelKey = `level${level}` as keyof SkillOrder
  delete skillOrder[levelKey]
  buildStore.setSkillOrder(skillOrder as SkillOrder)
}

const getSkillColor = (ability: string): string => {
  const colors = {
    Q: 'bg-blue-500 text-white border-blue-600',
    W: 'bg-green-500 text-white border-green-600',
    E: 'bg-yellow-500 text-white border-yellow-600',
    R: 'bg-red-500 text-white border-red-600',
  }
  return colors[ability as keyof typeof colors] || 'bg-surface text-text border-primary'
}

const { version } = useGameVersion()
</script>
