<template>
  <div class="skill-order-selector">
    <div v-if="!champion" class="py-8 text-center">
      <p class="text-text">Veuillez d'abord sélectionner un champion</p>
    </div>

    <div v-else>
      <div class="mb-4">
        <p class="mb-2 font-semibold text-text">Ordre de montée des compétences (Niveaux 1-18)</p>
        <p class="text-sm text-text/70">
          Cliquez sur les compétences pour définir l'ordre de montée. Les 18 niveaux doivent être
          assignés.
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
            :title="getSkillTooltip(getSkillForLevel(level)!, level)"
            @click="clearLevel(level)"
          >
            {{ t(`skills.key.${getSkillForLevel(level)}`) }}
          </button>
          <div v-else class="h-10 w-10 rounded border-2 border-dashed border-text/30"></div>
        </div>
      </div>

      <div class="mb-4">
        <p class="mb-2 font-semibold text-text">Compétences disponibles</p>
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
            :title="`${spell.name}${spell.description ? ': ' + spell.description.replace(/<[^>]*>/g, '').substring(0, 100) : ''}`"
            @click="selectedAbility = spell.id"
          >
            <img
              v-if="spell.image"
              :src="getSpellImageUrl(version, spell.image?.full || '')"
              :alt="spell.name"
              class="mb-1 h-12 w-12 rounded"
            />
            <span class="text-xs text-text">
              {{ t(`skills.key.${spell.id}`) }}
            </span>
          </button>
        </div>
      </div>

      <div v-if="selectedAbility" class="mb-4">
        <p class="mb-2 text-text">
          Cliquez sur un niveau pour assigner {{ t(`skills.key.${selectedAbility}`) }}
        </p>
        <div class="grid grid-cols-9 gap-2">
          <button
            v-for="level in 18"
            :key="level"
            :class="[
              'rounded border-2 p-2 transition-all',
              getSkillForLevel(level) === selectedAbility
                ? 'border-accent bg-accent/20'
                : canAssignSkill(level, selectedAbility)
                  ? 'border-surface hover:border-primary'
                  : 'cursor-not-allowed border-surface/30 bg-surface/30 opacity-50',
            ]"
            :disabled="!canAssignSkill(level, selectedAbility)"
            :title="getLevelTooltip(level, selectedAbility)"
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
import { useI18n } from 'vue-i18n'
import { useBuildStore } from '~/stores/BuildStore'
import type { SkillOrder } from '~/types/build'

import { getSpellImageUrl } from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'

const buildStore = useBuildStore()
const { t } = useI18n()

const selectedAbility = ref<string | null>(null)

const champion = computed(() => buildStore.currentBuild?.champion)

const availableSpells = computed(() => {
  if (!champion.value) return []
  return [
    {
      id: 'Q',
      name: champion.value.spells[0]?.name || 'Q',
      description: champion.value.spells[0]?.description || '',
      image: champion.value.spells[0]?.image,
    },
    {
      id: 'W',
      name: champion.value.spells[1]?.name || 'W',
      description: champion.value.spells[1]?.description || '',
      image: champion.value.spells[1]?.image,
    },
    {
      id: 'E',
      name: champion.value.spells[2]?.name || 'E',
      description: champion.value.spells[2]?.description || '',
      image: champion.value.spells[2]?.image,
    },
    {
      id: 'R',
      name: champion.value.spells[3]?.name || 'R',
      description: champion.value.spells[3]?.description || '',
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

  // Vérifier les règles avant d'assigner
  if (!canAssignSkill(level, ability)) {
    return
  }

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

const getSkillTooltip = (ability: string, level: number): string => {
  const spell = availableSpells.value.find(s => s.id === ability)
  if (!spell) return `Niveau ${level}: ${ability}`
  const cleanDescription = spell.description
    ? spell.description.replace(/<[^>]*>/g, '').substring(0, 150)
    : ''
  return `Niveau ${level}: ${spell.name}${cleanDescription ? ' - ' + cleanDescription : ''}`
}

const canAssignSkill = (level: number, ability: string): boolean => {
  // R ne peut être assigné qu'aux niveaux 6, 11, 16
  if (ability === 'R') {
    return level === 6 || level === 11 || level === 16
  }

  // Pour Q, W, E : le premier point (niveau 1) peut être assigné librement
  if (level === 1) {
    return true
  }

  // Au-delà du niveau 1 : vérifier que le rang ne dépasse pas la moitié du niveau (arrondi à l'inférieur)
  const skillOrder = buildStore.currentBuild?.skillOrder
  if (!skillOrder) return true

  // Compter combien de fois cette compétence a déjà été assignée AVANT ce niveau
  let currentRank = 0
  for (let l = 1; l < level; l++) {
    const levelKey = `level${l}` as keyof SkillOrder
    if (skillOrder[levelKey] === ability) {
      currentRank++
    }
  }

  // Le rang maximum autorisé au niveau N est floor(N / 2)
  // Après assignation, on aura currentRank + 1 rangs, donc il faut : currentRank + 1 <= floor(level / 2)
  // Ce qui équivaut à : currentRank < floor(level / 2)
  const maxRank = Math.floor(level / 2)
  return currentRank < maxRank
}

const getLevelTooltip = (level: number, ability: string): string => {
  if (ability === 'R') {
    if (level === 6 || level === 11 || level === 16) {
      return `Niveau ${level}: Vous pouvez apprendre/améliorer le R`
    } else {
      return `Niveau ${level}: Le R ne peut être amélioré qu'aux niveaux 6, 11 et 16`
    }
  }

  const canAssign = canAssignSkill(level, ability)
  if (!canAssign) {
    const skillOrder = buildStore.currentBuild?.skillOrder
    if (skillOrder) {
      let currentRank = 0
      for (let l = 1; l < level; l++) {
        const levelKey = `level${l}` as keyof SkillOrder
        if (skillOrder[levelKey] === ability) {
          currentRank++
        }
      }
      const maxRank = Math.floor(level / 2)
      return `Niveau ${level}: Limite atteinte (${currentRank}/${maxRank} rangs max)`
    }
  }

  return `Niveau ${level}: Assigner ${t(`skills.key.${ability}`)}`
}

const { version } = useGameVersion()
</script>
