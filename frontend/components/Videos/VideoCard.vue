<template>
  <a
    :href="video.url"
    target="_blank"
    rel="noopener noreferrer"
    class="group flex gap-3 rounded-lg border border-primary bg-surface p-3 transition-colors hover:border-accent"
  >
    <img
      :src="video.thumbnailUrl"
      :alt="video.title"
      class="h-20 w-36 flex-none rounded object-cover"
      loading="lazy"
    />
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-semibold text-text group-hover:text-text-accent">
        {{ video.title }}
      </p>
      <p class="text-text/60 mt-1 truncate text-xs">{{ video.channelTitle }}</p>
      <p class="text-text/60 mt-1 text-xs">{{ formatDate(video.publishedAt) }}</p>
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
