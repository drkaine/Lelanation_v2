import { defineStore } from 'pinia'
import type { SummonerSpell } from '~/types/build'

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

        // TODO: Load from API endpoint (Epic 2)
        const response = await fetch(`/api/game-data/summoner-spells?lang=${language}`)
        if (!response.ok) {
          throw new Error('Failed to load summoner spells')
        }

        const data = await response.json()
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
