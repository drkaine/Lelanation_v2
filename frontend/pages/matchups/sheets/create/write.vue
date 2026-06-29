<template>
  <MatchupGuideCreateWritePageView :is-streamer-mode="isLayoutScaled" :has-champion="hasChampion" />
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import MatchupGuideCreateWritePageView from '~/components/matchups/MatchupGuideCreateWritePageView.vue'
import { useLayoutScaled } from '~/composables/useLayoutScaled'
import { useMatchupGuideCreateBuilder } from '~/composables/useMatchupGuideCreateBuilder'
import {
  canNavigateToMatchupGuideStep,
  buildMatchupGuideStepAccessContext,
  MATCHUP_GUIDE_MIN_OPPONENTS_FOR_WRITE,
} from '~/utils/matchupGuideCreateSteps'

definePageMeta({
  layout: false,
  middleware: 'matchup-guides-admin',
})

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const localePath = useLocalePath()
const { buildStore, draftStore, sessionReady } = useMatchupGuideCreateBuilder('write')
const { isLayoutScaled } = useLayoutScaled()

const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))

watch(
  () => [sessionReady.value, buildStore.isBuildValid, draftStore.matchupEntries] as const,
  ([ready]) => {
    if (!ready) return
    if (!route.path.includes('/matchups/sheets/create/write')) return
    const context = buildMatchupGuideStepAccessContext({
      buildValid: buildStore.isBuildValid,
      hasChampion: Boolean(buildStore.currentBuild?.champion),
      matchupEntries: draftStore.matchupEntries,
    })
    if (draftStore.matchupEntries.length < MATCHUP_GUIDE_MIN_OPPONENTS_FOR_WRITE) {
      router.replace(localePath('/matchups/sheets/create/matchups'))
      return
    }
    if (!canNavigateToMatchupGuideStep('write', context)) {
      router.replace(localePath('/matchups/sheets/create/matchups'))
    }
  },
  { immediate: true }
)

useHead({
  title: () => t('matchupGuideCreate.titleWrite'),
})
</script>
