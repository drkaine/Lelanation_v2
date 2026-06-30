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
import {
  canNavigateToMatchupGuideStep,
  buildMatchupGuideStepAccessContext,
} from '~/utils/matchupGuideCreateSteps'

definePageMeta({
  layout: false,
})

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const localePath = useLocalePath()
const { buildStore, draftStore, sessionReady } = useMatchupGuideCreateBuilder('matchups')
const { isLayoutScaled } = useLayoutScaled()

const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))
const guideChampionId = computed(() => buildStore.currentBuild?.champion?.id ?? null)

watch(
  () => [sessionReady.value, buildStore.isBuildValid, draftStore.matchupEntries] as const,
  ([ready, valid]) => {
    if (!ready) return
    if (!route.path.includes('/matchups/sheets/create/matchups')) return
    const context = buildMatchupGuideStepAccessContext({
      buildValid: valid,
      hasChampion: Boolean(buildStore.currentBuild?.champion),
      matchupEntries: draftStore.matchupEntries,
    })
    if (!canNavigateToMatchupGuideStep('matchups', context)) {
      router.replace(localePath('/matchups/sheets/create/info'))
    }
  },
  { immediate: true }
)

useHead({
  title: () => t('matchupGuideCreate.titleMatchups'),
})
</script>
