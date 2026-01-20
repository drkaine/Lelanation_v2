import { defineStore } from 'pinia'

interface VoteState {
  votes: Record<string, number> // buildId -> vote count
  userVotes: Record<string, boolean> // buildId -> has user voted
}

export const useVoteStore = defineStore('vote', {
  state: (): VoteState => ({
    votes: {},
    userVotes: {},
  }),

  getters: {
    getVoteCount: state => {
      return (buildId: string): number => {
        return state.votes[buildId] || 0
      }
    },

    hasUserVoted: state => {
      return (buildId: string): boolean => {
        return state.userVotes[buildId] || false
      }
    },
  },

  actions: {
    init() {
      // Load votes from localStorage
      try {
        const storedVotes = localStorage.getItem('lelanation_votes')
        if (storedVotes) {
          this.votes = JSON.parse(storedVotes)
        }

        const storedUserVotes = localStorage.getItem('lelanation_user_votes')
        if (storedUserVotes) {
          this.userVotes = JSON.parse(storedUserVotes)
        }
      } catch {
        // Ignore malformed localStorage values
      }
    },

    vote(buildId: string): boolean {
      // Check if user already voted
      if (this.userVotes[buildId]) {
        return false
      }

      // Increment vote count
      this.votes[buildId] = (this.votes[buildId] || 0) + 1
      this.userVotes[buildId] = true

      // Save to localStorage
      try {
        localStorage.setItem('lelanation_votes', JSON.stringify(this.votes))
        localStorage.setItem('lelanation_user_votes', JSON.stringify(this.userVotes))
      } catch {
        return false
      }

      return true
    },

    unvote(buildId: string): boolean {
      // Check if user has voted
      if (!this.userVotes[buildId]) {
        return false
      }

      // Decrement vote count (but don't go below 0)
      if (this.votes[buildId] && this.votes[buildId] > 0) {
        this.votes[buildId] = this.votes[buildId] - 1
      }
      this.userVotes[buildId] = false

      // Save to localStorage
      try {
        localStorage.setItem('lelanation_votes', JSON.stringify(this.votes))
        localStorage.setItem('lelanation_user_votes', JSON.stringify(this.userVotes))
      } catch {
        return false
      }

      return true
    },
  },
})
