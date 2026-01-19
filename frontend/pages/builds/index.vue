<template>
  <div class="builds-list min-h-screen p-4 text-text">
    <div class="mx-auto max-w-7xl">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-3xl font-bold">My Builds</h1>
        <NuxtLink
          to="/builds/create"
          class="rounded bg-accent px-6 py-2 text-background hover:bg-accent-dark"
        >
          Create New Build
        </NuxtLink>
      </div>

      <div v-if="builds.length === 0" class="py-12 text-center">
        <p class="mb-4 text-lg text-text">No builds saved yet</p>
        <NuxtLink
          to="/builds/create"
          class="inline-block rounded bg-primary px-6 py-2 text-white hover:bg-primary-dark"
        >
          Create Your First Build
        </NuxtLink>
      </div>

      <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="build in builds"
          :key="build.id"
          class="rounded-lg border-2 border-primary bg-surface p-4 transition-colors hover:border-accent"
        >
          <div class="mb-3 flex items-start justify-between">
            <h3 class="text-lg font-bold text-text">{{ build.name }}</h3>
            <button class="text-sm text-error hover:text-error/70" @click="confirmDelete(build.id)">
              Delete
            </button>
          </div>

          <div v-if="build.champion" class="mb-3 flex items-center gap-3">
            <img
              :src="getChampionImageUrl(build.champion.image.full)"
              :alt="build.champion.name"
              class="h-12 w-12 rounded"
            />
            <div>
              <p class="font-semibold text-text">{{ build.champion.name }}</p>
              <p class="text-text/70 text-sm">{{ build.champion.title }}</p>
            </div>
          </div>

          <div class="mb-3 flex gap-2">
            <img
              v-for="item in build.items.slice(0, 6)"
              :key="item.id"
              :src="getItemImageUrl(item.image.full)"
              :alt="item.name"
              class="h-8 w-8 rounded"
            />
          </div>

          <div class="mb-3 flex gap-2">
            <NuxtLink
              :to="`/builds/edit/${build.id}`"
              class="rounded bg-primary px-4 py-2 text-sm text-white hover:bg-primary-dark"
            >
              Edit
            </NuxtLink>
            <button
              class="rounded border border-primary bg-surface px-4 py-2 text-sm text-text hover:bg-primary hover:text-white"
              @click="loadBuild(build.id)"
            >
              View
            </button>
          </div>

          <p class="text-text/50 text-xs">Created: {{ formatDate(build.createdAt) }}</p>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div
      v-if="buildToDelete"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click="buildToDelete = null"
    >
      <div class="mx-4 w-full max-w-md rounded-lg bg-surface p-6" @click.stop>
        <h3 class="mb-4 text-lg font-bold text-text">Delete Build?</h3>
        <p class="mb-6 text-text">
          Are you sure you want to delete this build? This action cannot be undone.
        </p>
        <div class="flex gap-4">
          <button
            class="rounded bg-error px-4 py-2 text-white hover:bg-error/80"
            @click="deleteBuild"
          >
            Delete
          </button>
          <button
            class="rounded border border-primary bg-surface px-4 py-2 text-text hover:bg-primary hover:text-white"
            @click="buildToDelete = null"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useBuildStore } from '~/stores/BuildStore'
import type { Build } from '~/types/build'

const buildStore = useBuildStore()

const buildToDelete = ref<string | null>(null)

const builds = computed<Build[]>(() => buildStore.getSavedBuilds())

const confirmDelete = (buildId: string) => {
  buildToDelete.value = buildId
}

const deleteBuild = () => {
  if (buildToDelete.value) {
    buildStore.deleteBuild(buildToDelete.value)
    buildToDelete.value = null
  }
}

const loadBuild = (buildId: string) => {
  buildStore.loadBuild(buildId)
  navigateTo(`/builds/edit/${buildId}`)
}

const getChampionImageUrl = (imageName: string): string => {
  return `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${imageName}`
}

const getItemImageUrl = (imageName: string): string => {
  return `https://ddragon.leagueoflegends.com/cdn/14.1.1/img/item/${imageName}`
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString()
}

onMounted(() => {
  // Builds are loaded from localStorage via getter
})
</script>
