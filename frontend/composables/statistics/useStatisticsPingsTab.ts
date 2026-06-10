import { computed, ref, type Ref } from 'vue'
import type { StatisticsMobileSortOption } from '~/components/statistics/StatisticsMobileSortBar.vue'

export const PING_METRIC_KEYS = [
  'allIn',
  'assistMe',
  'basic',
  'command',
  'danger',
  'enemyMissing',
  'enemyVision',
  'getBack',
  'hold',
  'needVision',
  'onMyWay',
  'push',
  'retreat',
  'visionCleared',
] as const

export type PingMetricKey = (typeof PING_METRIC_KEYS)[number]

export type PingsTableRow = {
  championId: number
  games: number
  totalPerGame: number
} & Record<PingMetricKey, number>

export type PingsSortCol = 'champion' | 'games' | 'totalPerGame' | PingMetricKey

type PingsApiPayload = {
  rows: PingsTableRow[]
  message?: string
  error?: string
}

export function useStatisticsPingsTab(params: {
  championSearchQuery: Ref<string>
  statsVersionFilter: Ref<string>
  statsFetch: <T>(url: string) => Promise<T>
  apiUrl: (path: string) => string
  championGlobalTableQueryForVersion: (versionFull: string | null | undefined) => string
  gameVersion: Ref<string>
  championName: (championId: number) => string | null
}) {
  const pingsTableData = ref<PingsApiPayload | null>(null)
  const pingsPending = ref(false)
  const pingsError = ref<string | null>(null)
  const pingsSortColumn = ref<PingsSortCol>('totalPerGame')
  const pingsSortDir = ref<'asc' | 'desc'>('desc')
  const pingsPage = ref(1)
  const pingsPageSize = ref(50)

  async function loadPingsTable(): Promise<void> {
    pingsPending.value = true
    pingsError.value = null
    try {
      const mainVer = (params.statsVersionFilter.value || params.gameVersion.value || '').trim()
      const url = params.apiUrl(
        `/api/stats/champions/pings-table${params.championGlobalTableQueryForVersion(mainVer)}`
      )
      pingsTableData.value = await params.statsFetch<PingsApiPayload>(url)
      pingsPage.value = 1
    } catch (e) {
      pingsTableData.value = null
      pingsError.value = e instanceof Error ? e.message : String(e)
    } finally {
      pingsPending.value = false
    }
  }

  const filteredPingsRows = computed(() => {
    const q = params.championSearchQuery.value.trim().toLowerCase()
    const rows = pingsTableData.value?.rows ?? []
    if (!q) return rows
    return rows.filter(row => {
      const name = (params.championName(row.championId) ?? String(row.championId)).toLowerCase()
      return name.includes(q) || String(row.championId).includes(q)
    })
  })

  function comparePingsRows(a: PingsTableRow, b: PingsTableRow): number {
    const col = pingsSortColumn.value
    const dir = pingsSortDir.value === 'asc' ? 1 : -1
    if (col === 'champion') {
      const an = (params.championName(a.championId) ?? String(a.championId)).toLowerCase()
      const bn = (params.championName(b.championId) ?? String(b.championId)).toLowerCase()
      return dir * an.localeCompare(bn, undefined, { sensitivity: 'base' })
    }
    const av = col === 'games' || col === 'totalPerGame' ? a[col] : a[col as PingMetricKey]
    const bv = col === 'games' || col === 'totalPerGame' ? b[col] : b[col as PingMetricKey]
    return dir * (Number(av) - Number(bv))
  }

  const sortedPingsRows = computed(() => [...filteredPingsRows.value].sort(comparePingsRows))

  const totalPingsPages = computed(() =>
    Math.max(1, Math.ceil(sortedPingsRows.value.length / pingsPageSize.value))
  )

  const paginatedPingsRows = computed(() => {
    const start = (pingsPage.value - 1) * pingsPageSize.value
    return sortedPingsRows.value.slice(start, start + pingsPageSize.value)
  })

  function setPingsSort(col: PingsSortCol): void {
    if (pingsSortColumn.value === col) {
      pingsSortDir.value = pingsSortDir.value === 'asc' ? 'desc' : 'asc'
    } else {
      pingsSortColumn.value = col
      pingsSortDir.value = col === 'champion' ? 'asc' : 'desc'
    }
    pingsPage.value = 1
  }

  return {
    pingsTableData,
    pingsPending,
    pingsError,
    pingsSortColumn,
    pingsSortDir,
    pingsPage,
    pingsPageSize,
    sortedPingsRows,
    paginatedPingsRows,
    totalPingsPages,
    loadPingsTable,
    setPingsSort,
  }
}

export function pingsMobileSortOptions(t: (key: string) => string): StatisticsMobileSortOption[] {
  return [
    { value: 'totalPerGame', label: t('statisticsPage.pingsColTotal') },
    { value: 'games', label: t('statisticsPage.pingsColGames') },
    { value: 'champion', label: t('statisticsPage.pingsColChampion') },
    ...PING_METRIC_KEYS.map(key => ({
      value: key,
      label: t(`statisticsPage.pingsMetric.${key}`),
    })),
  ]
}
