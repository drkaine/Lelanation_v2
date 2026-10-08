import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useTheorycraftVs } from './useTheorycraftVs'
import { useBuildStore } from '~/stores/BuildStore'

vi.mock('~/composables/useChampionData', () => ({
  useChampionData: () => ({ loadChampion: () => Promise.resolve(null) }),
}))

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v)
    },
    removeItem: (k: string) => {
      data.delete(k)
    },
  }
}

const t = (key: string) => `t:${key}`

function setup(opts: { active?: boolean; allyRegionsLocked?: boolean } = {}) {
  const store = useBuildStore()
  store.ensureCurrentBuild()
  const active = ref(opts.active ?? true)
  const vs = useTheorycraftVs({
    storageKey: () => 'vs-key',
    scope: side => `scope-${side}`,
    isActive: () => active.value,
    t,
    allyRegionsLocked: opts.allyRegionsLocked,
  })
  return { store, active, vs }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('localStorage', memoryStorage())
})

describe('useTheorycraftVs', () => {
  it('switching to the enemy keeps the ally build and opens an empty enemy build', () => {
    const { store, vs } = setup()
    const allyId = store.currentBuild!.id
    vs.activateSide('enemy')
    expect(vs.activeSide.value).toBe('enemy')
    expect(vs.sideBuilds.value.ally?.id).toBe(allyId)
    expect(vs.sideBuilds.value.enemy?.name).toBe('t:theorycraft.panel.enemyCard')
    expect(store.currentBuild?.id).toBe(vs.sideBuilds.value.enemy?.id)
  })

  it('round-trips the vs state through storage', () => {
    const { vs } = setup()
    vs.activateSide('enemy')
    vs.persistVsState()
    const stored = vs.loadVsState()
    expect(stored?.activeSide).toBe('enemy')
    expect(stored?.enemy?.id).toBe(vs.sideBuilds.value.enemy?.id)
  })

  it('does not persist while hydrating', () => {
    const { vs } = setup()
    vs.isHydratingVsState.value = true
    vs.persistVsState()
    expect(vs.loadVsState()).toBeNull()
  })

  it('flips a card to stats then back', () => {
    const { vs } = setup()
    vs.toggleStatsFlip('ally')
    expect(vs.statsFlipActive('ally')).toBe(true)
    expect(vs.statsFlipTitle('ally')).toBe('t:theorycraft.stats.showBuild')
    vs.toggleDescriptionFlip('ally')
    expect(vs.sideBackFace.value.ally).toBe('description')
    vs.toggleDescriptionFlip('ally')
    expect(vs.sideFlipped.value.ally).toBe(false)
  })

  it('ignores ally region selection when ally regions are locked', () => {
    const locked = setup({ allyRegionsLocked: true }).vs
    locked.onSelectRegion('ally', 'items')
    expect(locked.activePanel.value).toBe('theorycraft')

    setActivePinia(createPinia())
    const free = setup().vs
    free.onSelectRegion('ally', 'items')
    expect(free.activePanel.value).toBe('items')
  })

  it('tracks store edits on the active side only while active', async () => {
    const { store, active, vs } = setup({ active: false })
    store.currentBuild!.name = 'edited'
    await nextTick()
    expect(vs.sideBuilds.value.ally).toBeNull()
    active.value = true
    store.currentBuild!.name = 'edited again'
    await nextTick()
    expect(vs.sideBuilds.value.ally?.name).toBe('edited again')
  })

  it('keeps spell ranks, active spells and active item passives across side switches', () => {
    const { store, vs } = setup()
    // As the pages do on mount.
    store.setTheorycraftStorageScope('scope-ally')
    store.activateTheorycraftMode()
    const context = (championId: string) =>
      store.setTheorycraftStackContext({ championId, definitions: [], calculationsBySource: {} })
    context('Morgana')
    store.setTheorycraftSpellRank('MorganaQ', 4)
    store.toggleTheorycraftActiveSpell('MorganaW')
    store.toggleTheorycraftActiveItemPassive(0)

    vs.activateSide('enemy')
    context('Garen')
    expect(store.theorycraftSpellRanks).toEqual({})
    store.setTheorycraftSpellRank('GarenQ', 2)

    vs.activateSide('ally')
    context('Morgana')
    expect(store.theorycraftSpellRanks).toEqual({ MorganaQ: 4 })
    expect(store.theorycraftActiveSpells).toEqual({ MorganaW: true })
    expect(store.theorycraftActiveItemPassives).toEqual({ 0: true })

    vs.activateSide('enemy')
    context('Garen')
    expect(store.theorycraftSpellRanks).toEqual({ GarenQ: 2 })
  })

  it('keeps each side its own spell ranks in a mirror matchup', () => {
    const { store, vs } = setup()
    // As the pages do on mount.
    store.setTheorycraftStorageScope('scope-ally')
    store.activateTheorycraftMode()
    const context = () =>
      store.setTheorycraftStackContext({
        championId: 'Ahri',
        definitions: [],
        calculationsBySource: {},
      })
    context()
    store.setTheorycraftSpellRank('AhriQ', 5)
    vs.activateSide('enemy')
    context()
    expect(store.theorycraftSpellRanks).toEqual({})
    vs.activateSide('ally')
    context()
    expect(store.theorycraftSpellRanks).toEqual({ AhriQ: 5 })
  })

  it("gives the inactive card its own side's item state", () => {
    const { store, vs } = setup()
    // As the pages do on mount.
    store.setTheorycraftStorageScope('scope-ally')
    store.activateTheorycraftMode()
    store.toggleTheorycraftActiveItemPassive(1)
    store.setTheorycraftItemStacks(2, 12)
    expect(vs.inactiveItemStates.value.ally).toBeNull()

    vs.activateSide('enemy')
    expect(store.theorycraftActiveItemPassives).toEqual({})
    expect(vs.inactiveItemStates.value.enemy).toBeNull()
    expect(vs.inactiveItemStates.value.ally).toEqual({
      disabled: [],
      stacks: { 2: 12 },
      transformed: {},
      activePassives: { 1: true },
    })
  })

  it('keeps a level per side', () => {
    const { store, vs } = setup()
    const select = (value: number, side: 'ally' | 'enemy') =>
      vs.onLevelSelectChange({ target: { value: String(value) } } as unknown as Event, side)

    select(6, 'ally')
    expect(store.statsLevel).toBe(6)
    vs.activateSide('enemy')
    expect(store.statsLevel).toBe(18)
    expect(vs.sideLevels.value).toEqual({ ally: 6, enemy: 18 })

    // The inactive card's select activates that card, the other side keeps its level.
    select(9, 'ally')
    expect(vs.activeSide.value).toBe('ally')
    expect(store.statsLevel).toBe(9)
    expect(vs.theorycraftLevel.value).toBe(9)
    vs.activateSide('enemy')
    expect(store.statsLevel).toBe(18)
    expect(vs.sideLevels.value).toEqual({ ally: 9, enemy: 18 })
  })

  it('opens the champion list on the first click of a side without a champion', () => {
    const { vs } = setup()
    vs.activateSide('enemy')
    expect(vs.activePanel.value).toBe('champion')
  })
})
