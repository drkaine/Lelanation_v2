import { defineStore } from 'pinia'
import type { RunePath } from '~/types/build'

interface RunesState {
  runePaths: RunePath[]
  status: 'idle' | 'loading' | 'success' | 'error'
  error: string | null
}

export const useRunesStore = defineStore('runes', {
  state: (): RunesState => ({
    runePaths: [],
    status: 'idle',
    error: null,
  }),

  getters: {
    getRunePathById() {
      return (id: number): RunePath | undefined => {
        return this.runePaths.find(path => path.id === id)
      }
    },
  },

  actions: {
    async loadRunes(language: string = 'fr_FR') {
      try {
        this.status = 'loading'
        this.error = null

        // TODO: Load from API endpoint (Epic 2)
        const response = await fetch(`/api/game-data/runes?lang=${language}`)
        if (!response.ok) {
          throw new Error('Failed to load runes')
        }

        const data = await response.json()
        this.runePaths = (data || []) as RunePath[]
        this.status = 'success'
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load runes'
        this.status = 'error'
        this.runePaths = []
      }
    },
  },
})
