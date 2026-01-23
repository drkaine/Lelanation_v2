<template>
  <div class="build-comparison min-h-screen px-4 py-6 text-text sm:px-6 lg:px-8">
    <div class="max-w-8xl mx-auto px-2">
      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="space-y-1">
          <h1 class="text-3xl font-bold text-text">Comparer des builds</h1>
          <p class="text-sm text-text/70">
            {{ builds.length }} build<span v-if="builds.length > 1">s</span> sélectionné<span
              v-if="builds.length > 1"
              >s</span
            >
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            v-if="builds.length"
            type="button"
            class="rounded-lg border border-primary/40 bg-surface px-4 py-2 text-sm font-semibold text-text hover:border-primary hover:bg-primary/10"
            @click="clearComparison"
          >
            Vider
          </button>
          <NuxtLink
            to="/builds"
            class="rounded-lg border border-primary/40 bg-surface px-4 py-2 text-sm font-semibold text-text hover:border-primary hover:bg-primary/10"
          >
            Retour à la découverte
          </NuxtLink>
        </div>
      </div>

      <div v-if="builds.length === 0" class="py-12 text-center">
        <p class="text-lg text-text">Aucun build sélectionné pour la comparaison</p>
        <NuxtLink
          to="/builds"
          class="mt-4 inline-block rounded-lg bg-accent px-6 py-2 font-semibold text-background hover:bg-accent-dark"
        >
          Découvrir des builds
        </NuxtLink>
      </div>

      <div v-else class="overflow-x-auto pb-2">
        <div class="grid snap-x snap-mandatory auto-cols-[minmax(280px,1fr)] grid-flow-col gap-4">
          <div
            v-for="build in builds"
            :key="build.id"
            class="snap-start rounded-xl border-2 border-primary bg-surface p-4 shadow-sm"
          >
            <!-- Build Header -->
            <div class="mb-4 flex items-center justify-between">
              <h3 class="font-bold text-text">{{ build.name }}</h3>
              <button
                type="button"
                class="rounded px-2 py-1 text-error hover:bg-error/10"
                aria-label="Retirer de la comparaison"
                @click="removeFromComparison(build.id)"
              >
                ✕
              </button>
            </div>

            <!-- Champion -->
            <div v-if="build.champion" class="mb-4">
              <p class="mb-2 text-xs font-semibold text-text/70">Champion</p>
              <div class="flex items-center gap-2">
                <img
                  :src="getChampionImageUrl(version, build.champion.image.full)"
                  :alt="build.champion.name"
                  class="h-10 w-10 rounded"
                />
                <span class="text-sm text-text">{{ build.champion.name }}</span>
              </div>
            </div>

            <!-- Items -->
            <div class="mb-4">
              <p class="mb-2 text-xs font-semibold text-text/70">Objets</p>
              <div class="grid grid-cols-3 gap-1">
                <div
                  v-for="(item, index) in build.items.slice(0, 6)"
                  :key="index"
                  class="aspect-square rounded border border-primary/30"
                >
                  <img
                    v-if="item"
                    :src="getItemImageUrl(version, item.image.full)"
                    :alt="item.name"
                    class="h-full w-full rounded object-cover"
                  />
                </div>
              </div>
            </div>

            <!-- Stats Comparison -->
            <div class="mb-4">
              <p class="mb-2 text-xs font-semibold text-text/70">Statistiques clés</p>
              <div class="space-y-1 text-xs">
                <StatRow
                  label="AD"
                  :value="getStatValue(build.id, 'attackDamage')"
                  :is-highest="isHighest(build.id, 'attackDamage')"
                  :is-lowest="isLowest(build.id, 'attackDamage')"
                  format="number"
                />
                <StatRow
                  label="AP"
                  :value="getStatValue(build.id, 'abilityPower')"
                  :is-highest="isHighest(build.id, 'abilityPower')"
                  :is-lowest="isLowest(build.id, 'abilityPower')"
                  format="number"
                />
                <StatRow
                  label="Health"
                  :value="getStatValue(build.id, 'health')"
                  :is-highest="isHighest(build.id, 'health')"
                  :is-lowest="isLowest(build.id, 'health')"
                  format="number"
                />
                <StatRow
                  label="Armor"
                  :value="getStatValue(build.id, 'armor')"
                  :is-highest="isHighest(build.id, 'armor')"
                  :is-lowest="isLowest(build.id, 'armor')"
                  format="number"
                />
                <StatRow
                  label="MR"
                  :value="getStatValue(build.id, 'magicResist')"
                  :is-highest="isHighest(build.id, 'magicResist')"
                  :is-lowest="isLowest(build.id, 'magicResist')"
                  format="number"
                />
                <StatRow
                  label="AS"
                  :value="getStatValue(build.id, 'attackSpeed')"
                  :is-highest="isHighest(build.id, 'attackSpeed')"
                  :is-lowest="isLowest(build.id, 'attackSpeed')"
                  format="decimal"
                />
                <StatRow
                  label="MS"
                  :value="getStatValue(build.id, 'movementSpeed')"
                  :is-highest="isHighest(build.id, 'movementSpeed')"
                  :is-lowest="isLowest(build.id, 'movementSpeed')"
                  format="number"
                />
              </div>
            </div>

            <!-- View Details Link -->
            <NuxtLink
              :to="`/builds/${build.id}`"
              class="block rounded-lg bg-primary px-3 py-2 text-center text-sm text-white transition-colors hover:bg-primary-dark"
            >
              Voir les détails
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { calculateStats } from '~/utils/statsCalculator'
import type { CalculatedStats } from '~/types/build'
import StatRow from '~/components/Build/StatRow.vue'
import { useGameVersion } from '~/composables/useGameVersion'

