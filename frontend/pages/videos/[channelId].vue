<template>
  <div class="videos-channel min-h-screen p-4 text-text">
    <div class="mx-auto max-w-6xl">
      <div class="mb-6 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <NuxtLink
            to="/videos"
            class="rounded-lg bg-surface px-4 py-2 text-text transition-colors hover:bg-primary hover:text-white"
          >
            ← Retour
          </NuxtLink>
          <h1 class="text-2xl font-bold text-text">
            {{ title }}
          </h1>
        </div>
      </div>

      <div
        v-if="youtube.error"
        class="mb-4 rounded-lg border border-error bg-surface p-3 text-sm text-error"
      >
        {{ youtube.error }}
      </div>

      <div v-if="youtube.loadingChannelIds.has(channelId)" class="text-text/70 py-10 text-center">
        Chargement…
      </div>

      <div v-else-if="videos.length === 0" class="py-12 text-center">
        <p class="text-lg text-text">Aucune vidéo trouvée</p>
        <p class="text-text/70 mt-2 text-sm">
          Soit la chaîne n’est pas encore synchronisée, soit elle est vide.
        </p>
      </div>

      <div v-else>
        <div class="mb-4 flex items-center justify-between">
          <p class="text-text/70 text-sm">
            {{ videos.length }} vidéo{{ videos.length > 1 ? 's' : '' }}
          </p>
        </div>

        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <VideoCard v-for="v in videos" :key="v.id" :video="v" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useYouTubeStore } from '~/stores/YouTubeStore'
import VideoCard from '~/components/Videos/VideoCard.vue'
import type { YouTubeVideo } from '~/types/youtube'

const route = useRoute()
const youtube = useYouTubeStore()

const channelId = computed(() => route.params.channelId as string)

const data = computed(() => youtube.channelDataById[channelId.value])
const videos = computed<YouTubeVideo[]>(() =>
  Array.isArray(data.value?.videos) ? data.value!.videos : []
)
const title = computed(() => data.value?.channelName || channelId.value)

onMounted(async () => {
  await youtube.loadChannelData(channelId.value)
})
</script>
