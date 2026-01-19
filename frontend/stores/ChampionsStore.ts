import { defineStore } from 'pinia'
import type { Champion } from '~/types/build'

interface ChampionsState {
  champions: Champion[]
  status: 'idle' | 'loading' | 'success' | 'error'
  error: string | null
}

export const useChampionsStore = defineStore('champions', {
  state: (): ChampionsState => ({
    champions: [],
    status: 'idle',
    error: null,
  }),

  getters: {
    championsByRole(): Record<string, Champion[]> {
      const byRole: Record<string, Champion[]> = {}
      for (const champion of this.champions) {
        for (const tag of champion.tags) {
          if (!byRole[tag]) {
            byRole[tag] = []
          }
          byRole[tag].push(champion)
        }
      }
      return byRole
    },

    searchChampions() {
      return (query: string, role?: string): Champion[] => {
        let filtered = this.champions

        // Filter by role if provided
        if (role) {
          filtered = filtered.filter(champion => champion.tags.includes(role))
        }

        // Search by name
        if (query) {
          const lowerQuery = query.toLowerCase()
          filtered = filtered.filter(
            champion =>
              champion.name.toLowerCase().includes(lowerQuery) ||
              champion.id.toLowerCase().includes(lowerQuery)
          )
        }

        return filtered
      }
    },
  },

  actions: {
    async loadChampions(language: string = 'fr_FR') {
      try {
        this.status = 'loading'
        this.error = null

        // TODO: Load from API endpoint (Epic 2)
        // For now, we'll load from a placeholder
        // In production, this will be: /api/game-data/champions?lang=${language}
        const response = await fetch(`/api/game-data/champions?lang=${language}`)
        if (!response.ok) {
          throw new Error('Failed to load champions')
        }

        const data = await response.json()
        // Transform Data Dragon format to our format
        this.champions = Object.values(data.data || {}) as Champion[]
        this.status = 'success'
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load champions'
        this.status = 'error'
        // Fallback: empty array, will be populated when data is available
        this.champions = []
      }
    },
  },
})
