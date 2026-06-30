import { computed, ref, watch, type Ref } from 'vue'
import type { StatisticsMobileSortOption } from '~/components/statistics/StatisticsMobileSortBar.vue'
import { matchesChampionSearch } from '~/utils/multilingualEntitySearch'

/**
 * Métriques affichées (remap API Riot : basic→command, danger→getBack).
 * @see backend/src/constants/championPingMetrics.ts
 */
export const PING_METRIC_KEYS = [
  'allIn',
  'assistMe',
  'basic',
  'danger',
  'enemyMissing',
  'enemyVision',
  'needVision',
  'onMyWay',
  'push',
  'retreat',
] as const

export const PING_MOBILE_PREVIEW_KEYS = ['allIn', 'assistMe', 'enemyMissing'] as const

export type PingMobilePreviewKey = (typeof PING_MOBILE_PREVIEW_KEYS)[number]

export const PING_MOBILE_EXPANDED_KEYS = PING_METRIC_KEYS.filter(
  (key): key is Exclude<(typeof PING_METRIC_KEYS)[number], PingMobilePreviewKey> =>
    !(PING_MOBILE_PREVIEW_KEYS as readonly string[]).includes(key)
)

export type PingMetricKey = (typeof PING_METRIC_KEYS)[number]

export type PingsNumericKey = 'totalPerGame' | PingMetricKey

export type PingsDeltaSortCol = `${PingsNumericKey}Delta`

export type PingsSortCol = 'champion' | PingsNumericKey | PingsDeltaSortCol

export type PingsTableRow = {
  championId: number
  games: number
  totalPerGame: number
} & Record<PingMetricKey, number>

type PingsApiPayload = {
  rows: PingsTableRow[]
  message?: string
  error?: string
}

type PingsRefPayload = {
  rows: PingsTableRow[]
}

export function useStatisticsPingsTab(params: {
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
  const pingsTableData = ref<PingsApiPayload | null>(null)
  const pingsTableRefData = ref<PingsRefPayload | null>(null)
  const pingsPending = ref(false)
  const pingsError = ref<string | null>(null)
  const pingsSortColumn = ref<PingsSortCol>('totalPerGame')
  const pingsSortDir = ref<'asc' | 'desc'>('desc')
  const pingsPage = ref(1)

  const pingsRefByChampion = computed(() => {
    const m = new Map<number, PingsTableRow>()
    for (const r of pingsTableRefData.value?.rows ?? []) m.set(r.championId, r)
    return m
  })

  const pingsPatchDeltaRefLabel = computed(() => {
    const baseline = params.resolveBaselineVersion()
    if (!baseline) return null
    return params.patchFromVersion(baseline)
  })

  function pingsNumericValue(row: PingsTableRow, key: PingsNumericKey): number {
    return Number(row[key] ?? 0)
  }

  function pingsDelta(row: PingsTableRow, key: PingsNumericKey): number | null {
    if (!pingsPatchDeltaRefLabel.value) return null
    const refRow = pingsRefByChampion.value.get(row.championId)
    if (!refRow) return null
    return pingsNumericValue(row, key) - pingsNumericValue(refRow, key)
  }

  function pingsSortHint(col: PingsSortCol): string {
    if (pingsSortColumn.value !== col) return ''
    return pingsSortDir.value === 'desc' ? ' ↓' : ' ↑'
  }

  async function loadPingsTable(): Promise<void> {
    pingsPending.value = true
    pingsError.value = null
    pingsTableRefData.value = null
    try {
      const mainVer = (params.statsVersionFilter.value || params.gameVersion.value || '').trim()
      const url = params.apiUrl(
        `/api/stats/champions/pings-table${params.championGlobalTableQueryForVersion(mainVer)}`
      )
      pingsTableData.value = await params.statsFetch<PingsApiPayload>(url)
      pingsPage.value = 1

      const refVer = params.resolveBaselineVersion()
      if (refVer && pingsTableData.value?.rows?.length) {
        try {
          const refData = await params.statsFetch<PingsRefPayload>(
            params.apiUrl(
              `/api/stats/champions/pings-table${params.championGlobalTableQueryForVersion(refVer)}`
            )
          )
          if (refData?.rows?.length) pingsTableRefData.value = refData
        } catch {
          pingsTableRefData.value = null
        }
      }
    } catch (e) {
      pingsTableData.value = null
      pingsError.value = e instanceof Error ? e.message : String(e)
    } finally {
      pingsPending.value = false
    }
  }

  const filteredPingsRows = computed(() => {
    const q = params.championSearchQuery.value.trim()
    const rows = pingsTableData.value?.rows ?? []
    if (!q) return rows
    return rows.filter(row =>
      matchesChampionSearch(q, {
        championId: row.championId,
        name: params.championName(row.championId),
      })
    )
  })

  function comparePingsRows(a: PingsTableRow, b: PingsTableRow): number {
    const col = pingsSortColumn.value
    const dir = pingsSortDir.value === 'asc' ? 1 : -1
    if (col === 'champion') {
      const an = (params.championName(a.championId) ?? String(a.championId)).toLowerCase()
      const bn = (params.championName(b.championId) ?? String(b.championId)).toLowerCase()
      return dir * an.localeCompare(bn, undefined, { sensitivity: 'base' })
    }
    if (col.endsWith('Delta')) {
      const key = col.slice(0, -'Delta'.length) as PingsNumericKey
      return dir * ((pingsDelta(a, key) ?? 0) - (pingsDelta(b, key) ?? 0))
    }
    return (
      dir *
      (pingsNumericValue(a, col as PingsNumericKey) - pingsNumericValue(b, col as PingsNumericKey))
    )
  }

  const sortedPingsRows = computed(() => [...filteredPingsRows.value].sort(comparePingsRows))

  const totalPingsCount = computed(() => sortedPingsRows.value.length)

  const totalPingsPages = computed(() =>
    Math.max(1, Math.ceil(totalPingsCount.value / params.championsPageSize.value))
  )

  const paginatedPingsRows = computed(() => {
    const size = params.championsPageSize.value
    const page = Math.min(pingsPage.value, totalPingsPages.value)
    const start = (page - 1) * size
    return sortedPingsRows.value.slice(start, start + size)
  })

  watch(
    [params.championSearchQuery, pingsSortColumn, pingsSortDir, params.championsPageSize],
    () => {
      pingsPage.value = 1
    }
  )

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
    pingsTableRefData,
    pingsPatchDeltaRefLabel,
    pingsPending,
    pingsError,
    pingsSortColumn,
    pingsSortDir,
    pingsPage,
    sortedPingsRows,
    totalPingsCount,
    paginatedPingsRows,
    totalPingsPages,
    pingsDelta,
    pingsSortHint,
    loadPingsTable,
    setPingsSort,
  }
}

export function pingsMobileSortOptions(t: (key: string) => string): StatisticsMobileSortOption[] {
  return [
    { value: 'totalPerGame', label: t('statisticsPage.pingsColTotal') },
    { value: 'champion', label: t('statisticsPage.pingsColChampion') },
    ...PING_METRIC_KEYS.map(key => ({
      value: key,
      label: t(`statisticsPage.pingsMetric.${key}`),
    })),
  ]
}
