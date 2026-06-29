<template>
  <BuildCreateInfoPageView
    :is-streamer-mode="isLayoutScaled"
    :has-champion="hasChampion"
    :highlight-missing-fields="highlightMissingFields"
    :pending-champion-change="Boolean(buildStore.pendingChampionChange)"
    :stats-category="statsCategory"
    :basic-label="t('stats.categories.basic')"
    :advanced-label="t('stats.categories.advanced')"
    :economic-label="t('stats.categories.economic')"
    :confirm-title="t('matchupGuideCreate.changeChampionTitle')"
    :confirm-body="t('matchupGuideCreate.changeChampionBody')"
    :cancel-label="t('matchupGuideCreate.cancel')"
    :confirm-label="t('matchupGuideCreate.confirm')"
    :build-card-component="BuildCard"
    :build-save-button-component="MatchupGuideBuilderContinueButton"
    :stats-table-component="StatsTable"
    :build-menu-steps-component="MatchupGuideBuildMenuSteps"
    @highlight-missing="highlightMissingFields = $event"
    @update:stats-category="statsCategory = $event"
    @cancel-champion-change="buildStore.cancelChampionChange()"
    @confirm-champion-change="buildStore.confirmChampionChange()"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { BuildCreateInfoPageView } from '@lelanation/builds-ui'
import BuildCard from '~/components/Build/BuildCard.vue'
import StatsTable from '~/components/Build/StatsTable.vue'
import MatchupGuideBuildMenuSteps from '~/components/matchups/MatchupGuideBuildMenuSteps.vue'
import MatchupGuideBuilderContinueButton from '~/components/matchups/MatchupGuideBuilderContinueButton.vue'
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
const { buildStore } = useMatchupGuideCreateBuilder('info')
const { isLayoutScaled } = useLayoutScaled()
const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))
const statsCategory = ref<'basic' | 'advanced' | 'economic'>('basic')
const highlightMissingFields = ref(false)

watch(
  () => buildStore.currentBuild?.champion,
  champion => {
    if (!champion && route.path.includes('/matchups/sheets/create/info')) {
      router.replace(localePath('/matchups/sheets/create/champion'))
    }
  },
  { immediate: true }
)

onMounted(() => {
  if (!buildStore.currentBuild?.roles) {
    buildStore.setRoles([])
  }
  buildStore.ensureBuildChampionStats().catch(() => undefined)
})

useHead({
  title: () => t('matchupGuideCreate.titleInfo'),
})
</script>
