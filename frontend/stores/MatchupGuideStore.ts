import { defineStore } from 'pinia'
import type { MatchupGuide } from '@lelanation/shared-types'
import { getFallbackGameVersion } from '~/config/version'
import { apiUrl } from '~/utils/apiUrl'
import { buildEditHeaders } from '~/utils/buildApi'
import {
  GUIDE_SECRETS_STORAGE_KEY,
  parseGuideSecrets,
  withGuideSecret,
  withoutGuideSecret,
  type GuideSecrets,
} from '~/utils/matchupGuideEditSecrets'
import { shouldAutoPrivatizeFromCommunityVotes } from '~/utils/communityVoteVisibility'
import { useMatchupGuideVoteStore } from '~/stores/MatchupGuideVoteStore'
import { useVersionStore } from '~/stores/VersionStore'

const STORAGE_KEY = 'lelanation_matchup_guides'

function readGuideSecrets(): GuideSecrets {
  try {
    return parseGuideSecrets(localStorage.getItem(GUIDE_SECRETS_STORAGE_KEY))
  } catch {
    return {}
  }
}

function writeGuideSecrets(secrets: GuideSecrets): void {
  try {
    localStorage.setItem(GUIDE_SECRETS_STORAGE_KEY, JSON.stringify(secrets))
  } catch {
    // Storage unavailable: the guide stays editable only until the server locks it.
  }
}

/** DELETE with the edit secret this browser holds; forgets the secret once the server confirms. */
async function deleteGuideOnServer(guideId: string): Promise<void> {
  const secrets = readGuideSecrets()
  const res = await fetch(apiUrl(`/api/matchup-guides/${encodeURIComponent(guideId)}`), {
    method: 'DELETE',
    headers: buildEditHeaders(secrets[guideId]),
  })
  if (res.ok || res.status === 404)
    writeGuideSecrets(withoutGuideSecret(readGuideSecrets(), guideId))
}

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

    /** Met à jour le localStorage sans synchroniser le serveur (ex. cache après fetch API). */
    upsertGuideLocal(guide: MatchupGuide) {
      if (import.meta.server) return

      const savedGuides = this.getSavedGuides()
      const existingIndex = savedGuides.findIndex(g => g.id === guide.id)
      if (existingIndex >= 0) {
        savedGuides[existingIndex] = guide
      } else {
        savedGuides.push(guide)
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedGuides))
      this.savedGuidesVersion++
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
        const visibility = guide.visibility ?? 'public'
        const toSave: MatchupGuide = {
          ...guide,
          visibility,
          build: guide.build ? { ...guide.build, visibility } : guide.build,
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
              await deleteGuideOnServer(toSave.id)
            }
          } else {
            const res = await fetch(apiUrl('/api/matchup-guides'), {
              method: 'POST',
              headers: buildEditHeaders(toSave.id ? readGuideSecrets()[toSave.id] : undefined),
              body: JSON.stringify({ ...toSave, patchStale: null }),
            })
            if (res.ok) {
              const data = (await res.json()) as { id?: string; editSecret?: string }
              if (data.id)
                writeGuideSecrets(withGuideSecret(readGuideSecrets(), data.id, data.editSecret))
            }
          }
        } catch {
          // Saved locally; server sync best-effort
        }

        return true
      } catch {
        return false
      }
    },

    toggleGuideVisibility(guideId: string): Promise<boolean> {
      if (import.meta.server) return Promise.resolve(false)

      const savedGuides = this.getSavedGuides()
      const existing = savedGuides.find(g => g.id === guideId)
      if (!existing) return Promise.resolve(false)

      const nextVisibility: 'public' | 'private' =
        (existing.visibility ?? 'public') === 'private' ? 'public' : 'private'

      return this.saveGuide({
        ...existing,
        visibility: nextVisibility,
        build: existing.build ? { ...existing.build, visibility: nextVisibility } : existing.build,
      })
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
          await deleteGuideOnServer(guideId).catch(() => undefined)
        }

        return true
      } catch {
        return false
      }
    },

    async checkAndUpdateVisibility(guideId: string) {
      if (!guideId || import.meta.server) return false

      const voteStore = useMatchupGuideVoteStore()
      const upvotes = voteStore.getUpvoteCount(guideId)
      const downvotes = voteStore.getDownvoteCount(guideId)

      if (!shouldAutoPrivatizeFromCommunityVotes(upvotes, downvotes)) return false

      const savedGuides = this.getSavedGuides()
      const existingIndex = savedGuides.findIndex(g => g.id === guideId)
      if (existingIndex >= 0) {
        const existing = savedGuides[existingIndex]
        if (!existing) return false
        savedGuides[existingIndex] = {
          ...existing,
          visibility: 'private',
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedGuides))
        this.savedGuidesVersion++
      }

      try {
        // Only the browser that published the guide holds its secret; others get a 403.
        await deleteGuideOnServer(guideId)
      } catch {
        // Ignore errors
      }

      return true
    },
  },
})
