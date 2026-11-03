<template>
  <div class="champion-guide-videos min-h-screen px-4 pb-8 pt-4 text-text max-lg:px-3">
    <header class="mb-4 flex flex-wrap items-center gap-3">
      <NuxtLink
        :to="localePath('/videos/champions')"
        class="rounded-lg border border-primary/30 px-3 py-1.5 text-sm transition-colors hover:bg-primary hover:text-white"
      >
        {{ t('championGuidesPage.back') }}
      </NuxtLink>
      <img
        v-if="champion"
        :src="getChampionImageUrl(version, champion.image.full)"
        :alt="champion.name"
        width="48"
        height="48"
        class="h-12 w-12 rounded-lg object-cover"
      />
      <h1 class="text-lg font-bold text-text-accent sm:text-xl">
        {{ t('championGuidesPage.heading', { champion: champion?.name ?? slug }) }}
      </h1>
      <NuxtLink
        v-if="champion"
        :to="localePath(`/statistics/champion/${slug}`)"
        class="ml-auto text-sm text-accent hover:underline"
      >
        {{ t('championGuidesPage.stats') }}
      </NuxtLink>
    </header>

    <ChampionVideosTab v-if="champion" :champion-name="champion.name" />
    <p v-else class="text-sm text-text/70">{{ t('championGuidesPage.notFound') }}</p>
  </div>
</template>

<script setup lang="ts">
import ChampionVideosTab from '~/components/statistics/ChampionVideosTab.vue'
import { getFallbackGameVersion } from '~/config/version'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useVersionStore } from '~/stores/VersionStore'
import { getChampionImageUrl } from '~/utils/imageUrl'
import { riotLanguage } from '~/utils/riotLanguage'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const championsStore = useChampionsStore()
const versionStore = useVersionStore()

const slug = computed(() => String(route.params.slug ?? '').toLowerCase())

await Promise.all([
  championsStore.loadChampions(riotLanguage(locale.value)).catch(() => undefined),
  versionStore.loadCurrentVersion().catch(() => undefined),
])

const version = computed(() => versionStore.currentVersion ?? getFallbackGameVersion())
const champion = computed(() =>
  championsStore.champions.find(c => c.id.toLowerCase() === slug.value)
)

useHead({
  title: () => t('championGuidesPage.heading', { champion: champion.value?.name ?? slug.value }),
})
</script>
