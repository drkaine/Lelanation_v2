import { computed, ref, toRaw, watch, type Ref } from 'vue'
import type { Build, CalculatedStats } from '@lelanation/shared-types'
import { useChampionData } from '~/composables/useChampionData'
import { useBuildStore } from '~/stores/BuildStore'
import { useItemsStore } from '~/stores/ItemsStore'
import type { TheorycraftPanel } from '~/components/Build/TheorycraftWorkspacePanel.vue'
import type { TheorycraftBuildStats } from '~/types/theorycraft'
import { toTheorycraftBuildStats } from '~/utils/theorycraftStats'

const THEORYCRAFT_VS_STATE_STORAGE_PREFIX = 'lelanation_theorycraft_vs_state_v1_'

type BuilderSession = 'create' | 'theorycraft'
type TheorycraftSide = 'ally' | 'enemy'

interface StoreSnapshot {
  currentBuild: Build | null
  calculatedStats: CalculatedStats | null
  builderSession: BuilderSession
  theorycraftLinkedToBuilder: boolean
  displayedVariant: 'main' | number
  statsLevel: number
}

interface TheorycraftVsStoredState {
  ally: Build | null
  enemy: Build | null
  showVersus: boolean
  activeSide: TheorycraftSide
}

function cloneBuild(build: Build | null): Build | null {
  if (!build) return null
  try {
    const cloned = JSON.parse(JSON.stringify(toRaw(build))) as Build
    return {
      ...cloned,
      subBuilds: [],
      descriptionMode: 'single',
    } as Build
  } catch {
    return null
  }
}

function createEmptyTheorycraftBuild(name: string): Build {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name,
    author: '',
    description: '',
    visibility: 'public',
    champion: null,
    items: [],
    runes: null,
    shards: { slot1: 5008, slot2: 5008, slot3: 5011 },
    summonerSpells: [null, null],
    skillOrder: {
      firstThreeUps: [null as never, null as never, null as never],
      skillUpOrder: [null as never, null as never, null as never],
    },
    roles: [],
    tags: [],
    upvote: 0,
    downvote: 0,
    gameVersion: '',
    createdAt: now,
    updatedAt: now,
    subBuilds: [],
    descriptionMode: 'single',
  } as Build
}

