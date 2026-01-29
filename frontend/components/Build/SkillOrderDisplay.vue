<template>
  <div class="skill-order-display">
    <div v-if="!build || !build.champion" class="py-8 text-center">
      <p class="text-text/70">Aucun build ou champion sélectionné</p>
    </div>
    <div v-else-if="!build.skillOrder" class="py-8 text-center">
      <p class="text-text/70">Aucun ordre de compétences défini pour ce build</p>
    </div>

    <div v-else class="space-y-6">
      <!-- Section 1: Les 3 premiers "up" (niveaux 1, 2, 3) -->
      <div>
        <div class="mb-4">
          <p class="mb-2 font-semibold text-text">Les 3 premiers "up" (Niveaux 1, 2, 3)</p>
          <p class="text-sm text-text/70">
            Ordre dans lequel les 3 premières compétences sont apprises
          </p>
        </div>

        <div class="grid grid-cols-3 gap-2 sm:gap-4">
          <div
            v-for="(slot, index) in 3"
            :key="`first-${slot}`"
            class="flex flex-col items-center rounded border-2 border-primary bg-surface p-2 sm:p-4"
          >
            <span class="mb-1 text-xs font-semibold text-text sm:mb-2">Niveau {{ index + 1 }}</span>
            <div
              v-if="getFirstThreeUp(index)"
              :class="[
                'flex h-12 w-12 flex-col items-center justify-center rounded border-2 sm:h-16 sm:w-16',
                getSkillColor(getFirstThreeUp(index)!),
              ]"
            >
              <img
                v-if="getSpellImage(getFirstThreeUp(index)!) && build.champion"
                :src="
                  getChampionSpellImageUrl(
                    version,
                    build.champion.id,
                    getSpellImage(getFirstThreeUp(index)!)!.full
                  )
                "
                :alt="getSpellName(getFirstThreeUp(index)!)"
                class="mb-0.5 h-6 w-6 rounded sm:mb-1 sm:h-10 sm:w-10"
              />
              <span class="text-xs font-bold sm:text-lg">
                {{ t(`skills.key.${getFirstThreeUp(index)}`) }}
              </span>
            </div>
            <div
              v-else
              class="flex h-12 w-12 items-center justify-center rounded border-2 border-dashed border-text/30 sm:h-16 sm:w-16"
            >
              <span class="text-xs text-text/30 sm:text-base">?</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Section 2: L'ordre de montée (les 3 compétences qu'on max en priorité) -->
      <div>
        <div class="mb-4">
          <p class="mb-2 font-semibold text-text">Ordre de montée des compétences</p>
          <p class="text-sm text-text/70">
            Ordre dans lequel les compétences sont maxées en priorité
          </p>
        </div>

        <div class="grid grid-cols-3 gap-2 sm:gap-4">
          <div
            v-for="(slot, index) in 3"
            :key="`order-${slot}`"
            class="flex flex-col items-center rounded border-2 border-primary bg-surface p-2 sm:p-4"
          >
            <span class="mb-1 text-xs font-semibold text-text sm:mb-2"
              >Priorité {{ index + 1 }}</span
            >
            <div
              v-if="getSkillUpOrder(index)"
              :class="[
                'flex h-12 w-12 flex-col items-center justify-center rounded border-2 sm:h-16 sm:w-16',
                getSkillColor(getSkillUpOrder(index)!),
              ]"
            >
              <img
                v-if="getSpellImage(getSkillUpOrder(index)!) && build.champion"
                :src="
                  getChampionSpellImageUrl(
                    version,
                    build.champion.id,
                    getSpellImage(getSkillUpOrder(index)!)!.full
                  )
                "
                :alt="getSpellName(getSkillUpOrder(index)!)"
                class="mb-0.5 h-6 w-6 rounded sm:mb-1 sm:h-10 sm:w-10"
              />
              <span class="text-xs font-bold sm:text-lg">
                {{ t(`skills.key.${getSkillUpOrder(index)}`) }}
              </span>
            </div>
            <div
              v-else
              class="flex h-12 w-12 items-center justify-center rounded border-2 border-dashed border-text/30 sm:h-16 sm:w-16"
            >
              <span class="text-xs text-text/30 sm:text-base">?</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useGameVersion } from '~/composables/useGameVersion'
import { getChampionSpellImageUrl } from '~/utils/imageUrl'
import type { Build } from '~/types/build'

const props = defineProps<{
  build: Build | null
}>()

const { t } = useI18n()
const { version } = useGameVersion()

// Getters pour les 3 premiers up
const getFirstThreeUp = (index: number): 'Q' | 'W' | 'E' | 'R' | null => {
  if (!props.build?.skillOrder?.firstThreeUps) return null
  return props.build.skillOrder.firstThreeUps[index] || null
}

// Getters pour l'ordre de up
const getSkillUpOrder = (index: number): 'Q' | 'W' | 'E' | 'R' | null => {
  if (!props.build?.skillOrder?.skillUpOrder) return null
  return props.build.skillOrder.skillUpOrder[index] || null
}

// Obtenir l'image d'un sort
const getSpellImage = (key: 'Q' | 'W' | 'E' | 'R') => {
  if (!props.build?.champion) return null
  const index = key === 'Q' ? 0 : key === 'W' ? 1 : key === 'E' ? 2 : 3
  return props.build.champion.spells[index]?.image || null
}

// Obtenir le nom d'un sort
const getSpellName = (key: 'Q' | 'W' | 'E' | 'R') => {
  if (!props.build?.champion) return key
  const index = key === 'Q' ? 0 : key === 'W' ? 1 : key === 'E' ? 2 : 3
  return props.build.champion.spells[index]?.name || key
}

// Obtenir la couleur d'un sort
const getSkillColor = (key: 'Q' | 'W' | 'E' | 'R') => {
  const colors = {
    Q: 'border-blue-500 bg-blue-500/20',
    W: 'border-red-500 bg-red-500/20',
    E: 'border-yellow-500 bg-yellow-500/20',
    R: 'border-purple-500 bg-purple-500/20',
  }
  return colors[key]
}
</script>
