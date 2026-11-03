import { useBuildStore } from '~/stores/BuildStore'
import { useMatchupGuideDraftStore } from '~/stores/MatchupGuideDraftStore'

export function startMatchupGuideFromBuild(buildId: string): boolean {
  if (import.meta.server) return false

  const buildStore = useBuildStore()
  const draftStore = useMatchupGuideDraftStore()

  const loaded = buildStore.startEditingBuild(buildId)
  if (!loaded) return false

  draftStore.startNewGuide()
  draftStore.syncGuideChampion(buildStore.currentBuild?.champion?.id ?? null)
  draftStore.setLastStep('matchups')

  return true
}

export function bootstrapMatchupGuideFromBuild(fromBuildId: string): boolean {
  const buildStore = useBuildStore()
  const draftStore = useMatchupGuideDraftStore()

  if (buildStore.editSourceBuildId === fromBuildId && draftStore.guideId) {
    draftStore.hydrateFromStorage()
    draftStore.syncGuideChampion(buildStore.currentBuild?.champion?.id ?? null)
    return true
  }

  return startMatchupGuideFromBuild(fromBuildId)
}
