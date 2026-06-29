import { defineStore } from 'pinia'
import type { MatchupGuide } from '@lelanation/shared-types'
import { useMatchupGuideStore } from '~/stores/MatchupGuideStore'
import { useVersionStore } from '~/stores/VersionStore'
import { apiUrl } from '~/utils/apiUrl'

export type MatchupGuideSortOption = 'recent' | 'name'
export type MatchupGuideFilterRole = 'top' | 'jungle' | 'mid' | 'adc' | 'support' | null
export type MatchupGuidePageSizeOption = 20 | 30 | 40 | 50 | 'all'

const PAGINATION_STORAGE_KEY = 'lelanation_matchup_guides_pagination'

function readPaginationFromStorage(): {
  pageSize: MatchupGuidePageSizeOption
  currentPage: number
} | null {
  if (typeof document === 'undefined') return null
  try {
    const raw = localStorage.getItem(PAGINATION_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as { pageSize?: number | string; currentPage?: number }
    const validSizes: MatchupGuidePageSizeOption[] = [20, 30, 40, 50, 'all']
    const pageSize =
      data.pageSize !== undefined &&
      validSizes.includes(data.pageSize as MatchupGuidePageSizeOption)
        ? (data.pageSize as MatchupGuidePageSizeOption)
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

function writePaginationToStorage(pageSize: MatchupGuidePageSizeOption, currentPage: number) {
  if (typeof document === 'undefined') return
  try {
    localStorage.setItem(PAGINATION_STORAGE_KEY, JSON.stringify({ pageSize, currentPage }))
  } catch {
    // ignore
  }
}

function guideRecencyTimestamp(guide: MatchupGuide): number {
  for (const iso of [guide.updatedAt, guide.createdAt]) {
    if (iso && typeof iso === 'string') {
      const t = new Date(iso).getTime()
      if (Number.isFinite(t)) return t
    }
  }
  return 0
}

interface MatchupGuideDiscoveryState {
  searchQuery: string
  selectedChampion: string | null
  selectedOpponent: string | null
  selectedRole: MatchupGuideFilterRole
  selectedVersion: string | null
  onlyUpToDate: boolean
  sortBy: MatchupGuideSortOption
  pageSize: MatchupGuidePageSizeOption
  currentPage: number
  guides: MatchupGuide[]
  filteredGuides: MatchupGuide[]
  loading: boolean
  loadError: string | null
}

export const useMatchupGuideDiscoveryStore = defineStore('matchupGuideDiscovery', {
  state: (): MatchupGuideDiscoveryState => ({
    searchQuery: '',
    selectedChampion: null,
    selectedOpponent: null,
    selectedRole: null,
    selectedVersion: null,
    onlyUpToDate: false,
    sortBy: 'recent',
    pageSize: 20,
    currentPage: 1,
    guides: [],
    filteredGuides: [],
    loading: false,
    loadError: null,
  }),

  getters: {
    searchResults(): MatchupGuide[] {
      return this.filterGuides(this.guides)
    },

    totalPages(): number {
      if (this.pageSize === 'all') return 1
      const total = this.filteredGuides.length
      return total === 0 ? 0 : Math.ceil(total / this.pageSize)
    },

    paginatedGuides(): MatchupGuide[] {
      if (this.pageSize === 'all') return this.filteredGuides
      const start = (this.currentPage - 1) * this.pageSize
      return this.filteredGuides.slice(start, start + this.pageSize)
    },

    hasActiveFilters(): boolean {
      return (
        this.searchQuery !== '' ||
        this.selectedChampion !== null ||
        this.selectedOpponent !== null ||
        this.selectedRole !== null ||
        this.selectedVersion !== null ||
        this.onlyUpToDate
      )
    },
  },

  actions: {
    filterGuides(source: MatchupGuide[]): MatchupGuide[] {
      let results = [...source]

      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase().trim()
        results = results.filter(guide => {
          if (guide.shortDescription?.toLowerCase().includes(query)) return true
          if (guide.description?.toLowerCase().includes(query)) return true
          if (guide.champion?.name?.toLowerCase().includes(query)) return true
          if (guide.champion?.id?.toLowerCase().includes(query)) return true
          if (guide.author?.toLowerCase().includes(query)) return true
          const inMatchups = [...(guide.bestMatchups ?? []), ...(guide.worstMatchups ?? [])]
          if (
            inMatchups.some(
              m => m.name?.toLowerCase().includes(query) || m.id?.toLowerCase().includes(query)
            )
          ) {
            return true
          }
          return false
        })
      }

      if (this.selectedChampion) {
        const selected = this.selectedChampion.toLowerCase()
        results = results.filter(guide => guide.champion?.id?.toLowerCase() === selected)
      }

      if (this.selectedOpponent) {
        const selected = this.selectedOpponent.toLowerCase()
        results = results.filter(guide => {
          const matchups = [...(guide.bestMatchups ?? []), ...(guide.worstMatchups ?? [])]
          return matchups.some(m => m.id?.toLowerCase() === selected)
        })
      }

      if (this.selectedRole) {
        results = results.filter(guide => guide.role === this.selectedRole)
      }

      if (this.selectedVersion) {
        results = results.filter(guide => guide.gameVersion === this.selectedVersion)
      }

      if (this.onlyUpToDate) {
        results = results.filter(guide => !guide.patchStale)
      }

      const sorted = [...results]
      switch (this.sortBy) {
        case 'recent':
          sorted.sort((a, b) => guideRecencyTimestamp(b) - guideRecencyTimestamp(a))
          break
        case 'name':
          sorted.sort((a, b) => {
            const nameA = a.champion?.name ?? ''
            const nameB = b.champion?.name ?? ''
            return nameA.localeCompare(nameB)
          })
          break
      }

      return sorted
    },

    clampPageToMax(maxPage: number) {
      const safeMax = Math.max(1, maxPage)
      if (this.currentPage > safeMax) {
        this.currentPage = safeMax
        writePaginationToStorage(this.pageSize, this.currentPage)
      }
    },

    async loadGuides(options?: { fetcher?: typeof $fetch }) {
      this.loading = true
      this.loadError = null

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

      try {
        const guideStore = useMatchupGuideStore()
        const localGuides = guideStore.getSavedGuides()

        let serverGuides: MatchupGuide[] = []
        try {
          const allGuides = (await fetchJson('/api/matchup-guides')) as MatchupGuide[]
          const localIds = new Set(localGuides.map(g => g.id))
          serverGuides = allGuides.filter(g => !localIds.has(g.id) && g.visibility !== 'private')
        } catch {
          // API unreachable — local guides still shown
        }

        this.guides = [...localGuides, ...serverGuides]

        const versionStore = useVersionStore()
        if (!versionStore.currentVersion) {
          await versionStore.loadCurrentVersion().catch(() => undefined)
        }
        this.applyFilters()
      } catch (error) {
        this.loadError = error instanceof Error ? error.message : 'Failed to load guides'
        this.guides = []
        this.filteredGuides = []
      } finally {
        this.loading = false
      }
    },

    setSearchQuery(query: string) {
      this.searchQuery = query
      this.applyFilters()
    },

    setSelectedChampion(championId: string | null) {
      this.selectedChampion = championId
      this.applyFilters()
    },

    setSelectedOpponent(championId: string | null) {
      this.selectedOpponent = championId
      this.applyFilters()
    },

    setSelectedRole(role: MatchupGuideFilterRole) {
      this.selectedRole = role
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

    setSortBy(sort: MatchupGuideSortOption) {
      this.sortBy = sort
      this.applyFilters()
    },

    clearAllFilters() {
      this.searchQuery = ''
      this.selectedChampion = null
      this.selectedOpponent = null
      this.selectedRole = null
      this.selectedVersion = null
      this.onlyUpToDate = false
      this.applyFilters()
    },

    applyFilters() {
      this.filteredGuides = this.searchResults
      this.currentPage = 1
      writePaginationToStorage(this.pageSize, this.currentPage)
    },

    setPageSize(size: MatchupGuidePageSizeOption) {
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

    restorePaginationFromStorage() {
      const saved = readPaginationFromStorage()
      if (saved) {
        this.pageSize = saved.pageSize
        this.currentPage = saved.currentPage
      }
    },
  },
})
