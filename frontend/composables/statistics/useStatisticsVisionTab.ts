import { computed, ref, watch, type Ref } from 'vue'
import type { StatisticsMobileSortOption } from '~/components/statistics/StatisticsMobileSortBar.vue'
import { matchesChampionSearch } from '~/utils/multilingualEntitySearch'

export const VISION_METRIC_KEYS = [
  'visionScore',
  'visionScorePerMinute',
  'wardsPlaced',
  'wardsKilled',
  'controlWardsPlaced',
  'stealthWardsPlaced',
] as const

export type VisionMetricKey = (typeof VISION_METRIC_KEYS)[number]

export type VisionDeltaSortCol = `${VisionMetricKey}Delta`

export type VisionSortCol = 'champion' | VisionMetricKey | VisionDeltaSortCol

export type VisionTableRow = {
  championId: number
} & Record<VisionMetricKey, number>

type VisionApiPayload = {
  rows: VisionTableRow[]
  message?: string
  error?: string
}

type VisionRefPayload = {
  rows: VisionTableRow[]
}

export function useStatisticsVisionTab(params: {
  championSearchQuery: Ref<string>
  statsVersionFilter: Ref<string>
  statsFetch: <T>(url: string) => Promise<T>
  apiUrl: (path: string) => string
  championGlobalTableQueryForVersion: (versionFull: string | null | undefined) => string
  gameVersion: Ref<string>
  championName: (championId: number) => string | null
  championsPageSize: Ref<number>
  resolveBaselineVersion: () => string | null
  patchFromVersion: (v: string | null | undefined) => string | null
}) {
  const visionTableData = ref<VisionApiPayload | null>(null)
  const visionTableRefData = ref<VisionRefPayload | null>(null)
  const visionPending = ref(false)
  const visionError = ref<string | null>(null)
  const visionSortColumn = ref<VisionSortCol>('visionScore')
  const visionSortDir = ref<'asc' | 'desc'>('desc')
  const visionPage = ref(1)

  const visionRefByChampion = computed(() => {
    const m = new Map<number, VisionTableRow>()
    for (const r of visionTableRefData.value?.rows ?? []) m.set(r.championId, r)
    return m
  })

  const visionPatchDeltaRefLabel = computed(() => {
    const baseline = params.resolveBaselineVersion()
    if (!baseline) return null
    return params.patchFromVersion(baseline)
  })

  function visionNumericValue(row: VisionTableRow, key: VisionMetricKey): number {
    return Number(row[key] ?? 0)
  }

  function visionDelta(row: VisionTableRow, key: VisionMetricKey): number | null {
    if (!visionPatchDeltaRefLabel.value) return null
    const refRow = visionRefByChampion.value.get(row.championId)
    if (!refRow) return null
    return visionNumericValue(row, key) - visionNumericValue(refRow, key)
  }

  function visionSortHint(col: VisionSortCol): string {
    if (visionSortColumn.value !== col) return ''
    return visionSortDir.value === 'desc' ? ' ↓' : ' ↑'
  }

  async function loadVisionTable(): Promise<void> {
    visionPending.value = true
    visionError.value = null
    visionTableRefData.value = null
    try {
      const mainVer = (params.statsVersionFilter.value || params.gameVersion.value || '').trim()
      const url = params.apiUrl(
        `/api/stats/champions/vision-table${params.championGlobalTableQueryForVersion(mainVer)}`
      )
      visionTableData.value = await params.statsFetch<VisionApiPayload>(url)
      visionPage.value = 1

      const refVer = params.resolveBaselineVersion()
      if (refVer && visionTableData.value?.rows?.length) {
        try {
          const refData = await params.statsFetch<VisionRefPayload>(
            params.apiUrl(
              `/api/stats/champions/vision-table${params.championGlobalTableQueryForVersion(refVer)}`
            )
          )
          if (refData?.rows?.length) visionTableRefData.value = refData
        } catch {
          visionTableRefData.value = null
        }
      }
    } catch (e) {
      visionTableData.value = null
      visionError.value = e instanceof Error ? e.message : String(e)
    } finally {
      visionPending.value = false
    }
  }

  const filteredVisionRows = computed(() => {
    const q = params.championSearchQuery.value.trim()
    const rows = visionTableData.value?.rows ?? []
    if (!q) return rows
    return rows.filter(row =>
      matchesChampionSearch(q, {
        championId: row.championId,
        name: params.championName(row.championId),
      })
    )
  })

  function compareVisionRows(a: VisionTableRow, b: VisionTableRow): number {
    const col = visionSortColumn.value
    const dir = visionSortDir.value === 'asc' ? 1 : -1
    if (col === 'champion') {
      const an = (params.championName(a.championId) ?? String(a.championId)).toLowerCase()
      const bn = (params.championName(b.championId) ?? String(b.championId)).toLowerCase()
      return dir * an.localeCompare(bn, undefined, { sensitivity: 'base' })
    }
    if (col.endsWith('Delta')) {
      const key = col.slice(0, -'Delta'.length) as VisionMetricKey
      return dir * ((visionDelta(a, key) ?? 0) - (visionDelta(b, key) ?? 0))
    }
    return (
      dir *
      (visionNumericValue(a, col as VisionMetricKey) -
        visionNumericValue(b, col as VisionMetricKey))
    )
  }

  const sortedVisionRows = computed(() => [...filteredVisionRows.value].sort(compareVisionRows))

  const totalVisionCount = computed(() => sortedVisionRows.value.length)

  const totalVisionPages = computed(() =>
    Math.max(1, Math.ceil(totalVisionCount.value / params.championsPageSize.value))
  )

  const paginatedVisionRows = computed(() => {
    const size = params.championsPageSize.value
    const page = Math.min(visionPage.value, totalVisionPages.value)
    const start = (page - 1) * size
    return sortedVisionRows.value.slice(start, start + size)
  })

  watch(
    [params.championSearchQuery, visionSortColumn, visionSortDir, params.championsPageSize],
    () => {
      visionPage.value = 1
    }
  )

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
    visionTableRefData,
    visionPatchDeltaRefLabel,
    visionPending,
    visionError,
    visionSortColumn,
    visionSortDir,
    visionPage,
    sortedVisionRows,
    totalVisionCount,
    paginatedVisionRows,
    totalVisionPages,
    visionDelta,
    visionSortHint,
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
