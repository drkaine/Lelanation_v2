<template>
  <BuildCreateChampionPageView
    full-width
    :is-streamer-mode="isLayoutScaled"
    :has-champion="hasChampion"
    :highlight-missing-fields="highlightMissingFields"
    :pending-champion-change="Boolean(buildStore.pendingChampionChange)"
    :confirm-title="t('matchupGuideCreate.changeChampionTitle')"
    :confirm-body="t('matchupGuideCreate.changeChampionBody')"
    :cancel-label="t('matchupGuideCreate.cancel')"
    :confirm-label="t('matchupGuideCreate.confirm')"
    :champion-selector-component="ChampionSelector"
    :build-card-component="BuildCard"
    :build-save-button-component="MatchupGuideBuildCardSpacer"
    :build-menu-steps-component="MatchupGuideBuildMenuSteps"
    @highlight-missing="highlightMissingFields = $event"
    @cancel-champion-change="buildStore.cancelChampionChange()"
    @confirm-champion-change="buildStore.confirmChampionChange()"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { BuildCreateChampionPageView } from '@lelanation/builds-ui'
import BuildCard from '~/components/Build/BuildCard.vue'
import ChampionSelector from '~/components/Build/ChampionSelector.vue'
import MatchupGuideBuildMenuSteps from '~/components/matchups/MatchupGuideBuildMenuSteps.vue'
import MatchupGuideBuildCardSpacer from '~/components/matchups/MatchupGuideBuildCardSpacer.vue'
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
const { buildStore } = useMatchupGuideCreateBuilder('champion')
const { isLayoutScaled } = useLayoutScaled()
const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))
const highlightMissingFields = ref(false)

watch(hasChampion, value => {
  if (value && route.path.includes('/matchups/sheets/create/champion')) {
    const query: Record<string, string> = {}
    const editId = route.query.editId
    if (typeof editId === 'string' && editId.length > 0) query.editId = editId
    router.push(localePath({ path: '/matchups/sheets/create/rune', query }))
  }
})

useHead({
  title: () => t('matchupGuideCreate.titleChampion'),
})
</script>
