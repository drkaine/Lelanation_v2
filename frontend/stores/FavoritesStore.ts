/**
 * Favorites: build IDs stored only in localStorage (no backend).
 * Key: lelanation_favorite_build_ids (JSON array of strings).
 */
import { defineStore } from 'pinia'

const STORAGE_KEY = 'lelanation_favorite_build_ids'

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

export const useFavoritesStore = defineStore('favorites', {
  state: () => ({
    favoriteBuildIds: [] as string[],
  }),

  getters: {
    isFavorite: state => (buildId: string) => state.favoriteBuildIds.includes(buildId),
  },

  actions: {
    init() {
      this.favoriteBuildIds = loadFromStorage()
    },

    addFavorite(buildId: string) {
      if (!buildId || this.favoriteBuildIds.includes(buildId)) return
      this.favoriteBuildIds = [...this.favoriteBuildIds, buildId]
      saveToStorage(this.favoriteBuildIds)
    },

    removeFavorite(buildId: string) {
      this.favoriteBuildIds = this.favoriteBuildIds.filter(id => id !== buildId)
      saveToStorage(this.favoriteBuildIds)
    },

    toggleFavorite(buildId: string) {
      if (this.favoriteBuildIds.includes(buildId)) {
        this.removeFavorite(buildId)
      } else {
        this.addFavorite(buildId)
      }
    },
  },
})
