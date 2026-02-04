import { defineStore } from 'pinia'
import { useVersionStore } from './VersionStore'
import { getFallbackGameVersion } from '~/config/version'
import type { SummonerSpell } from '~/types/build'
import { apiUrl } from '~/utils/apiUrl'
import { getGameDataUrl } from '~/utils/staticDataUrl'

interface SummonerSpellsState {
  spells: SummonerSpell[]
  status: 'idle' | 'loading' | 'success' | 'error'
  error: string | null
}

export const useSummonerSpellsStore = defineStore('summonerSpells', {
  state: (): SummonerSpellsState => ({
    spells: [],
    status: 'idle',
    error: null,
  }),

  getters: {
    getSpellById() {
      return (id: string): SummonerSpell | undefined => {
        return this.spells.find(spell => spell.id === id || spell.key === id)
      }
    },
  },

  actions: {
    async loadSummonerSpells(language: string = 'fr_FR') {
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
            const staticUrl = getGameDataUrl(version, 'summoner', language)
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
            const apiUrlValue = apiUrl(`/api/game-data/summoner-spells?lang=${language}`)
            const response = await fetch(apiUrlValue, {
              signal: AbortSignal.timeout(5000),
            })
            if (!response.ok) {
              this.spells = []
              this.status = 'success'
              return
            }
            data = await response.json()
          } catch (apiError) {
            this.spells = []
            this.status = 'success'
            return
          }
        }

        this.spells = Object.values(data.data || {}) as SummonerSpell[]
        this.status = 'success'
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load summoner spells'
        this.status = 'error'
        this.spells = []
      }
    },
  },
})
