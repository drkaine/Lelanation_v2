import { defineStore } from 'pinia'
import { STATISTICS_MAIN_TAB_ORDER } from '~/constants/statisticsMainTabs'

const STORAGE_KEY = 'lelanation_statistics_ui'

export type StatisticsMainTab =
  | 'overview'
  | 'championTable'
  | 'balance'
  | 'trends'
  | 'team'
  | 'objectives'
  | 'surrender'
  | 'runes'
  | 'items'
  | 'spells'
  | 'infos'
  | 'bans'
  | 'pings'
  | 'vision'
  | 'misc'
  | 'patchNotes'

interface StatisticsUiState {
  filtersOpen: boolean
  activeTab: StatisticsMainTab
  hiddenTabs: StatisticsMainTab[]
  tabOrder: StatisticsMainTab[]
  defaultTab: StatisticsMainTab
  watchedChampionIds: string[]
}

/** Même ordre que la barre d’onglets stats (navigation clavier / persistance). */
const VALID_TABS: StatisticsMainTab[] = [...STATISTICS_MAIN_TAB_ORDER, 'trends']

function isValidTab(value: unknown): value is StatisticsMainTab {
  if (typeof value !== 'string') return false
  if (value === 'tierlist') return false
  return VALID_TABS.includes(value as StatisticsMainTab)
}

function normalizeHiddenTabs(value: unknown): StatisticsMainTab[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (tab): tab is StatisticsMainTab =>
      typeof tab === 'string' && VALID_TABS.includes(tab as StatisticsMainTab)
  )
}

function normalizeWatchedChampionIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((id): id is string => typeof id === 'string' && id.length > 0)
}

function normalizeTabOrder(value: unknown): StatisticsMainTab[] {
  const ordered: StatisticsMainTab[] = []
  const seen = new Set<StatisticsMainTab>()
  if (Array.isArray(value)) {
    for (const id of value) {
      if (
        typeof id !== 'string' ||
        !STATISTICS_MAIN_TAB_ORDER.includes(id as StatisticsMainTab) ||
        seen.has(id as StatisticsMainTab)
      ) {
        continue
      }
      ordered.push(id as StatisticsMainTab)
      seen.add(id as StatisticsMainTab)
    }
  }
  for (const id of STATISTICS_MAIN_TAB_ORDER) {
    if (!seen.has(id)) ordered.push(id)
  }
  return ordered
}

function defaultFiltersOpen(): boolean {
  if (import.meta.server) return true
  // Bottom sheet sur mobile : fermé par défaut pour ne pas bloquer le contenu.
  if (window.matchMedia('(max-width: 1023px)').matches) return false
  return true
}

function resolveDefaultTab(
  hiddenTabs: StatisticsMainTab[],
  tabOrder: StatisticsMainTab[],
  preferred?: StatisticsMainTab | null
): StatisticsMainTab {
  const visible = visibleTabsFromState(hiddenTabs, tabOrder)
  if (visible.length === 0) return STATISTICS_MAIN_TAB_ORDER[0] ?? 'overview'
  if (preferred && visible.includes(preferred)) return preferred
  return visible[0] ?? 'overview'
}

function loadUiState(): StatisticsUiState {
  // SSR : panneau fermé pour éviter un mismatch d’hydratation (le client réapplique init()).
  if (import.meta.server) {
    return {
      filtersOpen: false,
      activeTab: 'overview',
      hiddenTabs: [],
      tabOrder: [...STATISTICS_MAIN_TAB_ORDER],
      defaultTab: 'overview',
      watchedChampionIds: [],
    }
  }
  const filtersDefault = defaultFiltersOpen()
  const fallbackDefault = STATISTICS_MAIN_TAB_ORDER[0] ?? 'overview'
  const defaultTabOrder = [...STATISTICS_MAIN_TAB_ORDER]
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {
        filtersOpen: filtersDefault,
        activeTab: 'overview',
        hiddenTabs: [],
        tabOrder: defaultTabOrder,
        defaultTab: fallbackDefault,
        watchedChampionIds: [],
      }
    }
    const parsed = JSON.parse(raw) as Partial<StatisticsUiState>
    const isMobile = window.matchMedia('(max-width: 1023px)').matches
    const hiddenTabs = normalizeHiddenTabs(parsed.hiddenTabs)
    const tabOrder = normalizeTabOrder(parsed.tabOrder)
    const preferredDefault = isValidTab(parsed.defaultTab) ? parsed.defaultTab : fallbackDefault
    return {
      filtersOpen: isMobile ? false : (parsed.filtersOpen ?? filtersDefault),
      activeTab: isValidTab(parsed.activeTab) ? parsed.activeTab : 'overview',
      hiddenTabs,
      tabOrder,
      defaultTab: resolveDefaultTab(hiddenTabs, tabOrder, preferredDefault),
      watchedChampionIds: normalizeWatchedChampionIds(parsed.watchedChampionIds),
    }
  } catch {
    return {
      filtersOpen: filtersDefault,
      activeTab: 'overview',
      hiddenTabs: [],
      tabOrder: defaultTabOrder,
      defaultTab: fallbackDefault,
      watchedChampionIds: [],
    }
  }
}

