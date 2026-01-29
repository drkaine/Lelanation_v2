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
            <!-- Vote Button (désactivé pour les builds de l'utilisateur) -->
            <button
              v-if="!isUserBuild"
              class="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
              :class="
                hasVoted
                  ? 'bg-accent text-background hover:bg-accent-dark'
                  : 'border-2 border-primary bg-surface text-text hover:bg-primary hover:text-white'
              "
              :title="hasVoted ? 'Retirer votre vote' : 'Voter pour ce build'"
              @click="toggleVote"
            >
              <span>👍</span>
              <span>{{ voteCount }}</span>
            </button>
            <button
              class="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-background transition-colors hover:bg-accent-dark"
              @click="addToComparison"
            >
              Comparer
            </button>
          </div>
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
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useVoteStore } from '~/stores/VoteStore'
import BuildCard from '~/components/Build/BuildCard.vue'
import ShareBuildModal from '~/components/Build/ShareBuildModal.vue'
import { apiUrl } from '~/utils/apiUrl'
import OutdatedBuildBanner from '~/components/Build/OutdatedBuildBanner.vue'
import { migrateBuildToCurrent } from '~/utils/migrateBuildToCurrent'

const props = defineProps<{ buildId: string }>()

const buildStore = useBuildStore()
const discoveryStore = useBuildDiscoveryStore()
const voteStore = useVoteStore()

const loading = ref(true)
const error = ref<string | null>(null)
const build = computed(() => buildStore.currentBuild)
const shareUrl = ref<string | null>(null)

const voteCount = computed(() => (build.value ? voteStore.getVoteCount(build.value.id) : 0))
const hasVoted = computed(() => (build.value ? voteStore.hasUserVoted(build.value.id) : false))
const isUserBuild = computed(() => {
  if (!build.value) return false
  const savedBuilds = buildStore.getSavedBuilds()
  return savedBuilds.some(b => b.id === build.value!.id)
})

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
