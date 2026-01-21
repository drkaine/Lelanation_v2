<template>
  <div class="videos-page min-h-screen p-4 text-text">
    <div class="mx-auto max-w-7xl">
      <div class="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-text-accent">Vidéos</h1>
          <p class="mt-1 text-sm text-text/70">
            Vidéos YouTube organisées par créateur (synchronisées côté serveur).
          </p>
        </div>
        <button
          class="rounded-lg border border-primary bg-surface px-4 py-2 text-sm text-text transition-colors hover:bg-primary hover:text-white"
          :disabled="youtube.loadingStatus"
          @click="refresh"
        >
          Actualiser
        </button>
      </div>

      <div
        v-if="youtube.error"
        class="mb-4 rounded-lg border border-error bg-surface p-3 text-sm text-error"
      >
        {{ youtube.error }}
      </div>

      <div v-if="youtube.loadingStatus" class="py-8 text-center text-text-secondary">
        Chargement…
      </div>

      <div v-else-if="creators.length === 0" class="py-12 text-center">
        <p class="text-lg text-text">Aucun créateur configuré</p>
        <p class="mt-2 text-sm text-text/70">Demande à un admin d’ajouter des chaînes.</p>
      </div>

      <div v-else class="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <!-- Creator quick nav -->
        <aside class="rounded-lg border border-primary bg-surface p-4">
          <p class="mb-3 text-xs font-semibold text-text/70">Créateurs</p>
          <div class="space-y-2">
            <a
              v-for="c in creators"
              :key="c.channelId"
              :href="`#creator-${c.channelId}`"
              class="block rounded px-2 py-1 text-sm text-text transition-colors hover:bg-primary/20"
            >
              <span class="font-semibold">{{ c.channelName || c.channelId }}</span>
              <span class="ml-2 text-xs text-text/60">({{ c.videoCount }})</span>
            </a>
          </div>
        </aside>

        <!-- Creator sections -->
        <section class="space-y-4">
          <div
            v-for="c in creators"
            :id="`creator-${c.channelId}`"
            :key="c.channelId"
            class="rounded-lg border-2 border-primary bg-surface p-4"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="text-lg font-bold text-text">
                  {{ c.channelName || c.channelId }}
                </h2>
                <p class="mt-1 text-xs text-text/60">
                  {{ c.videoCount }} vidéo{{ c.videoCount > 1 ? 's' : '' }}
                  <span v-if="c.lastSync">· Sync: {{ formatDateTime(c.lastSync) }}</span>
                </p>
              </div>

              <div class="flex items-center gap-2">
                <NuxtLink
                  :to="`/videos/${c.channelId}`"
                  class="rounded-lg bg-primary px-3 py-2 text-sm text-white transition-colors hover:bg-primary-dark"
                >
                  Voir tout
                </NuxtLink>
                <button
                  class="rounded-lg border border-primary bg-surface px-3 py-2 text-sm text-text transition-colors hover:bg-primary hover:text-white"
                  @click="toggle(c.channelId)"
                >
                  {{ expanded.has(c.channelId) ? 'Réduire' : 'Déplier' }}
                </button>
              </div>
            </div>

            <div v-if="expanded.has(c.channelId)" class="mt-4">
              <div
                v-if="youtube.loadingChannelIds.has(c.channelId)"
                class="py-4 text-center text-text/70"
              >
                Chargement des vidéos…
              </div>

              <div v-else class="grid grid-cols-1 gap-3 md:grid-cols-2">
                <VideoCard v-for="v in topVideos(c.channelId)" :key="v.id" :video="v" />
              </div>

              <div class="mt-4 flex justify-end">
                <NuxtLink
                  :to="`/videos/${c.channelId}`"
                  class="text-sm font-semibold text-accent hover:text-accent-dark"
                >
                  Voir la liste complète →
                </NuxtLink>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAsyncData } from '#app'
import { useYouTubeStore } from '~/stores/YouTubeStore'
import VideoCard from '~/components/Videos/VideoCard.vue'
import type { YouTubeVideo } from '~/types/youtube'

const youtube = useYouTubeStore()
const expanded = ref(new Set<string>())

const creators = computed(() => youtube.creators)

const refresh = async () => {
  await youtube.loadStatus()
}

const toggle = async (channelId: string) => {
  if (expanded.value.has(channelId)) {
    expanded.value.delete(channelId)
    expanded.value = new Set(expanded.value)
    return
  }
  expanded.value.add(channelId)
  expanded.value = new Set(expanded.value)
  await youtube.loadChannelData(channelId)
}

const topVideos = (channelId: string): YouTubeVideo[] => {
  const data = youtube.channelDataById[channelId]
  const videos = Array.isArray(data?.videos) ? data!.videos : []
  return videos.slice(0, 6)
}

const formatDateTime = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// SSR + client navigation: prefetch creators list.
await useAsyncData('youtube-status', async () => {
  await youtube.loadStatus()
  return youtube.status
})
</script>
