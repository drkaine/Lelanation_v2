<template>
  <div class="videos-page min-h-screen w-full px-[10px] py-4 text-text sm:px-3 lg:px-6">
    <div class="mx-auto w-full max-w-[1600px] space-y-4">
      <div
        v-if="youtube.error"
        class="ui-build-card-surface rounded-xl border-error/40 px-4 py-3 text-sm text-error"
      >
        {{ youtube.error }}
      </div>

      <div
        v-if="youtube.loadingStatus || isLoadingAll"
        class="ui-build-card-surface videos-loading rounded-xl py-12 text-center text-sm text-text/70"
      >
        {{ t('videosPage.loading') }}
      </div>

      <div
        v-else-if="creators.length === 0"
        class="ui-build-card-surface rounded-xl px-4 py-12 text-center"
      >
        <p class="text-lg font-semibold text-text-accent">{{ t('videosPage.noCreatorsTitle') }}</p>
        <p class="mt-2 text-sm text-text/70">{{ t('videosPage.noCreatorsText') }}</p>
      </div>

      <template v-else>
        <section class="ui-build-card-surface rounded-xl p-4">
          <div class="flex flex-wrap items-center gap-2">
            <input
              v-model="query"
              type="search"
              placeholder="Rechercher une vidéo..."
              class="w-full rounded-lg border border-primary/35 bg-background px-4 py-2 text-sm text-text placeholder:text-text/45 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40 sm:flex-1"
            />

            <label for="videos-channel-filter" class="sr-only">Chaîne</label>
            <select
              id="videos-channel-filter"
              v-model="selectedChannelId"
              class="w-full rounded-lg border border-primary/35 bg-background px-4 py-2 text-sm text-text focus:border-accent focus:outline-none sm:w-[260px]"
              aria-label="Filtrer par chaîne"
            >
              <option value="all">Toutes les chaînes</option>
              <option v-for="c in creators" :key="c.channelId" :value="c.channelId">
                {{ c.channelName || c.channelId }}
              </option>
            </select>

            <div class="flex flex-wrap items-center gap-2">
              <div class="text-sm text-text/75">
                {{ filteredVideos.length }} vidéo{{ filteredVideos.length > 1 ? 's' : '' }}
              </div>
              <label for="videos-per-page" class="sr-only">Résultats par page</label>
              <select
                id="videos-per-page"
                :value="String(perPage)"
                class="rounded-lg border border-primary/35 bg-background px-2 py-1.5 text-xs text-text focus:border-accent focus:outline-none"
                aria-label="Résultats par page"
                @change="onPerPageChange"
              >
                <option v-for="o in perPageOptions" :key="o.value" :value="o.value">
                  {{ o.label }}
                </option>
              </select>
            </div>
          </div>
        </section>

        <section class="ui-build-card-surface rounded-xl p-3">
          <div class="no-scrollbar flex w-full flex-wrap items-center justify-center gap-2 py-0.5">
            <button
              type="button"
              class="ui-build-card-button px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
              :disabled="youtube.loadingStatus || isLoadingAll"
              @click="refresh"
            >
              Actualiser
            </button>

            <div class="h-5 w-px shrink-0 bg-primary/25" aria-hidden="true" />

            <div class="flex flex-wrap items-center justify-center gap-2">
              <button
                v-for="opt in typeOptions"
                :key="opt.id"
                type="button"
                :class="chipClass(selectedType === opt.id)"
                @click="selectedType = opt.id"
              >
                {{ opt.label }}
              </button>
            </div>

            <div class="h-5 w-px shrink-0 bg-primary/25" aria-hidden="true" />

            <div class="flex flex-wrap items-center justify-center gap-2">
              <button
                v-for="opt in formatOptions"
                :key="opt.id"
                type="button"
                :class="chipClass(selectedFormat === opt.id)"
                @click="selectedFormat = opt.id"
              >
                {{ opt.label }}
              </button>
            </div>

            <button
              v-if="
                query ||
                selectedChannelId !== 'all' ||
                selectedType !== 'all' ||
                selectedFormat !== 'all'
              "
              type="button"
              class="ui-build-card-button px-2.5 py-1 text-xs font-semibold"
              @click="resetFilters"
            >
              Réinitialiser
            </button>
          </div>
        </section>

        <div class="videos-results">
          <div
            v-if="paginatedVideos.length === 0"
            class="ui-build-card-surface rounded-xl px-4 py-10 text-center text-sm text-text/70"
          >
            Aucun résultat.
          </div>

          <div v-else class="videos-grid-list">
            <VideoGridCard
              v-for="(v, idx) in paginatedVideos"
              :key="v.id"
              :video="v"
              :fetch-priority="idx === 0 ? 'high' : undefined"
            />
          </div>
        </div>

        <div
          v-if="perPage !== 0 && totalPages > 1"
          class="flex flex-wrap items-center justify-center gap-2 pt-1"
        >
          <button
            type="button"
            :disabled="page === 1"
            class="ui-build-card-button px-3 py-2 text-sm disabled:opacity-40"
            @click="page = Math.max(1, page - 1)"
          >
            ←
          </button>
          <span class="px-2 text-sm text-text/75">Page {{ page }} / {{ totalPages }}</span>
          <button
            type="button"
            :disabled="page === totalPages"
            class="ui-build-card-button px-3 py-2 text-sm disabled:opacity-40"
            @click="page = Math.min(totalPages, page + 1)"
          >
            →
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAsyncData } from '#app'
import { useYouTubeStore } from '~/stores/YouTubeStore'
import VideoGridCard from '~/components/Videos/VideoGridCard.vue'
import type { YouTubeVideo } from '~/types/youtube'
import { useSiteUrl } from '~/composables/useSiteUrl'
import { usePageOgImage } from '~/composables/usePageOgImage'

