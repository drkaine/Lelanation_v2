<template>
  <div class="stats-display">
    <div v-if="!stats" class="py-8 text-center">
      <p class="text-text-secondary">
        {{ t('stats.selectChampionAndItems') }}
      </p>
    </div>

    <div v-else class="space-y-6">
      <!-- View Toggle -->
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-text-accent">{{ t('stats.title') }}</h3>
        <div class="flex gap-2 rounded-lg border-2 border-primary bg-surface p-1">
          <button
            :class="[
              'px-4 py-2 text-sm font-semibold transition-colors',
              viewMode === 'simple'
                ? 'bg-primary text-white'
                : 'text-text-secondary hover:text-text-primary',
            ]"
            @click="viewMode = 'simple'"
          >
            {{ t('stats.simple') }}
          </button>
          <button
            :class="[
              'px-4 py-2 text-sm font-semibold transition-colors',
              viewMode === 'detailed'
                ? 'bg-primary text-white'
                : 'text-text-secondary hover:text-text-primary',
            ]"
            @click="viewMode = 'detailed'"
          >
            {{ t('stats.detailed') }}
          </button>
        </div>
      </div>

      <!-- Simple View -->
      <div
        v-if="viewMode === 'simple'"
        class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4"
      >
        <!-- Offensive Stats -->
        <div class="rounded border border-primary bg-surface p-3">
          <p class="mb-1 text-xs text-text/70">{{ t('stats.labels.attackDamage') }}</p>
          <p class="text-xl font-bold text-text">{{ formatStat(stats.attackDamage) }}</p>
        </div>
        <div class="rounded border border-primary bg-surface p-3">
          <p class="mb-1 text-xs text-text/70">{{ t('stats.labels.abilityPower') }}</p>
          <p class="text-xl font-bold text-text">{{ formatStat(stats.abilityPower) }}</p>
        </div>
        <div class="rounded border border-primary bg-surface p-3">
          <p class="mb-1 text-xs text-text/70">{{ t('stats.labels.attackSpeed') }}</p>
          <p class="text-xl font-bold text-text">{{ formatStat(stats.attackSpeed, 2) }}</p>
        </div>
        <div class="rounded border border-primary bg-surface p-3">
          <p class="mb-1 text-xs text-text/70">{{ t('stats.labels.critChance') }}</p>
          <p class="text-xl font-bold text-text">{{ formatPercent(stats.critChance) }}</p>
        </div>

        <!-- Defensive Stats -->
        <div class="rounded border border-primary bg-surface p-3">
          <p class="mb-1 text-xs text-text/70">{{ t('stats.labels.health') }}</p>
          <p class="text-xl font-bold text-text">{{ formatStat(stats.health) }}</p>
        </div>
        <div class="rounded border border-primary bg-surface p-3">
          <p class="mb-1 text-xs text-text/70">{{ t('stats.labels.armor') }}</p>
          <p class="text-xl font-bold text-text">{{ formatStat(stats.armor) }}</p>
        </div>
        <div class="rounded border border-primary bg-surface p-3">
          <p class="mb-1 text-xs text-text/70">{{ t('stats.labels.magicResist') }}</p>
          <p class="text-xl font-bold text-text">{{ formatStat(stats.magicResist) }}</p>
        </div>
        <div class="rounded border border-primary bg-surface p-3">
          <p class="mb-1 text-xs text-text/70">{{ t('stats.labels.healthRegen') }}</p>
          <p class="text-xl font-bold text-text">{{ formatStat(stats.healthRegen, 2) }}/s</p>
        </div>

        <!-- Utility Stats -->
        <div class="rounded border border-primary bg-surface p-3">
          <p class="mb-1 text-xs text-text/70">{{ t('stats.labels.movementSpeed') }}</p>
          <p class="text-xl font-bold text-text">{{ formatStat(stats.movementSpeed) }}</p>
        </div>
        <div class="rounded border border-primary bg-surface p-3">
          <p class="mb-1 text-xs text-text/70">{{ t('stats.labels.cooldownReduction') }}</p>
          <p class="text-xl font-bold text-text">{{ formatPercent(stats.cooldownReduction) }}</p>
        </div>
        <div class="rounded border border-primary bg-surface p-3">
          <p class="mb-1 text-xs text-text/70">{{ t('stats.labels.lifeSteal') }}</p>
          <p class="text-xl font-bold text-text">{{ formatPercent(stats.lifeSteal) }}</p>
        </div>
        <div class="rounded border border-primary bg-surface p-3">
          <p class="mb-1 text-xs text-text/70">{{ t('stats.labels.armorPenetration') }}</p>
          <p class="text-xl font-bold text-text">{{ formatPercent(stats.armorPenetration) }}</p>
        </div>
      </div>

      <!-- Detailed View -->
      <div v-else class="space-y-4">
        <!-- Quick Analysis -->
        <div v-if="quickAnalysis.length" class="rounded-lg border-2 border-primary bg-surface p-4">
          <h4 class="mb-2 text-base font-bold text-text-accent">{{ t('stats.quickAnalysis') }}</h4>
          <ul class="list-disc space-y-1 pl-5 text-sm text-text/80">
            <li v-for="(msg, idx) in quickAnalysis" :key="idx">{{ msg }}</li>
          </ul>
        </div>

        <!-- Offensive Stats Section -->
        <div class="rounded-lg border-2 border-primary bg-surface p-4">
          <h4 class="mb-3 text-base font-bold text-text-accent">{{ t('stats.offensive') }}</h4>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <StatCard
              :label="t('stats.labels.attackDamage')"
              :value="stats.attackDamage"
              :previous-value="previousStats?.attackDamage"
              format="number"
            />
            <StatCard
              :label="t('stats.labels.abilityPower')"
              :value="stats.abilityPower"
              :previous-value="previousStats?.abilityPower"
              format="number"
            />
            <StatCard
              :label="t('stats.labels.attackSpeed')"
              :value="stats.attackSpeed"
              :previous-value="previousStats?.attackSpeed"
              format="decimal"
            />
            <StatCard
              :label="t('stats.labels.critChance')"
              :value="stats.critChance"
              :previous-value="previousStats?.critChance"
              format="percent"
            />
            <StatCard
              :label="t('stats.labels.critDamage')"
              :value="stats.critDamage"
              :previous-value="previousStats?.critDamage"
              format="percent"
            />
            <StatCard
              :label="t('stats.labels.lifeSteal')"
              :value="stats.lifeSteal"
              :previous-value="previousStats?.lifeSteal"
              format="percent"
            />
            <StatCard
              :label="t('stats.labels.armorPenetration')"
              :value="stats.armorPenetration"
              :previous-value="previousStats?.armorPenetration"
              format="percent"
            />
            <StatCard
              :label="t('stats.labels.magicPenetration')"
              :value="stats.magicPenetration"
              :previous-value="previousStats?.magicPenetration"
              format="percent"
            />
          </div>
        </div>

        <!-- Defensive Stats Section -->
        <div class="rounded-lg border-2 border-primary bg-surface p-4">
          <h4 class="mb-3 text-base font-bold text-text-accent">{{ t('stats.defensive') }}</h4>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <StatCard
              :label="t('stats.labels.health')"
              :value="stats.health"
              :previous-value="previousStats?.health"
              format="number"
            />
            <StatCard
              :label="t('stats.labels.armor')"
              :value="stats.armor"
              :previous-value="previousStats?.armor"
              format="number"
            />
            <StatCard
              :label="t('stats.labels.magicResist')"
              :value="stats.magicResist"
              :previous-value="previousStats?.magicResist"
              format="number"
            />
            <StatCard
              :label="t('stats.labels.healthRegen')"
              :value="stats.healthRegen"
              :previous-value="previousStats?.healthRegen"
              format="decimal"
              suffix="/s"
            />
            <StatCard
              :label="t('stats.labels.tenacity')"
              :value="stats.tenacity"
              :previous-value="previousStats?.tenacity"
              format="percent"
            />
          </div>
        </div>

        <!-- Utility Stats Section -->
        <div class="rounded-lg border-2 border-primary bg-surface p-4">
          <h4 class="mb-3 text-base font-bold text-text-accent">{{ t('stats.utility') }}</h4>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <StatCard
              :label="t('stats.labels.mana')"
              :value="stats.mana"
              :previous-value="previousStats?.mana"
              format="number"
            />
            <StatCard
              :label="t('stats.labels.manaRegen')"
              :value="stats.manaRegen"
              :previous-value="previousStats?.manaRegen"
              format="decimal"
              suffix="/s"
            />
            <StatCard
              :label="t('stats.labels.movementSpeed')"
              :value="stats.movementSpeed"
              :previous-value="previousStats?.movementSpeed"
              format="number"
            />
            <StatCard
              :label="t('stats.labels.cooldownReduction')"
              :value="stats.cooldownReduction"
              :previous-value="previousStats?.cooldownReduction"
              format="percent"
            />
            <StatCard
              :label="t('stats.labels.spellVamp')"
              :value="stats.spellVamp"
              :previous-value="previousStats?.spellVamp"
              format="percent"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import StatCard from './StatCard.vue'
