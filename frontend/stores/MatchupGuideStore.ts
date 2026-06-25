import { defineStore } from 'pinia'
import type { MatchupGuide } from '@lelanation/shared-types'
import { getFallbackGameVersion } from '~/config/version'
import { apiUrl } from '~/utils/apiUrl'
import { useVersionStore } from '~/stores/VersionStore'

const STORAGE_KEY = 'lelanation_matchup_guides'

export const useMatchupGuideStore = defineStore('matchupGuide', {
  state: () => ({
    savedGuidesVersion: 0,
  }),

  actions: {
    getSavedGuides(): MatchupGuide[] {
      if (import.meta.server) return []
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) return []
        return JSON.parse(stored) as MatchupGuide[]
      } catch {
        return []
      }
    },

    async saveGuide(guide: MatchupGuide): Promise<boolean> {
      if (import.meta.server) return false

      try {
        const versionStore = useVersionStore()
        if (!versionStore.currentVersion) {
          await versionStore.loadCurrentVersion().catch(() => undefined)
        }

        const savedGuides = this.getSavedGuides()
        const existingIndex = savedGuides.findIndex(g => g.id === guide.id)
        const previousGuide = existingIndex >= 0 ? savedGuides[existingIndex] : null
        const previousVisibility = previousGuide?.visibility ?? null
        const newVisibility = guide.visibility ?? 'public'

        const now = new Date().toISOString()
        const toSave: MatchupGuide = {
          ...guide,
          gameVersion: guide.gameVersion || versionStore.currentVersion || getFallbackGameVersion(),
          updatedAt: now,
          createdAt: existingIndex >= 0 ? guide.createdAt || now : now,
        }

        if (existingIndex >= 0) {
          savedGuides[existingIndex] = toSave
        } else {
          savedGuides.push(toSave)
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedGuides))
        this.savedGuidesVersion++

        try {
          if (newVisibility === 'private') {
            if (previousVisibility === 'public' && toSave.id) {
              await fetch(apiUrl(`/api/matchup-guides/${encodeURIComponent(toSave.id)}`), {
                method: 'DELETE',
              })
            }
          } else {
            await fetch(apiUrl('/api/matchup-guides'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...toSave, patchStale: null }),
            })
          }
        } catch {
          // Saved locally; server sync best-effort
        }

        return true
      } catch {
        return false
      }
    },

    async deleteGuide(guideId: string): Promise<boolean> {
      if (import.meta.server) return false

      try {
        const savedGuides = this.getSavedGuides()
        const existing = savedGuides.find(g => g.id === guideId)
        const next = savedGuides.filter(g => g.id !== guideId)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        this.savedGuidesVersion++

        if (existing?.visibility !== 'private') {
          await fetch(apiUrl(`/api/matchup-guides/${encodeURIComponent(guideId)}`), {
            method: 'DELETE',
          }).catch(() => undefined)
        }

        return true
      } catch {
        return false
      }
    },
  },
})
