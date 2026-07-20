<template>
  <component
    :is="isCommunityPost ? 'button' : 'a'"
    :href="isCommunityPost ? undefined : video.url"
    :type="isCommunityPost ? 'button' : undefined"
    :target="isCommunityPost ? undefined : '_blank'"
    :rel="isCommunityPost ? undefined : 'noopener noreferrer'"
    class="ui-build-card-surface group w-full overflow-hidden rounded-2xl text-left transition hover:shadow-[0_4px_18px_var(--card-border-color-soft)]"
    :class="{ 'video-grid-card--compact': compact }"
    @click="onCardClick"
  >
    <div class="relative aspect-video w-full overflow-hidden bg-black/40">
      <img
        v-if="previewImageUrl"
        :src="previewImageUrl"
        :alt="video.title"
        width="640"
        height="360"
        class="h-full w-full object-cover"
        :loading="fetchPriority === 'high' ? 'eager' : 'lazy'"
        :fetchpriority="fetchPriority"
        decoding="async"
      />
      <div
        v-else
        class="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/30 to-background px-4 text-center text-sm font-semibold text-text/80"
      >
        {{ video.title }}
      </div>
      <span
        v-if="isCommunityPost"
        class="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent"
      >
        Post
      </span>
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
  </component>

  <CommunityPostModal
    v-if="isCommunityPost"
    :open="modalOpen"
    :post="video"
    @close="modalOpen = false"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { YouTubeVideo } from '~/types/youtube'
import CommunityPostModal from '~/components/Videos/CommunityPostModal.vue'
import { normalizeCommunityPostImageUrl } from '~/utils/communityPostImages'

const props = withDefaults(
  defineProps<{
    video: YouTubeVideo
    /** Set 'high' for the first card (LCP) to improve Lighthouse. */
    fetchPriority?: 'high' | 'low' | undefined
    /** Smaller card for dense grids (e.g. homepage). */
    compact?: boolean
  }>(),
  { fetchPriority: undefined, compact: false }
)

const modalOpen = ref(false)

const isCommunityPost = computed(
  () => props.video.kind === 'communityPost' || props.video.id.startsWith('Ug')
)

const previewImageUrl = computed(() => {
  if (!props.video.thumbnailUrl) return ''
  return normalizeCommunityPostImageUrl(props.video.thumbnailUrl)
})

const onCardClick = (event: MouseEvent) => {
  if (!isCommunityPost.value) return
  event.preventDefault()
  modalOpen.value = true
}

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
