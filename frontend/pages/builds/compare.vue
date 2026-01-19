<template>
  <div class="build-comparison min-h-screen p-4 text-text">
    <div class="mx-auto max-w-7xl">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-3xl font-bold text-text">Compare Builds</h1>
        <NuxtLink
          to="/builds/discover"
          class="rounded bg-surface px-4 py-2 text-text hover:bg-primary hover:text-white"
        >
          Back to Discovery
        </NuxtLink>
      </div>

      <div v-if="builds.length === 0" class="py-12 text-center">
        <p class="text-lg text-text">No builds selected for comparison</p>
        <NuxtLink
          to="/builds/discover"
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
              <p class="text-text/70 mb-2 text-xs font-semibold">Key Stats</p>
              <div class="space-y-1 text-xs">
                <div class="flex justify-between">
                  <span class="text-text/70">AD:</span>
                  <span class="font-semibold text-text">{{ getStat(build, 'attackDamage') }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-text/70">AP:</span>
                  <span class="font-semibold text-text">{{ getStat(build, 'abilityPower') }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-text/70">Health:</span>
                  <span class="font-semibold text-text">{{ getStat(build, 'health') }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-text/70">Armor:</span>
                  <span class="font-semibold text-text">{{ getStat(build, 'armor') }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-text/70">MR:</span>
                  <span class="font-semibold text-text">{{ getStat(build, 'magicResist') }}</span>
                </div>
              </div>
            </div>

            <!-- View Details Link -->
            <NuxtLink
              :to="`/builds/view/${build.id}`"
              class="block rounded bg-primary px-3 py-2 text-center text-sm text-white hover:bg-primary-dark"
            >
              View Details
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
import type { CalculatedStats } from '~/types/build'

const discoveryStore = useBuildDiscoveryStore()

const builds = computed(() => discoveryStore.getComparisonBuilds())

const removeFromComparison = (buildId: string) => {
  discoveryStore.removeFromComparison(buildId)
}

const getStat = (_build: unknown, statName: keyof CalculatedStats): string => {
  // TODO: Calculate stats for comparison builds
  // For now, return placeholder values
  // In a full implementation, we'd calculate stats for each build
  const placeholderValues: Record<keyof CalculatedStats, number> = {
    health: 2000,
    mana: 1000,
    attackDamage: 100,
    abilityPower: 0,
    armor: 50,
    magicResist: 50,
    attackSpeed: 1.0,
    critChance: 0,
    critDamage: 1.75,
    lifeSteal: 0,
    spellVamp: 0,
    cooldownReduction: 0,
    movementSpeed: 350,
    healthRegen: 5,
    manaRegen: 5,
    armorPenetration: 0,
    magicPenetration: 0,
    tenacity: 0,
  }

  const value = placeholderValues[statName] || 0

  if (statName === 'attackDamage' || statName === 'abilityPower' || statName === 'health') {
    return Math.round(value).toString()
  }
  return value.toFixed(1)
}

const getChampionImageUrl = (imageName: string): string => {
  return `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${imageName}`
}

const getItemImageUrl = (imageName: string): string => {
  return `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/item/${imageName}`
}

onMounted(() => {
  if (builds.value.length === 0) {
    // Redirect if no builds to compare
    useRouter().push('/builds/discover')
  }
})
</script>
