import type { LocationQuery } from 'vue-router'
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

export function readMatchupGuideCreateQuery(query: LocationQuery): {
  editId: string | null
  fromBuildId: string | null
} {
  const editId = typeof query.editId === 'string' && query.editId.length > 0 ? query.editId : null
  const fromBuildId =
    typeof query.fromBuildId === 'string' && query.fromBuildId.length > 0 ? query.fromBuildId : null
  return { editId, fromBuildId }
}

export function matchupGuideCreateRouteQuery(query: LocationQuery): Record<string, string> {
  const { editId, fromBuildId } = readMatchupGuideCreateQuery(query)
  const next: Record<string, string> = {}
  if (editId) next.editId = editId
  if (fromBuildId) next.fromBuildId = fromBuildId
  return next
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
