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
            <!-- Vote Button (désactivé pour les builds de l'utilisateur) -->
            <button
              v-if="!isUserBuild(build.id)"
              class="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors"
              :class="
                hasVoted(build.id)
                  ? 'bg-accent text-background hover:bg-accent-dark'
                  : 'border border-accent/70 bg-surface text-text hover:bg-accent/10'
              "
              :title="hasVoted(build.id) ? 'Retirer votre vote' : 'Voter pour ce build'"
              @click.stop="toggleVote(build.id)"
            >
              <span>👍</span>
              <span>{{ getVoteCount(build.id) }}</span>
            </button>
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

interface Props {
  showComparisonButtons?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showComparisonButtons: true,
})

const discoveryStore = useBuildDiscoveryStore()
const buildStore = useBuildStore()
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

const getVoteCount = (buildId: string): number => {
  return voteStore.getVoteCount(buildId)
}

const hasVoted = (buildId: string): boolean => {
  return voteStore.hasUserVoted(buildId)
}

const toggleVote = (buildId: string) => {
  if (hasVoted(buildId)) {
    voteStore.unvote(buildId)
  } else {
    voteStore.vote(buildId)
  }
}

const isUserBuild = (buildId: string): boolean => {
  const savedBuilds = buildStore.getSavedBuilds()
  return savedBuilds.some(b => b.id === buildId)
}
</script>
