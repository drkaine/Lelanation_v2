<template>
  <div class="skill-order-selector">
    <div v-if="!champion" class="py-8 text-center">
      <p class="text-text">Veuillez d'abord sélectionner un champion</p>
    </div>

    <div v-else>
      <!-- Section 1: Les 3 premiers "up" (niveaux 1, 2, 3) -->
      <div class="mb-6">
        <div class="mb-4">
          <p class="mb-2 font-semibold text-text">Les 3 premiers "up" (Niveaux 1, 2, 3)</p>
          <p class="text-sm text-text/70">
            Définissez l'ordre dans lequel vous apprenez les 3 premières compétences
          </p>
        </div>

        <div class="mb-4 grid grid-cols-3 gap-4">
          <div
            v-for="(slot, index) in 3"
            :key="`first-${slot}`"
            class="flex flex-col items-center rounded border-2 border-primary bg-surface p-4"
            :class="{
              'border-accent bg-accent/10': selectedSlot === `first-${index}`,
            }"
          >
            <span class="mb-2 text-xs font-semibold text-text">Niveau {{ index + 1 }}</span>
            <button
              v-if="getFirstThreeUp(index)"
              :class="[
                'flex h-16 w-16 flex-col items-center justify-center rounded border-2 transition-all',
                getSkillColor(getFirstThreeUp(index)!),
              ]"
              :title="getSpellName(getFirstThreeUp(index)!)"
              @click="clearFirstThreeUp(index)"
            >
              <img
                v-if="getSpellImage(getFirstThreeUp(index)!)"
                :src="getSpellImageUrl(version, getSpellImage(getFirstThreeUp(index)!)!.full)"
                :alt="getSpellName(getFirstThreeUp(index)!)"
                class="mb-1 h-10 w-10 rounded"
              />
              <span class="text-lg font-bold">
                {{ t(`skills.key.${getFirstThreeUp(index)}`) }}
              </span>
            </button>
            <div
              v-else
              class="flex h-16 w-16 items-center justify-center rounded border-2 border-dashed border-text/30"
            >
              <span class="text-text/30">?</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Section 2: L'ordre de montée (les 3 compétences qu'on max en priorité) -->
      <div class="mb-6">
        <div class="mb-4">
          <p class="mb-2 font-semibold text-text">Ordre de montée des compétences</p>
          <p class="text-sm text-text/70">
            Définissez l'ordre dans lequel vous montez les compétences (les 3 compétences maxées en
            priorité)
          </p>
        </div>

        <div class="mb-4 grid grid-cols-3 gap-4">
          <div
            v-for="(slot, index) in 3"
            :key="`order-${slot}`"
            class="flex flex-col items-center rounded border-2 border-primary bg-surface p-4"
            :class="{
              'border-accent bg-accent/10': selectedSlot === `order-${index}`,
            }"
          >
            <span class="mb-2 text-xs font-semibold text-text">Priorité {{ index + 1 }}</span>
            <button
              v-if="getSkillUpOrder(index)"
              :class="[
                'flex h-16 w-16 flex-col items-center justify-center rounded border-2 transition-all',
                getSkillColor(getSkillUpOrder(index)!),
              ]"
              :title="getSpellName(getSkillUpOrder(index)!)"
              @click="clearSkillUpOrder(index)"
            >
              <img
                v-if="getSpellImage(getSkillUpOrder(index)!)"
                :src="getSpellImageUrl(version, getSpellImage(getSkillUpOrder(index)!)!.full)"
                :alt="getSpellName(getSkillUpOrder(index)!)"
                class="mb-1 h-10 w-10 rounded"
              />
              <span class="text-lg font-bold">
                {{ t(`skills.key.${getSkillUpOrder(index)}`) }}
              </span>
            </button>
            <div
              v-else
              class="flex h-16 w-16 items-center justify-center rounded border-2 border-dashed border-text/30"
            >
              <span class="text-text/30">?</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Compétences disponibles -->
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

      <!-- Instructions pour assigner -->
      <div v-if="selectedAbility" class="mb-4">
        <p class="mb-2 text-text">
          Cliquez sur une case pour assigner {{ t(`skills.key.${selectedAbility}`) }}
        </p>
        <div class="grid grid-cols-3 gap-2">
          <!-- Cases pour les 3 premiers up -->
          <button
            v-for="index in 3"
            :key="`assign-first-${index}`"
            :class="[
              'rounded border-2 p-2 transition-all',
              getFirstThreeUp(index - 1) === selectedAbility
                ? 'border-accent bg-accent/20'
                : 'border-surface hover:border-primary',
            ]"
            :title="`Niveau ${index}: Assigner ${t(`skills.key.${selectedAbility}`)}`"
            @click="assignFirstThreeUp(index - 1, selectedAbility)"
          >
            Niveau {{ index }}
          </button>
        </div>
        <div class="mt-2 grid grid-cols-3 gap-2">
          <!-- Cases pour l'ordre de up -->
          <button
            v-for="index in 3"
            :key="`assign-order-${index}`"
            :class="[
              'rounded border-2 p-2 transition-all',
              getSkillUpOrder(index - 1) === selectedAbility
                ? 'border-accent bg-accent/20'
                : 'border-surface hover:border-primary',
            ]"
            :title="`Priorité ${index}: Assigner ${t(`skills.key.${selectedAbility}`)}`"
            @click="assignSkillUpOrder(index - 1, selectedAbility)"
          >
            Priorité {{ index }}
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
const selectedSlot = ref<string | null>(null)

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