import { useBuildStore } from '~/stores/BuildStore'
import type { CalculatedStats } from '~/types/build'

const { t } = useI18n()
const buildStore = useBuildStore()

const viewMode = ref<'simple' | 'detailed'>('simple')
const previousStats = ref<CalculatedStats | null>(null)

const stats = computed<CalculatedStats | null>(() => buildStore.calculatedStats)
const championTags = computed(() => buildStore.currentBuild?.champion?.tags || [])

// Track previous stats for change visualization
watch(
  () => buildStore.calculatedStats,
  (newStats, oldStats) => {
    if (oldStats) {
      previousStats.value = oldStats
    }
    // Clear previous stats after animation
    setTimeout(() => {
      if (previousStats.value && newStats) {
        previousStats.value = null
      }
    }, 2000)
  }
)

const quickAnalysis = computed(() => {
  if (!stats.value) return []

  const s = stats.value
  const messages: string[] = []

  const offense = s.attackDamage + s.abilityPower * 0.6 + s.attackSpeed * 100 + s.critChance * 100
  const defense = s.health / 10 + s.armor + s.magicResist
  const utility = s.movementSpeed + s.cooldownReduction * 100

  if (offense > defense * 1.2) messages.push('Profil très offensif (fragile si mal positionné).')
  if (defense > offense * 1.2) messages.push('Profil très tanky (dégâts potentiellement faibles).')
  if (utility > 480) messages.push('Bonne mobilité / utilitaire (kite, rotations).')

  // Small heuristic suggestions (no item recommendation)
  if (championTags.value.includes('Marksman') && s.attackSpeed < 1.5) {
    messages.push('Suggestion: augmenter la vitesse d’attaque pour mieux scaler.')
  }
  if (s.attackDamage > 200 && s.armorPenetration < 0.1) {
    messages.push('Suggestion: ajouter de la pénétration d’armure contre les tanks.')
  }
  if (championTags.value.includes('Mage') && s.abilityPower < 400) {
    messages.push('Suggestion: renforcer l’AP si ton objectif est le burst/zone.')
  }

  return messages
})

const formatStat = (value: number, decimals: number = 0): string => {
  return value.toFixed(decimals)
}

const formatPercent = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`
}
</script>