export function useBuildDetailTheorycraft(sourceBuild: Ref<Build | null>) {
  const buildStore = useBuildStore()
  const itemsStore = useItemsStore()
  const { loadChampion } = useChampionData()
  const { t } = useI18n()

  const isActive = ref(false)
  const savedSnapshot = ref<StoreSnapshot | null>(null)
  const activeSide = ref<TheorycraftSide>('ally')
  const activePanel = ref<TheorycraftPanel>('theorycraft')
  const showVersus = ref(false)
  const theorycraftLevel = ref(18)
  const championData = ref<Record<string, unknown> | null>(null)
  const isHydratingVsState = ref(false)

  const sideBuilds = ref<Record<TheorycraftSide, Build | null>>({
    ally: null,
    enemy: null,
  })
  const sideCalculatedStats = ref<Record<TheorycraftSide, CalculatedStats | null>>({
    ally: null,
    enemy: null,
  })
  const sidePanels = ref<Record<TheorycraftSide, TheorycraftPanel>>({
    ally: 'theorycraft',
    enemy: 'theorycraft',
  })
  const sideFlipped = ref<Record<TheorycraftSide, boolean>>({
    ally: false,
    enemy: false,
  })
  const sideBackFace = ref<Record<TheorycraftSide, 'stats' | 'description'>>({
    ally: 'stats',
    enemy: 'stats',
  })

  const championId = computed(() => buildStore.currentBuild?.champion?.id ?? null)
  const maxChampionLevel = computed(() => buildStore.maxStatsLevel)

  const theorycraftStats = computed((): TheorycraftBuildStats | null => {
    const build = buildStore.displayedBuild ?? buildStore.currentBuild
    const stats = buildStore.calculatedStats
    if (!build?.champion || !stats) return null
    return toTheorycraftBuildStats(stats, build.champion, theorycraftLevel.value)
  })

  const opponentTheorycraftStats = computed((): TheorycraftBuildStats | null => {
    if (!showVersus.value) return null
    const opponentSide: TheorycraftSide = activeSide.value === 'ally' ? 'enemy' : 'ally'
    const opponentBuild = sideBuilds.value[opponentSide]
    const opponentRaw = sideCalculatedStats.value[opponentSide]
    if (!opponentBuild?.champion || !opponentRaw) return null
    return toTheorycraftBuildStats(
      opponentRaw as CalculatedStats,
      opponentBuild.champion,
      theorycraftLevel.value
    )
  })

  const opponentRawStats = computed(() => {
    if (!showVersus.value) return null
    const opponentSide: TheorycraftSide = activeSide.value === 'ally' ? 'enemy' : 'ally'
    return sideCalculatedStats.value[opponentSide]
  })

  const attackerRawStats = computed(() => sideCalculatedStats.value[activeSide.value] ?? null)

  function vsStateStorageKey(): string | null {
    const buildId = sourceBuild.value?.id
    return buildId ? `${THEORYCRAFT_VS_STATE_STORAGE_PREFIX}${buildId}` : null
  }

  function persistActiveSideBuild() {
    sideBuilds.value[activeSide.value] = cloneBuild(buildStore.currentBuild)
  }

  function persistActiveSideStats() {
    sideCalculatedStats.value[activeSide.value] = buildStore.calculatedStats
      ? ({ ...buildStore.calculatedStats } as CalculatedStats)
      : null
  }

  function loadSideBuild(side: TheorycraftSide) {
    const target = cloneBuild(sideBuilds.value[side])
    if (!target) return
    buildStore.setCurrentBuild(target)
    buildStore.activateTheorycraftMode()
  }

  function persistVsState() {
    const key = vsStateStorageKey()
    if (import.meta.server || !key || isHydratingVsState.value) return
    try {
      const payload: TheorycraftVsStoredState = {
        ally: cloneBuild(sideBuilds.value.ally),
        enemy: cloneBuild(sideBuilds.value.enemy),
        showVersus: showVersus.value,
        activeSide: activeSide.value,
      }
      localStorage.setItem(key, JSON.stringify(payload))
    } catch {
      // ignore
    }
  }

  function loadVsState(): TheorycraftVsStoredState | null {
    const key = vsStateStorageKey()
    if (import.meta.server || !key) return null
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<TheorycraftVsStoredState>
      return {
        ally: cloneBuild((parsed.ally as Build | null) ?? null),
        enemy: cloneBuild((parsed.enemy as Build | null) ?? null),
        showVersus: Boolean(parsed.showVersus),
        activeSide: parsed.activeSide === 'enemy' ? 'enemy' : 'ally',
      }
    } catch {
      return null
    }
  }

  function captureStoreSnapshot() {
    savedSnapshot.value = {
      currentBuild: buildStore.currentBuild ? cloneBuild(buildStore.currentBuild) : null,
      calculatedStats: buildStore.calculatedStats
        ? ({ ...buildStore.calculatedStats } as CalculatedStats)
        : null,
      builderSession: buildStore.builderSession,
      theorycraftLinkedToBuilder: buildStore.theorycraftLinkedToBuilder,
      displayedVariant: buildStore.displayedVariant,
      statsLevel: buildStore.statsLevel,
    }
  }

  function restoreStoreSnapshot() {
    const snap = savedSnapshot.value
    if (!snap) return
    buildStore.$patch({
      currentBuild: snap.currentBuild,
      calculatedStats: snap.calculatedStats,
      builderSession: snap.builderSession,
      theorycraftLinkedToBuilder: snap.theorycraftLinkedToBuilder,
      displayedVariant: snap.displayedVariant,
      statsLevel: snap.statsLevel,
    })
    savedSnapshot.value = null
  }

  function syncAllyFromSource(build: Build) {
    const cloned = cloneBuild(build)
    if (!cloned) return
    sideBuilds.value.ally = cloned
    buildStore.setCurrentBuild(cloned)
    buildStore.activateTheorycraftMode()
    sideCalculatedStats.value.ally = buildStore.calculatedStats
      ? ({ ...buildStore.calculatedStats } as CalculatedStats)
      : null
    theorycraftLevel.value = buildStore.statsLevel
  }

  function enter() {
    const build = sourceBuild.value
    if (!build || isActive.value) return
    captureStoreSnapshot()
    isHydratingVsState.value = true
    activeSide.value = 'ally'
    activePanel.value = 'theorycraft'
    syncAllyFromSource(build)

    const stored = loadVsState()
    const canRestore =
      Boolean(stored?.showVersus) &&
      Boolean(stored?.enemy) &&
      stored?.ally?.champion?.id === build.champion?.id

    if (canRestore && stored) {
      sideBuilds.value.enemy = stored.enemy
      sideCalculatedStats.value.enemy = null
      showVersus.value = true
      if (stored.activeSide === 'enemy') {
        activeSide.value = 'enemy'
        activePanel.value = sidePanels.value.enemy ?? 'theorycraft'
        loadSideBuild('enemy')
      }
    } else {
      sideBuilds.value.enemy = null
      sideCalculatedStats.value.enemy = null
      showVersus.value = false
    }

    isHydratingVsState.value = false
    persistVsState()
    isActive.value = true
    loadChampionDataForPanel().catch(() => undefined)
  }

  function leave() {
    if (!isActive.value) return
    persistActiveSideBuild()
    persistActiveSideStats()
    activeSide.value = 'ally'
    if (sideBuilds.value.ally) {
      const ally = cloneBuild(sideBuilds.value.ally)
      if (ally) buildStore.setCurrentBuild(ally)
    }
    persistVsState()
    buildStore.deactivateTheorycraftMode()
    restoreStoreSnapshot()
    isActive.value = false
  }

  function activateSide(side: TheorycraftSide) {
    if (activeSide.value === side) return
    persistActiveSideBuild()
    persistActiveSideStats()
    sidePanels.value[activeSide.value] = activePanel.value
    activeSide.value = side
    activePanel.value = sidePanels.value[side] ?? 'theorycraft'
    if (!sideBuilds.value[side]) {
      sideBuilds.value[side] = createEmptyTheorycraftBuild(
        side === 'enemy' ? t('theorycraft.panel.enemyCard') : 'Build'
      )
    }
    loadSideBuild(side)
  }

  function toggleVersus() {
    if (showVersus.value) {
      if (activeSide.value === 'enemy') activateSide('ally')
      showVersus.value = false
      persistVsState()
      return
    }
    persistActiveSideBuild()
    if (!sideBuilds.value.enemy) {
      sideBuilds.value.enemy = createEmptyTheorycraftBuild(t('theorycraft.panel.enemyCard'))
    }
    showVersus.value = true
    persistVsState()
  }

  function statsFlipActive(side: TheorycraftSide): boolean {
    return sideFlipped.value[side] && sideBackFace.value[side] === 'stats'
  }

  function statsFlipTitle(side: TheorycraftSide): string {
    return statsFlipActive(side)
      ? t('theorycraft.stats.showBuild')
      : t('theorycraft.stats.showStats')
  }

  function theorycraftPanelActive(side: TheorycraftSide): boolean {
    return activeSide.value === side && activePanel.value === 'theorycraft'
  }

  function toggleDescriptionFlip(side: TheorycraftSide) {
    if (activeSide.value !== side) activateSide(side)
    if (sideFlipped.value[side] && sideBackFace.value[side] === 'description') {
      sideFlipped.value = { ...sideFlipped.value, [side]: false }
      return
    }
    sideBackFace.value = { ...sideBackFace.value, [side]: 'description' }
    sideFlipped.value = { ...sideFlipped.value, [side]: true }
  }

  function toggleStatsFlip(side: TheorycraftSide) {
    if (activeSide.value !== side) activateSide(side)
    if (statsFlipActive(side)) {
      sideFlipped.value = { ...sideFlipped.value, [side]: false }
      return
    }
    sideBackFace.value = { ...sideBackFace.value, [side]: 'stats' }
    sideFlipped.value = { ...sideFlipped.value, [side]: true }
  }

  function activateTheorycraft(side: TheorycraftSide) {
    if (activeSide.value !== side) activateSide(side)
    activePanel.value = 'theorycraft'
    sidePanels.value[side] = 'theorycraft'
  }

  function onSelectRegion(side: TheorycraftSide, region: 'champion' | 'items' | 'runes') {
    if (activeSide.value !== side) activateSide(side)
    if (side === 'ally') return
    activePanel.value = region
    sidePanels.value[side] = region
  }

  function onLevelChange(level: number) {
    theorycraftLevel.value = level
    buildStore.setStatsLevel(level)
  }

  function onLevelSelectChange(event: Event) {
    const value = Number((event.target as HTMLSelectElement).value)
    if (Number.isFinite(value)) onLevelChange(value)
  }

  async function loadChampionDataForPanel() {
    const id = championId.value
    if (!id) {
      championData.value = null
      return
    }
    const data = await loadChampion(id)
    championData.value = data
    if (data) buildStore.mergeTheorycraftChampionDetail(data)
  }

  watch(championId, () => {
    loadChampionDataForPanel().catch(() => undefined)
  })

  watch(sourceBuild, build => {
    if (!isActive.value || !build || activeSide.value !== 'ally') return
    syncAllyFromSource(build)
  })

  watch(
    () => buildStore.currentBuild,
    build => {
      if (!isActive.value) return
      sideBuilds.value[activeSide.value] = cloneBuild(build)
    },
    { deep: true }
  )

  watch(
    () => buildStore.calculatedStats,
    stats => {
      if (!isActive.value) return
      sideCalculatedStats.value[activeSide.value] = stats ? ({ ...stats } as CalculatedStats) : null
    },
    { deep: true }
  )

  watch(
    [sideBuilds, showVersus, activeSide],
    () => {
      if (isHydratingVsState.value || !isActive.value) return
      persistVsState()
    },
    { deep: true }
  )

  watch(activePanel, panel => {
    if (!isActive.value) return
    sidePanels.value[activeSide.value] = panel
  })

  watch(
    () => buildStore.statsLevel,
    level => {
      theorycraftLevel.value = level
    }
  )

  watch(maxChampionLevel, max => {
    if (theorycraftLevel.value > max) onLevelChange(max)
  })

  watch(
    () => itemsStore.items.length,
    (length, previous) => {
      if (length > 0 && (previous ?? 0) === 0 && isActive.value) {
        buildStore.recalculateStats()
      }
    }
  )

  return {
    activeSide,
    activePanel,
    showVersus,
    sideBuilds,
    sideCalculatedStats,
    sideFlipped,
    sideBackFace,
    theorycraftLevel,
    championData,
    championId,
    maxChampionLevel,
    theorycraftStats,
    opponentTheorycraftStats,
    opponentRawStats,
    attackerRawStats,
    enter,
    leave,
    activateSide,
    toggleVersus,
    statsFlipActive,
    statsFlipTitle,
    theorycraftPanelActive,
    toggleDescriptionFlip,
    toggleStatsFlip,
    activateTheorycraft,
    onSelectRegion,
    onLevelSelectChange,
  }
}
