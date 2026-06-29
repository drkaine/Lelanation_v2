<template>
  <MatchupGuideCreateMatchupsPageView
    :is-streamer-mode="isLayoutScaled"
    :has-champion="hasChampion"
    :guide-champion-id="guideChampionId"
  />
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import MatchupGuideCreateMatchupsPageView from '~/components/matchups/MatchupGuideCreateMatchupsPageView.vue'
import { useLayoutScaled } from '~/composables/useLayoutScaled'
import { useMatchupGuideCreateBuilder } from '~/composables/useMatchupGuideCreateBuilder'

definePageMeta({
  layout: false,
  middleware: 'matchup-guides-admin',
})

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const localePath = useLocalePath()
const { buildStore } = useMatchupGuideCreateBuilder('matchups')
const { isLayoutScaled } = useLayoutScaled()

const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))
const guideChampionId = computed(() => buildStore.currentBuild?.champion?.id ?? null)

watch(
  () => [buildStore.isBuildValid, buildStore.currentBuild?.champion] as const,
  ([valid]) => {
    if (!valid && route.path.includes('/matchups/sheets/create/matchups')) {
      router.replace(localePath('/matchups/sheets/create/info'))
    }
  },
  { immediate: true }
)

useHead({
  title: () => t('matchupGuideCreate.titleMatchups'),
})
</script>
