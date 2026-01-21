<template>
  <a
    :href="video.url"
    target="_blank"
    rel="noopener noreferrer"
    class="group overflow-hidden rounded-2xl border border-primary/25 bg-surface/80 shadow-lg shadow-black/20 backdrop-blur-sm transition hover:border-accent/60 hover:shadow-black/35"
  >
    <div class="relative">
      <img
        :src="video.thumbnailUrl"
        :alt="video.title"
        class="h-36 w-full object-cover"
        loading="lazy"
      />
      <div class="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5" />
    </div>

    <div class="p-4">
      <p class="title-2l text-sm font-semibold text-text">
        {{ video.title }}
      </p>
      <p class="mt-2 text-xs text-text/60">{{ formatDate(video.publishedAt) }}</p>

      <div class="mt-4">
        <span
          class="block w-full rounded-lg bg-accent/75 px-3 py-2 text-center text-sm font-semibold text-background transition-colors group-hover:bg-accent"
        >
          Voir la vidéo
        </span>
      </div>
    </div>
  </a>
</template>

<script setup lang="ts">
import type { YouTubeVideo } from '~/types/youtube'

defineProps<{
  video: YouTubeVideo
}>()

const formatDate = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: '2-digit' })
}
</script>

<style scoped>
.title-2l {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
