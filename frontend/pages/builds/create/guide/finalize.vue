<template>
  <MatchupGuideCreateFinalizePageView :has-champion="hasChampion" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MatchupGuideCreateFinalizePageView from '~/components/matchups/MatchupGuideCreateFinalizePageView.vue'
import { useBuilderGuideStepPage } from '~/composables/useBuilderGuideStepPage'

definePageMeta({
  layout: false,
})

const { t } = useI18n()
const { buildStore } = useBuilderGuideStepPage('finalize')

const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))

useHead({
  title: () => t('matchupGuideCreate.titleFinalize'),
})
</script>
