<template>
  <MatchupGuideCreateWritePageView :is-streamer-mode="isLayoutScaled" :has-champion="hasChampion" />
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import MatchupGuideCreateWritePageView from '~/components/matchups/MatchupGuideCreateWritePageView.vue'
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
const { buildStore, draftStore, sessionReady } = useMatchupGuideCreateBuilder('write')
const { isLayoutScaled } = useLayoutScaled()

const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))

watch(
  () => [sessionReady.value, buildStore.isBuildValid, draftStore.matchupEntries.length] as const,
  ([ready, valid, count]) => {
    if (!ready) return
    if (!valid && route.path.includes('/matchups/sheets/create/write')) {
      router.replace(localePath('/matchups/sheets/create/info'))
      return
    }
    if (count < 2 && route.path.includes('/matchups/sheets/create/write')) {
      router.replace(localePath('/matchups/sheets/create/matchups'))
    }
  },
  { immediate: true }
)

useHead({
  title: () => t('matchupGuideCreate.titleWrite'),
})
</script>
