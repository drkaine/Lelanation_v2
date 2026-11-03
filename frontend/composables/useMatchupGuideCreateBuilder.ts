import type { LocationQuery } from 'vue-router'
import { computed, onMounted, ref, watch } from 'vue'
import { useBuildStore } from '~/stores/BuildStore'
import {
  useMatchupGuideDraftStore,
  type MatchupGuideDraftStep,
} from '~/stores/MatchupGuideDraftStore'
import { startEditingMatchupGuide } from '~/utils/matchupGuideEditSession'
import { bootstrapMatchupGuideFromBuild } from '~/utils/matchupGuideFromBuildSession'
import { readBuilderGuideQuery, type BuilderGuideSubstep } from '~/utils/builderGuideStep'

export type MatchupGuideBuilderStep = MatchupGuideDraftStep

export function bootstrapMatchupGuideCreateSession(routeQuery?: LocationQuery | null) {
  const buildStore = useBuildStore()
  const draftStore = useMatchupGuideDraftStore()

  if (import.meta.server) return

  const { guideEditId, fromBuildId } = readBuilderGuideQuery(routeQuery ?? {})

  // La session d'édition est chargée de façon asynchrone dans useMatchupGuideCreateBuilder.
  if (guideEditId) return

  if (fromBuildId) {
    bootstrapMatchupGuideFromBuild(fromBuildId)
    buildStore.ensureBuildChampionStats().catch(() => undefined)
    return
  }

  draftStore.hydrateFromStorage()
  if (!draftStore.guideId) {
    draftStore.startNewGuide()
  }

  buildStore.ensureCurrentBuild()
  draftStore.syncGuideChampion(buildStore.currentBuild?.champion?.id ?? null)
  buildStore.ensureBuildChampionStats().catch(() => undefined)
}

export function useMatchupGuideCreateBuilder(step: BuilderGuideSubstep) {
  const buildStore = useBuildStore()
  const draftStore = useMatchupGuideDraftStore()
  const route = useRoute()

  const editId = readBuilderGuideQuery(route.query).guideEditId
  const editSessionReady = ref(!editId)

  if (import.meta.client && !editId) {
    bootstrapMatchupGuideCreateSession(route.query)
  }

  const sessionReady = computed(
    () =>
      import.meta.server ||
      ((!editId || editSessionReady.value) &&
        draftStore.hydrated &&
        Boolean(buildStore.currentBuild))
  )

  onMounted(async () => {
    if (editId) {
      await startEditingMatchupGuide(editId)
      editSessionReady.value = true
    } else {
      draftStore.hydrateFromStorage()
    }

    draftStore.setLastStep(step)
    buildStore.setLastBuilderStep('guide')
  })

  watch(
    () => buildStore.currentBuild?.champion?.id ?? null,
    championId => {
      draftStore.syncGuideChampion(championId)
    }
  )

  return { buildStore, draftStore, route, sessionReady, editId }
}
