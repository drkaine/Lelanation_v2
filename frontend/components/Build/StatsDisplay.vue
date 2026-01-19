<template>
  <div class="stats-display">
    <div v-if="!stats" class="py-8 text-center">
      <p class="text-text">Select a champion and items to see statistics</p>
    </div>

    <div v-else class="space-y-6">
      <div>
        <h3 class="mb-4 text-lg font-bold text-text">Statistics</h3>
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useBuildStore } from '~/stores/BuildStore'
import type { CalculatedStats } from '~/types/build'

const buildStore = useBuildStore()

const stats = computed<CalculatedStats | null>(() => buildStore.calculatedStats)

const formatStat = (value: number, decimals: number = 0): string => {
  return value.toFixed(decimals)
}

const formatPercent = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`
}
</script>
