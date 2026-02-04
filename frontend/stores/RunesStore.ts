import { defineStore } from 'pinia'
import { useVersionStore } from './VersionStore'
import { getFallbackGameVersion } from '~/config/version'
import type { RunePath } from '~/types/build'
import { apiUrl } from '~/utils/apiUrl'
import { getGameDataUrl } from '~/utils/staticDataUrl'

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

        // Try to load from static file first (faster, no API call)
        const versionStore = useVersionStore()
        if (!versionStore.currentVersion) {
          await versionStore.loadCurrentVersion()
        }
        const version = versionStore.currentVersion || getFallbackGameVersion()

        let data: any
        let useStatic = false

        // Try static file first (only in browser, not SSR)
        if (process.client) {
          try {
            // Add cache-busting parameter based on version to force reload after sync
            const staticUrl = getGameDataUrl(version, 'runesReforged', language)
            const urlWithCacheBust = `${staticUrl}?_v=${version.replace(/\./g, '_')}`
            const staticResponse = await fetch(urlWithCacheBust, {
              cache: 'no-cache',
            })
            if (staticResponse.ok) {
              data = await staticResponse.json()
              useStatic = true
            }
          } catch (staticError) {
            // Static file not available, will try API - silently continue
          }
        }

        // Fallback to API if static file not available
        // Always try API as fallback (even in production) since static files might not exist yet
        if (!useStatic) {
          try {
            const response = await fetch(apiUrl(`/api/game-data/runes?lang=${language}`), {
              signal: AbortSignal.timeout(5000),
            })
            if (!response.ok) {
              throw new Error(`API returned ${response.status}`)
            }
            data = await response.json()
          } catch (apiError) {
            throw new Error('Failed to load runes from both static and API')
          }
        }

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
