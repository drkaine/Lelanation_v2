import { defineStore } from 'pinia'
import { HOME_SECTION_ORDER } from '~/constants/homeSections'

const STORAGE_KEY = 'lelanation_home_ui'

export type HomeSectionId =
  | 'customize'
  | 'recentBuilds'
  | 'tierList'
  | 'latestVideos'
  | 'app'
  | 'contact'
  | 'globalStats'

interface HomeUiState {
  hiddenSections: HomeSectionId[]
  sectionOrder: HomeSectionId[]
}

const VALID_SECTIONS: HomeSectionId[] = [...HOME_SECTION_ORDER]

function isValidSection(value: unknown): value is HomeSectionId {
  return typeof value === 'string' && VALID_SECTIONS.includes(value as HomeSectionId)
}

function normalizeHiddenSections(value: unknown): HomeSectionId[] {
  if (!Array.isArray(value)) return []
  return value.filter((id): id is HomeSectionId => isValidSection(id))
}

function normalizeSectionOrder(value: unknown): HomeSectionId[] {
  const ordered: HomeSectionId[] = []
  const seen = new Set<HomeSectionId>()
  if (Array.isArray(value)) {
    for (const id of value) {
      if (!isValidSection(id) || seen.has(id)) continue
      ordered.push(id)
      seen.add(id)
    }
  }
  for (const id of HOME_SECTION_ORDER) {
    if (!seen.has(id)) ordered.push(id)
  }
  return ordered
}

function loadUiState(): HomeUiState {
  if (import.meta.server) {
    return {
      hiddenSections: [],
      sectionOrder: [...HOME_SECTION_ORDER],
    }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {
        hiddenSections: [],
        sectionOrder: [...HOME_SECTION_ORDER],
      }
    }
    const parsed = JSON.parse(raw) as Partial<HomeUiState>
    return {
      hiddenSections: normalizeHiddenSections(parsed.hiddenSections),
      sectionOrder: normalizeSectionOrder(parsed.sectionOrder),
    }
  } catch {
    return {
      hiddenSections: [],
      sectionOrder: [...HOME_SECTION_ORDER],
    }
  }
}

function persistState(state: HomeUiState): void {
  if (import.meta.server) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

export const useHomeUiStore = defineStore('homeUi', {
  state: (): HomeUiState => ({
    hiddenSections: [],
    sectionOrder: [...HOME_SECTION_ORDER],
  }),
  getters: {
    isSectionVisible:
      state =>
      (section: HomeSectionId): boolean =>
        !state.hiddenSections.includes(section),
    visibleSections(state): HomeSectionId[] {
      const hidden = new Set(state.hiddenSections)
      return state.sectionOrder.filter(section => !hidden.has(section))
    },
  },
  actions: {
    init() {
      if (import.meta.server) return
      const data = loadUiState()
      this.hiddenSections = data.hiddenSections
      this.sectionOrder = data.sectionOrder
    },
    setSectionVisible(section: HomeSectionId, visible: boolean) {
      const hidden = new Set(this.hiddenSections)
      if (visible) hidden.delete(section)
      else hidden.add(section)
      const nextHidden = [...hidden]
      if (this.sectionOrder.filter(id => !nextHidden.includes(id)).length === 0) return
      this.hiddenSections = nextHidden
      persistState(this.$state)
    },
    moveSection(section: HomeSectionId, direction: 'up' | 'down') {
      const order = [...this.sectionOrder]
      const index = order.indexOf(section)
      if (index < 0) return
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= order.length) return
      ;[order[index], order[targetIndex]] = [order[targetIndex], order[index]]
      this.sectionOrder = order
      persistState(this.$state)
    },
    resetSections() {
      this.hiddenSections = []
      this.sectionOrder = [...HOME_SECTION_ORDER]
      persistState(this.$state)
    },
  },
})
