<template>
  <div
    class="build-card flex cursor-pointer flex-col rounded-lg border-2 border-primary bg-surface p-4 transition-all hover:border-accent hover:shadow-lg"
    @click="navigateToBuild"
  >
    <!-- Champion Header -->
    <div v-if="build.champion" class="mb-3 flex items-center gap-3">
      <img
        :src="getChampionImageUrl(build.champion.image.full)"
        :alt="build.champion.name"
        class="h-12 w-12 rounded"
      />
      <div class="flex-1">
        <h3 class="font-bold text-text">{{ build.champion.name }}</h3>
        <p class="text-text/70 text-xs">{{ build.champion.title }}</p>
      </div>
      <div v-if="build.gameVersion" class="text-text/50 text-xs">v{{ build.gameVersion }}</div>
    </div>

    <!-- Items Grid -->
    <div class="mb-3">
      <p class="text-text/70 mb-2 text-xs font-semibold">Items</p>
      <div class="grid grid-cols-6 gap-1">
        <div
          v-for="(item, index) in displayItems"
          :key="index"
          class="border-primary/30 bg-surface-dark relative aspect-square rounded border"
        >
          <img
            v-if="item"
            :src="getItemImageUrl(item.image.full)"
            :alt="item.name"
            class="h-full w-full rounded object-cover"
          />
          <div v-else class="text-text/30 flex h-full w-full items-center justify-center text-xs">
            -
          </div>
        </div>
      </div>
    </div>

    <!-- Runes Preview -->
    <div v-if="build.runes" class="mb-3">
      <p class="text-text/70 mb-2 text-xs font-semibold">Runes</p>
      <div class="flex items-center gap-2">
        <img
          v-if="primaryRunePath"
          :src="getRunePathImageUrl(primaryRunePath.icon)"
          :alt="primaryRunePath.name"
          class="h-6 w-6 rounded"
        />
        <span class="text-xs text-text">{{ primaryRunePath?.name || 'No runes' }}</span>
      </div>
    </div>

    <!-- Build Name and Meta -->
    <div class="border-primary/30 mt-auto flex items-center justify-between border-t pt-2">
      <div class="flex-1">
        <p class="text-sm font-semibold text-text">{{ build.name }}</p>
        <p class="text-text/50 text-xs">{{ formatDate(build.createdAt) }}</p>
      </div>
      <div class="flex items-center gap-2">
        <!-- Vote Button -->
        <button
          class="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors"
          :class="
            hasVoted
              ? 'bg-accent text-background hover:bg-accent-dark'
              : 'border border-primary bg-surface text-text hover:bg-primary hover:text-white'
          "
          :title="hasVoted ? 'Retirer votre vote' : 'Voter pour ce build'"
          @click.stop="toggleVote"
        >
          <span>👍</span>
          <span>{{ voteCount }}</span>
        </button>
        <button
          v-if="showAddToComparison"
          class="rounded bg-primary px-2 py-1 text-xs text-white transition-colors hover:bg-primary-dark"
          @click.stop="addToComparison"
        >
          Compare
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useRunesStore } from '~/stores/RunesStore'
import { useVoteStore } from '~/stores/VoteStore'
import type { Build } from '~/types/build'

interface Props {
  build: Build
  showAddToComparison?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showAddToComparison: true,
})

const discoveryStore = useBuildDiscoveryStore()
const runesStore = useRunesStore()
const voteStore = useVoteStore()

const displayItems = computed(() => {
  const items = [...props.build.items]
  // Fill empty slots
  while (items.length < 6) {
    items.push(null as any)
  }
  return items.slice(0, 6)
})

const primaryRunePath = computed(() => {
  if (!props.build.runes) return null
  return runesStore.getRunePathById(props.build.runes.primary.pathId)
})

const navigateToBuild = () => {
  useRouter().push(`/builds/view/${props.build.id}`)
}

const addToComparison = () => {
  discoveryStore.addToComparison(props.build.id)
}

const getChampionImageUrl = (imageName: string): string => {
  return `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${imageName}`
}

const getItemImageUrl = (imageName: string): string => {
  return `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/item/${imageName}`
}

const getRunePathImageUrl = (icon: string): string => {
  return `https://ddragon.leagueoflegends.com/cdn/img/${icon}`
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString()
}

const voteCount = computed(() => voteStore.getVoteCount(props.build.id))
const hasVoted = computed(() => voteStore.hasUserVoted(props.build.id))

const toggleVote = () => {
  if (hasVoted.value) {
    voteStore.unvote(props.build.id)
  } else {
    voteStore.vote(props.build.id)
  }
}

onMounted(() => {
  voteStore.init()
})
</script>
