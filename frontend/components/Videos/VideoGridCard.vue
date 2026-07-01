<template>
  <a
    :href="video.url"
    target="_blank"
    rel="noopener noreferrer"
    class="ui-build-card-surface group overflow-hidden rounded-2xl transition hover:shadow-[0_4px_18px_var(--card-border-color-soft)]"
    :class="{ 'video-grid-card--compact': compact }"
  >
    <div class="relative aspect-video w-full overflow-hidden bg-black/40">
      <img
        :src="video.thumbnailUrl"
        :alt="video.title"
        width="640"
        height="360"
        class="h-full w-full object-cover"
        :loading="fetchPriority === 'high' ? 'eager' : 'lazy'"
        :fetchpriority="fetchPriority"
        decoding="async"
      />
      <div class="pointer-events-none absolute inset-0 ring-1 ring-inset ring-primary/15" />
    </div>

    <div class="p-3" :class="{ 'p-2': compact }">
      <p
        class="title-2l text-sm font-semibold text-text-accent group-hover:text-accent"
        :class="{ 'text-xs': compact }"
      >
        {{ video.title }}
      </p>
      <p class="mt-1 text-xs text-text/65">{{ formatDate(video.publishedAt) }}</p>
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
    /** Smaller card for dense grids (e.g. homepage). */
    compact?: boolean
  }>(),
  { fetchPriority: undefined, compact: false }
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

.video-grid-card--compact {
  border-radius: 0.75rem;
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.15);
}
</style>
