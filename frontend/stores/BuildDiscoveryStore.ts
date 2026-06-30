import { defineStore } from 'pinia'
import type { Build, StoredBuild } from '@lelanation/shared-types'
import { useBuildStore } from './BuildStore'
import { useVoteStore } from './VoteStore'
import { useVersionStore } from './VersionStore'
import { apiUrl } from '~/utils/apiUrl'
import { hydrateBuild, isStoredBuild } from '~/utils/buildSerialize'
import { filterStandaloneLibraryBuilds } from '~/utils/buildLibrary'
import { extractPatchStaleMap, mergePatchStaleIntoBuilds } from '~/utils/mergePatchStale'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'
import { matchesChampionSearch, matchesLocalizedTextSearch } from '~/utils/multilingualEntitySearch'

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

/** Pour le tri « récent » : dernière édition d’abord, sinon date de création. */
function buildRecencyTimestamp(build: Build): number {
  for (const iso of [build.updatedAt, build.createdAt]) {
    if (iso && typeof iso === 'string') {
      const t = new Date(iso).getTime()
      if (Number.isFinite(t)) return t
    }
  }
  return 0
}

interface BuildDiscoveryState {
  searchQuery: string
  selectedChampion: string | null
  selectedRole: FilterRole
  selectedTag: FilterBuildTag
  selectedVersion: string | null
  onlyUpToDate: boolean
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
    onlyUpToDate: false,
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
        const query = this.searchQuery
        results = results.filter(build => {
          if (matchesLocalizedTextSearch(query, [build.name, build.author])) return true
          if (
            build.champion &&
            matchesChampionSearch(query, {
              id: build.champion.id,
              name: build.champion.name,
            })
          ) {
            return true
          }
          const subBuilds = build.subBuilds ?? []
          if (subBuilds.some(sub => matchesLocalizedTextSearch(query, [sub.title]))) return true
          return false
        })
      }

      // Filter by champion
      if (this.selectedChampion) {
        const selected = this.selectedChampion.toLowerCase()
        results = results.filter(build => build.champion?.id?.toLowerCase() === selected)
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

      if (this.onlyUpToDate) {
        results = results.filter(build => !build.patchStale)
      }

      // Sort
      const sorted = [...results]

      switch (this.sortBy) {
        case 'recent':
          sorted.sort((a, b) => buildRecencyTimestamp(b) - buildRecencyTimestamp(a))
          break
        case 'popular': {
          // Sort by vote count (descending), then by recency (updated / created)
          const voteStore = useVoteStore()
          sorted.sort((a, b) => {
            const votesA = voteStore.getVoteCount(a.id)
            const votesB = voteStore.getVoteCount(b.id)
            if (votesA !== votesB) {
              return votesB - votesA
            }
            return buildRecencyTimestamp(b) - buildRecencyTimestamp(a)
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
        this.selectedVersion !== null ||
        this.onlyUpToDate
      )
    },
  },

  actions: {
    async loadBuilds(options?: { fetcher?: typeof $fetch }) {
      const buildStore = useBuildStore()
      const fetchJson = async (path: string): Promise<unknown> => {
        if (options?.fetcher) {
          return options.fetcher(path)
        }
        const response = await fetch(apiUrl(path))
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`)
        }
        return response.json()
      }

      await buildStore.syncPatchStaleFromServer().catch(() => undefined)

      // Synchroniser les builds locaux avec le serveur (en arrière-plan)
      // Cela resauvegarde automatiquement les builds qui n'existent pas sur le serveur
      buildStore.syncAllBuildsToServer().catch(() => {})

      const summonerSpellsStore = useSummonerSpellsStore()
      if (summonerSpellsStore.spells.length === 0) {
        await summonerSpellsStore.loadSummonerSpells().catch(() => undefined)
      }

      const localBuilds = buildStore.getSavedBuilds()

      // Charger les builds publics depuis l'API
      let publicBuilds: Build[] = []
      try {
        const allBuilds = (await fetchJson('/api/builds')) as (Build | StoredBuild)[]
        const patchStaleById = extractPatchStaleMap(allBuilds)
        const localBuildIds = new Set(localBuilds.map(b => b.id))
        const filtered = allBuilds.filter(
          b => !localBuildIds.has(b.id) && b.visibility !== 'private'
        )
        publicBuilds = filtered.map(b => (isStoredBuild(b) ? hydrateBuild(b) : (b as Build)))
        const localPublicBuilds = mergePatchStaleIntoBuilds(
          filterStandaloneLibraryBuilds(localBuilds.filter(b => b.visibility !== 'private')),
          patchStaleById
        )
        this.builds = [...localPublicBuilds, ...publicBuilds]

        const versionStore = useVersionStore()
        if (!versionStore.currentVersion) {
          await versionStore.loadCurrentVersion()
        }
        this.applyFilters()
        return
      } catch {
        // Failed to load public builds
      }

      // Combiner les builds locaux publics et les builds publics du serveur
      // (ne pas inclure nos builds privés dans la découverte)
      const localPublicBuilds = filterStandaloneLibraryBuilds(
        localBuilds.filter(b => b.visibility !== 'private')
      )
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

    setOnlyUpToDate(value: boolean) {
      this.onlyUpToDate = value
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
      this.onlyUpToDate = false
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
          return sorted.sort((a, b) => buildRecencyTimestamp(b) - buildRecencyTimestamp(a))
        case 'popular': {
          const voteStore = useVoteStore()
          return sorted.sort((a, b) => {
            const votesA = voteStore.getVoteCount(a.id)
            const votesB = voteStore.getVoteCount(b.id)
            if (votesA !== votesB) {
              return votesB - votesA
            }
            return buildRecencyTimestamp(b) - buildRecencyTimestamp(a)
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
