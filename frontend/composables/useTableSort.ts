import { ref, type Ref } from 'vue'

export type SortDir = 'asc' | 'desc'

export type TableSortOptions<K extends string> = {
  initialKey?: K | null
  initialDir?: SortDir
  /** Direction applied when a new column is selected (default: desc). */
  defaultDir?: (key: K) => SortDir
  /** Third click on the active column clears the sort (desc → asc → none). */
  resettable?: boolean
  /** `triangles`: ' ↕' / ' ▲' / ' ▼' — `arrows`: '' / ' ↑' / ' ↓'. */
  indicator?: 'triangles' | 'arrows'
}

export type TableSort<K extends string, Active extends K | null = K | null> = {
  sortBy: Ref<Active>
  sortDir: Ref<SortDir>
  toggleSort: (key: K) => void
  sortIcon: (key: K) => string
}

const INDICATORS = {
  triangles: { idle: ' ↕', asc: ' ▲', desc: ' ▼' },
  arrows: { idle: '', asc: ' ↑', desc: ' ↓' },
} as const

/** With an initial key and no reset, a column is always active: `sortBy` is never null. */
export function useTableSort<K extends string>(
  opts: TableSortOptions<K> & { initialKey: K; resettable?: false }
): TableSort<K, K>
export function useTableSort<K extends string>(opts?: TableSortOptions<K>): TableSort<K>
export function useTableSort<K extends string>(opts: TableSortOptions<K> = {}): TableSort<K> {
  const defaultDir = opts.defaultDir ?? (() => 'desc' as SortDir)
  const icons = INDICATORS[opts.indicator ?? 'triangles']
  const sortBy = ref(opts.initialKey ?? null) as Ref<K | null>
  const sortDir = ref<SortDir>(opts.initialDir ?? 'desc')

  function toggleSort(key: K): void {
    if (sortBy.value !== key) {
      sortBy.value = key
      sortDir.value = defaultDir(key)
      return
    }
    if (opts.resettable && sortDir.value === 'asc') {
      sortBy.value = null
      sortDir.value = 'desc'
      return
    }
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  }

  function sortIcon(key: K): string {
    if (sortBy.value !== key) return icons.idle
    return icons[sortDir.value]
  }

  return { sortBy, sortDir, toggleSort, sortIcon }
}
