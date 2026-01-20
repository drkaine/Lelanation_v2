<template>
  <div class="stats-display">
    <div v-if="!stats" class="py-8 text-center">
      <p class="text-text-secondary">
        Sélectionnez un champion et des items pour voir les statistiques
      </p>
    </div>

    <div v-else class="space-y-6">
      <!-- View Toggle -->
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-text-accent">Statistiques</h3>
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
            Simple
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
            Détaillé
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
          <p class="text-text/70 mb-1 text-xs">Attack Damage</p>
          <p class="text-xl font-bold text-text">{{ formatStat(stats.attackDamage) }}</p>
        </div>
        <div class="rounded border border-primary bg-surface p-3">
          <p class="text-text/70 mb-1 text-xs">Ability Power</p>
          <p class="text-xl font-bold text-text">{{ formatStat(stats.abilityPower) }}</p>
        </div>
        <div class="rounded border border-primary bg-surface p-3">
          <p class="text-text/70 mb-1 text-xs">Attack Speed</p>
          <p class="text-xl font-bold text-text">{{ formatStat(stats.attackSpeed, 2) }}</p>
        </div>
        <div class="rounded border border-primary bg-surface p-3">
          <p class="text-text/70 mb-1 text-xs">Crit Chance</p>
          <p class="text-xl font-bold text-text">{{ formatPercent(stats.critChance) }}</p>
        </div>

        <!-- Defensive Stats -->
        <div class="rounded border border-primary bg-surface p-3">
          <p class="text-text/70 mb-1 text-xs">Health</p>
          <p class="text-xl font-bold text-text">{{ formatStat(stats.health) }}</p>
        </div>
        <div class="rounded border border-primary bg-surface p-3">
          <p class="text-text/70 mb-1 text-xs">Armor</p>
          <p class="text-xl font-bold text-text">{{ formatStat(stats.armor) }}</p>
        </div>
        <div class="rounded border border-primary bg-surface p-3">
          <p class="text-text/70 mb-1 text-xs">Magic Resist</p>
          <p class="text-xl font-bold text-text">{{ formatStat(stats.magicResist) }}</p>
        </div>
        <div class="rounded border border-primary bg-surface p-3">
          <p class="text-text/70 mb-1 text-xs">Health Regen</p>
          <p class="text-xl font-bold text-text">{{ formatStat(stats.healthRegen, 2) }}/s</p>
        </div>

        <!-- Utility Stats -->
        <div class="rounded border border-primary bg-surface p-3">
          <p class="text-text/70 mb-1 text-xs">Movement Speed</p>
          <p class="text-xl font-bold text-text">{{ formatStat(stats.movementSpeed) }}</p>
        </div>
        <div class="rounded border border-primary bg-surface p-3">
          <p class="text-text/70 mb-1 text-xs">Cooldown Reduction</p>
          <p class="text-xl font-bold text-text">{{ formatPercent(stats.cooldownReduction) }}</p>
        </div>
        <div class="rounded border border-primary bg-surface p-3">
          <p class="text-text/70 mb-1 text-xs">Life Steal</p>
          <p class="text-xl font-bold text-text">{{ formatPercent(stats.lifeSteal) }}</p>
        </div>
        <div class="rounded border border-primary bg-surface p-3">
          <p class="text-text/70 mb-1 text-xs">Armor Pen</p>
          <p class="text-xl font-bold text-text">{{ formatPercent(stats.armorPenetration) }}</p>
        </div>
      </div>

      <!-- Detailed View -->
      <div v-else class="space-y-4">
        <!-- Offensive Stats Section -->
        <div class="rounded-lg border-2 border-primary bg-surface p-4">
          <h4 class="mb-3 text-base font-bold text-text-accent">Statistiques Offensives</h4>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <StatCard
              label="Attack Damage"
              :value="stats.attackDamage"
              :previous-value="previousStats?.attackDamage"
              format="number"
            />
            <StatCard
              label="Ability Power"
              :value="stats.abilityPower"
              :previous-value="previousStats?.abilityPower"
              format="number"
            />
            <StatCard
              label="Attack Speed"
              :value="stats.attackSpeed"
              :previous-value="previousStats?.attackSpeed"
              format="decimal"
            />
            <StatCard
              label="Crit Chance"
              :value="stats.critChance"
              :previous-value="previousStats?.critChance"
              format="percent"
            />
            <StatCard
              label="Crit Damage"
              :value="stats.critDamage"
              :previous-value="previousStats?.critDamage"
              format="percent"
            />
            <StatCard
              label="Life Steal"
              :value="stats.lifeSteal"
              :previous-value="previousStats?.lifeSteal"
              format="percent"
            />
            <StatCard
              label="Armor Penetration"
              :value="stats.armorPenetration"
              :previous-value="previousStats?.armorPenetration"
              format="percent"
            />
            <StatCard
              label="Magic Penetration"
              :value="stats.magicPenetration"
              :previous-value="previousStats?.magicPenetration"
              format="percent"
            />
          </div>
        </div>

        <!-- Defensive Stats Section -->
        <div class="rounded-lg border-2 border-primary bg-surface p-4">
          <h4 class="mb-3 text-base font-bold text-text-accent">Statistiques Défensives</h4>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <StatCard
              label="Health"
              :value="stats.health"
              :previous-value="previousStats?.health"
              format="number"
            />
            <StatCard
              label="Armor"
              :value="stats.armor"
              :previous-value="previousStats?.armor"
              format="number"
            />
            <StatCard
              label="Magic Resist"
              :value="stats.magicResist"
              :previous-value="previousStats?.magicResist"
              format="number"
            />
            <StatCard
              label="Health Regen"
              :value="stats.healthRegen"
              :previous-value="previousStats?.healthRegen"
              format="decimal"
              suffix="/s"
            />
            <StatCard
              label="Tenacity"
              :value="stats.tenacity"
              :previous-value="previousStats?.tenacity"
              format="percent"
            />
          </div>
        </div>

        <!-- Utility Stats Section -->
        <div class="rounded-lg border-2 border-primary bg-surface p-4">
          <h4 class="mb-3 text-base font-bold text-text-accent">Statistiques Utilitaires</h4>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <StatCard
              label="Mana"
              :value="stats.mana"
              :previous-value="previousStats?.mana"
              format="number"
            />
            <StatCard
              label="Mana Regen"
              :value="stats.manaRegen"
              :previous-value="previousStats?.manaRegen"
              format="decimal"
              suffix="/s"
            />
            <StatCard
              label="Movement Speed"
              :value="stats.movementSpeed"
              :previous-value="previousStats?.movementSpeed"
              format="number"
            />
            <StatCard
              label="Cooldown Reduction"
              :value="stats.cooldownReduction"
              :previous-value="previousStats?.cooldownReduction"
              format="percent"
            />
            <StatCard
              label="Spell Vamp"
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
import StatCard from './StatCard.vue'
import { useBuildStore } from '~/stores/BuildStore'
import type { CalculatedStats } from '~/types/build'

const buildStore = useBuildStore()

const viewMode = ref<'simple' | 'detailed'>('simple')
const previousStats = ref<CalculatedStats | null>(null)

const stats = computed<CalculatedStats | null>(() => buildStore.calculatedStats)

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

const formatStat = (value: number, decimals: number = 0): string => {
  return value.toFixed(decimals)
}

const formatPercent = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`
}
</script>
