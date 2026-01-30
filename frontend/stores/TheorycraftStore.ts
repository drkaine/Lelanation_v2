import { defineStore } from 'pinia'
import type { Build } from '~/types/build'

interface TheorycraftState {
  theorycraftBuild: Build | null
}

export const useTheorycraftStore = defineStore('theorycraft', {
  state: (): TheorycraftState => ({
    theorycraftBuild: null,
  }),

  getters: {
    hasBuild(): boolean {
      return this.theorycraftBuild !== null
    },
  },

  actions: {
    /**
     * Load a build into the theorycraft store
     */
    loadBuild(build: Build) {
      this.theorycraftBuild = build
    },

    /**
     * Clear the theorycraft build
     */
    clearBuild() {
      this.theorycraftBuild = null
    },

    /**
     * Get the build to use for theorycraft (returns theorycraft build if available, otherwise null)
     */
    getBuild(): Build | null {
      return this.theorycraftBuild
    },
  },
})
