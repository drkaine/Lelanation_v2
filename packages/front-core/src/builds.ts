import type { Build, Role } from '@lelanation/shared-types'

export type SortOption = 'recent' | 'popular' | 'name'
export type FilterRole = Role | null

export interface BuildDiscoveryFilters {
  searchQuery: string
  selectedChampion: string | null
  selectedRole: FilterRole
  selectedVersion: string | null
  sortBy: SortOption
}

export function filterAndSortBuilds(
  builds: Build[],
  filters: BuildDiscoveryFilters,
  getVoteCount: (buildId: string) => number = () => 0
): Build[] {
  let results = [...builds]
  const query = filters.searchQuery.toLowerCase().trim()

  if (query) {
    results = results.filter(build => {
      if (build.name?.toLowerCase().includes(query)) return true
      if (build.champion?.name?.toLowerCase().includes(query)) return true
      if (build.champion?.id?.toLowerCase().includes(query)) return true
      if (build.author?.toLowerCase().includes(query)) return true
      return (build.subBuilds ?? []).some(sub => sub.title?.toLowerCase().includes(query))
    })
  }

  if (filters.selectedChampion) {
    results = results.filter(build => build.champion?.id === filters.selectedChampion)
  }

  if (filters.selectedRole) {
    results = results.filter(build => (build.roles ?? []).includes(filters.selectedRole!))
  }

  if (filters.selectedVersion) {
    results = results.filter(build => build.gameVersion === filters.selectedVersion)
  }

  return sortBuilds(results, filters.sortBy, getVoteCount)
}

export function sortBuilds(
  builds: Build[],
  sortBy: SortOption,
  getVoteCount: (buildId: string) => number = () => 0
): Build[] {
  const sorted = [...builds]
  switch (sortBy) {
    case 'recent':
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    case 'popular':
      return sorted.sort((a, b) => {
        const votesA = getVoteCount(a.id)
        const votesB = getVoteCount(b.id)
        if (votesA !== votesB) return votesB - votesA
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
    case 'name':
      return sorted.sort((a, b) => {
        const nameA = a.champion?.name || a.name
        const nameB = b.champion?.name || b.name
        return nameA.localeCompare(nameB)
      })
  }
}

export function paginate<T>(items: T[], pageSize: number | 'all', currentPage: number): T[] {
  if (pageSize === 'all') return items
  const start = (currentPage - 1) * pageSize
  return items.slice(start, start + pageSize)
}
