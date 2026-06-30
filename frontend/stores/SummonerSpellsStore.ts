import { defineStore } from 'pinia'
import type { SummonerSpell } from '@lelanation/shared-types'
import { useVersionStore } from './VersionStore'
import { getFallbackGameVersion } from '~/config/version'
import { apiUrl } from '~/utils/apiUrl'
import { getGameDataUrl, fetchPublicJson } from '~/utils/staticDataUrl'
import { normalizeSummonerSpell, resolveSummonerSpellFromRef } from '~/utils/summonerSpellResolver'
import type { SummonerSpellRefLike } from '~/utils/summonerSpellResolver'

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
    /**
     * Resolve a spell by id (from Participants.summonerSpells / stats API).
     * Data comes from public/data/game/{version}/{lang}/summoner.json; each spell has "key" = numeric id.
     */
    getSpellById() {
      return (id: string): SummonerSpell | undefined => {
        const normalized = String(id).trim()
        if (!normalized) return undefined
        return this.spells.find(
          spell =>
            spell.key === normalized ||
            spell.id === normalized ||
            spell.id.toLowerCase() === normalized.toLowerCase()
        )
      }
    },
    resolveSpell() {
      return (ref: SummonerSpellRefLike | null | undefined): SummonerSpell | undefined =>
        resolveSummonerSpellFromRef(ref, this.getSpellById, this.spells)
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

        // Load from public/data/game/{version}/{language}/summoner.json (Data Dragon format).
        try {
          const staticUrl = getGameDataUrl(version, 'summoner', language)
          const urlWithCacheBust = `${staticUrl}?_v=${version.replace(/\./g, '_')}`
          data = await fetchPublicJson<Record<string, unknown>>(urlWithCacheBust)
          useStatic = true
        } catch {
          // Static file not available, will try API
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

        this.spells = Object.values(data.data || {}).map(spell =>
          normalizeSummonerSpell(spell as SummonerSpell)
        )
        this.status = 'success'
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load summoner spells'
        this.status = 'error'
        this.spells = []
      }
    },
  },
})
