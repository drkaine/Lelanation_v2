import { defineStore } from 'pinia'

const STORAGE_KEY = 'lelanation_statistics_ui'

export type StatisticsMainTab =
  | 'overview'
  | 'tierlist'
  | 'championTable'
  | 'trends'
  | 'team'
  | 'runes'
  | 'items'
  | 'spells'
  | 'infos'
  | 'bans'

interface StatisticsUiState {
  filtersOpen: boolean
  activeTab: StatisticsMainTab
}

const VALID_TABS: StatisticsMainTab[] = [
  'overview',
  'tierlist',
  'championTable',
  'trends',
  'team',
  'runes',
  'items',
  'spells',
  'infos',
  'bans',
]

function isValidTab(value: unknown): value is StatisticsMainTab {
  return typeof value === 'string' && VALID_TABS.includes(value as StatisticsMainTab)
}

function loadUiState(): StatisticsUiState {
  if (import.meta.server) return { filtersOpen: true, activeTab: 'overview' }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { filtersOpen: true, activeTab: 'overview' }
    const parsed = JSON.parse(raw) as Partial<StatisticsUiState>
    return {
      filtersOpen: parsed.filtersOpen ?? true,
      activeTab: isValidTab(parsed.activeTab) ? parsed.activeTab : 'overview',
    }
  } catch {
    return { filtersOpen: true, activeTab: 'overview' }
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

export const useStatisticsUiStore = defineStore('statisticsUi', {
  state: (): StatisticsUiState => ({
    filtersOpen: true,
    activeTab: 'overview',
  }),
  actions: {
    init() {
      const data = loadUiState()
      this.filtersOpen = data.filtersOpen
      this.activeTab = data.activeTab
    },
    setFiltersOpen(value: boolean) {
      this.filtersOpen = value
      saveUiState({ filtersOpen: this.filtersOpen, activeTab: this.activeTab })
    },
    setActiveTab(value: StatisticsMainTab) {
      this.activeTab = value
      saveUiState({ filtersOpen: this.filtersOpen, activeTab: this.activeTab })
    },
  },
})
