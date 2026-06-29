<template>
  <MatchupGuideCreateFinalizePageView :has-champion="hasChampion" />
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import MatchupGuideCreateFinalizePageView from '~/components/matchups/MatchupGuideCreateFinalizePageView.vue'
import { useMatchupGuideCreateBuilder } from '~/composables/useMatchupGuideCreateBuilder'

definePageMeta({
  layout: false,
  middleware: 'matchup-guides-admin',
})

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const localePath = useLocalePath()
const { buildStore, draftStore, sessionReady } = useMatchupGuideCreateBuilder('finalize')

const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))

watch(
  () => [sessionReady.value, buildStore.isBuildValid, draftStore.matchupEntries.length] as const,
  ([ready, valid, count]) => {
    if (!ready) return
    if (!valid && route.path.includes('/matchups/sheets/create/finalize')) {
      router.replace(localePath('/matchups/sheets/create/info'))
      return
    }
    if (count < 2 && route.path.includes('/matchups/sheets/create/finalize')) {
      router.replace(localePath('/matchups/sheets/create/matchups'))
    }
  },
  { immediate: true }
)

useHead({
  title: () => t('matchupGuideCreate.titleFinalize'),
})
</script>
