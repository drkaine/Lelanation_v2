import { computed, onMounted, watch } from 'vue'
import { useBuildStore } from '~/stores/BuildStore'
import {
  useMatchupGuideDraftStore,
  type MatchupGuideDraftStep,
} from '~/stores/MatchupGuideDraftStore'
import { startEditingMatchupGuide } from '~/utils/matchupGuideEditSession'

export type MatchupGuideBuilderStep = MatchupGuideDraftStep

const BUILD_STEPS: MatchupGuideDraftStep[] = ['champion', 'rune', 'item', 'info']

export function bootstrapMatchupGuideCreateSession(editId: string | null) {
  const buildStore = useBuildStore()
  const draftStore = useMatchupGuideDraftStore()

  if (import.meta.server) return

  if (editId) {
    if (!draftStore.guideId || draftStore.guideId !== editId) {
      startEditingMatchupGuide(editId)
    }
  } else {
    draftStore.hydrateFromStorage()
    if (!draftStore.guideId) {
      draftStore.startNewGuide()
    }
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
  const hasScale = draftStore.matchupEntries.length >= 2

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

export function useMatchupGuideCreateBuilder(step: MatchupGuideBuilderStep) {
  const buildStore = useBuildStore()
  const draftStore = useMatchupGuideDraftStore()
  const route = useRoute()

  const editId = typeof route.query.editId === 'string' ? route.query.editId : null
  bootstrapMatchupGuideCreateSession(editId)

  const sessionReady = computed(
    () => import.meta.server || (draftStore.hydrated && Boolean(buildStore.currentBuild))
  )

  onMounted(() => {
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
