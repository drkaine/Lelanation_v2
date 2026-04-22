import { defineStore } from 'pinia'
import type { Build, StoredBuild } from '@lelanation/shared-types'
import { useBuildStore } from './BuildStore'
import { useVoteStore } from './VoteStore'
import { useVersionStore } from './VersionStore'
import { apiUrl } from '~/utils/apiUrl'
import { hydrateBuild, isStoredBuild } from '~/utils/buildSerialize'

export type SortOption = 'recent' | 'popular' | 'name'
export type FilterRole = 'top' | 'jungle' | 'mid' | 'adc' | 'support' | null
/** Filtre découverte : un tag build (Pro / OTP / …), même logique que `Build.tags`. */
export type FilterBuildTag = 'pro' | 'otp' | 'exotique' | 'troll' | null
export type PageSizeOption = 20 | 30 | 40 | 50 | 'all'

const PAGINATION_STORAGE_KEY = 'lelanation_builds_pagination'

function readPaginationFromStorage(): { pageSize: PageSizeOption; currentPage: number } | null {
  if (typeof document === 'undefined') return null
  try {
    const raw = localStorage.getItem(PAGINATION_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as { pageSize?: number | string; currentPage?: number }
    const validSizes: PageSizeOption[] = [20, 30, 40, 50, 'all']
    const pageSize =
      data.pageSize !== undefined && validSizes.includes(data.pageSize as PageSizeOption)
        ? (data.pageSize as PageSizeOption)
        : null
    const currentPage =
      typeof data.currentPage === 'number' && data.currentPage >= 1
        ? Math.floor(data.currentPage)
        : null
    if (pageSize !== null && currentPage !== null) {
      return { pageSize, currentPage }
    }
  } catch {
    // ignore
  }
  return null
}

function writePaginationToStorage(pageSize: PageSizeOption, currentPage: number) {
  if (typeof document === 'undefined') return
  try {
    localStorage.setItem(PAGINATION_STORAGE_KEY, JSON.stringify({ pageSize, currentPage }))
  } catch {
    // ignore
  }
}

interface BuildDiscoveryState {
  searchQuery: string
  selectedChampion: string | null
  selectedRole: FilterRole
  selectedTag: FilterBuildTag
  selectedVersion: string | null
  sortBy: SortOption
  pageSize: PageSizeOption
  currentPage: number
  builds: Build[]
  filteredBuilds: Build[]
  comparisonBuilds: string[] // Build IDs
}

export const useBuildDiscoveryStore = defineStore('buildDiscovery', {
  state: (): BuildDiscoveryState => ({
    searchQuery: '',
    selectedChampion: null,
    selectedRole: null,
    selectedTag: null,
    selectedVersion: null,
    sortBy: 'recent',
    pageSize: 20,
    currentPage: 1,
    builds: [],
    filteredBuilds: [],
    comparisonBuilds: [],
  }),

  getters: {
    searchResults(): Build[] {
      let results = [...this.builds]

      // Search by build name, variant titles, champion name or author
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase().trim()
        results = results.filter(build => {
          if (build.name?.toLowerCase().includes(query)) return true
          if (build.champion?.name?.toLowerCase().includes(query)) return true
          if (build.champion?.id?.toLowerCase().includes(query)) return true
          if (build.author?.toLowerCase().includes(query)) return true
          const subBuilds = build.subBuilds ?? []
          if (subBuilds.some(sub => sub.title?.toLowerCase().includes(query))) return true
          return false
        })
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

      // Filter by build tag (Pro, OTP, …)
      if (this.selectedTag) {
        const tag = this.selectedTag
        results = results.filter(build => {
          if (build.tags?.includes(tag)) return true
          return (build.subBuilds ?? []).some(sub => sub.tags?.includes(tag))
        })
      }

      // Filter by version
      if (this.selectedVersion) {
        results = results.filter(build => build.gameVersion === this.selectedVersion)
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

    totalFilteredCount(): number {
      return this.filteredBuilds.length
    },

    totalPages(): number {
      if (this.pageSize === 'all') return 1
      const total = this.filteredBuilds.length
      return total === 0 ? 0 : Math.ceil(total / this.pageSize)
    },

    paginatedBuilds(): Build[] {
      if (this.pageSize === 'all') return this.filteredBuilds
      const start = (this.currentPage - 1) * this.pageSize
      return this.filteredBuilds.slice(start, start + this.pageSize)
    },

    hasActiveFilters(): boolean {
      return (
        this.searchQuery !== '' ||
        this.selectedChampion !== null ||
        this.selectedRole !== null ||
        this.selectedTag !== null ||
        this.selectedVersion !== null
      )
    },
  },

  actions: {
    async loadBuilds() {
      const buildStore = useBuildStore()
      const localBuilds = buildStore.getSavedBuilds()

      // Synchroniser les builds locaux avec le serveur (en arrière-plan)
      // Cela resauvegarde automatiquement les builds qui n'existent pas sur le serveur
      buildStore.syncAllBuildsToServer().catch(() => {})

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
      } catch {
        // Failed to load public builds
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

    setSelectedTag(tag: FilterBuildTag) {
      this.selectedTag = tag
      this.applyFilters()
    },

    setSelectedVersion(version: string | null) {
      this.selectedVersion = version
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
      this.selectedTag = null
      this.selectedVersion = null
      this.applyFilters()
    },

    applyFilters() {
      this.filteredBuilds = this.searchResults
      this.currentPage = 1
      writePaginationToStorage(this.pageSize, this.currentPage)
    },

    setPageSize(size: PageSizeOption) {
      this.pageSize = size
      const maxPage = this.totalPages || 1
      if (this.currentPage > maxPage) {
        this.currentPage = maxPage
      }
      writePaginationToStorage(this.pageSize, this.currentPage)
    },

    setPage(page: number) {
      const maxPage = this.totalPages || 1
      this.currentPage = Math.max(1, Math.min(page, maxPage))
      writePaginationToStorage(this.pageSize, this.currentPage)
    },

    /** Restore page and pageSize from localStorage (call on builds page mount, client-only). */
    restorePaginationFromStorage() {
      const saved = readPaginationFromStorage()
      if (saved) {
        this.pageSize = saved.pageSize
        this.currentPage = saved.currentPage
      }
    },

    /** Clamp currentPage to a given max (e.g. for custom list total pages). */
    clampPageToMax(maxPage: number) {
      if (maxPage < 1) return
      if (this.currentPage > maxPage) {
        this.currentPage = maxPage
        writePaginationToStorage(this.pageSize, this.currentPage)
      }
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