import { getChampionImageUrl, getItemImageUrl } from '~/utils/imageUrl'

const discoveryStore = useBuildDiscoveryStore()
const { version } = useGameVersion()

const builds = computed(() => discoveryStore.getComparisonBuilds())

// Calculate stats for each build
const buildStats = computed(() => {
  return builds.value.map(build => {
    const stats = calculateStats(build.champion ?? null, build.items, build.runes, build.shards, 18)
    return {
      buildId: build.id,
      stats: stats || createEmptyStats(),
    }
  })
})

// Find highest and lowest values for each stat
const getStatComparison = (statName: keyof CalculatedStats) => {
  const values = buildStats.value.map(bs => bs.stats[statName])
  const max = Math.max(...values)
  const min = Math.min(...values)
  return { max, min }
}

const getStatValue = (buildId: string, statName: keyof CalculatedStats): number => {
  const buildStat = buildStats.value.find(bs => bs.buildId === buildId)
  return buildStat?.stats[statName] || 0
}

const isNear = (a: number, b: number, epsilon: number = 1e-6): boolean => {
  return Math.abs(a - b) <= epsilon
}

const isHighest = (buildId: string, statName: keyof CalculatedStats): boolean => {
  const comparison = getStatComparison(statName)
  const value = getStatValue(buildId, statName)
  return isNear(value, comparison.max) && !isNear(comparison.max, comparison.min)
}

const isLowest = (buildId: string, statName: keyof CalculatedStats): boolean => {
  const comparison = getStatComparison(statName)
  const value = getStatValue(buildId, statName)
  return isNear(value, comparison.min) && !isNear(comparison.max, comparison.min)
}

const createEmptyStats = (): CalculatedStats => {
  return {
    health: 0,
    mana: 0,
    attackDamage: 0,
    abilityPower: 0,
    armor: 0,
    magicResist: 0,
    attackSpeed: 0,
    critChance: 0,
    critDamage: 1.75,
    lifeSteal: 0,
    spellVamp: 0,
    cooldownReduction: 0,
    movementSpeed: 0,
    healthRegen: 0,
    manaRegen: 0,
    armorPenetration: 0,
    magicPenetration: 0,
    tenacity: 0,
  }
}

const removeFromComparison = (buildId: string) => {
  discoveryStore.removeFromComparison(buildId)
}

const clearComparison = () => {
  discoveryStore.clearComparison()
}
</script>
