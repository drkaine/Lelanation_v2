<template>
  <MatchupGuideDetailView v-if="hydratedGuide" :guide="hydratedGuide" embedded />
</template>

<script setup lang="ts">
import type { MatchupGuide } from '@lelanation/shared-types'
import MatchupGuideDetailView from '~/components/MatchupGuideDiscovery/MatchupGuideDetailView.vue'
import { fetchMatchupGuideById } from '~/composables/useMatchupGuideDetail'
import { ensureMatchupGuideBuildHydrated } from '~/utils/matchupGuideBuildResolve'

const props = defineProps<{
  guide: MatchupGuide
}>()

const { data: hydratedGuide } = await useAsyncData(
  () => `build-detail-guide-${props.guide.id}`,
  async () => {
    const full = (await fetchMatchupGuideById(props.guide.id)) ?? props.guide
    return ensureMatchupGuideBuildHydrated(full)
  },
  { watch: [() => props.guide.id] }
)
</script>
