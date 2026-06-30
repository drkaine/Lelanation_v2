<template>
  <div class="matchup-guide-creator min-h-screen text-text">
    <div class="w-full px-3 sm:px-5 lg:px-6">
      <div class="mb-3">
        <MatchupGuideBuildMenuSteps current-step="write" :has-champion="hasChampion" />
      </div>

      <div class="matchup-guide-write-layout space-y-4">
        <div class="matchup-guide-layout flex flex-col items-start gap-4 lg:flex-row">
          <div class="matchup-guide-sidebar w-full flex-shrink-0 lg:w-[320px]">
            <MatchupGuideMatchupTargetSelector />
          </div>

          <div class="matchup-guide-write-col w-full min-w-0 flex-1">
            <MatchupGuideMatchupDetailEditor />
          </div>
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
  hasChampion: boolean
}>()

const draftStore = useMatchupGuideDraftStore()

onMounted(() => {
  draftStore.hydrateFromStorage()
  draftStore.reconcileCohortColors()
  draftStore.syncSelectedOpponentIds()
})
</script>

<style scoped>
.matchup-guide-creator {
  padding: var(--build-create-page-padding-top, 1rem) 1rem 1rem;
  margin-top: var(--build-create-page-lift, 0px);
}

.matchup-guide-write-layout {
  width: 100%;
}

.matchup-guide-write-col,
.matchup-guide-sidebar {
  align-self: flex-start;
}
</style>
