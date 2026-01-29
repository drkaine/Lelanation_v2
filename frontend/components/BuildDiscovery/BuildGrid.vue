<template>
  <div class="build-grid">
    <div v-if="builds.length === 0" class="py-12 text-center">
      <p class="text-lg text-text">Aucun build trouvé</p>
      <p class="mt-2 text-sm text-text/70">
        {{ hasActiveFilters ? 'Essayez d’ajuster vos filtres' : 'Créez votre premier build !' }}
      </p>
      <NuxtLink
        v-if="!hasActiveFilters"
        to="/builds/create"
        class="mt-4 inline-block rounded bg-accent px-6 py-2 text-background hover:bg-accent-dark"
      >
        Créer un Build
      </NuxtLink>
    </div>

    <div v-else class="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      <div v-for="build in builds" :key="build.id" class="flex flex-col items-center gap-4">
        <!-- BuildCard Sheet -->
        <div class="relative cursor-pointer" @click="navigateToBuild(build.id)">
          <BuildCard :build="build" :readonly="true" />
        </div>

        <!-- Informations du build (auteur et description) -->
        <div class="w-full max-w-[300px] space-y-2">
          <div class="flex items-center justify-end gap-2">
            <!-- Boutons de vote (désactivés pour les builds de l'utilisateur) -->
            <div v-if="!isUserBuild(build.id)" class="flex items-center gap-1">
              <!-- Bouton Upvote -->
              <button
                class="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors"
                :class="
                  getUserVote(build.id) === 'up'
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'border border-green-600 bg-surface text-green-600 hover:bg-green-50'
                "
                :title="
                  getUserVote(build.id) === 'up' ? 'Retirer votre upvote' : 'Upvoter ce build'
                "
                @click.stop="handleUpvote(build.id)"
              >
                <span>👍</span>
                <span>{{ getUpvoteCount(build.id) }}</span>
              </button>
              <!-- Bouton Downvote -->
              <button
                class="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors"
                :class="
                  getUserVote(build.id) === 'down'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'border border-red-600 bg-surface text-red-600 hover:bg-red-50'
                "
                :title="
                  getUserVote(build.id) === 'down' ? 'Retirer votre downvote' : 'Downvoter ce build'
                "
                @click.stop="handleDownvote(build.id)"
              >
                <span>👎</span>
                <span>{{ getDownvoteCount(build.id) }}</span>
              </button>
            </div>
            <button
              v-if="props.showComparisonButtons"
              class="rounded border border-accent/70 bg-surface px-2 py-1 text-xs text-text transition-colors hover:bg-accent/10"
              @click.stop="addToComparison(build.id)"
            >
              Comparer
            </button>
          </div>

          <!-- Auteur -->
          <div v-if="build.author" class="text-sm text-text/70">
            <span class="font-semibold">Auteur:</span>
            <span class="ml-1">{{ build.author }}</span>
          </div>

          <!-- Description -->
          <div v-if="build.description" class="text-sm text-text/80">
            <p class="line-clamp-3">{{ build.description }}</p>
          </div>

          <!-- Date de création -->
          <p class="text-xs text-text/50">Créé le : {{ formatDate(build.createdAt) }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import BuildCard from '~/components/Build/BuildCard.vue'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useBuildStore } from '~/stores/BuildStore'
import { useVoteStore } from '~/stores/VoteStore'

const buildStore = useBuildStore()

interface Props {
  showComparisonButtons?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showComparisonButtons: true,
})

const discoveryStore = useBuildDiscoveryStore()
const voteStore = useVoteStore()
const router = useRouter()

const builds = computed(() => discoveryStore.filteredBuilds)
const hasActiveFilters = computed(() => discoveryStore.hasActiveFilters)

const navigateToBuild = (buildId: string) => {
  router.push(`/builds/${buildId}`)
}

const addToComparison = (buildId: string) => {
  discoveryStore.addToComparison(buildId)
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const getUpvoteCount = (buildId: string): number => {
  return voteStore.getUpvoteCount(buildId)
}

const getDownvoteCount = (buildId: string): number => {
  return voteStore.getDownvoteCount(buildId)
}

const getUserVote = (buildId: string): 'up' | 'down' | null => {
  return voteStore.getUserVote(buildId)
}

const handleUpvote = async (buildId: string) => {
  voteStore.upvote(buildId)
  const build = discoveryStore.builds.find(b => b.id === buildId)
  if (build) {
    buildStore.setCurrentBuild(build)
    await buildStore.checkAndUpdateVisibility()
  }
}

const handleDownvote = async (buildId: string) => {
  voteStore.downvote(buildId)
  const build = discoveryStore.builds.find(b => b.id === buildId)
  if (build) {
    buildStore.setCurrentBuild(build)
    await buildStore.checkAndUpdateVisibility()
  }
}

const isUserBuild = (buildId: string): boolean => {
  const savedBuilds = buildStore.getSavedBuilds()
  return savedBuilds.some(b => b.id === buildId)
}
</script>
