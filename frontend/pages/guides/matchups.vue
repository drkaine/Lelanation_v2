<template>
  <ShowIf :show-if="isAdmin">
    <div class="matchup-guides-page min-h-screen px-[10px] pb-4 text-text">
      <div class="max-w-8xl mx-auto px-0">
        <header class="mb-4 pt-2 text-center">
          <h1 class="text-2xl font-bold text-text-accent sm:text-3xl">
            {{ t('matchupGuidePage.title') }}
          </h1>
          <p class="mt-2 text-sm text-text-secondary">
            {{ t('matchupGuidePage.subtitle') }}
          </p>
        </header>

        <div class="mb-3">
          <div class="flex flex-wrap items-center gap-2">
            <MatchupGuideSearch />
            <MatchupGuideFilters />
          </div>
        </div>

        <MatchupGuideGrid />
      </div>
    </div>
  </ShowIf>
</template>

<script setup lang="ts">
import ShowIf from '~/components/ShowIf.vue'
import MatchupGuideSearch from '~/components/MatchupGuideDiscovery/MatchupGuideSearch.vue'
import MatchupGuideFilters from '~/components/MatchupGuideDiscovery/MatchupGuideFilters.vue'
import MatchupGuideGrid from '~/components/MatchupGuideDiscovery/MatchupGuideGrid.vue'
import { useAdminAuth } from '~/composables/useAdminAuth'
import { useMatchupGuideDiscoveryStore } from '~/stores/MatchupGuideDiscoveryStore'
import { usePageOgImage } from '~/composables/usePageOgImage'

definePageMeta({
  middleware: 'matchup-guides-admin',
})

const { t } = useI18n()
const { isLoggedIn: isAdmin } = useAdminAuth()
const discoveryStore = useMatchupGuideDiscoveryStore()
const requestFetch = useRequestFetch()

useSeoMeta({
  title: () => t('matchupGuidePage.metaTitle'),
  description: () => t('matchupGuidePage.metaDescription'),
  robots: 'noindex, nofollow',
})

usePageOgImage({
  title: () => t('matchupGuidePage.metaTitle'),
  subtitle: () => t('matchupGuidePage.metaDescription'),
})

await useAsyncData('matchup-guides-index', async () => {
  discoveryStore.restorePaginationFromStorage()
  await discoveryStore.loadGuides({ fetcher: requestFetch })
  return discoveryStore.guides.length
})
</script>
