<template>
  <div class="champion-videos-tab">
    <section v-if="showMatchups && matchupGuides.length > 0" class="mb-6">
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-text-accent">
        {{ t('statisticsPage.championMatchupGuides') }}
      </h2>
      <ul class="flex flex-col gap-2">
        <li
          v-for="guide in matchupGuides"
          :key="guide.url"
          class="ui-build-card-surface flex flex-col gap-1 rounded-xl px-3 py-2 sm:flex-row sm:items-start sm:gap-4"
        >
          <div class="shrink-0 sm:w-48">
            <a
              :href="guide.url"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
            >
              {{ guide.label || guide.url }}
              <Icon name="mdi:open-in-new" size="14" />
            </a>
            <p v-if="guide.who || guide.level" class="text-xs text-text/65">
              <span v-if="guide.who">{{
                t('statisticsPage.championMatchupGuidesBy', { who: guide.who })
              }}</span>
              <span v-if="guide.who && guide.level"> · </span>
              <span v-if="guide.level">{{ guide.level }}</span>
            </p>
          </div>
          <p v-if="guide.notes" class="whitespace-pre-line text-sm text-text/80">
            {{ guide.notes }}
          </p>
        </li>
      </ul>
    </section>
    <p v-if="section === 'matchups' && matchupGuides.length === 0" class="text-sm text-text/60">
      {{ t('statisticsPage.championMatchupGuidesEmpty', { champion: championName }) }}
    </p>
    <template v-if="showVideos">
      <p v-if="pending && groups.length === 0" class="text-sm text-text/60">
        {{ t('statisticsPage.championVideosLoading') }}
      </p>
      <p
        v-else-if="groups.length === 0 && (section === 'videos' || matchupGuides.length === 0)"
        class="text-sm text-text/60"
      >
        {{ t('statisticsPage.championVideosEmpty', { champion: championName }) }}
      </p>
    </template>
    <section
      v-for="group in showVideos ? groups : []"
      :key="group.role ?? 'other'"
      class="champion-videos-tab__group mb-6 last:mb-0"
    >
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-text-accent">
        {{
          group.role
            ? t(`statisticsPage.championVideosRole.${group.role}`)
            : t('statisticsPage.championVideosRoleOther')
        }}
      </h2>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <VideoGridCard v-for="video in group.videos" :key="video.id" :video="video" compact />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import VideoGridCard from '~/components/Videos/VideoGridCard.vue'
import { useYouTubeStore } from '~/stores/YouTubeStore'
import type { YouTubeVideo } from '~/types/youtube'
import { championGuideVideosByRole } from '~/utils/championGuideVideos'
import { matchupGuidesForChampion, type MatchupGuidesByChampion } from '~/utils/matchupGuidesSheet'

const props = withDefaults(
  defineProps<{ championName: string; section?: 'all' | 'videos' | 'matchups' }>(),
  { section: 'all' }
)
const showVideos = computed(() => props.section !== 'matchups')
const showMatchups = computed(() => props.section !== 'videos')

const { t } = useI18n()
const youtube = useYouTubeStore()
const pending = ref(true)

const allVideos = computed<YouTubeVideo[]>(() =>
  Object.values(youtube.channelDataById).flatMap(d => d?.videos ?? [])
)

const { data: matchupGuideData } = useLazyFetch<MatchupGuidesByChampion>('/matchup-guides.json', {
  key: 'matchup-guides',
  default: () => ({}),
})
const matchupGuides = computed(() =>
  matchupGuidesForChampion(matchupGuideData.value ?? {}, props.championName)
)

const groups = computed(() => championGuideVideosByRole(allVideos.value, props.championName))

onMounted(async () => {
  try {
    await youtube.loadAllChannelsData()
  } catch {
    // Pas de vidéos : l'onglet affiche l'état vide.
  } finally {
    pending.value = false
  }
})
</script>
