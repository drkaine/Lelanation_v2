import { computed, ref, toRaw, watch } from 'vue'
import type { Build, CalculatedStats } from '@lelanation/shared-types'
import type { TheorycraftPanel } from '~/components/Build/TheorycraftWorkspacePanel.vue'
import { useChampionData } from '~/composables/useChampionData'
import { useBuildStore } from '~/stores/BuildStore'
import { useItemsStore } from '~/stores/ItemsStore'
import type { TheorycraftBuildStats } from '~/types/theorycraft'
import { toTheorycraftBuildStats } from '~/utils/theorycraftStats'

export type TheorycraftSide = 'ally' | 'enemy'

export interface TheorycraftVsStoredState {
  ally: Build | null
  enemy: Build | null
  activeSide: TheorycraftSide
  allyDisplayedVariant?: 'main' | number
}

export type TheorycraftVsOptions = {
  /** localStorage key of the vs state (null: not persisted yet). */
  storageKey: () => string | null
  /** Theorycraft modifiers storage scope of a side (null: keep the current one). */
  scope: (side: TheorycraftSide) => string | null
  /** Watchers only mirror the store into the sides while the session is active. */
  isActive: () => boolean
  t: (key: string) => string
  /** The ally build is read-only: selecting one of its regions does not open an editor panel. */
  allyRegionsLocked?: boolean
}

const STORAGE_PREFIX = 'lelanation_theorycraft_vs_state_v1_'

export function theorycraftVsStorageKey(id: string): string {
  return `${STORAGE_PREFIX}${id}`
}

export function cloneBuild(build: Build | null): Build | null {
  if (!build) return null
  try {
    return JSON.parse(JSON.stringify(toRaw(build))) as Build
  } catch {
    return null
  }
}

