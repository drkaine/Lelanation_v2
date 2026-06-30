import type { LocationQuery } from 'vue-router'
import { computed, onMounted, ref, watch } from 'vue'
import { useBuildStore } from '~/stores/BuildStore'
import {
  useMatchupGuideDraftStore,
  type MatchupGuideDraftStep,
} from '~/stores/MatchupGuideDraftStore'
import { startEditingMatchupGuide } from '~/utils/matchupGuideEditSession'
import {
  bootstrapMatchupGuideFromBuild,
  readMatchupGuideCreateQuery,
} from '~/utils/matchupGuideFromBuildSession'
import {
  buildMatchupGuideStepAccessContext,
  canNavigateToMatchupGuideStep,
  MATCHUP_GUIDE_MIN_OPPONENTS_FOR_WRITE,
} from '~/utils/matchupGuideCreateSteps'

export type MatchupGuideBuilderStep = MatchupGuideDraftStep

const BUILD_STEPS: MatchupGuideDraftStep[] = ['champion', 'rune', 'item', 'info']

export function bootstrapMatchupGuideCreateSession(routeQuery?: LocationQuery | null) {
  const buildStore = useBuildStore()
  const draftStore = useMatchupGuideDraftStore()

  if (import.meta.server) return

  const { editId, fromBuildId } = readMatchupGuideCreateQuery(routeQuery ?? {})

  // La session d'édition est chargée de façon asynchrone dans useMatchupGuideCreateBuilder.
  if (editId) return

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

export function resolveMatchupGuideCreateStep(): MatchupGuideDraftStep {
  const buildStore = useBuildStore()
  const draftStore = useMatchupGuideDraftStore()
  const last = draftStore.lastStep
  const buildValid = buildStore.isBuildValid
  const hasScale = draftStore.matchupEntries.length >= MATCHUP_GUIDE_MIN_OPPONENTS_FOR_WRITE

  if (last === 'finalize' || last === 'write') {
    if (buildValid && hasScale) return last
    if (buildValid) return 'matchups'
    return buildStore.getLastBuilderStep()
  }

  if (last === 'matchups') {
    if (buildValid) return 'matchups'
    return buildStore.getLastBuilderStep()
  }

  if (BUILD_STEPS.includes(last)) return last

  return buildStore.getLastBuilderStep()
}

export function canAccessMatchupGuideCreateStep(
  step: 'matchups' | 'write' | 'finalize',
  options?: { buildValid?: boolean; hasChampion?: boolean }
): boolean {
  const buildStore = useBuildStore()
  const draftStore = useMatchupGuideDraftStore()
  const context = buildMatchupGuideStepAccessContext({
    buildValid: options?.buildValid ?? buildStore.isBuildValid,
    hasChampion: options?.hasChampion ?? Boolean(buildStore.currentBuild?.champion),
    matchupEntries: draftStore.matchupEntries,
  })
  return canNavigateToMatchupGuideStep(step, context)
}

export function useMatchupGuideCreateBuilder(step: MatchupGuideBuilderStep) {
  const buildStore = useBuildStore()
  const draftStore = useMatchupGuideDraftStore()
  const route = useRoute()

  const editId = typeof route.query.editId === 'string' ? route.query.editId : null
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
    if (BUILD_STEPS.includes(step)) {
      buildStore.setLastBuilderStep(step)
    }
  })

  watch(
    () => buildStore.currentBuild?.champion?.id ?? null,
    championId => {
      draftStore.syncGuideChampion(championId)
    }
  )

  return { buildStore, draftStore, route, sessionReady, editId }
}
