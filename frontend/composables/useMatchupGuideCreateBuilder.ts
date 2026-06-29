import { onMounted } from 'vue'
import { useBuildStore } from '~/stores/BuildStore'
import { useMatchupGuideDraftStore } from '~/stores/MatchupGuideDraftStore'

export type MatchupGuideBuilderStep = 'champion' | 'rune' | 'item' | 'info' | 'matchups'

export function useMatchupGuideCreateBuilder(step: MatchupGuideBuilderStep) {
  const buildStore = useBuildStore()
  const draftStore = useMatchupGuideDraftStore()
  const route = useRoute()

  onMounted(() => {
    if (!draftStore.guideId) {
      draftStore.startNewGuide()
    }
    buildStore.ensureCurrentBuild()
    if (step !== 'matchups') {
      buildStore.setLastBuilderStep(step === 'champion' ? 'champion' : step)
    }
  })

  return { buildStore, draftStore, route }
}