const youtube = useYouTubeStore()
const isLoadingAll = ref(false)
const route = useRoute()
const { t } = useI18n()
const videosSiteUrl = useSiteUrl()

useHead({
  title: () => t('videosPage.metaTitle'),
  meta: [{ name: 'description', content: () => t('videosPage.metaDescription') }],
  link: [
    { rel: 'preconnect', href: 'https://i.ytimg.com', crossorigin: '' },
    { rel: 'preconnect', href: 'https://www.youtube.com', crossorigin: '' },
  ],
})
useSeoMeta({
  ogTitle: () => t('videosPage.metaTitle'),
  ogDescription: () => t('videosPage.metaDescription'),
  ogType: 'website',
})
usePageOgImage({
  title: () => t('videosPage.metaTitle'),
  subtitle: () => t('videosPage.metaDescription'),
})
const router = useRouter()

const creators = computed(() => youtube.creators)

type VideoCategory = 'all' | 'builds' | 'lobby' | 'cast' | 'guide' | 'other'
type VideoFormat = 'all' | 'videos' | 'shorts' | 'posts'
type ChannelFilter = 'all' | string

const query = ref('')
const selectedChannelId = ref<ChannelFilter>('all')
const selectedType = ref<VideoCategory>('all')
const selectedFormat = ref<VideoFormat>('all')

const typeOptions = [
  { id: 'all' as const, label: 'Tous' },
  { id: 'builds' as const, label: 'Build' },
  { id: 'lobby' as const, label: 'Lobby' },
  { id: 'cast' as const, label: 'Cast' },
  { id: 'guide' as const, label: 'Guide' },
]

const formatOptions = [
  { id: 'all' as const, label: 'Tous formats' },
  { id: 'videos' as const, label: 'Vidéos' },
  { id: 'shorts' as const, label: 'Shorts' },
  { id: 'posts' as const, label: 'Posts' },
]

const isCommunityPost = (video: YouTubeVideo) =>
  video.kind === 'communityPost' || video.id.startsWith('Ug')

const chipClass = (active: boolean) =>
  [
    'ui-build-card-button shrink-0 rounded-full px-3 py-1 text-xs font-semibold',
    active ? 'is-active' : '',
  ].join(' ')

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')

    .replace(/[\u0300-\u036F]/g, '')

const isGuideTitle = (title: string): boolean => {
  const t = normalize(title)
  if (/\bguide\b/.test(t)) return true
  if (/comment\s+jouer/.test(t)) return true
  if (/voici\s+comment/.test(t)) return true
  if (/\bcomment\b/.test(t) && (/\bbuilds?\b/.test(t) || /\bcarry\b/.test(t))) return true
  return false
}

const detectType = (title: string): Exclude<VideoCategory, 'all'> => {
  const t = normalize(title)
  if (/\bcast\b/.test(t)) return 'cast'
  if (isGuideTitle(title)) return 'guide'
  if (/lobby/.test(t)) return 'lobby'
  if (/\bbuilds?\b/.test(t)) return 'builds'
  return 'other'
}

