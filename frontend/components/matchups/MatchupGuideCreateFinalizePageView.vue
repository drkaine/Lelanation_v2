<template>
  <div class="matchup-guide-creator min-h-screen text-text">
    <div class="mx-auto max-w-3xl px-2">
      <div class="mb-3">
        <MatchupGuideBuildMenuSteps
          current-step="finalize"
          :has-champion="hasChampion"
          :can-open-matchups="true"
          :can-open-write="true"
          :can-open-finalize="true"
        />
      </div>

      <MatchupGuideFinalSaveButton class="mb-4" />
      <MatchupGuideFinalizeForm />
    </div>
  </div>
</template>

<script setup lang="ts">
import MatchupGuideBuildMenuSteps from '~/components/matchups/MatchupGuideBuildMenuSteps.vue'
import MatchupGuideFinalSaveButton from '~/components/matchups/MatchupGuideFinalSaveButton.vue'
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
