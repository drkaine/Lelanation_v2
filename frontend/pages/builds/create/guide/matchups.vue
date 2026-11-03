<template>
  <MatchupGuideCreateMatchupsPageView
    :is-streamer-mode="isLayoutScaled"
    :has-champion="hasChampion"
    :guide-champion-id="guideChampionId"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MatchupGuideCreateMatchupsPageView from '~/components/matchups/MatchupGuideCreateMatchupsPageView.vue'
import { useLayoutScaled } from '~/composables/useLayoutScaled'
import { useBuilderGuideStepPage } from '~/composables/useBuilderGuideStepPage'

definePageMeta({
  layout: false,
})

const { t } = useI18n()
const { buildStore } = useBuilderGuideStepPage('matchups')
const { isLayoutScaled } = useLayoutScaled()

const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))
const guideChampionId = computed(() => buildStore.currentBuild?.champion?.id ?? null)

useHead({
  title: () => t('matchupGuideCreate.titleMatchups'),
})
</script>
