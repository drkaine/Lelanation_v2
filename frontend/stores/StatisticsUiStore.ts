import { defineStore } from 'pinia'

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

interface StatisticsUiState {
  filtersOpen: boolean
  activeTab: StatisticsMainTab
}

/** Même ordre que la barre d’onglets stats (navigation clavier / persistance). */
const VALID_TABS: StatisticsMainTab[] = [
  'overview',
  'team',
  'objectives',
  'surrender',
  'bans',
  'championTable',
  'balance',
  'runes',
  'spells',
  'items',
  'infos',
  'trends',
]

function isValidTab(value: unknown): value is StatisticsMainTab {
  if (typeof value !== 'string') return false
  if (value === 'tierlist') return false
  return VALID_TABS.includes(value as StatisticsMainTab)
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
