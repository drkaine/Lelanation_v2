<template>
  <div class="skill-order-selector">
    <div v-if="!champion" class="py-8 text-center">
      <p class="text-text">{{ t('skills.selectChampionFirst') }}</p>
    </div>

    <div v-else>
      <!-- Section 1: Les 3 premiers "up" (niveaux 1, 2, 3) -->
      <div class="mb-6">
        <div class="mb-4">
          <p class="mb-2 font-semibold text-text">{{ t('skills.firstThreeUps') }}</p>
        </div>

        <div class="mb-4 grid grid-cols-3 gap-2 sm:gap-4">
          <div
            v-for="(slot, index) in 3"
            :key="`first-${slot}`"
            class="relative flex flex-col items-center"
          >
            <span class="mb-1 text-xs font-semibold text-text sm:mb-2"
              >{{ t('skills.level') }} {{ index + 1 }}</span
            >
            <button
              :class="[
                'relative flex h-6 w-6 flex-col items-center justify-center rounded border-2 transition-all sm:h-8 sm:w-8',
                getFirstThreeUp(index)
                  ? 'border-primary bg-surface'
                  : 'border-dashed border-text/30 bg-surface',
              ]"
              :title="
                getFirstThreeUp(index)
                  ? getSpellName(getFirstThreeUp(index)!)
                  : t('skills.selectSkill')
              "
              @click.stop="toggleDropdown(`first-${index}`)"
            >
              <img
                v-if="getFirstThreeUp(index) && getSpellImage(getFirstThreeUp(index)!) && champion"
                :src="
                  getChampionSpellImageUrl(
                    version,
                    champion.id,
                    getSpellImage(getFirstThreeUp(index)!)!.full
                  )
                "
                :alt="getSpellName(getFirstThreeUp(index)!)"
                class="h-4 w-4 rounded sm:h-5 sm:w-5"
              />
              <span v-else-if="getFirstThreeUp(index)" class="text-xs font-bold sm:text-sm">
                {{ t(`skills.key.${getFirstThreeUp(index)}`) }}
              </span>
              <span v-else class="text-xs text-text/30 sm:text-sm">?</span>
            </button>

            <!-- Dropdown menu -->
            <div
              v-if="openDropdown === `first-${index}`"
              class="absolute top-full z-50 mt-1 rounded border-2 border-primary bg-surface shadow-lg"
              style="background-color: var(--color-surface); opacity: 1"
              @click.stop
            >
              <button
                v-for="spell in availableSpells"
                :key="spell.id"
                :class="[
                  'flex w-full items-center gap-2 px-3 py-2 text-left transition-colors',
                  getFirstThreeUp(index) === spell.id
                    ? 'bg-accent/20'
                    : isFirstThreeUpSelected(spell.id, index)
                      ? 'cursor-not-allowed bg-surface/50 opacity-50'
                      : 'hover:bg-primary/20',
                ]"
                :disabled="isFirstThreeUpSelected(spell.id, index)"
                :title="
                  getFirstThreeUp(index) === spell.id
                    ? t('skills.clickToDeselect')
                    : isFirstThreeUpSelected(spell.id, index)
                      ? t('skills.alreadyUsedElsewhere')
                      : t('skills.select')
                "
                @click="toggleFirstThreeUp(index, spell.id)"
              >
                <img
                  v-if="spell.image && champion"
                  :src="getChampionSpellImageUrl(version, champion.id, spell.image?.full || '')"
                  :alt="spell.name"
                  class="h-5 w-5 rounded"
                />
                <span class="text-sm font-semibold">{{ t(`skills.key.${spell.id}`) }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Section 2: L'ordre de montée (les 3 compétences qu'on max en priorité) -->
      <div class="mb-6">
        <div class="mb-4">
          <p class="mb-2 font-semibold text-text">{{ t('skills.skillUpOrder') }}</p>
        </div>

        <div class="mb-4 grid grid-cols-3 gap-2 sm:gap-4">
          <div
            v-for="(slot, index) in 3"
            :key="`order-${slot}`"
            class="relative flex flex-col items-center"
          >
            <span class="mb-1 text-xs font-semibold text-text sm:mb-2"
              >{{ t('skills.priority') }} {{ index + 1 }}</span
            >
            <button
              :class="[
                'relative flex h-6 w-6 flex-col items-center justify-center rounded border-2 transition-all sm:h-8 sm:w-8',
                getSkillUpOrder(index)
                  ? 'border-primary bg-surface'
                  : 'border-dashed border-text/30 bg-surface',
              ]"
              :title="
                getSkillUpOrder(index)
                  ? getSpellName(getSkillUpOrder(index)!)
                  : t('skills.selectSkill')
              "
              @click.stop="toggleDropdown(`order-${index}`)"
            >
              <img
                v-if="getSkillUpOrder(index) && getSpellImage(getSkillUpOrder(index)!) && champion"
                :src="
                  getChampionSpellImageUrl(
                    version,
                    champion.id,
                    getSpellImage(getSkillUpOrder(index)!)!.full
                  )
                "
                :alt="getSpellName(getSkillUpOrder(index)!)"
                class="h-4 w-4 rounded sm:h-5 sm:w-5"
              />
              <span v-else-if="getSkillUpOrder(index)" class="text-xs font-bold sm:text-sm">
                {{ t(`skills.key.${getSkillUpOrder(index)}`) }}
              </span>
              <span v-else class="text-xs text-text/30 sm:text-sm">?</span>
            </button>

            <!-- Dropdown menu -->
            <div
              v-if="openDropdown === `order-${index}`"
              class="absolute top-full z-50 mt-1 rounded border-2 border-primary bg-surface shadow-lg"
              style="background-color: var(--color-surface); opacity: 1"
              @click.stop
            >
              <button
                v-for="spell in availableSpells"
                :key="spell.id"
                :class="[
                  'flex w-full items-center gap-2 px-3 py-2 text-left transition-colors',
                  getSkillUpOrder(index) === spell.id
                    ? 'bg-accent/20'
                    : isSkillUpOrderSelected(spell.id, index)
                      ? 'cursor-not-allowed bg-surface/50 opacity-50'
                      : 'hover:bg-primary/20',
                ]"
                :disabled="isSkillUpOrderSelected(spell.id, index)"
                :title="
                  getSkillUpOrder(index) === spell.id
                    ? t('skills.clickToDeselect')
                    : isSkillUpOrderSelected(spell.id, index)
                      ? t('skills.alreadyUsedElsewhere')
                      : t('skills.select')
                "
                @click="toggleSkillUpOrder(index, spell.id)"
              >
                <img
                  v-if="spell.image && champion"
                  :src="getChampionSpellImageUrl(version, champion.id, spell.image?.full || '')"
                  :alt="spell.name"
                  class="h-5 w-5 rounded"
                />
                <span class="text-sm font-semibold">{{ t(`skills.key.${spell.id}`) }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBuildStore } from '~/stores/BuildStore'