// Initialiser le skillOrder si nécessaire
const initializeSkillOrder = () => {
  if (!buildStore.currentBuild) {
    buildStore.createNewBuild()
  }
  if (!buildStore.currentBuild?.skillOrder) {
    const newSkillOrder: SkillOrder = {
      firstThreeUps: [null as any, null as any, null as any],
      skillUpOrder: [null as any, null as any, null as any],
    }
    buildStore.setSkillOrder(newSkillOrder)
  }
}

// Getters pour les 3 premiers up
const getFirstThreeUp = (index: number): 'Q' | 'W' | 'E' | 'R' | null => {
  initializeSkillOrder()
  const skillOrder = buildStore.currentBuild?.skillOrder
  if (!skillOrder || !skillOrder.firstThreeUps) return null
  return skillOrder.firstThreeUps[index] || null
}

// Getters pour l'ordre de up
const getSkillUpOrder = (index: number): 'Q' | 'W' | 'E' | 'R' | null => {
  initializeSkillOrder()
  const skillOrder = buildStore.currentBuild?.skillOrder
  if (!skillOrder || !skillOrder.skillUpOrder) return null
  return skillOrder.skillUpOrder[index] || null
}

// Assigner les 3 premiers up
const assignFirstThreeUp = (index: number, ability: string) => {
  initializeSkillOrder()
  if (!buildStore.currentBuild) return

  if (ability === 'Q' || ability === 'W' || ability === 'E' || ability === 'R') {
    const skillOrder = buildStore.currentBuild.skillOrder || {
      firstThreeUps: [null as any, null as any, null as any],
      skillUpOrder: [null as any, null as any, null as any],
    }
    const newFirstThreeUps = [...(skillOrder.firstThreeUps || [null, null, null])]
    newFirstThreeUps[index] = ability as 'Q' | 'W' | 'E' | 'R'
    buildStore.setSkillOrder({
      ...skillOrder,
      firstThreeUps: newFirstThreeUps as [
        'Q' | 'W' | 'E' | 'R',
        'Q' | 'W' | 'E' | 'R',
        'Q' | 'W' | 'E' | 'R',
      ],
    })
  }
}

// Assigner l'ordre de up
const assignSkillUpOrder = (index: number, ability: string) => {
  initializeSkillOrder()
  if (!buildStore.currentBuild) return

  if (ability === 'Q' || ability === 'W' || ability === 'E' || ability === 'R') {
    const skillOrder = buildStore.currentBuild.skillOrder || {
      firstThreeUps: [null as any, null as any, null as any],
      skillUpOrder: [null as any, null as any, null as any],
    }
    const newSkillUpOrder = [...(skillOrder.skillUpOrder || [null, null, null])]
    newSkillUpOrder[index] = ability as 'Q' | 'W' | 'E' | 'R'
    buildStore.setSkillOrder({
      ...skillOrder,
      skillUpOrder: newSkillUpOrder as [
        'Q' | 'W' | 'E' | 'R',
        'Q' | 'W' | 'E' | 'R',
        'Q' | 'W' | 'E' | 'R',
      ],
    })
  }
}

// Clear functions
const clearFirstThreeUp = (index: number) => {
  if (!buildStore.currentBuild?.skillOrder) return
  const skillOrder = { ...buildStore.currentBuild.skillOrder }
  const newFirstThreeUps = [...skillOrder.firstThreeUps]
  newFirstThreeUps[index] = null as any
  buildStore.setSkillOrder({
    ...skillOrder,
    firstThreeUps: newFirstThreeUps as [
      'Q' | 'W' | 'E' | 'R',
      'Q' | 'W' | 'E' | 'R',
      'Q' | 'W' | 'E' | 'R',
    ],
  })
}

const clearSkillUpOrder = (index: number) => {
  if (!buildStore.currentBuild?.skillOrder) return
  const skillOrder = { ...buildStore.currentBuild.skillOrder }
  const newSkillUpOrder = [...skillOrder.skillUpOrder]
  newSkillUpOrder[index] = null as any
  buildStore.setSkillOrder({
    ...skillOrder,
    skillUpOrder: newSkillUpOrder as [
      'Q' | 'W' | 'E' | 'R',
      'Q' | 'W' | 'E' | 'R',
      'Q' | 'W' | 'E' | 'R',
    ],
  })
}

// Helper functions
const getSkillColor = (ability: string): string => {
  const colors = {
    Q: 'bg-blue-500 text-white border-blue-600',
    W: 'bg-green-500 text-white border-green-600',
    E: 'bg-yellow-500 text-white border-yellow-600',
    R: 'bg-red-500 text-white border-red-600',
  }
  return colors[ability as keyof typeof colors] || 'bg-surface text-text border-primary'
}

const getSpellName = (ability: 'Q' | 'W' | 'E' | 'R'): string => {
  const spell = availableSpells.value.find(s => s.id === ability)
  return spell?.name || ability
}

const getSpellImage = (ability: 'Q' | 'W' | 'E' | 'R'): { full: string } | null => {
  const spell = availableSpells.value.find(s => s.id === ability)
  return spell?.image || null
}

const { version } = useGameVersion()
</script>
