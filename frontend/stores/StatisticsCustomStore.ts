import { defineStore } from 'pinia'

const STORAGE_KEY = 'lelanation_statistics_custom'

export interface CustomStatisticWidget {
  id: string
  title: string
}

interface TrendThresholds {
  winrateDeltaPct: number
  pickrateDeltaPct: number
  gamesDeltaPct: number
  banrateDeltaPct: number
}

interface StatisticsCustomState {
  favoriteWidgetIds: string[]
  layout: CustomStatisticWidget[]
  constructionMode: boolean
  trendThresholds: TrendThresholds
  trendMaxGraphs: number
}

function defaultState(): StatisticsCustomState {
  return {
    favoriteWidgetIds: [],
    layout: [],
    constructionMode: false,
    trendThresholds: {
      winrateDeltaPct: 5,
      pickrateDeltaPct: 10,
      gamesDeltaPct: 15,
      banrateDeltaPct: 10,
    },
    trendMaxGraphs: 8,
  }
}

function loadState(): StatisticsCustomState {
  if (import.meta.server) return defaultState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as Partial<StatisticsCustomState>
    const d = defaultState()
    return {
      ...d,
      favoriteWidgetIds: Array.isArray(parsed.favoriteWidgetIds)
        ? parsed.favoriteWidgetIds.filter((x): x is string => typeof x === 'string')
        : d.favoriteWidgetIds,
      layout: Array.isArray(parsed.layout)
        ? parsed.layout.filter(
            (w): w is CustomStatisticWidget =>
              typeof w?.id === 'string' && typeof w?.title === 'string'
          )
        : d.layout,
      constructionMode: parsed.constructionMode ?? d.constructionMode,
      trendThresholds: {
        ...d.trendThresholds,
        ...(parsed.trendThresholds ?? {}),
      },
      trendMaxGraphs: Number.isFinite(parsed.trendMaxGraphs)
        ? Number(parsed.trendMaxGraphs)
        : d.trendMaxGraphs,
    }
  } catch {
    return defaultState()
  }
}

function persist(state: StatisticsCustomState): void {
  if (import.meta.server) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

export const useStatisticsCustomStore = defineStore('statisticsCustom', {
  state: (): StatisticsCustomState => defaultState(),
  getters: {
    hasCustomStatistics: s => s.favoriteWidgetIds.length > 0,
    isFavorite: s => (widgetId: string) => s.favoriteWidgetIds.includes(widgetId),
  },
  actions: {
    init() {
      Object.assign(this, loadState())
    },
    toggleFavorite(widgetId: string, fallbackTitle?: string) {
      if (!widgetId) return
      const exists = this.favoriteWidgetIds.includes(widgetId)
      if (exists) {
        this.favoriteWidgetIds = this.favoriteWidgetIds.filter(id => id !== widgetId)
        this.layout = this.layout.filter(w => w.id !== widgetId)
      } else {
        this.favoriteWidgetIds = [...this.favoriteWidgetIds, widgetId]
        if (!this.layout.some(w => w.id === widgetId)) {
          this.layout.push({ id: widgetId, title: fallbackTitle || widgetId })
        }
      }
      persist(this.$state)
    },
    setConstructionMode(value: boolean) {
      this.constructionMode = value
      persist(this.$state)
    },
    moveWidget(fromIndex: number, toIndex: number) {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= this.layout.length ||
        toIndex >= this.layout.length ||
        fromIndex === toIndex
      )
        return
      const next = [...this.layout]
      const [item] = next.splice(fromIndex, 1)
      if (!item) return
      next.splice(toIndex, 0, item)
      this.layout = next
      persist(this.$state)
    },
    renameWidget(widgetId: string, title: string) {
      const clean = title.trim()
      this.layout = this.layout.map(w =>
        w.id === widgetId ? { ...w, title: clean || w.title } : w
      )
      persist(this.$state)
    },
    removeWidget(widgetId: string) {
      this.favoriteWidgetIds = this.favoriteWidgetIds.filter(id => id !== widgetId)
      this.layout = this.layout.filter(w => w.id !== widgetId)
      persist(this.$state)
    },
    setTrendThresholds(next: Partial<TrendThresholds>) {
      this.trendThresholds = { ...this.trendThresholds, ...next }
      persist(this.$state)
    },
    setTrendMaxGraphs(value: number) {
      this.trendMaxGraphs = Math.max(1, Math.min(24, Math.trunc(value || 1)))
      persist(this.$state)
    },
  },
})
