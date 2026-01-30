<template>
  <div class="build-shared min-h-screen p-4 text-text">
    <div class="mx-auto max-w-6xl">
      <div v-if="loading" class="py-12 text-center">
        <p class="text-text">Chargement…</p>
      </div>

      <div v-else-if="error" class="py-12 text-center">
        <p class="text-error">{{ error }}</p>
        <NuxtLink
          :to="localePath('/builds')"
          class="mt-4 inline-block rounded bg-primary px-6 py-2 text-white hover:bg-primary-dark"
        >
          Retour aux builds
        </NuxtLink>
      </div>

      <div v-else-if="build" class="flex flex-col items-center gap-6">
        <!-- Bouton retour et actions -->
        <div class="flex w-full max-w-[300px] items-center justify-between">
          <NuxtLink
            :to="localePath('/builds')"
            class="rounded bg-surface px-4 py-2 text-text hover:bg-primary hover:text-white"
          >
            ← Retour
          </NuxtLink>
          <button
            class="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent-dark"
            @click="copyBuild"
          >
            Copier ce build
          </button>
        </div>

        <OutdatedBuildBanner
          v-if="build.gameVersion"
          :build-version="build.gameVersion"
          :storage-key="`shared:${route.params.id}:${build.gameVersion}`"
          :on-update="updateToCurrentVersion"
        />

        <div
          v-if="copied"
          class="mb-6 rounded-lg border border-success bg-surface p-3 text-sm text-success"
        >
          Build copié. Redirection vers l'éditeur…
        </div>

        <!-- BuildCard Sheet -->
        <div class="flex flex-col items-center gap-4">
          <BuildCard :build="build" :readonly="true" />

          <!-- Informations du build (auteur et description) -->
          <div class="w-full max-w-[300px] space-y-2">
            <!-- Auteur -->
            <div class="text-sm text-text/70">
              <span class="ml-1">{{ build.author }}</span>
            </div>

            <!-- Description -->
            <div v-if="build.description" class="text-sm text-text/80">
              <p
                v-if="build.description.length <= 150 || isDescriptionExpanded"
                class="whitespace-pre-wrap"
              >
                {{ build.description }}
              </p>
              <p v-else class="line-clamp-3 whitespace-pre-wrap">
                {{ build.description }}
              </p>
              <button
                v-if="build.description.length > 150"
                class="mt-1 text-xs text-accent hover:text-accent/80"
                @click="isDescriptionExpanded = !isDescriptionExpanded"
              >
                {{ isDescriptionExpanded ? 'Voir moins' : 'Voir plus' }}
              </button>
            </div>

            <!-- Date de création -->
            <p class="text-xs text-text/50">Créé le : {{ formatDate(build.createdAt) }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBuildStore } from '~/stores/BuildStore'
import BuildCard from '~/components/Build/BuildCard.vue'
import { apiUrl } from '~/utils/apiUrl'
import type { Build } from '~/types/build'
import OutdatedBuildBanner from '~/components/Build/OutdatedBuildBanner.vue'
import { migrateBuildToCurrent } from '~/utils/migrateBuildToCurrent'

const route = useRoute()
const router = useRouter()
const buildStore = useBuildStore()
const localePath = useLocalePath()

const loading = ref(true)
const error = ref<string | null>(null)
const copied = ref(false)
const isDescriptionExpanded = ref(false)

const build = computed(() => buildStore.currentBuild)

const copyBuild = () => {
  if (!build.value) return
  const newId = buildStore.importBuild(build.value)
  if (!newId) return
  copied.value = true
  setTimeout(() => {
    router.push(`/builds/edit/${newId}`)
  }, 600)
}

const updateToCurrentVersion = async () => {
  if (!build.value) return
  const { migrated } = await migrateBuildToCurrent(build.value)
  const newId = buildStore.importBuild(migrated, { nameSuffix: ' (maj)' })
  if (!newId) return
  copied.value = true
  setTimeout(() => {
    router.push(`/builds/edit/${newId}`)
  }, 600)
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

onMounted(async () => {
  const shareId = route.params.id as string
  if (!shareId) {
    error.value = 'Lien invalide'
    loading.value = false
    return
  }

  try {
    loading.value = true
    const res = await fetch(apiUrl(`/api/shared-builds/${encodeURIComponent(shareId)}`))
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Build introuvable')

    const sharedBuild = data?.build as Build | undefined
    if (!sharedBuild) throw new Error('Build introuvable')

    buildStore.setCurrentBuild(sharedBuild)
    loading.value = false
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Build introuvable'
    loading.value = false
  }
})
</script>