export function createEmptyTheorycraftBuild(name: string): Build {
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

function sidePair<T>(ally: T, enemy: T): Record<TheorycraftSide, T> {
  return { ally, enemy }
}

/** Ally vs enemy theorycraft session shared by the builder step and the build detail tab. */
export function useTheorycraftVs(opts: TheorycraftVsOptions) {
  const buildStore = useBuildStore()
  const itemsStore = useItemsStore()
  const { loadChampion } = useChampionData()
  const { t } = opts

  const activeSide = ref<TheorycraftSide>('ally')
  const activePanel = ref<TheorycraftPanel>('theorycraft')
  const theorycraftLevel = ref(18)
  const championData = ref<Record<string, unknown> | null>(null)
  const isHydratingVsState = ref(false)
  const allyDisplayedVariant = ref<'main' | number>('main')

  const sideBuilds = ref(sidePair<Build | null>(null, null))
  const sideCalculatedStats = ref(sidePair<CalculatedStats | null>(null, null))
  const sidePanels = ref(sidePair<TheorycraftPanel>('theorycraft', 'theorycraft'))
  const sideFlipped = ref(sidePair(false, false))
  const sideBackFace = ref(sidePair<'stats' | 'description'>('stats', 'stats'))

  const championId = computed(() => buildStore.currentBuild?.champion?.id ?? null)
  const maxChampionLevel = computed(() => buildStore.maxStatsLevel)
  const opponentSide = computed<TheorycraftSide>(() =>
    activeSide.value === 'ally' ? 'enemy' : 'ally'
  )

  const theorycraftStats = computed((): TheorycraftBuildStats | null => {
    const build = buildStore.displayedBuild ?? buildStore.currentBuild
    const stats = buildStore.calculatedStats
    if (!build?.champion || !stats) return null
    return toTheorycraftBuildStats(stats, build.champion, theorycraftLevel.value)
  })

  const opponentTheorycraftStats = computed((): TheorycraftBuildStats | null => {
    const opponentBuild = sideBuilds.value[opponentSide.value]
    const opponentRaw = sideCalculatedStats.value[opponentSide.value]
    if (!opponentBuild?.champion || !opponentRaw) return null
    return toTheorycraftBuildStats(opponentRaw, opponentBuild.champion, theorycraftLevel.value)
  })

  const opponentRawStats = computed(() => sideCalculatedStats.value[opponentSide.value])
  const attackerRawStats = computed(() => sideCalculatedStats.value[activeSide.value] ?? null)

  /** Copy of the store's current stats (the store object is mutated in place). */
  function storeStatsSnapshot(): CalculatedStats | null {
    return buildStore.calculatedStats ? { ...buildStore.calculatedStats } : null
  }

  function persistActiveSideBuild() {
    if (activeSide.value === 'ally') allyDisplayedVariant.value = buildStore.displayedVariant
    sideBuilds.value[activeSide.value] = cloneBuild(buildStore.currentBuild)
  }

  function persistActiveSideStats() {
    sideCalculatedStats.value[activeSide.value] = storeStatsSnapshot()
  }

  /** Put a build in the store as the ally, keeping the ally's displayed variant. */
  function setAllyInStore(build: Build) {
    buildStore.setCurrentBuild(build, { keepDisplayedVariant: true })
    buildStore.displayedVariant = allyDisplayedVariant.value
  }

  function loadSideBuild(side: TheorycraftSide) {
    const scope = opts.scope(side)
    if (scope) buildStore.setTheorycraftStorageScope(scope)
    const target = cloneBuild(sideBuilds.value[side])
    if (!target) return
    if (side === 'ally') setAllyInStore(target)
    else buildStore.setCurrentBuild(target)
    buildStore.reloadTheorycraftModifiers()
  }

  function persistVsState() {
    const key = opts.storageKey()
    if (import.meta.server || !key || isHydratingVsState.value) return
    try {
      const payload: TheorycraftVsStoredState = {
        ally: cloneBuild(sideBuilds.value.ally),
        enemy: cloneBuild(sideBuilds.value.enemy),
        activeSide: activeSide.value,
        allyDisplayedVariant: allyDisplayedVariant.value,
      }
      localStorage.setItem(key, JSON.stringify(payload))
    } catch {
      // ignore persistence errors
    }
  }

  function loadVsState(): TheorycraftVsStoredState | null {
    const key = opts.storageKey()
    if (import.meta.server || !key) return null
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<TheorycraftVsStoredState>
      return {
        ally: cloneBuild(parsed.ally ?? null),
        enemy: cloneBuild(parsed.enemy ?? null),
        activeSide: parsed.activeSide === 'enemy' ? 'enemy' : 'ally',
        allyDisplayedVariant:
          parsed.allyDisplayedVariant === 'main' || typeof parsed.allyDisplayedVariant === 'number'
            ? parsed.allyDisplayedVariant
            : undefined,
      }
    } catch {
      return null
    }
  }

  function emptyEnemyBuild(): Build {
    return createEmptyTheorycraftBuild(t('theorycraft.panel.enemyCard'))
  }

  /** Restore the stored side the user was on (after the sides are hydrated). */
  function restoreActiveSide(stored: TheorycraftVsStoredState | null) {
    if (stored?.activeSide === 'enemy') {
      activeSide.value = 'enemy'
      activePanel.value = sidePanels.value.enemy ?? 'theorycraft'
      loadSideBuild('enemy')
    } else {
      activeSide.value = 'ally'
      activePanel.value = sidePanels.value.ally ?? 'theorycraft'
    }
  }

  function activateSide(side: TheorycraftSide) {
    if (activeSide.value === side) return
    persistActiveSideBuild()
    persistActiveSideStats()
    sidePanels.value[activeSide.value] = activePanel.value
    activeSide.value = side
    activePanel.value = sidePanels.value[side] ?? 'theorycraft'
    if (!sideBuilds.value[side]) {
      sideBuilds.value[side] =
        side === 'enemy' ? emptyEnemyBuild() : createEmptyTheorycraftBuild('Build')
    }
    loadSideBuild(side)
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

  function toggleFlip(side: TheorycraftSide, face: 'stats' | 'description') {
    if (activeSide.value !== side) activateSide(side)
    if (sideFlipped.value[side] && sideBackFace.value[side] === face) {
      sideFlipped.value = { ...sideFlipped.value, [side]: false }
      return
    }
    sideBackFace.value = { ...sideBackFace.value, [side]: face }
    sideFlipped.value = { ...sideFlipped.value, [side]: true }
  }

  function toggleDescriptionFlip(side: TheorycraftSide) {
    toggleFlip(side, 'description')
  }

  function toggleStatsFlip(side: TheorycraftSide) {
    toggleFlip(side, 'stats')
  }

  function activateTheorycraft(side: TheorycraftSide) {
    if (activeSide.value !== side) activateSide(side)
    activePanel.value = 'theorycraft'
    sidePanels.value[side] = 'theorycraft'
  }

  function onSelectRegion(side: TheorycraftSide, region: 'champion' | 'items' | 'runes') {
    if (activeSide.value !== side) activateSide(side)
    if (side === 'ally' && opts.allyRegionsLocked) return
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

  watch(
    () => buildStore.displayedVariant,
    variant => {
      if (isHydratingVsState.value || !opts.isActive() || activeSide.value !== 'ally') return
      allyDisplayedVariant.value = variant
    }
  )

  watch(
    () => buildStore.currentBuild,
    build => {
      if (!opts.isActive()) return
      sideBuilds.value[activeSide.value] = cloneBuild(build)
    },
    { deep: true }
  )

  watch(
    () => buildStore.calculatedStats,
    stats => {
      if (!opts.isActive()) return
      sideCalculatedStats.value[activeSide.value] = stats ? { ...stats } : null
    },
    { deep: true }
  )

  watch(
    [sideBuilds, activeSide],
    () => {
      if (isHydratingVsState.value || !opts.isActive()) return
      persistVsState()
    },
    { deep: true }
  )

  watch(activePanel, panel => {
    if (!opts.isActive()) return
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
      if (length > 0 && (previous ?? 0) === 0 && opts.isActive()) buildStore.recalculateStats()
    }
  )

  return {
    activeSide,
    activePanel,
    theorycraftLevel,
    championData,
    isHydratingVsState,
    allyDisplayedVariant,
    sideBuilds,
    sideCalculatedStats,
    sidePanels,
    sideFlipped,
    sideBackFace,
    championId,
    maxChampionLevel,
    theorycraftStats,
    opponentTheorycraftStats,
    opponentRawStats,
    attackerRawStats,
    storeStatsSnapshot,
    persistActiveSideBuild,
    persistActiveSideStats,
    setAllyInStore,
    loadSideBuild,
    persistVsState,
    loadVsState,
    emptyEnemyBuild,
    restoreActiveSide,
    activateSide,
    statsFlipActive,
    statsFlipTitle,
    theorycraftPanelActive,
    toggleDescriptionFlip,
    toggleStatsFlip,
    activateTheorycraft,
    onSelectRegion,
    onLevelSelectChange,
    loadChampionDataForPanel,
  }
}
