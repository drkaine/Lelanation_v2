<template>
  <div v-if="cards.length > 0" class="description-video-previews space-y-2">
    <a
      v-for="card in cards"
      :key="card.url"
      :href="card.url"
      target="_blank"
      rel="noopener noreferrer"
      class="group flex flex-col gap-1.5 rounded-lg border border-primary/40 bg-surface/60 p-2.5 transition-colors hover:border-accent"
    >
      <p class="desc-line text-xs text-text/65">
        {{ card.description }}
      </p>
      <p class="truncate text-xs text-text/75">
        {{ card.channelName }}
      </p>
      <p class="title-line text-sm font-semibold text-yellow-500 group-hover:text-yellow-400">
        {{ card.title }}
      </p>
      <img
        v-if="card.thumbnailUrl"
        :src="card.thumbnailUrl"
        :alt="card.title"
        class="mt-1 h-28 w-full rounded object-cover"
        loading="lazy"
      />
    </a>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import {
  extractVideoUrls,
  getVideoLinkFallbackTitle,
  getYouTubeThumbnailUrl,
} from '~/utils/videoLinkPreview'

type PreviewCard = {
  url: string
  title: string
  description: string
  channelName: string
  providerLabel: string
  thumbnailUrl: string | null
}

type OEmbedResponse = {
  title?: string
  author_name?: string
  provider_name?: string
  thumbnail_url?: string
}

const props = defineProps<{
  text: string
}>()

const previewMap = reactive<Record<string, PreviewCard>>({})
const loadedUrls = new Set<string>()

const videoUrls = computed(() => extractVideoUrls(props.text))
const cards = computed(() =>
  videoUrls.value.map(url => previewMap[url] ?? buildFallbackCard(url, null))
)

function buildFallbackCard(url: string, providerName: string | null): PreviewCard {
  const providerLabel = providerName || deriveProviderLabel(url)
  return {
    url,
    title: getVideoLinkFallbackTitle(url),
    description: shortenUrlForDisplay(url),
    channelName: providerLabel,
    providerLabel,
    thumbnailUrl: getYouTubeThumbnailUrl(url),
  }
}

function deriveProviderLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host
  } catch {
    return 'video'
  }
}

function shortenUrlForDisplay(url: string): string {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    const path = parsed.pathname === '/' ? '' : parsed.pathname
    return `${host}${path}`
  } catch {
    return url
  }
}

async function loadPreview(url: string): Promise<void> {
  if (loadedUrls.has(url)) return
  loadedUrls.add(url)
  previewMap[url] = buildFallbackCard(url, null)

  try {
    const endpoint = `https://noembed.com/embed?url=${encodeURIComponent(url)}`
    const response = await fetch(endpoint, { method: 'GET' })
    if (!response.ok) return

    const data = (await response.json()) as OEmbedResponse
    previewMap[url] = {
      url,
      title: (data.title || '').trim() || previewMap[url].title,
      description: previewMap[url].description,
      channelName:
        (data.author_name || '').trim() ||
        (data.provider_name || '').trim() ||
        previewMap[url].channelName,
      providerLabel: (data.provider_name || '').trim() || previewMap[url].providerLabel,
      thumbnailUrl: data.thumbnail_url || previewMap[url].thumbnailUrl,
    }
  } catch {
    // Keep fallback card if oEmbed fails.
  }
}

watch(
  videoUrls,
  urls => {
    if (!import.meta.client) return
    for (const url of urls) {
      loadPreview(url).catch(() => {})
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.desc-line {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.title-line {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
