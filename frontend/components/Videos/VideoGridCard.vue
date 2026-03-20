<template>
  <a
    :href="video.url"
    target="_blank"
    rel="noopener noreferrer"
    class="group overflow-hidden rounded-2xl border border-accent/70 bg-surface/80 shadow-lg shadow-black/20 backdrop-blur-sm transition hover:border-accent hover:shadow-black/35"
  >
    <div class="relative">
      <img
        :src="video.thumbnailUrl"
        :alt="video.title"
        class="h-44 w-full object-cover"
        :loading="fetchPriority === 'high' ? 'eager' : 'lazy'"
        :fetchpriority="fetchPriority"
      />
      <div class="pointer-events-none absolute inset-0 ring-1 ring-inset ring-sky-200/20" />
    </div>

    <div class="p-3">
      <p class="title-2l text-sm font-semibold text-yellow-500">
        {{ video.title }}
      </p>
      <p class="mt-1 text-xs text-sky-200">{{ formatDate(video.publishedAt) }}</p>
    </div>
  </a>
</template>

<script setup lang="ts">
import type { YouTubeVideo } from '~/types/youtube'

withDefaults(
  defineProps<{
    video: YouTubeVideo
    /** Set 'high' for the first card (LCP) to improve Lighthouse. */
    fetchPriority?: 'high' | 'low' | undefined
  }>(),
  { fetchPriority: undefined }
)

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
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
