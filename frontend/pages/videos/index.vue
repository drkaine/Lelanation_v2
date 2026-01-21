<template>
  <div class="videos-page min-h-screen p-4 text-text">
    <div class="mx-auto max-w-7xl">
      <div
        v-if="youtube.error"
        class="mb-4 rounded-lg border border-error bg-surface p-3 text-sm text-error"
      >
        {{ youtube.error }}
      </div>

      <div
        v-if="youtube.loadingStatus || isLoadingAll"
        class="py-8 text-center text-text-secondary"
      >
        Chargement…
      </div>

      <div v-else-if="creators.length === 0" class="py-12 text-center">
        <p class="text-lg text-text">Aucun créateur configuré</p>
        <p class="mt-2 text-sm text-text/70">Demande à un admin d’ajouter des chaînes.</p>
      </div>

      <div v-else class="space-y-4">
        <!-- Search (centered) -->
        <div class="mx-auto max-w-5xl">
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_260px]">
            <input
              v-model="query"
              type="search"
              placeholder="Rechercher une vidéo..."
              class="w-full rounded-lg border border-primary/40 bg-surface/70 px-4 py-2 text-sm text-text shadow-sm placeholder:text-text/50 focus:border-accent/70 focus:outline-none"
            />

            <select
              v-model="selectedChannelId"
              class="w-full rounded-lg border border-primary/40 bg-surface/70 px-4 py-2 text-sm text-text focus:border-accent/70 focus:outline-none"
            >
              <option value="all">Toutes les chaînes</option>
              <option v-for="c in creators" :key="c.channelId" :value="c.channelId">
                {{ c.channelName || c.channelId }}
              </option>
            </select>
          </div>
        </div>

        <!-- Type pills (centered) -->
        <div class="flex justify-center">
          <div class="flex flex-wrap justify-center gap-2">
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
        </div>

        <!-- Format pills (centered) -->
        <div class="flex justify-center">
          <div class="flex flex-wrap justify-center gap-2">
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
        </div>

        <!-- Pagination controls -->
        <div
          class="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="text-sm text-text/70">
            {{ filteredVideos.length }} résultat{{ filteredVideos.length > 1 ? 's' : '' }}
          </div>

          <button
            type="button"
            class="rounded-lg border border-primary/40 bg-surface/70 px-4 py-2 text-sm font-semibold text-text transition-colors hover:bg-primary/10 disabled:opacity-40"
            :disabled="youtube.loadingStatus || isLoadingAll"
            @click="refresh"
          >
            Actualiser
          </button>

          <div class="flex flex-wrap items-center gap-2">
            <select
              :value="String(perPage)"
              class="rounded-lg border border-primary/40 bg-surface/70 px-3 py-2 text-sm text-text focus:border-accent/70 focus:outline-none"
              @change="onPerPageChange"
            >
              <option v-for="o in perPageOptions" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </select>

            <button
              v-if="
                query ||
                selectedChannelId !== 'all' ||
                selectedType !== 'all' ||
                selectedFormat !== 'all'
              "
              type="button"
              class="ml-2 text-xs font-semibold text-accent hover:text-accent-dark"
              @click="resetFilters"
            >
              Réinitialiser
            </button>
          </div>
        </div>

        <!-- Results grid -->
        <div class="mx-auto max-w-5xl">
          <div v-if="paginatedVideos.length === 0" class="py-10 text-center text-text/70">
            Aucun résultat.
          </div>

          <div v-else class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <VideoGridCard v-for="v in paginatedVideos" :key="v.id" :video="v" />
          </div>
        </div>

        <!-- Pager -->
        <div
          v-if="perPage !== 0 && totalPages > 1"
          class="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-2 pt-2"
        >
          <button
            type="button"
            :disabled="page === 1"
            class="rounded-lg border border-primary/40 bg-surface/70 px-3 py-2 text-sm text-text disabled:opacity-40"
            @click="page = Math.max(1, page - 1)"
          >
            ←
          </button>
          <span class="px-2 text-sm text-text/70">Page {{ page }} / {{ totalPages }}</span>
          <button
            type="button"
            :disabled="page === totalPages"
            class="rounded-lg border border-primary/40 bg-surface/70 px-3 py-2 text-sm text-text disabled:opacity-40"
            @click="page = Math.min(totalPages, page + 1)"
          >
            →
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAsyncData } from '#app'
import { useYouTubeStore } from '~/stores/YouTubeStore'
import VideoGridCard from '~/components/Videos/VideoGridCard.vue'
import type { YouTubeVideo } from '~/types/youtube'

