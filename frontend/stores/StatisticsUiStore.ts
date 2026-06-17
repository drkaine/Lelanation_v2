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
  defaultTab: StatisticsMainTab
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

function defaultFiltersOpen(): boolean {
  if (import.meta.server) return true
  // Bottom sheet sur mobile : fermé par défaut pour ne pas bloquer le contenu.
  if (window.matchMedia('(max-width: 1023px)').matches) return false
  return true
}

function resolveDefaultTab(
  hiddenTabs: StatisticsMainTab[],
  preferred?: StatisticsMainTab | null
): StatisticsMainTab {
  const visible = visibleTabsFromHidden(hiddenTabs)
  if (visible.length === 0) return STATISTICS_MAIN_TAB_ORDER[0] ?? 'overview'
  if (preferred && visible.includes(preferred)) return preferred
  return visible[0] ?? 'overview'
}

function loadUiState(): StatisticsUiState {
  // SSR : panneau fermé pour éviter un mismatch d’hydratation (le client réapplique init()).
  if (import.meta.server) {
    return { filtersOpen: false, activeTab: 'overview', hiddenTabs: [], defaultTab: 'overview' }
  }
  const filtersDefault = defaultFiltersOpen()
  const fallbackDefault = STATISTICS_MAIN_TAB_ORDER[0] ?? 'overview'
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {
        filtersOpen: filtersDefault,
        activeTab: 'overview',
        hiddenTabs: [],
        defaultTab: fallbackDefault,
      }
    }
    const parsed = JSON.parse(raw) as Partial<StatisticsUiState>
    const isMobile = window.matchMedia('(max-width: 1023px)').matches
    const hiddenTabs = normalizeHiddenTabs(parsed.hiddenTabs)
    const preferredDefault = isValidTab(parsed.defaultTab) ? parsed.defaultTab : fallbackDefault
    return {
      filtersOpen: isMobile ? false : (parsed.filtersOpen ?? filtersDefault),
      activeTab: isValidTab(parsed.activeTab) ? parsed.activeTab : 'overview',
      hiddenTabs,
      defaultTab: resolveDefaultTab(hiddenTabs, preferredDefault),
    }
  } catch {
    return {
      filtersOpen: filtersDefault,
      activeTab: 'overview',
      hiddenTabs: [],
      defaultTab: fallbackDefault,
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

function visibleTabsFromHidden(hiddenTabs: StatisticsMainTab[]): StatisticsMainTab[] {
  const hidden = new Set(hiddenTabs)
  return STATISTICS_MAIN_TAB_ORDER.filter(tab => !hidden.has(tab))
}

function persistState(state: StatisticsUiState): void {
  saveUiState(state)
}

export const useStatisticsUiStore = defineStore('statisticsUi', {
  state: (): StatisticsUiState => ({
    filtersOpen: false,
    activeTab: 'overview',
    hiddenTabs: [],
    defaultTab: STATISTICS_MAIN_TAB_ORDER[0] ?? 'overview',
  }),
  getters: {
    isTabVisible:
      state =>
      (tab: StatisticsMainTab): boolean =>
        !state.hiddenTabs.includes(tab),
    visibleMainTabs(state): StatisticsMainTab[] {
      return visibleTabsFromHidden(state.hiddenTabs)
    },
    resolveDefaultMainTab(state): StatisticsMainTab {
      return resolveDefaultTab(state.hiddenTabs, state.defaultTab)
    },
  },
  actions: {
    init() {
      const data = loadUiState()
      this.filtersOpen = data.filtersOpen
      this.activeTab = data.activeTab
      this.hiddenTabs = data.hiddenTabs
      this.defaultTab = data.defaultTab
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
      if (visibleTabsFromHidden(nextHidden).length === 0) return
      this.hiddenTabs = nextHidden
      if (!visible && this.defaultTab === tab) {
        this.defaultTab = resolveDefaultTab(this.hiddenTabs, null)
      }
      persistState(this.$state)
    },
    setDefaultTab(tab: StatisticsMainTab) {
      if (!this.isTabVisible(tab)) return
      this.defaultTab = tab
      persistState(this.$state)
    },
    resetTabVisibility() {
      this.hiddenTabs = []
      this.defaultTab = STATISTICS_MAIN_TAB_ORDER[0] ?? 'overview'
      persistState(this.$state)
    },
    ensureActiveTabVisible(preferred?: StatisticsMainTab): StatisticsMainTab {
      const visible = visibleTabsFromHidden(this.hiddenTabs)
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