import type { SkillOrder } from '~/types/build'

import { getChampionSpellImageUrl } from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'

const buildStore = useBuildStore()
const { t } = useI18n()

const openDropdown = ref<string | null>(null)

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

// Toggle dropdown
const toggleDropdown = (slot: string) => {
  if (openDropdown.value === slot) {
    openDropdown.value = null
  } else {
    openDropdown.value = slot
  }
}

// Fermer le dropdown en cliquant ailleurs
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.skill-order-selector')) {
    openDropdown.value = null
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Sélectionner ou désélectionner (toggle) pour les 3 premiers up
const toggleFirstThreeUp = (index: number, ability: string) => {
  initializeSkillOrder()
  if (!buildStore.currentBuild) return

  const current = getFirstThreeUp(index)
  // Si on reclique sur le skill déjà sélectionné, on le désélectionne
  if (current === ability) {
    const skillOrder = buildStore.currentBuild.skillOrder || {
      firstThreeUps: [null as any, null as any, null as any],
      skillUpOrder: [null as any, null as any, null as any],
    }
    const newFirstThreeUps = [...(skillOrder.firstThreeUps || [null, null, null])]
    newFirstThreeUps[index] = null
    buildStore.setSkillOrder({
      ...skillOrder,
      firstThreeUps: newFirstThreeUps as [
        'Q' | 'W' | 'E' | 'R',
        'Q' | 'W' | 'E' | 'R',
        'Q' | 'W' | 'E' | 'R',
      ],
    })
    openDropdown.value = null
    return
  }

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
    openDropdown.value = null
  }
}

// Sélectionner ou désélectionner (toggle) pour l'ordre de up
const toggleSkillUpOrder = (index: number, ability: string) => {
  initializeSkillOrder()
  if (!buildStore.currentBuild) return

  const current = getSkillUpOrder(index)
  // Si on reclique sur le skill déjà sélectionné, on le désélectionne
  if (current === ability) {
    const skillOrder = buildStore.currentBuild.skillOrder || {
      firstThreeUps: [null as any, null as any, null as any],
      skillUpOrder: [null as any, null as any, null as any],
    }
    const newSkillUpOrder = [...(skillOrder.skillUpOrder || [null, null, null])]
    newSkillUpOrder[index] = null
    buildStore.setSkillOrder({
      ...skillOrder,
      skillUpOrder: newSkillUpOrder as [
        'Q' | 'W' | 'E' | 'R',
        'Q' | 'W' | 'E' | 'R',
        'Q' | 'W' | 'E' | 'R',
      ],
    })
    openDropdown.value = null
    return
  }

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
    openDropdown.value = null
  }
}

// Vérifier si une compétence est déjà sélectionnée dans les 3 premiers up.
// Règle : un même spell ne peut pas être monté deux niveaux consécutifs (1==2 ou 2==3 interdit),
// mais peut réapparaître en 1 et 3 (ex: Q → W → Q est valide).
const isFirstThreeUpSelected = (spellId: string, currentIndex: number): boolean => {
  initializeSkillOrder()
  const skillOrder = buildStore.currentBuild?.skillOrder
  if (!skillOrder || !skillOrder.firstThreeUps) return false
  const ups = skillOrder.firstThreeUps
  const adjacentIndices = currentIndex === 0 ? [1] : currentIndex === 1 ? [0, 2] : [1]
  return adjacentIndices.some(idx => ups[idx] === spellId)
}

// Vérifier si une compétence est déjà sélectionnée dans l'ordre de montée.
// Règle stricte : les 3 compétences doivent toutes être différentes.
const isSkillUpOrderSelected = (spellId: string, currentIndex: number): boolean => {
  initializeSkillOrder()
  const skillOrder = buildStore.currentBuild?.skillOrder
  if (!skillOrder || !skillOrder.skillUpOrder) return false
  return skillOrder.skillUpOrder.some(
    (selected, idx) => idx !== currentIndex && selected === spellId
  )
}

// Helper functions
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

<style scoped>
.skill-order-selector {
  position: relative;
}

/* Style pour les dropdowns avec background opaque */
.skill-order-selector [class*='absolute top-full'] {
  background-color: var(--color-surface) !important;
  opacity: 1 !important;
  min-width: 120px;
}

/* Style pour les boutons désactivés */
.skill-order-selector button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
