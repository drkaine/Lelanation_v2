<template>
  <div class="build-shared min-h-screen p-4 text-text">
    <div class="mx-auto max-w-6xl">
      <div v-if="loading" class="py-12 text-center">
        <p class="text-text">Chargement…</p>
      </div>

      <div v-else-if="error" class="py-12 text-center">
        <p class="text-error">{{ error }}</p>
        <NuxtLink
          to="/builds"
          class="mt-4 inline-block rounded bg-primary px-6 py-2 text-white hover:bg-primary-dark"
        >
          Retour aux builds
        </NuxtLink>
      </div>

      <div v-else-if="build">
        <div class="mb-6 flex items-center justify-between gap-3">
          <div class="flex items-center gap-4">
            <NuxtLink
              to="/builds"
              class="rounded bg-surface px-4 py-2 text-text hover:bg-primary hover:text-white"
            >
              ← Back
            </NuxtLink>
            <div>
              <h1 class="text-3xl font-bold text-text">{{ build.name }}</h1>
              <p class="text-text/70 mt-1 text-sm">Build partagé</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent-dark"
              @click="copyBuild"
            >
              Copier ce build
            </button>
          </div>
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
          Build copié. Redirection vers l’éditeur…
        </div>

        <!-- Reuse existing view layout (simplified) -->
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
            </div>
          </div>
        </div>

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

        <div class="mb-6 rounded-lg bg-surface p-6">
          <h2 class="mb-4 text-2xl font-bold text-text">Statistiques</h2>
          <StatsDisplay />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBuildStore } from '~/stores/BuildStore'
import StatsDisplay from '~/components/Build/StatsDisplay.vue'
import { apiUrl } from '~/utils/apiUrl'
import type { Build } from '~/types/build'
import { useGameVersion } from '~/composables/useGameVersion'
import OutdatedBuildBanner from '~/components/Build/OutdatedBuildBanner.vue'
import { migrateBuildToCurrent } from '~/utils/migrateBuildToCurrent'

const route = useRoute()
const router = useRouter()
const buildStore = useBuildStore()
const { version } = useGameVersion()

const loading = ref(true)
const error = ref<string | null>(null)
const copied = ref(false)

const build = computed(() => buildStore.currentBuild)

const getChampionImageUrl = (imageName: string): string => {
  return `https://ddragon.leagueoflegends.com/cdn/${version.value}/img/champion/${imageName}`
}
const getItemImageUrl = (imageName: string): string => {
  return `https://ddragon.leagueoflegends.com/cdn/${version.value}/img/item/${imageName}`
}

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
