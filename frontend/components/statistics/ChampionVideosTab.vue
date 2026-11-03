<template>
  <div class="champion-videos-tab">
    <p v-if="pending && groups.length === 0" class="text-sm text-text/60">
      {{ t('statisticsPage.championVideosLoading') }}
    </p>
    <p v-else-if="groups.length === 0" class="text-sm text-text/60">
      {{ t('statisticsPage.championVideosEmpty', { champion: championName }) }}
    </p>
    <section
      v-for="group in groups"
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

const props = defineProps<{ championName: string }>()

const { t } = useI18n()
const youtube = useYouTubeStore()
const pending = ref(true)

const allVideos = computed<YouTubeVideo[]>(() =>
  Object.values(youtube.channelDataById).flatMap(d => d?.videos ?? [])
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
