<template>
  <div class="matchup-guide-creator min-h-screen text-text">
    <div class="max-w-8xl mx-auto px-2">
      <div class="mb-3">
        <MatchupGuideBuildMenuSteps current-step="write" :has-champion="hasChampion" />
      </div>

      <div
        class="matchup-guide-layout mb-6 flex flex-col items-start gap-4 lg:flex-row"
        :class="{ 'matchup-guide-layout--streamer': isStreamerMode }"
      >
        <div class="matchup-guide-write-col w-full flex-1 lg:order-2">
          <MatchupGuideMatchupDetailEditor />
        </div>

        <div class="matchup-guide-sidebar w-full flex-shrink-0 lg:order-1 lg:w-[320px]">
          <MatchupGuideMatchupTargetSelector />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import MatchupGuideBuildMenuSteps from '~/components/matchups/MatchupGuideBuildMenuSteps.vue'
import MatchupGuideMatchupDetailEditor from '~/components/matchups/MatchupGuideMatchupDetailEditor.vue'
import MatchupGuideMatchupTargetSelector from '~/components/matchups/MatchupGuideMatchupTargetSelector.vue'
import { useMatchupGuideDraftStore } from '~/stores/MatchupGuideDraftStore'

defineProps<{
  isStreamerMode: boolean
  hasChampion: boolean
}>()

const draftStore = useMatchupGuideDraftStore()

onMounted(() => {
  draftStore.hydrateFromStorage()
  draftStore.ensureDefaultCohortAssignments()
  draftStore.reconcileCohortColors()
  draftStore.syncSelectedOpponentIds()
})
</script>

<style scoped>
.matchup-guide-creator {
  padding: var(--build-create-page-padding-top, 1rem) 1rem 1rem;
  margin-top: var(--build-create-page-lift, 0px);
}

.matchup-guide-write-col,
.matchup-guide-sidebar {
  align-self: flex-start;
}
</style>
