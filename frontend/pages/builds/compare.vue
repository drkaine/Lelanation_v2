<template>
  <div class="build-comparison min-h-screen p-4 text-text">
    <div class="mx-auto max-w-7xl">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-3xl font-bold text-text">Compare Builds</h1>
        <NuxtLink
          to="/builds"
          class="rounded bg-surface px-4 py-2 text-text hover:bg-primary hover:text-white"
        >
          Back to Discovery
        </NuxtLink>
      </div>

      <div v-if="builds.length === 0" class="py-12 text-center">
        <p class="text-lg text-text">No builds selected for comparison</p>
        <NuxtLink
          to="/builds"
          class="mt-4 inline-block rounded bg-accent px-6 py-2 text-background hover:bg-accent-dark"
        >
          Discover Builds
        </NuxtLink>
      </div>

      <div v-else class="overflow-x-auto">
        <div class="grid gap-4" :style="{ gridTemplateColumns: `repeat(${builds.length}, 1fr)` }">
          <div
            v-for="build in builds"
            :key="build.id"
            class="min-w-[280px] rounded-lg border-2 border-primary bg-surface p-4"
          >
            <!-- Build Header -->
            <div class="mb-4 flex items-center justify-between">
              <h3 class="font-bold text-text">{{ build.name }}</h3>
              <button
                class="text-error hover:text-error/70"
                @click="removeFromComparison(build.id)"
              >
                ✕
              </button>
            </div>

            <!-- Champion -->
            <div v-if="build.champion" class="mb-4">
              <p class="text-text/70 mb-2 text-xs font-semibold">Champion</p>
              <div class="flex items-center gap-2">
                <img
                  :src="getChampionImageUrl(build.champion.image.full)"
                  :alt="build.champion.name"
                  class="h-10 w-10 rounded"
                />
                <span class="text-sm text-text">{{ build.champion.name }}</span>
              </div>
            </div>

            <!-- Items -->
            <div class="mb-4">
              <p class="text-text/70 mb-2 text-xs font-semibold">Items</p>
              <div class="grid grid-cols-3 gap-1">
                <div
                  v-for="(item, index) in build.items.slice(0, 6)"
                  :key="index"
                  class="border-primary/30 aspect-square rounded border"
                >
                  <img
                    v-if="item"
                    :src="getItemImageUrl(item.image.full)"
                    :alt="item.name"
                    class="h-full w-full rounded object-cover"
                  />
                </div>
              </div>
            </div>

            <!-- Stats Comparison -->
            <div class="mb-4">
              <p class="text-text/70 mb-2 text-xs font-semibold">Statistiques Clés</p>
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
              :to="`/builds/view/${build.id}`"
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
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { calculateStats } from '~/utils/statsCalculator'
import type { CalculatedStats } from '~/types/build'
import StatRow from '~/components/Build/StatRow.vue'
import { useGameVersion } from '~/composables/useGameVersion'

const discoveryStore = useBuildDiscoveryStore()
const router = useRouter()
const { version } = useGameVersion()

const builds = computed(() => discoveryStore.getComparisonBuilds())

// Calculate stats for each build
const buildStats = computed(() => {
  return builds.value.map(build => {
    const stats = calculateStats(build.champion, build.items, build.runes, build.shards, 18)
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

const isHighest = (buildId: string, statName: keyof CalculatedStats): boolean => {
  const comparison = getStatComparison(statName)
  const value = getStatValue(buildId, statName)
  return value === comparison.max && comparison.max !== comparison.min
}

const isLowest = (buildId: string, statName: keyof CalculatedStats): boolean => {
  const comparison = getStatComparison(statName)
  const value = getStatValue(buildId, statName)
  return value === comparison.min && comparison.max !== comparison.min
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

const getChampionImageUrl = (imageName: string): string => {
  return `https://ddragon.leagueoflegends.com/cdn/${version.value}/img/champion/${imageName}`
}

const getItemImageUrl = (imageName: string): string => {
  return `https://ddragon.leagueoflegends.com/cdn/${version.value}/img/item/${imageName}`
}

onMounted(() => {
  if (builds.value.length === 0) {
    // Redirect if no builds to compare
    router.push('/builds')
  }
})
</script>
