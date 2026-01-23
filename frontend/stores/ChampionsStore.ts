import { defineStore } from 'pinia'
import { useVersionStore } from './VersionStore'
import type { Champion } from '~/types/build'
import { apiUrl } from '~/utils/apiUrl'
import { getGameDataUrl, getVersionUrl } from '~/utils/staticDataUrl'

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
      return (query: string, roles?: string | string[]): Champion[] => {
        let filtered = this.champions

        // Filter by role(s) if provided
        if (roles) {
          const rolesArray = Array.isArray(roles) ? roles : [roles]
          if (rolesArray.length > 0) {
            // Show champions that have ALL of the selected roles
            filtered = filtered.filter(champion =>
              rolesArray.every(role => champion.tags.includes(role))
            )
          }
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

        // Try to load from static file first (faster, no API call)
        const versionStore = useVersionStore()
        if (!versionStore.currentVersion) {
          await versionStore.loadCurrentVersion()
        }

        // If version store doesn't have version, try to read it directly from static file
        let version = versionStore.currentVersion
        if (!version && process.client) {
          try {
            const versionUrl = getVersionUrl()
            const versionResponse = await fetch(versionUrl, { cache: 'no-cache' })
            if (versionResponse.ok) {
              const versionData = await versionResponse.json()
              version = versionData.currentVersion || versionData.version
            }
          } catch (e) {
            // Could not read version from static file - silently continue
          }
        }

        // Last resort: return error if no version available
        if (!version) {
          this.champions = []
          this.status = 'error'
          this.error = 'Game version not available'
          return
        }

        let data: any
        let useStatic = false

        // Try static file first (only in browser, not SSR)
        if (process.client) {
          try {
            const staticUrl = getGameDataUrl(version, 'champion', language)
            const staticResponse = await fetch(staticUrl, {
              cache: 'no-cache',
            })
            if (staticResponse.ok) {
              data = await staticResponse.json()
              useStatic = true
            }
          } catch (staticError) {
            // Network error or other issue - silently continue
          }
        }

        // Fallback to API if static file not available
        // Always try API as fallback (even in production) since static files might not exist yet
        if (!useStatic) {
          try {
            const apiUrlValue = apiUrl(`/api/game-data/champions?lang=${language}`)
            const response = await fetch(apiUrlValue, {
              signal: AbortSignal.timeout(5000),
            })
            if (!response.ok) {
              // If API returns error, return empty array
              this.champions = []
              this.status = 'success'
              return
            }
            data = await response.json()
          } catch (apiError) {
            // If API also fails (network error, timeout, etc.), return empty array
            this.champions = []
            this.status = 'success'
            return
          }
        }

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