const detectFormat = (video: YouTubeVideo): Exclude<VideoFormat, 'all'> => {
  if (typeof video.isShort === 'boolean') {
    return video.isShort ? 'shorts' : 'videos'
  }

  const title = video.title || ''
  const desc = video.description || ''
  const t = normalize(`${title} ${desc}`)

  if (/\bshorts?\b/.test(t) || /#shorts?\b/.test(t)) return 'shorts'

  const hasHashtags = /#\w+/.test(title)
  if (hasHashtags && title.length <= 90) return 'shorts'

  return 'videos'
}

const allVideos = computed<YouTubeVideo[]>(() => {
  const all = Object.values(youtube.channelDataById).flatMap(d => (d?.videos ? d.videos : []))
  const byId = new Map<string, YouTubeVideo>()
  for (const v of all) byId.set(v.id, v)
  return [...byId.values()]
})

useJsonLdHead(
  'videos-graph',
  computed(() => {
    const videos = allVideos.value
    if (videos.length === 0) return null
    return graphJsonLd(
      videos.map(video =>
        videoObjectNode({
          name: video.title,
          description: video.description,
          thumbnailUrl: video.thumbnailUrl,
          uploadDate: video.publishedAt,
          url: video.url,
          duration: video.duration,
        })
      )
    )
  })
)

useJsonLdHead(
  'videos-itemlist',
  computed(() => {
    const videos = allVideos.value.slice(0, 24)
    if (videos.length === 0) return null
    return itemListJsonLd(videosSiteUrl, {
      name: t('videosPage.metaTitle'),
      description: t('videosPage.metaDescription'),
      path: '/videos',
      items: videos.map((video, index) => ({
        name: video.title,
        url: video.url,
        position: index + 1,
      })),
    })
  })
)

const filteredVideos = computed<YouTubeVideo[]>(() => {
  const q = normalize(query.value.trim())
  const channelId = selectedChannelId.value
  const type = selectedType.value
  const fmt = selectedFormat.value

  let list = allVideos.value

  if (channelId !== 'all') {
    list = list.filter(v => v.channelId === channelId)
  }

  if (type !== 'all') {
    list = list.filter(v => detectType(v.title) === type)
  }

  if (fmt === 'posts') {
    list = list.filter(isCommunityPost)
  } else if (fmt !== 'all') {
    list = list.filter(v => !isCommunityPost(v) && detectFormat(v) === fmt)
  }

  if (q) {
    list = list.filter(v => normalize(v.title).includes(q))
  }

  const toTime = (iso: string | undefined) => {
    const t = Date.parse(String(iso || ''))
    return Number.isFinite(t) ? t : -Infinity
  }

  return [...list].sort((a, b) => {
    const dt = toTime(b.publishedAt) - toTime(a.publishedAt)
    if (dt !== 0) return dt
    const byTitle = a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' })
    if (byTitle !== 0) return byTitle
    return a.id.localeCompare(b.id, 'fr', { sensitivity: 'base' })
  })
})

const perPageOptions = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 30, label: '30' },
  { value: 0, label: 'Toutes' },
]
const perPage = ref<number>(youtube.videosPerPage)
const page = ref<number>(1)

const onPerPageChange = (e: Event) => {
  const target = e.target as HTMLSelectElement | null
  const next = target ? Number(target.value) : 20
  const normalized = Number.isFinite(next) ? next : 20
  perPage.value = normalized
  youtube.setVideosPerPage(normalized)
}

watch([query, selectedChannelId, selectedType, selectedFormat, perPage], () => {
  page.value = 1
})

watch(
  () => route.query.channelId,
  channelIdQuery => {
    const q = typeof channelIdQuery === 'string' ? channelIdQuery : ''
    if (!q) {
      selectedChannelId.value = 'all'
      return
    }
    if (creators.value.some(c => c.channelId === q)) {
      selectedChannelId.value = q
    }
  },
  { immediate: true }
)

watch(selectedChannelId, next => {
  const current = typeof route.query.channelId === 'string' ? route.query.channelId : ''
  const nextQueryValue = next === 'all' ? '' : String(next)
  if (current === nextQueryValue) return

  const q = { ...route.query } as Record<string, any>
  if (nextQueryValue) q.channelId = nextQueryValue
  else delete q.channelId

  router.replace({ query: q })
})

const totalPages = computed(() => {
  if (perPage.value === 0) return 1
  return Math.max(1, Math.ceil(filteredVideos.value.length / perPage.value))
})

watch(totalPages, tp => {
  if (page.value > tp) page.value = tp
})

const paginatedVideos = computed<YouTubeVideo[]>(() => {
  if (perPage.value === 0) return filteredVideos.value
  const start = (page.value - 1) * perPage.value
  return filteredVideos.value.slice(start, start + perPage.value)
})

const resetFilters = () => {
  query.value = ''
  selectedChannelId.value = 'all'
  selectedType.value = 'all'
  selectedFormat.value = 'all'
}

const refresh = async () => {
  youtube.clearChannelCache()
  isLoadingAll.value = true
  try {
    await youtube.loadStatus()
    await youtube.loadAllChannelsData({ force: true })
  } finally {
    isLoadingAll.value = false
  }
}

const loadVideos = async (force = false) => {
  if (force) youtube.clearChannelCache()
  isLoadingAll.value = true
  try {
    await youtube.loadStatus()
    await youtube.loadAllChannelsData({ force })
  } finally {
    isLoadingAll.value = false
  }
}

await useAsyncData('youtube-videos-page', async () => {
  if (import.meta.server) {
    await loadVideos(false)
  }
  return youtube.status
})

onMounted(async () => {
  youtube.initializeVideoPreferences()
  perPage.value = youtube.videosPerPage
  await loadVideos(true)
})
</script>

<style scoped>
.videos-page-title {
  color: var(--color-gold-300);
}

.videos-page-subtitle {
  color: rgb(125 211 252 / 0.88);
}

.no-scrollbar {
  scrollbar-width: none;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.videos-loading {
  min-height: 28vh;
}

.videos-results {
  width: 100%;
}

.videos-grid-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 15px;
}

.videos-grid-list > * {
  width: min(100%, 360px);
}

@media (max-width: 640px) {
  .videos-grid-list > * {
    width: 100%;
  }
}
</style>
