import { defineStore } from 'pinia'

const STORAGE_KEY = 'lelanation_favorite_matchup_guide_ids'

function loadFromStorage(): string[] {
  if (import.meta.server) return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string')
  } catch {
    return []
  }
}

function saveToStorage(ids: string[]) {
  if (import.meta.server) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // ignore
  }
}

export const useMatchupGuideFavoritesStore = defineStore('matchupGuideFavorites', {
  state: () => ({
    favoriteGuideIds: [] as string[],
  }),

  getters: {
    isFavorite: state => (guideId: string) => state.favoriteGuideIds.includes(guideId),
  },

  actions: {
    init() {
      this.favoriteGuideIds = loadFromStorage()
    },

    toggleFavorite(guideId: string) {
      if (!guideId) return
      if (this.favoriteGuideIds.includes(guideId)) {
        this.favoriteGuideIds = this.favoriteGuideIds.filter(id => id !== guideId)
      } else {
        this.favoriteGuideIds = [...this.favoriteGuideIds, guideId]
      }
      saveToStorage(this.favoriteGuideIds)
    },
  },
})
