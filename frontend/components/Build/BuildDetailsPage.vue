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
            <button
              class="rounded-lg border-2 border-primary bg-surface px-4 py-2 text-sm font-semibold text-text transition-colors hover:bg-primary hover:text-white"
              @click="shareBuild"
            >
              Partager
            </button>
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

        <OutdatedBuildBanner
          v-if="build.gameVersion"
          :build-version="build.gameVersion"
          :storage-key="`build:${build.id}:${build.gameVersion}`"
          :on-update="updateToCurrentVersion"
        />

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

        <!-- Statistics Section -->
        <div class="mb-6 rounded-lg bg-surface p-6">
          <h2 class="mb-4 text-2xl font-bold text-text">Statistics</h2>
          <StatsDisplay />
        </div>
      </div>
    </div>

    <ShareBuildModal v-if="shareUrl" :share-url="shareUrl" @close="shareUrl = null" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useBuildStore } from '~/stores/BuildStore'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useVoteStore } from '~/stores/VoteStore'
import StatsDisplay from '~/components/Build/StatsDisplay.vue'
import { useGameVersion } from '~/composables/useGameVersion'
import ShareBuildModal from '~/components/Build/ShareBuildModal.vue'
import { apiUrl } from '~/utils/apiUrl'
import OutdatedBuildBanner from '~/components/Build/OutdatedBuildBanner.vue'
import { migrateBuildToCurrent } from '~/utils/migrateBuildToCurrent'

const props = defineProps<{ buildId: string }>()

const buildStore = useBuildStore()
const discoveryStore = useBuildDiscoveryStore()
const voteStore = useVoteStore()
const { version } = useGameVersion()

const loading = ref(true)
const error = ref<string | null>(null)
const build = computed(() => buildStore.currentBuild)
const shareUrl = ref<string | null>(null)

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

const addToComparison = () => {
  if (build.value) discoveryStore.addToComparison(build.value.id)
}

const getChampionImageUrl = (imageName: string): string => {
  return `https://ddragon.leagueoflegends.com/cdn/${version.value}/img/champion/${imageName}`
}

const getItemImageUrl = (imageName: string): string => {
  return `https://ddragon.leagueoflegends.com/cdn/${version.value}/img/item/${imageName}`
}

const shareBuild = async () => {
  if (!build.value) return
  try {
    const res = await fetch(apiUrl('/api/shared-builds'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(build.value),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Failed to share build')
    const id = data?.shareId as string
    shareUrl.value = `${window.location.origin}/builds/shared/${id}`
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to share build'
  }
}

const updateToCurrentVersion = async () => {
  if (!build.value) return
  try {
    const { migrated } = await migrateBuildToCurrent(build.value)
    const newId = buildStore.importBuild(migrated, { nameSuffix: ' (maj)' })
    if (newId) navigateTo(`/builds/edit/${newId}`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Migration failed'
  }
}

watch(
  () => props.buildId,
  id => {
    if (!id) return
    loading.value = true
    const ok = buildStore.loadBuild(id)
    if (!ok) error.value = 'Build not found'
    loading.value = false
  },
  { immediate: true }
)

onMounted(() => {
  voteStore.init()
})
</script>
