<template>
  <MatchupGuideCreateWritePageView :has-champion="hasChampion" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MatchupGuideCreateWritePageView from '~/components/matchups/MatchupGuideCreateWritePageView.vue'
import { useBuilderGuideStepPage } from '~/composables/useBuilderGuideStepPage'

definePageMeta({
  layout: false,
})

const { t } = useI18n()
const { buildStore } = useBuilderGuideStepPage('write')

const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))

useHead({
  title: () => t('matchupGuideCreate.titleWrite'),
})
</script>
