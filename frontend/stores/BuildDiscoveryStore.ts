import { defineStore } from 'pinia'
import { useBuildStore } from './BuildStore'
import { useVoteStore } from './VoteStore'
import type { Build } from '~/types/build'

export type SortOption = 'recent' | 'popular' | 'name'
export type FilterRole = 'top' | 'jungle' | 'mid' | 'adc' | 'support' | null

interface BuildDiscoveryState {
  searchQuery: string
  selectedChampion: string | null
  selectedRole: FilterRole
  onlyUpToDate: boolean
  sortBy: SortOption
  builds: Build[]
  filteredBuilds: Build[]
  comparisonBuilds: string[] // Build IDs
}

export const useBuildDiscoveryStore = defineStore('buildDiscovery', {
  state: (): BuildDiscoveryState => ({
    searchQuery: '',
    selectedChampion: null,
    selectedRole: null,
    onlyUpToDate: false,
    sortBy: 'recent',
    builds: [],
    filteredBuilds: [],
    comparisonBuilds: [],
  }),

  getters: {
    searchResults(): Build[] {
      let results = [...this.builds]

      // Search by champion name
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase()
        results = results.filter(
          build =>
            build.champion?.name.toLowerCase().includes(query) ||
            build.champion?.id.toLowerCase().includes(query)
        )
      }

      // Filter by champion
      if (this.selectedChampion) {
        results = results.filter(build => build.champion?.id === this.selectedChampion)
      }

      // Filter by role (champion tags)
      if (this.selectedRole) {
        results = results.filter(build =>
          build.champion?.tags.includes(this.selectedRole!.toUpperCase())
        )
      }

      // Filter by version (up-to-date)
      if (this.onlyUpToDate) {
        // TODO: Get current version from VersionStore
        // For now, we'll skip this filter until VersionStore is properly integrated
        // const versionStore = useVersionStore()
        // const currentVersion = versionStore.currentVersion
        // if (currentVersion) {
        //   results = results.filter(build => build.gameVersion === currentVersion)
        // }
      }

      // Sort
      results = this.sortBuilds(results)

      return results
    },

    hasActiveFilters(): boolean {
      return (
        this.searchQuery !== '' ||
        this.selectedChampion !== null ||
        this.selectedRole !== null ||
        this.onlyUpToDate
      )
    },
  },

  actions: {
    loadBuilds() {
      const buildStore = useBuildStore()
      this.builds = buildStore.getSavedBuilds()
      this.applyFilters()
    },

    setSearchQuery(query: string) {
      this.searchQuery = query
      this.applyFilters()
    },

    setSelectedChampion(championId: string | null) {
      this.selectedChampion = championId
      this.applyFilters()
    },

    setSelectedRole(role: FilterRole) {
      this.selectedRole = role
      this.applyFilters()
    },

    setOnlyUpToDate(only: boolean) {
      this.onlyUpToDate = only
      this.applyFilters()
    },

    setSortBy(sort: SortOption) {
      this.sortBy = sort
      this.applyFilters()
    },

    clearAllFilters() {
      this.searchQuery = ''
      this.selectedChampion = null
      this.selectedRole = null
      this.onlyUpToDate = false
      this.applyFilters()
    },

    applyFilters() {
      this.filteredBuilds = this.searchResults
    },

    sortBuilds(builds: Build[]): Build[] {
      const sorted = [...builds]

      switch (this.sortBy) {
        case 'recent':
          return sorted.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        case 'popular': // Sort by vote count (descending), then by creation date
        {
          const voteStore = useVoteStore()
          return sorted.sort((a, b) => {
            const votesA = voteStore.getVoteCount(a.id)
            const votesB = voteStore.getVoteCount(b.id)
            if (votesA !== votesB) {
              return votesB - votesA
            }
            // If same votes, sort by most recent
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          })
        }
        case 'name':
          return sorted.sort((a, b) => {
            const nameA = a.champion?.name || a.name
            const nameB = b.champion?.name || b.name
            return nameA.localeCompare(nameB)
          })
        default:
          return sorted
      }
    },

    addToComparison(buildId: string) {
      if (!this.comparisonBuilds.includes(buildId) && this.comparisonBuilds.length < 4) {
        this.comparisonBuilds.push(buildId)
      }
    },

    removeFromComparison(buildId: string) {
      this.comparisonBuilds = this.comparisonBuilds.filter(id => id !== buildId)
    },

    clearComparison() {
      this.comparisonBuilds = []
    },

    getComparisonBuilds(): Build[] {
      const buildStore = useBuildStore()
      return this.comparisonBuilds
        .map(id => buildStore.getSavedBuilds().find(b => b.id === id))
        .filter((b): b is Build => b !== undefined)
    },
  },
})
