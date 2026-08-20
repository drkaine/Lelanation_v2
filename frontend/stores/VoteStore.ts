import { defineStore } from 'pinia'
import { apiUrl } from '~/utils/apiUrl'
import { getOrCreateVoterId, voterRequestHeaders } from '~/utils/voterId'

type UserVote = 'up' | 'down' | null

const LEGACY_USER_VOTES_KEY = 'lelanation_user_votes'
const LEGACY_UPVOTES_KEY = 'lelanation_upvotes'
const LEGACY_DOWNVOTES_KEY = 'lelanation_downvotes'
const VOTES_SERVER_SYNCED_KEY = 'lelanation_votes_server_synced_v1'

type ServerVoteStats = {
  upvotes?: number
  downvotes?: number
  userVote?: UserVote
}

interface VoteState {
  upvotes: Record<string, number>
  downvotes: Record<string, number>
  userVotes: Record<string, UserVote>
}

export type VoteActionResult = {
  ok: boolean
  autoPrivatized?: boolean
}

export const useVoteStore = defineStore('vote', {
  state: (): VoteState => ({
    upvotes: {},
    downvotes: {},
    userVotes: {},
  }),

  getters: {
    getUpvoteCount: state => {
      return (buildId: string): number => state.upvotes[buildId] || 0
    },

    getDownvoteCount: state => {
      return (buildId: string): number => state.downvotes[buildId] || 0
    },

    getUserVote: state => {
      return (buildId: string): UserVote => state.userVotes[buildId] ?? null
    },

    hasUserVoted: state => {
      return (buildId: string): boolean => state.userVotes[buildId] != null
    },
  },

  actions: {
    init() {
      if (import.meta.server) return
      getOrCreateVoterId()
      this.migrateLegacyVotesToServer().catch(() => undefined)
    },

    readLegacyUserVotes(): Record<string, 'up' | 'down'> {
      if (import.meta.server) return {}
      try {
        const raw = localStorage.getItem(LEGACY_USER_VOTES_KEY)
        if (!raw) return {}
        const parsed = JSON.parse(raw) as Record<string, unknown>
        const out: Record<string, 'up' | 'down'> = {}
        for (const [buildId, vote] of Object.entries(parsed)) {
          const id = buildId.trim()
          if (!id) continue
          if (vote === 'up' || vote === 'down') out[id] = vote
        }
        return out
      } catch {
        return {}
      }
    },

    clearLegacyVoteStorage(): void {
      if (import.meta.server) return
      try {
        localStorage.removeItem(LEGACY_USER_VOTES_KEY)
        localStorage.removeItem(LEGACY_UPVOTES_KEY)
        localStorage.removeItem(LEGACY_DOWNVOTES_KEY)
      } catch {
        // ignore
      }
    },

    /** Push votes stored locally before server-side voting existed. */
    async migrateLegacyVotesToServer(): Promise<void> {
      if (import.meta.server) return
      try {
        if (localStorage.getItem(VOTES_SERVER_SYNCED_KEY) === '1') return
      } catch {
        return
      }

      const legacyVotes = this.readLegacyUserVotes()
      if (!Object.keys(legacyVotes).length) {
        try {
          localStorage.setItem(VOTES_SERVER_SYNCED_KEY, '1')
        } catch {
          // ignore
        }
        return
      }

      try {
        const response = await fetch(apiUrl('/api/builds/votes/sync'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...voterRequestHeaders(),
          },
          body: JSON.stringify({ votes: legacyVotes }),
        })
        if (!response.ok) return

        const data = (await response.json()) as {
          votes?: Record<string, ServerVoteStats>
        }
        for (const [buildId, stats] of Object.entries(data.votes ?? {})) {
          this.applyServerStats(buildId, stats)
        }

        localStorage.setItem(VOTES_SERVER_SYNCED_KEY, '1')
        this.clearLegacyVoteStorage()
      } catch {
        // Retry on next visit if API was unreachable
      }
    },

    applyServerStats(buildId: string, stats: ServerVoteStats | undefined): void {
      if (!stats) return
      if (typeof stats.upvotes === 'number') this.upvotes[buildId] = stats.upvotes
      if (typeof stats.downvotes === 'number') this.downvotes[buildId] = stats.downvotes
      if (stats.userVote === 'up' || stats.userVote === 'down' || stats.userVote === null) {
        this.userVotes[buildId] = stats.userVote
      }
    },

    async loadVotesForBuilds(buildIds: string[]): Promise<void> {
      if (import.meta.server) return
      const ids = [...new Set(buildIds.map(id => id.trim()).filter(Boolean))].slice(0, 200)
      if (!ids.length) return

      try {
        const response = await fetch(
          apiUrl(`/api/builds/votes?ids=${encodeURIComponent(ids.join(','))}`),
          { headers: voterRequestHeaders() }
        )
        if (!response.ok) return
        const data = (await response.json()) as { votes?: Record<string, ServerVoteStats> }
        for (const [buildId, stats] of Object.entries(data.votes ?? {})) {
          this.applyServerStats(buildId, stats)
        }
      } catch {
        // API unavailable — counts stay at 0 until next load
      }
    },

    async loadVoteForBuild(buildId: string): Promise<void> {
      await this.loadVotesForBuilds([buildId])
    },

    applyUpvoteLocal(buildId: string): void {
      const currentVote = this.userVotes[buildId] ?? null
      if (currentVote === 'down' && (this.downvotes[buildId] ?? 0) > 0) {
        this.downvotes[buildId] = (this.downvotes[buildId] ?? 0) - 1
      }
      if (currentVote === 'up') {
        if ((this.upvotes[buildId] ?? 0) > 0) {
          this.upvotes[buildId] = (this.upvotes[buildId] ?? 0) - 1
        }
        this.userVotes[buildId] = null
        return
      }
      this.upvotes[buildId] = (this.upvotes[buildId] ?? 0) + 1
      this.userVotes[buildId] = 'up'
    },

    applyDownvoteLocal(buildId: string): void {
      const currentVote = this.userVotes[buildId] ?? null
      if (currentVote === 'up' && (this.upvotes[buildId] ?? 0) > 0) {
        this.upvotes[buildId] = (this.upvotes[buildId] ?? 0) - 1
      }
      if (currentVote === 'down') {
        if ((this.downvotes[buildId] ?? 0) > 0) {
          this.downvotes[buildId] = (this.downvotes[buildId] ?? 0) - 1
        }
        this.userVotes[buildId] = null
        return
      }
      this.downvotes[buildId] = (this.downvotes[buildId] ?? 0) + 1
      this.userVotes[buildId] = 'down'
    },

    async castVote(buildId: string, direction: 'up' | 'down'): Promise<VoteActionResult> {
      if (import.meta.server) return { ok: false }

      if (direction === 'up') this.applyUpvoteLocal(buildId)
      else this.applyDownvoteLocal(buildId)

      try {
        const response = await fetch(apiUrl(`/api/builds/${encodeURIComponent(buildId)}/vote`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...voterRequestHeaders(),
          },
          body: JSON.stringify({ direction }),
        })
        if (!response.ok) return { ok: false }
        const data = (await response.json()) as {
          stats?: ServerVoteStats
          autoPrivatized?: boolean
        }
        this.applyServerStats(buildId, data.stats)
        return { ok: true, autoPrivatized: data.autoPrivatized === true }
      } catch {
        return { ok: false }
      }
    },

    upvote(buildId: string): Promise<VoteActionResult> {
      return this.castVote(buildId, 'up')
    },

    downvote(buildId: string): Promise<VoteActionResult> {
      return this.castVote(buildId, 'down')
    },

    vote(buildId: string): Promise<VoteActionResult> {
      return this.upvote(buildId)
    },

    unvote(buildId: string): Promise<VoteActionResult> {
      const currentVote = this.userVotes[buildId]
      if (currentVote === 'up') return this.upvote(buildId)
      if (currentVote === 'down') return this.downvote(buildId)
      return Promise.resolve({ ok: true })
    },

    getVoteCount(buildId: string): number {
      return (this.upvotes[buildId] || 0) - (this.downvotes[buildId] || 0)
    },
  },
})
