<template>
  <BuildCreateItemPageView
    full-width
    :is-streamer-mode="isLayoutScaled"
    :has-champion="hasChampion"
    :highlight-missing-fields="highlightMissingFields"
    :item-selector-component="ItemSelector"
    :build-card-component="BuildCard"
    :build-save-button-component="MatchupGuideBuildCardSpacer"
    :build-menu-steps-component="MatchupGuideBuildMenuSteps"
    @highlight-missing="highlightMissingFields = $event"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { BuildCreateItemPageView } from '@lelanation/builds-ui'
import BuildCard from '~/components/Build/BuildCard.vue'
import ItemSelector from '~/components/Build/ItemSelector.vue'
import MatchupGuideBuildMenuSteps from '~/components/matchups/MatchupGuideBuildMenuSteps.vue'
import MatchupGuideBuildCardSpacer from '~/components/matchups/MatchupGuideBuildCardSpacer.vue'
import { useLayoutScaled } from '~/composables/useLayoutScaled'
import { useMatchupGuideCreateBuilder } from '~/composables/useMatchupGuideCreateBuilder'

definePageMeta({
  layout: false,
})

const { t } = useI18n()
const { buildStore } = useMatchupGuideCreateBuilder('item')
const { isLayoutScaled } = useLayoutScaled()
const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))
const highlightMissingFields = ref(false)

useHead({
  title: () => t('matchupGuideCreate.titleItem'),
})
</script>
