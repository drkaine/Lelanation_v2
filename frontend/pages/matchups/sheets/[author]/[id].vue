<template>
  <ShowIf :show-if="isAdmin">
    <MatchupGuideDetailView :guide="guide" />
  </ShowIf>
</template>

<script setup lang="ts">
import ShowIf from '~/components/ShowIf.vue'
import MatchupGuideDetailView from '~/components/MatchupGuideDiscovery/MatchupGuideDetailView.vue'
import { useAdminAuth } from '~/composables/useAdminAuth'
import { fetchMatchupGuideById } from '~/composables/useMatchupGuideDetail'
import { matchupGuideAuthorSlugMatches, matchupGuideDetailPath } from '~/utils/matchupGuideSlug'

definePageMeta({
  middleware: 'matchup-guides-admin',
})

const route = useRoute()
const localePath = useLocalePath()
const { t } = useI18n()
const { isLoggedIn: isAdmin } = useAdminAuth()
const requestFetch = useRequestFetch()

const guideId = computed(() => String(route.params.id ?? ''))
const authorParam = computed(() => String(route.params.author ?? ''))

const { data: guide } = await useAsyncData(
  () => `matchup-sheet-${guideId.value}`,
  async () => {
    const loaded = await fetchMatchupGuideById(guideId.value, requestFetch)
    if (!loaded) return null
    if (!matchupGuideAuthorSlugMatches(loaded, authorParam.value)) {
      await navigateTo(matchupGuideDetailPath(loaded, localePath), { replace: true })
    }
    return loaded
  },
  { watch: [guideId, authorParam] }
)

if (!guide.value) {
  throw createError({ statusCode: 404, statusMessage: t('matchupGuidePage.notFound') })
}

const championName = computed(() => guide.value!.champion?.name ?? '')
const authorName = computed(
  () => guide.value!.author?.trim() || t('matchupGuideDiscovery.authorAnonymous')
)

useSeoMeta({
  title: () =>
    t('matchupGuidePage.detailMetaTitle', {
      champion: championName.value,
      author: authorName.value,
    }),
  description: () => guide.value!.description ?? t('matchupGuidePage.metaDescription'),
  robots: 'noindex, nofollow',
})
</script>
