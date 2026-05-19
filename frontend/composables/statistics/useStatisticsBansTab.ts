import { computed, ref, watch, type Ref } from 'vue'

export type BansTableRow = {
  championId: number
  bansTotal: number
  bansWhenTeamWon: number
  bansWhenTeamLost: number
  bansBlue: number
  bansRed: number
  bansTop: number
  bansJungle: number
  bansMiddle: number
  bansBottom: number
  bansSupport: number
}

export type BansSortCol =
  | 'rate'
  | 'rateDelta'
  | 'win'
  | 'winDelta'
  | 'loss'
  | 'lossDelta'
  | 'blue'
  | 'blueDelta'
  | 'red'
  | 'redDelta'
  | 'top'
  | 'topDelta'
  | 'jungle'
  | 'jungleDelta'
  | 'middle'
  | 'middleDelta'
  | 'bottom'
  | 'bottomDelta'
  | 'support'
  | 'supportDelta'

type BansMetricKey =
  | 'bansTotal'
  | 'bansBlue'
  | 'bansRed'
  | 'bansTop'
  | 'bansJungle'
  | 'bansMiddle'
  | 'bansBottom'
  | 'bansSupport'

type BansApiPayload = {
  matchCount: number
  rows: BansTableRow[]
  message?: string
  error?: string
}

type RefPayload = {
  matchCount: number
  rows: BansTableRow[]
}

