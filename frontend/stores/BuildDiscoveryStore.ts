import { defineStore } from 'pinia'
import type { Build, StoredBuild } from '@lelanation/shared-types'
import { useBuildStore } from './BuildStore'
import { useVoteStore } from './VoteStore'
import { useVersionStore } from './VersionStore'
import { apiUrl } from '~/utils/apiUrl'
import { hydrateBuild, isStoredBuild } from '~/utils/buildSerialize'

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

      // Search by champion name or author
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase()
        results = results.filter(
          build =>
            build.champion?.name.toLowerCase().includes(query) ||
            build.champion?.id.toLowerCase().includes(query) ||
            (build.author && build.author.toLowerCase().includes(query))
        )
      }

      // Filter by champion
      if (this.selectedChampion) {
        results = results.filter(build => build.champion?.id === this.selectedChampion)
      }

      // Filter by role (using build.roles field)
      if (this.selectedRole) {
        results = results.filter(build => {
          // Vérifier si le build a le rôle sélectionné dans son champ roles
          return build.roles && build.roles.includes(this.selectedRole!)
        })
      }

      // Filter by version (up-to-date)
      if (this.onlyUpToDate) {
        const versionStore = useVersionStore()
        const currentVersion = versionStore.currentVersion
        if (currentVersion) {
          results = results.filter(build => build.gameVersion === currentVersion)
        }
      }

      // Sort
      const sorted = [...results]

      switch (this.sortBy) {
        case 'recent':
          sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          break
        case 'popular': {
          // Sort by vote count (descending), then by creation date
          const voteStore = useVoteStore()
          sorted.sort((a, b) => {
            const votesA = voteStore.getVoteCount(a.id)
            const votesB = voteStore.getVoteCount(b.id)
            if (votesA !== votesB) {
              return votesB - votesA
            }
            // If same votes, sort by most recent
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          })
          break
        }
        case 'name':
          sorted.sort((a, b) => {
            const nameA = a.champion?.name || a.name
            const nameB = b.champion?.name || b.name
            return nameA.localeCompare(nameB)
          })
          break
      }

      return sorted
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
    async loadBuilds() {
      const buildStore = useBuildStore()
      const localBuilds = buildStore.getSavedBuilds()

      // Synchroniser les builds locaux avec le serveur (en arrière-plan)
      // Cela resauvegarde automatiquement les builds qui n'existent pas sur le serveur
      buildStore.syncAllBuildsToServer().catch(error => {
        // eslint-disable-next-line no-console
        console.warn('[BuildDiscoveryStore] Error syncing builds to server:', error)
      })

      // Charger les builds publics depuis l'API
      let publicBuilds: Build[] = []
      try {
        const response = await fetch(apiUrl('/api/builds'))
        if (response.ok) {
          const allBuilds = (await response.json()) as (Build | StoredBuild)[]
          const localBuildIds = new Set(localBuilds.map(b => b.id))
          const filtered = allBuilds.filter(
            b => !localBuildIds.has(b.id) && b.visibility !== 'private'
          )
          publicBuilds = filtered.map(b => (isStoredBuild(b) ? hydrateBuild(b) : (b as Build)))
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load public builds:', error)
      }

      // Combiner les builds locaux publics et les builds publics du serveur
      // (ne pas inclure nos builds privés dans la découverte)
      const localPublicBuilds = localBuilds.filter(b => b.visibility !== 'private')
      this.builds = [...localPublicBuilds, ...publicBuilds]

      const versionStore = useVersionStore()
      if (!versionStore.currentVersion) {
        await versionStore.loadCurrentVersion()
      }
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
        case 'popular': {
          // Sort by vote count (descending), then by creation date
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
