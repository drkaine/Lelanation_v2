<template>
  <BuildCreateRunePageView
    full-width
    :is-streamer-mode="isLayoutScaled"
    :has-champion="hasChampion"
    :highlight-missing-fields="highlightMissingFields"
    :rune-selector-component="RuneSelector"
    :build-card-component="BuildCard"
    :build-save-button-component="MatchupGuideBuildCardSpacer"
    :build-menu-steps-component="MatchupGuideBuildMenuSteps"
    @highlight-missing="highlightMissingFields = $event"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { BuildCreateRunePageView } from '@lelanation/builds-ui'
import BuildCard from '~/components/Build/BuildCard.vue'
import RuneSelector from '~/components/Build/RuneSelector.vue'
import MatchupGuideBuildMenuSteps from '~/components/matchups/MatchupGuideBuildMenuSteps.vue'
import MatchupGuideBuildCardSpacer from '~/components/matchups/MatchupGuideBuildCardSpacer.vue'
import { useLayoutScaled } from '~/composables/useLayoutScaled'
import { useMatchupGuideCreateBuilder } from '~/composables/useMatchupGuideCreateBuilder'

definePageMeta({
  layout: false,
  middleware: 'matchup-guides-admin',
})

const { t } = useI18n()
const { buildStore } = useMatchupGuideCreateBuilder('rune')
const { isLayoutScaled } = useLayoutScaled()
const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))
const highlightMissingFields = ref(false)

useHead({
  title: () => t('matchupGuideCreate.titleRune'),
})
</script>