function saveUiState(state: StatisticsUiState): void {
  if (import.meta.server) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

function visibleTabsFromState(
  hiddenTabs: StatisticsMainTab[],
  tabOrder: StatisticsMainTab[]
): StatisticsMainTab[] {
  const hidden = new Set(hiddenTabs)
  return tabOrder.filter(tab => !hidden.has(tab))
}

function persistState(state: StatisticsUiState): void {
  saveUiState(state)
}

export const useStatisticsUiStore = defineStore('statisticsUi', {
  state: (): StatisticsUiState => ({
    filtersOpen: false,
    activeTab: 'overview',
    hiddenTabs: [],
    tabOrder: [...STATISTICS_MAIN_TAB_ORDER],
    defaultTab: STATISTICS_MAIN_TAB_ORDER[0] ?? 'overview',
    watchedChampionIds: [],
  }),
  getters: {
    isTabVisible:
      state =>
      (tab: StatisticsMainTab): boolean =>
        !state.hiddenTabs.includes(tab),
    visibleMainTabs(state): StatisticsMainTab[] {
      return visibleTabsFromState(state.hiddenTabs, state.tabOrder)
    },
    resolveDefaultMainTab(state): StatisticsMainTab {
      return resolveDefaultTab(state.hiddenTabs, state.tabOrder, state.defaultTab)
    },
  },
  actions: {
    init() {
      if (import.meta.server) return
      const data = loadUiState()
      this.filtersOpen = data.filtersOpen
      this.activeTab = data.activeTab
      this.hiddenTabs = data.hiddenTabs
      this.tabOrder = data.tabOrder
      this.defaultTab = data.defaultTab
      this.watchedChampionIds = data.watchedChampionIds
    },
    setFiltersOpen(value: boolean) {
      this.filtersOpen = value
      persistState(this.$state)
    },
    setActiveTab(value: StatisticsMainTab) {
      this.activeTab = value
      persistState(this.$state)
    },
    setTabVisible(tab: StatisticsMainTab, visible: boolean) {
      const hidden = new Set(this.hiddenTabs)
      if (visible) hidden.delete(tab)
      else hidden.add(tab)
      const nextHidden = [...hidden]
      if (visibleTabsFromState(nextHidden, this.tabOrder).length === 0) return
      this.hiddenTabs = nextHidden
      if (!visible && this.defaultTab === tab) {
        this.defaultTab = resolveDefaultTab(this.hiddenTabs, this.tabOrder, null)
      }
      persistState(this.$state)
    },
    moveTab(tab: StatisticsMainTab, direction: 'up' | 'down') {
      const order = [...this.tabOrder]
      const index = order.indexOf(tab)
      if (index < 0) return
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= order.length) return
      ;[order[index], order[targetIndex]] = [order[targetIndex], order[index]]
      this.tabOrder = order
      persistState(this.$state)
    },
    reorderTab(fromIndex: number, toIndex: number) {
      if (fromIndex === toIndex) return
      const order = [...this.tabOrder]
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= order.length || toIndex >= order.length) {
        return
      }
      const [item] = order.splice(fromIndex, 1)
      if (!item) return
      order.splice(toIndex, 0, item)
      this.tabOrder = order
      persistState(this.$state)
    },
    setDefaultTab(tab: StatisticsMainTab) {
      if (!this.isTabVisible(tab)) return
      this.defaultTab = tab
      persistState(this.$state)
    },
    resetTabVisibility() {
      this.hiddenTabs = []
      this.tabOrder = [...STATISTICS_MAIN_TAB_ORDER]
      this.defaultTab = STATISTICS_MAIN_TAB_ORDER[0] ?? 'overview'
      persistState(this.$state)
    },
    setWatchedChampionIds(ids: string[]) {
      this.watchedChampionIds = normalizeWatchedChampionIds(ids)
      persistState(this.$state)
    },
    toggleWatchedChampion(championId: string) {
      if (!championId) return
      const exists = this.watchedChampionIds.includes(championId)
      this.watchedChampionIds = exists
        ? this.watchedChampionIds.filter(id => id !== championId)
        : [...this.watchedChampionIds, championId]
      persistState(this.$state)
    },
    clearWatchedChampions() {
      this.watchedChampionIds = []
      persistState(this.$state)
    },
    ensureActiveTabVisible(preferred?: StatisticsMainTab): StatisticsMainTab {
      const visible = visibleTabsFromState(this.hiddenTabs, this.tabOrder)
      if (visible.length === 0) return 'overview'
      if (preferred && visible.includes(preferred)) return preferred
      if (visible.includes(this.activeTab)) return this.activeTab
      const fallback = visible[0] ?? 'overview'
      this.activeTab = fallback
      persistState(this.$state)
      return fallback
    },
  },
})
