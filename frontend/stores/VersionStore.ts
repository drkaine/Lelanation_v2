import { defineStore } from 'pinia'
import { apiUrl } from '~/utils/apiUrl'

interface VersionState {
  currentVersion: string | null
  status: 'idle' | 'loading' | 'success' | 'error'
  error: string | null
}

export const useVersionStore = defineStore('version', {
  state: (): VersionState => ({
    currentVersion: null,
    status: 'idle',
    error: null,
  }),

  actions: {
    async loadCurrentVersion() {
      try {
        this.status = 'loading'
        this.error = null

        const response = await fetch(apiUrl('/api/game-data/version'))
        if (!response.ok) {
          throw new Error('Failed to load game version')
        }

        const data = await response.json()
        this.currentVersion = data.version
        this.status = 'success'
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load version'
        this.status = 'error'
        // Fallback to a default version
        this.currentVersion = '14.1.1'
      }
    },
  },
})
