import { defineStore } from 'pinia'
import type { ChampionRef } from '@lelanation/shared-types'
import type { Build } from '~/types/build'
import { buildMatchupGuideFromDraft } from '~/utils/matchupGuideFromBuild'

function newGuideId(): string {
  if (import.meta.client && typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `guide-${Date.now()}`
}

export const useMatchupGuideDraftStore = defineStore('matchupGuideDraft', {
  state: () => ({
    guideId: '' as string,
    rankedOpponents: [] as ChampionRef[],
  }),

  getters: {
    rankedOpponentIds(state): Set<string> {
      return new Set(state.rankedOpponents.map(o => o.id))
    },
  },

  actions: {
    startNewGuide() {
      this.guideId = newGuideId()
      this.rankedOpponents = []
    },

    ensureGuideId() {
      if (!this.guideId) this.guideId = newGuideId()
    },

    addOpponent(opponent: ChampionRef) {
      if (this.rankedOpponents.some(o => o.id === opponent.id)) return
      this.rankedOpponents.push(opponent)
    },

    removeOpponent(opponentId: string) {
      this.rankedOpponents = this.rankedOpponents.filter(o => o.id !== opponentId)
    },

    moveOpponent(fromIndex: number, toIndex: number) {
      if (fromIndex < 0 || toIndex < 0) return
      if (fromIndex >= this.rankedOpponents.length || toIndex >= this.rankedOpponents.length) return
      const next = [...this.rankedOpponents]
      const [moved] = next.splice(fromIndex, 1)
      if (!moved) return
      next.splice(toIndex, 0, moved)
      this.rankedOpponents = next
    },

    buildGuideFromCurrentBuild(build: Build | null) {
      this.ensureGuideId()
      if (!build?.champion) return null
      if (this.rankedOpponents.length < 2) return null
      return buildMatchupGuideFromDraft(build, this.rankedOpponents, this.guideId)
    },

    reset() {
      this.guideId = ''
      this.rankedOpponents = []
    },
  },
})
