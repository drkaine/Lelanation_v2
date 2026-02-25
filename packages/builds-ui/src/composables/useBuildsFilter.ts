import { ref, computed, type Ref } from 'vue'
import type { Build, Role } from '@lelanation/shared-types'

export type SortOption = 'recent' | 'popular' | 'name'
export type FilterRole = Role | null

export interface VoteProvider {
  getVoteCount: (buildId: string) => number
}

/**
 * Pure, framework-agnostic composable for filtering and sorting builds.
 * No store, no API, no routing — all data injected via params.
 */
export function useBuildsFilter(
  builds: Ref<Build[]>,
  options?: {
    currentVersion?: Ref<string | null>
    voteProvider?: VoteProvider
  }
) {
  const searchQuery = ref('')
  const selectedChampion = ref<string | null>(null)
  const selectedRole = ref<FilterRole>(null)
  const onlyUpToDate = ref(false)
  const sortBy = ref<SortOption>('recent')

  const hasActiveFilters = computed(() => {
    return (
      searchQuery.value !== '' ||
      selectedChampion.value !== null ||
      selectedRole.value !== null ||
      onlyUpToDate.value
    )
  })

  const filteredBuilds = computed(() => {
    let results = [...builds.value]

    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      results = results.filter(
        b =>
          b.champion?.name.toLowerCase().includes(q) ||
          b.champion?.id.toLowerCase().includes(q) ||
          (b.author && b.author.toLowerCase().includes(q))
      )
    }

    if (selectedChampion.value) {
      results = results.filter(b => b.champion?.id === selectedChampion.value)
    }

    if (selectedRole.value) {
      const role = selectedRole.value
      results = results.filter(b => b.roles?.includes(role))
    }

    if (onlyUpToDate.value && options?.currentVersion?.value) {
      const ver = options.currentVersion.value
      results = results.filter(b => b.gameVersion === ver)
    }

    const sorted = [...results]
    switch (sortBy.value) {
      case 'recent':
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case 'popular': {
        const vp = options?.voteProvider
        sorted.sort((a, b) => {
          const va = vp?.getVoteCount(a.id) ?? 0
          const vb = vp?.getVoteCount(b.id) ?? 0
          if (va !== vb) return vb - va
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })
        break
      }
      case 'name':
        sorted.sort((a, b) => {
          const na = a.champion?.name || a.name
          const nb = b.champion?.name || b.name
          return na.localeCompare(nb)
        })
        break
    }

    return sorted
  })

  function clearFilters() {
    searchQuery.value = ''
    selectedChampion.value = null
    selectedRole.value = null
    onlyUpToDate.value = false
  }

  return {
    searchQuery,
    selectedChampion,
    selectedRole,
    onlyUpToDate,
    sortBy,
    hasActiveFilters,
    filteredBuilds,
    clearFilters,
  }
}
