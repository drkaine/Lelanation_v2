<template>
  <div class="matchup-guide-creator min-h-screen text-text">
    <div class="max-w-8xl mx-auto px-2">
      <div class="mb-3">
        <MatchupGuideBuildMenuSteps current-step="matchups" :has-champion="hasChampion" />
      </div>

      <p v-if="opponentProgress < requiredOpponents" class="matchup-guide-unlock-hint">
        {{
          t('matchupGuideCreate.opponentProgress', {
            count: opponentProgress,
            required: requiredOpponents,
          })
        }}
      </p>

      <div
        class="matchup-guide-layout mb-6 flex flex-col items-start gap-4 md:flex-row"
        :class="{ 'matchup-guide-layout--streamer': isStreamerMode }"
      >
        <div class="matchup-guide-selector-col w-full flex-1 md:order-2">
          <MatchupGuideOpponentSelector :exclude-champion-id="guideChampionId" />
        </div>

        <div class="matchup-scale-wrapper w-full flex-shrink-0 md:order-1">
          <MatchupGuideMatchupScale />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MatchupGuideBuildMenuSteps from '~/components/matchups/MatchupGuideBuildMenuSteps.vue'
import MatchupGuideMatchupScale from '~/components/matchups/MatchupGuideMatchupScale.vue'
import MatchupGuideOpponentSelector from '~/components/matchups/MatchupGuideOpponentSelector.vue'
import { useMatchupGuideDraftStore } from '~/stores/MatchupGuideDraftStore'
import { MATCHUP_GUIDE_MIN_OPPONENTS_FOR_WRITE } from '~/utils/matchupGuideCreateSteps'

defineProps<{
  isStreamerMode: boolean
  hasChampion: boolean
  guideChampionId: string | null
}>()

const { t } = useI18n()
const draftStore = useMatchupGuideDraftStore()

const requiredOpponents = MATCHUP_GUIDE_MIN_OPPONENTS_FOR_WRITE
const opponentProgress = computed(() => draftStore.matchupEntries.length)
</script>

<style scoped>
.matchup-guide-creator {
  padding: var(--build-create-page-padding-top, 1rem) 1rem 1rem;
  margin-top: var(--build-create-page-lift, 0px);
}

.matchup-guide-unlock-hint {
  margin: 0 0 0.75rem;
  text-align: center;
  font-size: 0.78rem;
  color: rgb(var(--rgb-text) / 0.65);
}

.matchup-guide-layout {
  --matchup-scale-width: 320px;
}

.matchup-guide-layout--streamer {
  --matchup-scale-width: 390px;
}

.matchup-scale-wrapper {
  width: min(100%, var(--matchup-scale-width));
  margin-top: 0;
}

.matchup-guide-selector-col {
  align-self: flex-start;
}

@media (max-width: 768px) {
  .matchup-guide-layout--streamer {
    --matchup-scale-width: calc(100vw - 1.5rem);
  }

  .matchup-scale-wrapper {
    width: 100%;
    max-width: 100%;
  }
}
</style>
