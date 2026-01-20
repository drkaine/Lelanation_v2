<template>
  <div class="build-details min-h-screen p-4 text-text">
    <div class="mx-auto max-w-6xl">
      <div v-if="loading" class="py-12 text-center">
        <p class="text-text">Loading build...</p>
      </div>

      <div v-else-if="error" class="py-12 text-center">
        <p class="text-error">{{ error }}</p>
        <NuxtLink
          to="/builds"
          class="mt-4 inline-block rounded bg-primary px-6 py-2 text-white hover:bg-primary-dark"
        >
          Back to Builds
        </NuxtLink>
      </div>

      <div v-else-if="build">
        <!-- Header -->
        <div class="mb-6 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <NuxtLink
              to="/builds"
              class="rounded bg-surface px-4 py-2 text-text hover:bg-primary hover:text-white"
            >
              ← Back
            </NuxtLink>
            <h1 class="text-3xl font-bold text-text">{{ build.name }}</h1>
          </div>
          <div class="flex items-center gap-3">
            <!-- Vote Button -->
            <button
              class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
              :class="
                hasVoted
                  ? 'bg-accent text-background hover:bg-accent-dark'
                  : 'border-2 border-primary bg-surface text-text hover:bg-primary hover:text-white'
              "
              :title="hasVoted ? 'Retirer votre vote' : 'Voter pour ce build'"
              @click="toggleVote"
            >
              <span>👍</span>
              <span>{{ voteCount }} vote{{ voteCount !== 1 ? 's' : '' }}</span>
            </button>
            <button
              class="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent-dark"
              @click="addToComparison"
            >
              Ajouter à la comparaison
            </button>
          </div>
        </div>

        <!-- Champion Section -->
        <div v-if="build.champion" class="mb-6 rounded-lg bg-surface p-6">
          <h2 class="mb-4 text-2xl font-bold text-text">Champion</h2>
          <div class="flex items-center gap-4">
            <img
              :src="getChampionImageUrl(build.champion.image.full)"
              :alt="build.champion.name"
              class="h-24 w-24 rounded"
            />
            <div>
              <h3 class="text-xl font-bold text-text">{{ build.champion.name }}</h3>
              <p class="text-text/70">{{ build.champion.title }}</p>
              <div class="mt-2 flex gap-2">
                <span
                  v-for="tag in build.champion.tags"
                  :key="tag"
                  class="bg-primary/20 rounded px-2 py-1 text-xs text-text"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Items Section -->
        <div class="mb-6 rounded-lg bg-surface p-6">
          <h2 class="mb-4 text-2xl font-bold text-text">Items</h2>
          <div class="grid grid-cols-3 gap-4 sm:grid-cols-6">
            <div
              v-for="(item, index) in build.items"
              :key="index"
              class="flex flex-col items-center rounded border border-primary p-3"
            >
              <img
                :src="getItemImageUrl(item.image.full)"
                :alt="item.name"
                class="mb-2 h-16 w-16 rounded"
              />
              <p class="text-center text-sm text-text">{{ item.name }}</p>
            </div>
          </div>
        </div>

        <!-- Runes Section -->
        <div v-if="build.runes" class="mb-6 rounded-lg bg-surface p-6">
          <h2 class="mb-4 text-2xl font-bold text-text">Runes</h2>
          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <!-- Primary Runes -->
            <div>
              <h3 class="mb-3 text-lg font-semibold text-text">Primary</h3>
              <div v-if="primaryRunePath" class="flex items-center gap-3">
                <img
                  :src="getRunePathImageUrl(primaryRunePath.icon)"
                  :alt="primaryRunePath.name"
                  class="h-12 w-12 rounded"
                />
                <span class="font-semibold text-text">{{ primaryRunePath.name }}</span>
              </div>
            </div>

            <!-- Secondary Runes -->
            <div>
              <h3 class="mb-3 text-lg font-semibold text-text">Secondary</h3>
              <div v-if="secondaryRunePath" class="flex items-center gap-3">
                <img
                  :src="getRunePathImageUrl(secondaryRunePath.icon)"
                  :alt="secondaryRunePath.name"
                  class="h-12 w-12 rounded"
                />
                <span class="font-semibold text-text">{{ secondaryRunePath.name }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Summoner Spells Section -->
        <div v-if="build.summonerSpells" class="mb-6 rounded-lg bg-surface p-6">
          <h2 class="mb-4 text-2xl font-bold text-text">Summoner Spells</h2>
          <div class="flex gap-4">
            <div
              v-for="(spell, index) in validSummonerSpells"
              :key="index"
              class="flex flex-col items-center rounded border border-primary p-3"
            >
              <img
                :src="getSpellImageUrl(spell.image.full)"
                :alt="spell.name"
                class="mb-2 h-16 w-16 rounded"
              />
              <p class="text-center text-sm text-text">{{ spell.name }}</p>
            </div>
          </div>
        </div>

        <!-- Skill Order Section -->
        <div v-if="build.skillOrder" class="mb-6 rounded-lg bg-surface p-6">
          <h2 class="mb-4 text-2xl font-bold text-text">Skill Order</h2>
          <div class="grid grid-cols-9 gap-2">
            <div
              v-for="level in 18"
              :key="level"
              class="flex flex-col items-center rounded border border-primary p-2"
            >
              <span class="text-text/70 mb-1 text-xs">L{{ level }}</span>
              <span
                :class="getSkillColor(getSkillForLevel(level))"
                class="flex h-8 w-8 items-center justify-center rounded font-bold"
              >
                {{ getSkillForLevel(level) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Statistics Section -->
        <div class="mb-6 rounded-lg bg-surface p-6">
          <h2 class="mb-4 text-2xl font-bold text-text">Statistics</h2>
          <StatsDisplay />
        </div>

        <!-- Meta Information -->
        <div class="rounded-lg bg-surface p-6">
          <h2 class="mb-4 text-2xl font-bold text-text">Build Information</h2>
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p class="text-text/70">Created:</p>
              <p class="font-semibold text-text">{{ formatDate(build.createdAt) }}</p>
            </div>
            <div>
              <p class="text-text/70">Last Updated:</p>
              <p class="font-semibold text-text">{{ formatDate(build.updatedAt) }}</p>
            </div>
            <div>
              <p class="text-text/70">Game Version:</p>
              <p class="font-semibold text-text">{{ build.gameVersion || 'Unknown' }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useBuildStore } from '~/stores/BuildStore'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useRunesStore } from '~/stores/RunesStore'
import { useVoteStore } from '~/stores/VoteStore'
import StatsDisplay from '~/components/Build/StatsDisplay.vue'
import type { SkillOrder } from '~/types/build'
import { useGameVersion } from '~/composables/useGameVersion'

const route = useRoute()
const buildStore = useBuildStore()
const discoveryStore = useBuildDiscoveryStore()
const voteStore = useVoteStore()
const runesStore = useRunesStore()
const { version } = useGameVersion()

const loading = ref(true)
const error = ref<string | null>(null)
const build = computed(() => buildStore.currentBuild)

const primaryRunePath = computed(() => {
  if (!build.value?.runes) return null
  return runesStore.getRunePathById(build.value.runes.primary.pathId)
})

const secondaryRunePath = computed(() => {
  if (!build.value?.runes) return null
  return runesStore.getRunePathById(build.value.runes.secondary.pathId)
})

const validSummonerSpells = computed(() => {
  if (!build.value?.summonerSpells) return []
  return build.value.summonerSpells.filter(spell => spell !== null)
})

const getSkillForLevel = (level: number): 'Q' | 'W' | 'E' | 'R' | null => {
  if (!build.value?.skillOrder) return null
  const levelKey = `level${level}` as keyof SkillOrder
  return build.value.skillOrder[levelKey] || null
}

const getSkillColor = (ability: string | null): string => {
  if (!ability) return 'bg-surface text-text'
  const colors = {
    Q: 'bg-blue-500 text-white',
    W: 'bg-green-500 text-white',
    E: 'bg-yellow-500 text-white',
    R: 'bg-red-500 text-white',
  }
  return colors[ability as keyof typeof colors] || 'bg-surface text-text'
}

const addToComparison = () => {
  if (build.value) {
    discoveryStore.addToComparison(build.value.id)
    // Navigate to comparison page or show notification
  }
}

const getChampionImageUrl = (imageName: string): string => {
  return `https://ddragon.leagueoflegends.com/cdn/${version.value}/img/champion/${imageName}`
}

const getItemImageUrl = (imageName: string): string => {
  return `https://ddragon.leagueoflegends.com/cdn/${version.value}/img/item/${imageName}`
}

const getRunePathImageUrl = (icon: string): string => {
  return `https://ddragon.leagueoflegends.com/cdn/img/${icon}`
}

const getSpellImageUrl = (imageName: string): string => {
  return `https://ddragon.leagueoflegends.com/cdn/${version.value}/img/spell/${imageName}`
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString()
}

const voteCount = computed(() => (build.value ? voteStore.getVoteCount(build.value.id) : 0))
const hasVoted = computed(() => (build.value ? voteStore.hasUserVoted(build.value.id) : false))

const toggleVote = () => {
  if (!build.value) return
  if (hasVoted.value) {
    voteStore.unvote(build.value.id)
  } else {
    voteStore.vote(build.value.id)
  }
}

onMounted(() => {
  voteStore.init()
  const buildId = route.params.id as string
  if (buildId) {
    loading.value = true
    const success = buildStore.loadBuild(buildId)
    if (!success) {
      error.value = 'Build not found'
    }
    loading.value = false
  } else {
    error.value = 'No build ID provided'
    loading.value = false
  }

  // Load runes if needed
  if (runesStore.runePaths.length === 0) {
    runesStore.loadRunes()
  }
})
</script>
