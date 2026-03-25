<template>
  <div
    class="build-card flex cursor-pointer flex-col rounded-lg border-2 border-accent/70 bg-surface p-4 transition-all hover:border-accent hover:shadow-lg"
    @click="navigateToBuild"
  >
    <!-- Champion Header -->
    <div v-if="build.champion" class="mb-3 flex items-center gap-3">
      <img
        :src="championImageSrc"
        :alt="build.champion.name"
        :class="['h-12 w-12 object-cover', championSplashEnabled ? '' : 'rounded']"
      />
      <div class="flex-1">
        <h3 class="font-bold text-text">{{ build.champion.name }}</h3>
        <p class="text-xs text-text/70">{{ build.champion.title }}</p>
      </div>
      <div v-if="build.gameVersion" class="text-xs text-text/50">v{{ build.gameVersion }}</div>
    </div>

    <!-- Items Grid -->
    <div class="mb-3">
      <p class="mb-2 text-xs font-semibold text-text/70">Items</p>
      <div class="grid grid-cols-6 gap-1">
        <div
          v-for="(item, index) in displayItems"
          :key="index"
          class="bg-surface-dark relative aspect-square rounded border border-primary/30"
        >
          <img
            v-if="item"
            :src="getItemImageUrl(version, item.image.full)"
            :alt="item.name"
            class="h-full w-full rounded object-cover"
          />
          <div v-else class="flex h-full w-full items-center justify-center text-xs text-text/30">
            -
          </div>
        </div>
      </div>
    </div>

    <!-- Runes Preview -->
    <div v-if="build.runes" class="mb-3">
      <p class="mb-2 text-xs font-semibold text-text/70">Runes</p>
      <div class="flex items-center gap-2">
        <div
          v-if="primaryRunePath"
          class="h-6 w-6 rounded-full"
          role="img"
          :aria-label="primaryRunePath.name"
        >
          <span
            class="block h-full w-full"
            :style="{
              backgroundColor: getRunePathColor(
                primaryRunePath.icon,
                primaryRunePath.id,
                primaryRunePath.name
              ),
              WebkitMaskImage: `url(${getRunePathImageUrl(version, primaryRunePath.icon, primaryRunePath.id, primaryRunePath.name)})`,
              maskImage: `url(${getRunePathImageUrl(version, primaryRunePath.icon, primaryRunePath.id, primaryRunePath.name)})`,
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              maskPosition: 'center',
            }"
          />
        </div>
        <span class="text-xs text-text">{{ primaryRunePath?.name || 'No runes' }}</span>
      </div>
    </div>

    <!-- Build Name and Meta -->
    <div class="mt-auto flex items-center justify-between border-t border-primary/30 pt-2">
      <div class="flex-1">
        <p class="text-sm font-semibold text-text">{{ build.name }}</p>
        <p v-if="hydrated" class="text-xs text-text/50">{{ formatDate(build.createdAt) }}</p>
      </div>
      <div class="flex items-center gap-2">
        <!-- Vote Button -->
        <button
          class="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors"
          :class="
            hasVoted
              ? 'bg-accent text-background hover:bg-accent-dark'
              : 'border border-accent/70 bg-surface text-text hover:bg-accent/10'
          "
          :title="hasVoted ? 'Retirer votre vote' : 'Voter pour ce build'"
          @click.stop="toggleVote"
        >
          <span>👍</span>
          <span>{{ voteCount }}</span>
        </button>
        <button
          v-if="showAddToComparison"
          class="rounded border border-accent/70 bg-surface px-2 py-1 text-xs text-text transition-colors hover:bg-accent/10"
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
import { useGameVersion } from '~/composables/useGameVersion'
import {
  getChampionImageUrl,
  getChampionSplashImageUrl,
  getItemImageUrl,
  getRunePathColor,
  getRunePathImageUrl,
} from '~/utils/imageUrl'
import { useClientHydrated } from '~/composables/useClientHydrated'
import { useChampionSplashPreference } from '~/composables/useChampionSplashPreference'

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
const router = useRouter()
const { version } = useGameVersion()
const { hydrated } = useClientHydrated()
const { championSplashEnabled } = useChampionSplashPreference()

const championImageSrc = computed(() => {
  const champion = props.build.champion
  if (!champion) return ''
  if (championSplashEnabled.value) {
    return getChampionSplashImageUrl(version.value, champion.id)
  }
  return getChampionImageUrl(version.value, champion.image.full)
})

const displayItems = computed(() => {
  const items: Array<(typeof props.build.items)[number] | null> = [...props.build.items]
  while (items.length < 6) items.push(null)
  return items.slice(0, 6)
})

const primaryRunePath = computed(() => {
  if (!props.build.runes) return null
  return runesStore.getRunePathById(props.build.runes.primary.pathId)
})

const navigateToBuild = () => {
  router.push(`/builds/${props.build.id}`)
}

const addToComparison = () => {
  discoveryStore.addToComparison(props.build.id)
}

const formatDate = (dateString: string): string => {
  if (!hydrated.value) return ''
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