export function useStatisticsBansTab(params: {
  championSearchQuery: Ref<string>
  championsPageSize: Ref<number>
  statsVersionFilter: Ref<string>
  progressionFromVersion: Ref<string | null>
  gameVersion: Ref<string>
  statsFetch: <T>(url: string) => Promise<T>
  apiUrl: (path: string) => string
  patchFromVersion: (v: string | null | undefined) => string | null
  championGlobalTableQueryForVersion: (versionFull: string | null | undefined) => string
  statsPerfStart: (name: string) => number
  statsPerfEnd: (name: string, startedAt: number) => void
  championName: (championId: number) => string | null
  overviewTeamsData: Ref<{
    matchCount: number
    bans?: {
      byWin?: Array<{ championId: number; count: number }>
      byLoss?: Array<{ championId: number; count: number }>
    }
  } | null>
  overviewTeamsBaselineData: Ref<{
    matchCount: number
    bans?: {
      byWin?: Array<{ championId: number; count: number }>
      byLoss?: Array<{ championId: number; count: number }>
    }
  } | null>
}) {
  const bansTableData = ref<BansApiPayload | null>(null)
  const bansTableRefData = ref<RefPayload | null>(null)
  const bansPending = ref(false)
  const bansError = ref<string | null>(null)
  const bansSortColumn = ref<BansSortCol>('rate')
  const bansSortDir = ref<'asc' | 'desc'>('desc')
  const bansPage = ref(1)

  function banRateForBansRow(row: { bansTotal: number }, matchCount: number): number {
    if (matchCount <= 0) return 0
    return Math.round((10000 * row.bansTotal) / (2 * matchCount)) / 100
  }

  function banPctForCount(count: number, matchCount: number, bansPerMatch: number): number {
    if (matchCount <= 0 || bansPerMatch <= 0) return 0
    return Math.round((10000 * count) / (bansPerMatch * matchCount)) / 100
  }

  const bansRefByChampion = computed(() => {
    const m = new Map<number, BansTableRow>()
    for (const r of bansTableRefData.value?.rows ?? []) m.set(r.championId, r)
    return m
  })

  function bansDeltaPct(
    row: BansTableRow,
    key: BansMetricKey,
    bansPerMatch: number
  ): number | null {
    const refRow = bansRefByChampion.value.get(row.championId)
    const currMc = bansTableData.value?.matchCount ?? 0
    const refMc = bansTableRefData.value?.matchCount ?? 0
    if (!refRow || currMc <= 0 || refMc <= 0) return null
    const currPct = banPctForCount(Number(row[key] ?? 0), currMc, bansPerMatch)
    const refPct = banPctForCount(Number(refRow[key] ?? 0), refMc, bansPerMatch)
    return Math.round((currPct - refPct) * 100) / 100
  }

  function pctDeltaClass(delta: number): string {
    if (delta > 0) return 'text-success'
    if (delta < 0) return 'text-error'
    return 'text-text/60'
  }

  const bansByWinMap = computed(() => {
    const out = new Map<number, number>()
    for (const row of params.overviewTeamsData.value?.bans?.byWin ?? []) {
      out.set(Number(row.championId), Number(row.count ?? 0))
    }
    return out
  })

  const bansByLossMap = computed(() => {
    const out = new Map<number, number>()
    for (const row of params.overviewTeamsData.value?.bans?.byLoss ?? []) {
      out.set(Number(row.championId), Number(row.count ?? 0))
    }
    return out
  })

  const bansByWinRefMap = computed(() => {
    const out = new Map<number, number>()
    for (const row of params.overviewTeamsBaselineData.value?.bans?.byWin ?? []) {
      out.set(Number(row.championId), Number(row.count ?? 0))
    }
    return out
  })

  const bansByLossRefMap = computed(() => {
    const out = new Map<number, number>()
    for (const row of params.overviewTeamsBaselineData.value?.bans?.byLoss ?? []) {
      out.set(Number(row.championId), Number(row.count ?? 0))
    }
    return out
  })

  function bansOutcomeCount(championId: number, outcome: 'win' | 'loss'): number {
    const row = bansTableData.value?.rows?.find(r => r.championId === championId)
    if (row) {
      return outcome === 'win'
        ? Number(row.bansWhenTeamWon ?? 0)
        : Number(row.bansWhenTeamLost ?? 0)
    }
    return outcome === 'win'
      ? (bansByWinMap.value.get(championId) ?? 0)
      : (bansByLossMap.value.get(championId) ?? 0)
  }

  function bansOutcomeRefCount(championId: number, outcome: 'win' | 'loss'): number {
    const refRow = bansRefByChampion.value.get(championId)
    if (refRow) {
      return outcome === 'win'
        ? Number(refRow.bansWhenTeamWon ?? 0)
        : Number(refRow.bansWhenTeamLost ?? 0)
    }
    return outcome === 'win'
      ? (bansByWinRefMap.value.get(championId) ?? 0)
      : (bansByLossRefMap.value.get(championId) ?? 0)
  }

  function bansOutcomePct(championId: number, outcome: 'win' | 'loss'): number {
    const matchCount = bansTableData.value?.matchCount ?? 0
    if (matchCount <= 0) return 0
    return banPctForCount(bansOutcomeCount(championId, outcome), matchCount, 2)
  }

  function bansOutcomeDeltaPct(championId: number, outcome: 'win' | 'loss'): number | null {
    const currMc = bansTableData.value?.matchCount ?? 0
    const refMc = bansTableRefData.value?.matchCount ?? 0
    if (currMc <= 0 || refMc <= 0) return null
    const currPct = banPctForCount(bansOutcomeCount(championId, outcome), currMc, 2)
    const refPct = banPctForCount(bansOutcomeRefCount(championId, outcome), refMc, 2)
    return Math.round((currPct - refPct) * 100) / 100
  }

  function bansSortHint(col: BansSortCol): string {
    if (bansSortColumn.value !== col) return ''
    return bansSortDir.value === 'desc' ? ' ↓' : ' ↑'
  }

  const filteredBansRows = computed(() => {
    const list = bansTableData.value?.rows ?? []
    const mc = bansTableData.value?.matchCount ?? 0
    const q = params.championSearchQuery.value.toLowerCase()
    const filtered = q
      ? list.filter(row => {
          const name = params.championName(row.championId)?.toLowerCase() ?? ''
          return name.includes(q) || String(row.championId).includes(q)
        })
      : [...list]
    const col = bansSortColumn.value
    const dir = bansSortDir.value
    const mult = dir === 'desc' ? 1 : -1
    return filtered.sort((a, b) => {
      let va = 0
      let vb = 0
      switch (col) {
        case 'rate':
          va = banRateForBansRow(a, mc)
          vb = banRateForBansRow(b, mc)
          break
        case 'rateDelta':
          va = bansDeltaPct(a, 'bansTotal', 2) ?? 0
          vb = bansDeltaPct(b, 'bansTotal', 2) ?? 0
          break
        case 'win':
          va = bansOutcomePct(a.championId, 'win')
          vb = bansOutcomePct(b.championId, 'win')
          break
        case 'winDelta':
          va = bansOutcomeDeltaPct(a.championId, 'win') ?? 0
          vb = bansOutcomeDeltaPct(b.championId, 'win') ?? 0
          break
        case 'loss':
          va = bansOutcomePct(a.championId, 'loss')
          vb = bansOutcomePct(b.championId, 'loss')
          break
        case 'lossDelta':
          va = bansOutcomeDeltaPct(a.championId, 'loss') ?? 0
          vb = bansOutcomeDeltaPct(b.championId, 'loss') ?? 0
          break
        case 'blue':
          va = a.bansBlue
          vb = b.bansBlue
          break
        case 'blueDelta':
          va = bansDeltaPct(a, 'bansBlue', 1) ?? 0
          vb = bansDeltaPct(b, 'bansBlue', 1) ?? 0
          break
        case 'red':
          va = a.bansRed
          vb = b.bansRed
          break
        case 'redDelta':
          va = bansDeltaPct(a, 'bansRed', 1) ?? 0
          vb = bansDeltaPct(b, 'bansRed', 1) ?? 0
          break
        case 'top':
          va = a.bansTop
          vb = b.bansTop
          break
        case 'topDelta':
          va = bansDeltaPct(a, 'bansTop', 1) ?? 0
          vb = bansDeltaPct(b, 'bansTop', 1) ?? 0
          break
        case 'jungle':
          va = a.bansJungle
          vb = b.bansJungle
          break
        case 'jungleDelta':
          va = bansDeltaPct(a, 'bansJungle', 1) ?? 0
          vb = bansDeltaPct(b, 'bansJungle', 1) ?? 0
          break
        case 'middle':
          va = a.bansMiddle
          vb = b.bansMiddle
          break
        case 'middleDelta':
          va = bansDeltaPct(a, 'bansMiddle', 1) ?? 0
          vb = bansDeltaPct(b, 'bansMiddle', 1) ?? 0
          break
        case 'bottom':
          va = a.bansBottom
          vb = b.bansBottom
          break
        case 'bottomDelta':
          va = bansDeltaPct(a, 'bansBottom', 1) ?? 0
          vb = bansDeltaPct(b, 'bansBottom', 1) ?? 0
          break
        case 'support':
          va = a.bansSupport
          vb = b.bansSupport
          break
        case 'supportDelta':
          va = bansDeltaPct(a, 'bansSupport', 1) ?? 0
          vb = bansDeltaPct(b, 'bansSupport', 1) ?? 0
          break
      }
      return mult * (vb - va)
    })
  })

  const totalBansCount = computed(() => filteredBansRows.value.length)
  const totalBansPages = computed(() =>
    Math.max(1, Math.ceil(totalBansCount.value / params.championsPageSize.value))
  )
  const paginatedBans = computed(() => {
    const list = filteredBansRows.value
    const size = params.championsPageSize.value
    const page = Math.min(bansPage.value, totalBansPages.value)
    const start = (page - 1) * size
    return list.slice(start, start + size)
  })

  watch(bansSortColumn, () => {
    bansSortDir.value = 'desc'
  })
  watch([params.championSearchQuery, bansSortColumn, bansSortDir, params.championsPageSize], () => {
    bansPage.value = 1
  })

  function setBansSort(col: BansSortCol) {
    if (bansSortColumn.value === col) {
      bansSortDir.value = bansSortDir.value === 'desc' ? 'asc' : 'desc'
    } else {
      bansSortColumn.value = col
      bansSortDir.value = 'desc'
    }
  }

  async function loadBansTable() {
    const t = params.statsPerfStart('loadBansTable')
    bansPending.value = true
    bansError.value = null
    bansTableRefData.value = null
    try {
      const qs = params.championGlobalTableQueryForVersion(params.statsVersionFilter.value)
      const data = await params.statsFetch<BansApiPayload>(
        params.apiUrl(`/api/stats/champions/bans-table${qs}`)
      )
      bansTableData.value = data
      if (data?.error || data?.message) {
        bansError.value = [data.error, data.message].filter(Boolean).join(': ') || null
      } else {
        bansError.value = null
      }

      const refPatch = params.patchFromVersion(params.progressionFromVersion.value)
      const mainPatch = params.patchFromVersion(
        params.statsVersionFilter.value || params.gameVersion.value
      )
      const refVer = params.progressionFromVersion.value?.trim()
      if (
        refPatch &&
        mainPatch &&
        refPatch !== mainPatch &&
        refVer &&
        !data?.error &&
        data.rows &&
        data.rows.length > 0
      ) {
        try {
          const refData = await params.statsFetch<RefPayload>(
            params.apiUrl(
              `/api/stats/champions/bans-table${params.championGlobalTableQueryForVersion(refVer)}`
            )
          )
          if (refData?.rows?.length) bansTableRefData.value = refData
        } catch {
          bansTableRefData.value = null
        }
      }
    } catch (e) {
      bansError.value = e instanceof Error ? e.message : String(e)
    } finally {
      bansPending.value = false
      params.statsPerfEnd('loadBansTable', t)
    }
  }

  return {
    bansTableData,
    bansTableRefData,
    bansPending,
    bansError,
    bansSortColumn,
    bansSortDir,
    bansPage,
    banRateForBansRow,
    banPctForCount,
    bansDeltaPct,
    bansOutcomeDeltaPct,
    bansOutcomePct,
    pctDeltaClass,
    bansSortHint,
    filteredBansRows,
    totalBansCount,
    totalBansPages,
    paginatedBans,
    setBansSort,
    loadBansTable,
  }
}
