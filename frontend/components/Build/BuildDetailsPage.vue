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

      <div v-else-if="build" class="flex flex-col items-center gap-6">
        <!-- Header avec actions -->
        <div class="flex w-full max-w-[300px] items-center justify-between">
          <NuxtLink
            to="/builds"
            class="rounded bg-surface px-4 py-2 text-text hover:bg-primary hover:text-white"
          >
            ← Retour
          </NuxtLink>
          <div class="flex items-center gap-2">
            <button
              class="rounded-lg border-2 border-primary bg-surface px-3 py-1.5 text-xs font-semibold text-text transition-colors hover:bg-primary hover:text-white"
              @click="shareBuild"
            >
              Partager
            </button>
          </div>
        </div>

        <!-- Boutons de vote (en bas) -->
        <div v-if="!isUserBuild && build" class="flex items-center gap-3">
          <!-- Bouton Upvote -->
          <button
            class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
            :class="
              userVote === 'up'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'border-2 border-green-600 bg-surface text-green-600 hover:bg-green-50'
            "
            :title="userVote === 'up' ? 'Retirer votre upvote' : 'Upvoter ce build'"
            @click="handleUpvote"
          >
            <span>👍</span>
            <span>{{ upvoteCount }}</span>
          </button>

          <!-- Bouton Downvote -->
          <button
            class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
            :class="
              userVote === 'down'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'border-2 border-red-600 bg-surface text-red-600 hover:bg-red-50'
            "
            :title="userVote === 'down' ? 'Retirer votre downvote' : 'Downvoter ce build'"
            @click="handleDownvote"
          >
            <span>👎</span>
            <span>{{ downvoteCount }}</span>
          </button>
        </div>

        <OutdatedBuildBanner
          v-if="build.gameVersion"
          :build-version="build.gameVersion"
          :storage-key="`build:${build.id}:${build.gameVersion}`"
          :on-update="updateToCurrentVersion"
        />

        <!-- BuildCard Sheet -->
        <div class="flex flex-col items-center gap-4">
          <BuildCard :build="build" :readonly="true" />

          <!-- Informations du build (auteur et description) -->
          <div class="w-full max-w-[300px] space-y-2">
            <!-- Auteur -->
            <div v-if="build.author" class="text-sm text-text/70">
              <span class="font-semibold">Auteur:</span>
              <span class="ml-1">{{ build.author }}</span>
            </div>

            <!-- Description -->
            <div v-if="build.description" class="text-sm text-text/80">
              <p class="whitespace-pre-wrap">{{ build.description }}</p>
            </div>

            <!-- Date de création -->
            <p class="text-xs text-text/50">Créé le : {{ formatDate(build.createdAt) }}</p>
          </div>
        </div>
      </div>
    </div>

    <ShareBuildModal v-if="shareUrl" :share-url="shareUrl" @close="shareUrl = null" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useBuildStore } from '~/stores/BuildStore'
import { useVoteStore } from '~/stores/VoteStore'
import BuildCard from '~/components/Build/BuildCard.vue'
import ShareBuildModal from '~/components/Build/ShareBuildModal.vue'
import { apiUrl } from '~/utils/apiUrl'
import OutdatedBuildBanner from '~/components/Build/OutdatedBuildBanner.vue'
import { migrateBuildToCurrent } from '~/utils/migrateBuildToCurrent'

const props = defineProps<{ buildId: string }>()

const buildStore = useBuildStore()
const voteStore = useVoteStore()

const loading = ref(true)
const error = ref<string | null>(null)
const build = computed(() => buildStore.currentBuild)
const shareUrl = ref<string | null>(null)

const upvoteCount = computed(() => (build.value ? voteStore.getUpvoteCount(build.value.id) : 0))
const downvoteCount = computed(() => (build.value ? voteStore.getDownvoteCount(build.value.id) : 0))
const userVote = computed(() => (build.value ? voteStore.getUserVote(build.value.id) : null))
const isUserBuild = computed(() => {
  if (!build.value) return false
  const savedBuilds = buildStore.getSavedBuilds()
  return savedBuilds.some(b => b.id === build.value!.id)
})

const handleUpvote = async () => {
  if (!build.value) return
  voteStore.upvote(build.value.id)
  await buildStore.checkAndUpdateVisibility()
}

const handleDownvote = async () => {
  if (!build.value) return
  voteStore.downvote(build.value.id)
  await buildStore.checkAndUpdateVisibility()
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
  async id => {
    if (!id) return
    loading.value = true
    error.value = null

    // Essayer d'abord de charger depuis le localStorage
    const ok = buildStore.loadBuild(id)
    if (ok) {
      loading.value = false
      return
    }

    // Si pas trouvé localement, charger depuis l'API
    try {
      const { apiUrl } = await import('~/utils/apiUrl')
      const response = await fetch(apiUrl(`/api/builds/${encodeURIComponent(id)}`))
      if (response.ok) {
        const buildData = await response.json()
        buildStore.setCurrentBuild(buildData)
      } else {
        error.value = 'Build not found'
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load build'
    } finally {
      loading.value = false
    }
  },
  { immediate: true }
)

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

onMounted(() => {
  voteStore.init()
})
</script>
