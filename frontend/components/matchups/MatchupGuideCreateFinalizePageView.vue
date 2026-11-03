<template>
  <div class="matchup-guide-creator min-h-screen text-text">
    <div class="w-full px-3 sm:px-5 lg:px-6">
      <div class="mb-3">
        <BuildMenuSteps current-step="guide" :has-champion="hasChampion" />
        <BuildGuideSubSteps current-step="finalize" />
      </div>

      <BuildSaveButton class="mb-4" />
      <MatchupGuideFinalizeForm />
    </div>
  </div>
</template>

<script setup lang="ts">
import BuildMenuSteps from '~/components/Build/BuildMenuSteps.vue'
import BuildGuideSubSteps from '~/components/Build/BuildGuideSubSteps.vue'
import BuildSaveButton from '~/components/Build/BuildSaveButton.vue'
import MatchupGuideFinalizeForm from '~/components/matchups/MatchupGuideFinalizeForm.vue'

defineProps<{
  hasChampion: boolean
}>()
</script>

<style scoped>
.matchup-guide-creator {
  padding: var(--build-create-page-padding-top, 1rem) 1rem 1rem;
  margin-top: var(--build-create-page-lift, 0px);
}
</style>
