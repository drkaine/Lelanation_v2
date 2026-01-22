import { defineStore } from 'pinia'
import { apiUrl } from '~/utils/apiUrl'
import { getVersionUrl } from '~/utils/staticDataUrl'

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

        // Try static file first (only in browser, not SSR)
        if (process.client) {
          try {
            const staticUrl = getVersionUrl()
            const staticResponse = await fetch(staticUrl, {
              cache: 'no-cache',
            })
            if (staticResponse.ok) {
              const staticData = await staticResponse.json()
              // Static file uses 'currentVersion', API uses 'version'
              const version = staticData.currentVersion || staticData.version
              if (version) {
                this.currentVersion = version
                this.status = 'success'
                return
              }
            }
          } catch (staticError) {
            // Network error or other issue - will try API - silently continue
          }
        }

        // Fallback to API if static file not available or failed
        try {
          const apiUrlValue = apiUrl('/api/game-data/version')
          const response = await fetch(apiUrlValue, {
            signal: AbortSignal.timeout(5000),
          })
          if (!response.ok) {
            throw new Error(`API returned ${response.status}`)
          }
          const apiData = await response.json()
          // API uses 'version' field
          const version = apiData.version
          if (version) {
            this.currentVersion = version
            this.status = 'success'
            return
          }
        } catch (apiError) {
          // Both static file and API failed
          this.error = apiError instanceof Error ? apiError.message : 'Failed to load version'
          this.status = 'error'
          // Don't set a default version - let calling code handle null gracefully
          this.currentVersion = null
          return
        }

        // Should not reach here
        this.status = 'error'
        this.error = 'No version data found'
        this.currentVersion = null
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load version'
        this.status = 'error'
        this.currentVersion = null
      }
    },
  },
})
