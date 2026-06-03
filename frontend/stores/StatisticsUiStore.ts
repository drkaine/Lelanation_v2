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

function defaultFiltersOpen(): boolean {
  if (import.meta.server) return true
  // Bottom sheet sur mobile : fermé par défaut pour ne pas bloquer le contenu.
  if (window.matchMedia('(max-width: 1023px)').matches) return false
  return true
}

function loadUiState(): StatisticsUiState {
  // SSR : panneau fermé pour éviter un mismatch d’hydratation (le client réapplique init()).
  if (import.meta.server) return { filtersOpen: false, activeTab: 'overview' }
  const filtersDefault = defaultFiltersOpen()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { filtersOpen: filtersDefault, activeTab: 'overview' }
    const parsed = JSON.parse(raw) as Partial<StatisticsUiState>
    const isMobile = window.matchMedia('(max-width: 1023px)').matches
    return {
      filtersOpen: isMobile ? false : (parsed.filtersOpen ?? filtersDefault),
      activeTab: isValidTab(parsed.activeTab) ? parsed.activeTab : 'overview',
    }
  } catch {
    return { filtersOpen: filtersDefault, activeTab: 'overview' }
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
    filtersOpen: false,
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
