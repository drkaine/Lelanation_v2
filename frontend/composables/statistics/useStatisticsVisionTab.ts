import { computed, ref, type Ref } from 'vue'
import type { StatisticsMobileSortOption } from '~/components/statistics/StatisticsMobileSortBar.vue'

export const VISION_METRIC_KEYS = [
  'visionScore',
  'visionScorePerMinute',
  'wardsPlaced',
  'wardsKilled',
  'controlWardsPlaced',
  'stealthWardsPlaced',
] as const

export type VisionMetricKey = (typeof VISION_METRIC_KEYS)[number]

export type VisionTableRow = {
  championId: number
} & Record<VisionMetricKey, number>

export type VisionSortCol = 'champion' | VisionMetricKey

type VisionApiPayload = {
  rows: VisionTableRow[]
  message?: string
  error?: string
}

export function useStatisticsVisionTab(params: {
  championSearchQuery: Ref<string>
  statsVersionFilter: Ref<string>
  statsFetch: <T>(url: string) => Promise<T>
  apiUrl: (path: string) => string
  championGlobalTableQueryForVersion: (versionFull: string | null | undefined) => string
  gameVersion: Ref<string>
  championName: (championId: number) => string | null
}) {
  const visionTableData = ref<VisionApiPayload | null>(null)
  const visionPending = ref(false)
  const visionError = ref<string | null>(null)
  const visionSortColumn = ref<VisionSortCol>('visionScore')
  const visionSortDir = ref<'asc' | 'desc'>('desc')
  const visionPage = ref(1)
  const visionPageSize = ref(50)

  async function loadVisionTable(): Promise<void> {
    visionPending.value = true
    visionError.value = null
    try {
      const mainVer = (params.statsVersionFilter.value || params.gameVersion.value || '').trim()
      const url = params.apiUrl(
        `/api/stats/champions/vision-table${params.championGlobalTableQueryForVersion(mainVer)}`
      )
      visionTableData.value = await params.statsFetch<VisionApiPayload>(url)
      visionPage.value = 1
    } catch (e) {
      visionTableData.value = null
      visionError.value = e instanceof Error ? e.message : String(e)
    } finally {
      visionPending.value = false
    }
  }

  const filteredVisionRows = computed(() => {
    const q = params.championSearchQuery.value.trim().toLowerCase()
    const rows = visionTableData.value?.rows ?? []
    if (!q) return rows
    return rows.filter(row => {
      const name = (params.championName(row.championId) ?? String(row.championId)).toLowerCase()
      return name.includes(q) || String(row.championId).includes(q)
    })
  })

  function compareVisionRows(a: VisionTableRow, b: VisionTableRow): number {
    const col = visionSortColumn.value
    const dir = visionSortDir.value === 'asc' ? 1 : -1
    if (col === 'champion') {
      const an = (params.championName(a.championId) ?? String(a.championId)).toLowerCase()
      const bn = (params.championName(b.championId) ?? String(b.championId)).toLowerCase()
      return dir * an.localeCompare(bn, undefined, { sensitivity: 'base' })
    }
    return dir * (Number(a[col]) - Number(b[col]))
  }

  const sortedVisionRows = computed(() => [...filteredVisionRows.value].sort(compareVisionRows))

  const totalVisionPages = computed(() =>
    Math.max(1, Math.ceil(sortedVisionRows.value.length / visionPageSize.value))
  )

  const paginatedVisionRows = computed(() => {
    const start = (visionPage.value - 1) * visionPageSize.value
    return sortedVisionRows.value.slice(start, start + visionPageSize.value)
  })

  function setVisionSort(col: VisionSortCol): void {
    if (visionSortColumn.value === col) {
      visionSortDir.value = visionSortDir.value === 'asc' ? 'desc' : 'asc'
    } else {
      visionSortColumn.value = col
      visionSortDir.value = col === 'champion' ? 'asc' : 'desc'
    }
    visionPage.value = 1
  }

  return {
    visionTableData,
    visionPending,
    visionError,
    visionSortColumn,
    visionSortDir,
    visionPage,
    visionPageSize,
    sortedVisionRows,
    paginatedVisionRows,
    totalVisionPages,
    loadVisionTable,
    setVisionSort,
  }
}

export function visionMobileSortOptions(t: (key: string) => string): StatisticsMobileSortOption[] {
  return [
    { value: 'champion', label: t('statisticsPage.visionColChampion') },
    ...VISION_METRIC_KEYS.map(key => ({
      value: key,
      label: t(`statisticsPage.visionMetric.${key}`),
    })),
  ]
}