const youtube = useYouTubeStore()
const isLoadingAll = ref(false)

const creators = computed(() => youtube.creators)

type VideoCategory = 'all' | 'builds' | 'recap' | 'tierlist' | 'other'
type VideoFormat = 'all' | 'videos' | 'shorts'
type ChannelFilter = 'all' | string

const query = ref('')
const selectedChannelId = ref<ChannelFilter>('all')
const selectedType = ref<VideoCategory>('all')
const selectedFormat = ref<VideoFormat>('all')

const typeOptions = [
  { id: 'all' as const, label: 'Tous' },
  { id: 'tierlist' as const, label: 'Tierlist' },
  { id: 'builds' as const, label: 'Build' },
  { id: 'recap' as const, label: 'Debrief' },
]

const formatOptions = [
  { id: 'all' as const, label: 'Tous formats' },
  { id: 'videos' as const, label: 'Vidéos' },
  { id: 'shorts' as const, label: 'Shorts' },
]

const chipClass = (active: boolean) =>
  [
    'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
    active
      ? 'border-accent bg-accent/15 text-text'
      : 'border-primary/40 bg-background/10 text-text/80 hover:border-primary hover:bg-primary/10',
  ].join(' ')

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')

    .replace(/[\u0300-\u036F]/g, '')

const detectType = (title: string): Exclude<VideoCategory, 'all'> => {
  const t = normalize(title)
  if (/(tier\s*list|tierlist)/.test(t)) return 'tierlist'
  if (/\bbuilds?\b/.test(t)) return 'builds'
  if (/(debrief|debriefing|d[ée]brief|recap|recapitulatif|r[ée]cap)/.test(t)) return 'recap'
  return 'other'
}

const detectFormat = (video: YouTubeVideo): Exclude<VideoFormat, 'all'> => {
  if (typeof video.isShort === 'boolean') {
    return video.isShort ? 'shorts' : 'videos'
  }

  const title = video.title || ''
  const desc = video.description || ''
  const t = normalize(`${title} ${desc}`)

  // Primary: explicit markers
  if (/\bshorts?\b/.test(t) || /#shorts?\b/.test(t)) return 'shorts'

  // Heuristic: many shorts are posted with hashtags in the title and a short title.
  // (We don't have duration in the stored data.)
  const hasHashtags = /#\w+/.test(title)
  if (hasHashtags && title.length <= 90) return 'shorts'

  return 'videos'
}

const allVideos = computed<YouTubeVideo[]>(() => {
  const all = Object.values(youtube.channelDataById).flatMap(d => (d?.videos ? d.videos : []))
  // Deduplicate by id (defensive)
  const byId = new Map<string, YouTubeVideo>()
  for (const v of all) byId.set(v.id, v)
  return [...byId.values()]
})

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

  if (fmt !== 'all') {
    list = list.filter(v => detectFormat(v) === fmt)
  }

  if (q) {
    list = list.filter(v => normalize(v.title).includes(q))
  }

  const sortByTitle = type === 'builds' || type === 'recap' || type === 'tierlist'
  if (sortByTitle) {
    return [...list].sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }))
  }

  return [...list].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )
})

const perPageOptions = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 30, label: '30' },
  { value: 0, label: 'Toutes' },
]
const perPage = ref<number>(20)
const page = ref<number>(1)

const onPerPageChange = (e: Event) => {
  const target = e.target as HTMLSelectElement | null
  const next = target ? Number(target.value) : 20
  perPage.value = Number.isFinite(next) ? next : 20
}

watch([query, selectedChannelId, selectedType, selectedFormat, perPage], () => {
  page.value = 1
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
    await youtube.loadAllChannelsData()
  } finally {
    isLoadingAll.value = false
  }
}

// SSR + client navigation: prefetch creators list.
await useAsyncData('youtube-status', async () => {
  await youtube.loadStatus()
  isLoadingAll.value = true
  try {
    await youtube.loadAllChannelsData()
  } finally {
    isLoadingAll.value = false
  }
  return youtube.status
})
</script>

<style scoped>
.no-scrollbar {
  scrollbar-width: none;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
