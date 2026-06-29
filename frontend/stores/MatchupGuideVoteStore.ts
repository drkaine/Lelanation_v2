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
      if (currentVote === 'down' && this.downvotes[guideId] > 0) {
        this.downvotes[guideId] -= 1
      }
      if (currentVote === 'up') {
        if (this.upvotes[guideId] > 0) this.upvotes[guideId] -= 1
        this.userVotes[guideId] = null
      } else {
        this.upvotes[guideId] = (this.upvotes[guideId] || 0) + 1
        this.userVotes[guideId] = 'up'
      }
      this.persist()
    },

    downvote(guideId: string) {
      const currentVote = this.userVotes[guideId]
      if (currentVote === 'up' && this.upvotes[guideId] > 0) {
        this.upvotes[guideId] -= 1
      }
      if (currentVote === 'down') {
        if (this.downvotes[guideId] > 0) this.downvotes[guideId] -= 1
        this.userVotes[guideId] = null
      } else {
        this.downvotes[guideId] = (this.downvotes[guideId] || 0) + 1
        this.userVotes[guideId] = 'down'
      }
      this.persist()
    },
  },
})
