import { defineStore } from 'pinia'

interface MatchupGuideVoteState {
  upvotes: Record<string, number>
  downvotes: Record<string, number>
  userVotes: Record<string, 'up' | 'down' | null>
}

const UP_KEY = 'lelanation_matchup_guide_upvotes'
const DOWN_KEY = 'lelanation_matchup_guide_downvotes'
const USER_KEY = 'lelanation_matchup_guide_user_votes'

export const useMatchupGuideVoteStore = defineStore('matchupGuideVote', {
  state: (): MatchupGuideVoteState => ({
    upvotes: {},
    downvotes: {},
    userVotes: {},
  }),

  getters: {
    getUpvoteCount: state => (guideId: string) => state.upvotes[guideId] || 0,
    getDownvoteCount: state => (guideId: string) => state.downvotes[guideId] || 0,
    getUserVote: state => (guideId: string) => state.userVotes[guideId] || null,
  },

  actions: {
    init() {
      if (import.meta.server) return
      try {
        const storedUpvotes = localStorage.getItem(UP_KEY)
        if (storedUpvotes) this.upvotes = JSON.parse(storedUpvotes)

        const storedDownvotes = localStorage.getItem(DOWN_KEY)
        if (storedDownvotes) this.downvotes = JSON.parse(storedDownvotes)

        const storedUserVotes = localStorage.getItem(USER_KEY)
        if (storedUserVotes) this.userVotes = JSON.parse(storedUserVotes)
      } catch {
        // ignore malformed localStorage
      }
    },

    persist() {
      try {
        localStorage.setItem(UP_KEY, JSON.stringify(this.upvotes))
        localStorage.setItem(DOWN_KEY, JSON.stringify(this.downvotes))
        localStorage.setItem(USER_KEY, JSON.stringify(this.userVotes))
      } catch {
        return false
      }
      return true
    },

    upvote(guideId: string) {
      const currentVote = this.userVotes[guideId]
      const downCount = this.downvotes[guideId] ?? 0
      const upCount = this.upvotes[guideId] ?? 0
      if (currentVote === 'down' && downCount > 0) {
        this.downvotes[guideId] = downCount - 1
      }
      if (currentVote === 'up') {
        if (upCount > 0) this.upvotes[guideId] = upCount - 1
        this.userVotes[guideId] = null
      } else {
        this.upvotes[guideId] = upCount + 1
        this.userVotes[guideId] = 'up'
      }
      this.persist()
    },

    downvote(guideId: string) {
      const currentVote = this.userVotes[guideId]
      const upCount = this.upvotes[guideId] ?? 0
      const downCount = this.downvotes[guideId] ?? 0
      if (currentVote === 'up' && upCount > 0) {
        this.upvotes[guideId] = upCount - 1
      }
      if (currentVote === 'down') {
        if (downCount > 0) this.downvotes[guideId] = downCount - 1
        this.userVotes[guideId] = null
      } else {
        this.downvotes[guideId] = downCount + 1
        this.userVotes[guideId] = 'down'
      }
      this.persist()
    },
  },
})
