import { defineStore } from 'pinia'

interface VoteState {
  upvotes: Record<string, number> // buildId -> upvote count
  downvotes: Record<string, number> // buildId -> downvote count
  userVotes: Record<string, 'up' | 'down' | null> // buildId -> user vote type
}

export const useVoteStore = defineStore('vote', {
  state: (): VoteState => ({
    upvotes: {},
    downvotes: {},
    userVotes: {},
  }),

  getters: {
    getUpvoteCount: state => {
      return (buildId: string): number => {
        return state.upvotes[buildId] || 0
      }
    },

    getDownvoteCount: state => {
      return (buildId: string): number => {
        return state.downvotes[buildId] || 0
      }
    },

    getUserVote: state => {
      return (buildId: string): 'up' | 'down' | null => {
        return state.userVotes[buildId] || null
      }
    },

    hasUserVoted: state => {
      return (buildId: string): boolean => {
        return state.userVotes[buildId] !== null && state.userVotes[buildId] !== undefined
      }
    },
  },

  actions: {
    init() {
      // Load votes from localStorage
      try {
        const storedUpvotes = localStorage.getItem('lelanation_upvotes')
        if (storedUpvotes) {
          this.upvotes = JSON.parse(storedUpvotes)
        }

        const storedDownvotes = localStorage.getItem('lelanation_downvotes')
        if (storedDownvotes) {
          this.downvotes = JSON.parse(storedDownvotes)
        }

        const storedUserVotes = localStorage.getItem('lelanation_user_votes')
        if (storedUserVotes) {
          this.userVotes = JSON.parse(storedUserVotes)
        }
      } catch {
        // Ignore malformed localStorage values
      }
    },

    upvote(buildId: string): boolean {
      const currentVote = this.userVotes[buildId]

      // Si l'utilisateur avait déjà downvoté, on retire le downvote
      if (currentVote === 'down') {
        if (this.downvotes[buildId] && this.downvotes[buildId] > 0) {
          this.downvotes[buildId] = this.downvotes[buildId] - 1
        }
      }

      // Si l'utilisateur avait déjà upvoté, on retire l'upvote
      if (currentVote === 'up') {
        if (this.upvotes[buildId] && this.upvotes[buildId] > 0) {
          this.upvotes[buildId] = this.upvotes[buildId] - 1
        }
        this.userVotes[buildId] = null
      } else {
        // Ajouter l'upvote
        this.upvotes[buildId] = (this.upvotes[buildId] || 0) + 1
        this.userVotes[buildId] = 'up'
      }

      // Save to localStorage
      try {
        localStorage.setItem('lelanation_upvotes', JSON.stringify(this.upvotes))
        localStorage.setItem('lelanation_downvotes', JSON.stringify(this.downvotes))
        localStorage.setItem('lelanation_user_votes', JSON.stringify(this.userVotes))
      } catch {
        return false
      }

      return true
    },

    downvote(buildId: string): boolean {
      const currentVote = this.userVotes[buildId]

      // Si l'utilisateur avait déjà upvoté, on retire l'upvote
      if (currentVote === 'up') {
        if (this.upvotes[buildId] && this.upvotes[buildId] > 0) {
          this.upvotes[buildId] = this.upvotes[buildId] - 1
        }
      }

      // Si l'utilisateur avait déjà downvoté, on retire le downvote
      if (currentVote === 'down') {
        if (this.downvotes[buildId] && this.downvotes[buildId] > 0) {
          this.downvotes[buildId] = this.downvotes[buildId] - 1
        }
        this.userVotes[buildId] = null
      } else {
        // Ajouter le downvote
        this.downvotes[buildId] = (this.downvotes[buildId] || 0) + 1
        this.userVotes[buildId] = 'down'
      }

      // Save to localStorage
      try {
        localStorage.setItem('lelanation_upvotes', JSON.stringify(this.upvotes))
        localStorage.setItem('lelanation_downvotes', JSON.stringify(this.downvotes))
        localStorage.setItem('lelanation_user_votes', JSON.stringify(this.userVotes))
      } catch {
        return false
      }

      return true
    },

    // Méthodes de compatibilité (pour migration)
    vote(buildId: string): boolean {
      return this.upvote(buildId)
    },

    unvote(buildId: string): boolean {
      const currentVote = this.userVotes[buildId]
      if (!currentVote) return false

      if (currentVote === 'up') {
        if (this.upvotes[buildId] && this.upvotes[buildId] > 0) {
          this.upvotes[buildId] = this.upvotes[buildId] - 1
        }
      } else if (currentVote === 'down') {
        if (this.downvotes[buildId] && this.downvotes[buildId] > 0) {
          this.downvotes[buildId] = this.downvotes[buildId] - 1
        }
      }

      this.userVotes[buildId] = null

      try {
        localStorage.setItem('lelanation_upvotes', JSON.stringify(this.upvotes))
        localStorage.setItem('lelanation_downvotes', JSON.stringify(this.downvotes))
        localStorage.setItem('lelanation_user_votes', JSON.stringify(this.userVotes))
      } catch {
        return false
      }

      return true
    },

    getVoteCount(buildId: string): number {
      // Pour compatibilité avec l'ancien système
      return (this.upvotes[buildId] || 0) - (this.downvotes[buildId] || 0)
    },
  },
})
