import { ref, watch, type Ref } from 'vue'
import type { Build, CalculatedStats } from '@lelanation/shared-types'
import { useBuildStore, type BuildStoreSession } from '~/stores/BuildStore'
import { theorycraftDetailScope } from '~/utils/theorycraftStorageScope'
import {
  cloneBuild,
  theorycraftVsStorageKey,
  useTheorycraftVs,
} from '~/composables/useTheorycraftVs'

interface StoreSnapshot {
  currentBuild: Build | null
  calculatedStats: CalculatedStats | null
  builderSession: BuildStoreSession
  theorycraftLinkedToBuilder: boolean
  displayedVariant: 'main' | number
  statsLevel: number
}

/** Theorycraft tab of a build detail page: a vs session on a copy of the build, store restored on leave. */
export function useBuildDetailTheorycraft(sourceBuild: Ref<Build | null>) {
  const buildStore = useBuildStore()
  const { t } = useI18n()

  const isActive = ref(false)
  const savedSnapshot = ref<StoreSnapshot | null>(null)

  const vs = useTheorycraftVs({
    storageKey: () =>
      sourceBuild.value?.id ? theorycraftVsStorageKey(sourceBuild.value.id) : null,
    scope: side =>
      sourceBuild.value?.id ? theorycraftDetailScope(sourceBuild.value.id, side) : null,
    isActive: () => isActive.value,
    t,
    allyRegionsLocked: true,
  })
  const { activeSide, activePanel, sideBuilds, sideCalculatedStats, allyDisplayedVariant } = vs

  function captureStoreSnapshot() {
    savedSnapshot.value = {
      currentBuild: cloneBuild(buildStore.currentBuild),
      calculatedStats: vs.storeStatsSnapshot(),
      builderSession: buildStore.builderSession,
      theorycraftLinkedToBuilder: buildStore.theorycraftLinkedToBuilder,
      displayedVariant: buildStore.displayedVariant,
      statsLevel: buildStore.statsLevel,
    }
  }

  function restoreStoreSnapshot() {
    const snap = savedSnapshot.value
    if (!snap) return
    // Function form: replaces values (the object form would deep-merge the saved build).
    buildStore.$patch(state => {
      state.currentBuild = snap.currentBuild
      state.calculatedStats = snap.calculatedStats
      state.builderSession = snap.builderSession
      state.theorycraftLinkedToBuilder = snap.theorycraftLinkedToBuilder
      state.displayedVariant = snap.displayedVariant
      state.statsLevel = snap.statsLevel
    })
    savedSnapshot.value = null
  }

  function syncAllyFromSource(build: Build) {
    const cloned = cloneBuild(build)
    if (!cloned) return
    sideBuilds.value.ally = cloned
    allyDisplayedVariant.value = buildStore.displayedVariant
    vs.setAllyInStore(cloned)
    buildStore.activateTheorycraftMode()
    sideCalculatedStats.value.ally = vs.storeStatsSnapshot()
    vs.theorycraftLevel.value = buildStore.statsLevel
  }

  function enter() {
    const build = sourceBuild.value
    if (!build || isActive.value) return
    captureStoreSnapshot()
    buildStore.suspendDraftPersistence()
    vs.isHydratingVsState.value = true
    activeSide.value = 'ally'
    activePanel.value = 'theorycraft'

    const stored = vs.loadVsState()
    const sameChampion = stored?.ally?.champion?.id === build.champion?.id

    if (sameChampion && stored?.ally) {
      sideBuilds.value.ally = stored.ally
      allyDisplayedVariant.value = stored.allyDisplayedVariant ?? 'main'
      buildStore.setTheorycraftStorageScope(theorycraftDetailScope(build.id, 'ally'))
      vs.setAllyInStore(cloneBuild(stored.ally)!)
      buildStore.activateTheorycraftMode()
      sideCalculatedStats.value.ally = vs.storeStatsSnapshot()
    } else {
      syncAllyFromSource(build)
    }

    sideBuilds.value.enemy = sameChampion && stored?.enemy ? stored.enemy : vs.emptyEnemyBuild()
    sideCalculatedStats.value.enemy = null

    if (stored?.activeSide === 'enemy') vs.restoreActiveSide(stored)

    vs.isHydratingVsState.value = false
    vs.persistVsState()
    isActive.value = true
    vs.loadChampionDataForPanel().catch(() => undefined)
  }

  function leave() {
    if (!isActive.value) return
    vs.persistActiveSideBuild()
    vs.persistActiveSideStats()
    vs.persistVsState()
    buildStore.deactivateTheorycraftMode({ skipPersist: true })
    restoreStoreSnapshot()
    buildStore.resumeDraftPersistence()
    isActive.value = false
  }

  watch(sourceBuild, build => {
    if (!isActive.value || !build || activeSide.value !== 'ally') return
    syncAllyFromSource(build)
  })

  return {
    activeSide,
    activePanel,
    sideBuilds,
    sideCalculatedStats,
    sideFlipped: vs.sideFlipped,
    sideBackFace: vs.sideBackFace,
    theorycraftLevel: vs.theorycraftLevel,
    championData: vs.championData,
    championId: vs.championId,
    maxChampionLevel: vs.maxChampionLevel,
    theorycraftStats: vs.theorycraftStats,
    opponentTheorycraftStats: vs.opponentTheorycraftStats,
    opponentRawStats: vs.opponentRawStats,
    attackerRawStats: vs.attackerRawStats,
    enter,
    leave,
    activateSide: vs.activateSide,
    statsFlipActive: vs.statsFlipActive,
    statsFlipTitle: vs.statsFlipTitle,
    theorycraftPanelActive: vs.theorycraftPanelActive,
    toggleDescriptionFlip: vs.toggleDescriptionFlip,
    toggleStatsFlip: vs.toggleStatsFlip,
    activateTheorycraft: vs.activateTheorycraft,
    onSelectRegion: vs.onSelectRegion,
    onLevelSelectChange: vs.onLevelSelectChange,
  }
}
