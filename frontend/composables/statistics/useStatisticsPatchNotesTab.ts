import { computed, ref, type Ref } from 'vue'
import type { StatisticsMobileSortOption } from '~/components/statistics/StatisticsMobileSortBar.vue'

export type PatchNotesTargetType = 'champion' | 'items' | 'runes'
export type PatchNotesChangeType = 'up' | 'nerf' | 'ajust'

export type PatchNotesStatsRow = {
  targetType: PatchNotesTargetType
  targetId: string
  countNerf: number
  countUp: number
  countAjust: number
  totalChanges: number
  patchesTouched: number
  totalPatches: number
  regularity: number
  lastModPatch: string
  lastModType: PatchNotesChangeType
}

export type PatchNotesSortCol =
  | 'target'
  | 'countUp'
  | 'countNerf'
  | 'countAjust'
  | 'totalChanges'
  | 'lastMod'
  | 'regularity'

export function useStatisticsPatchNotesTab(params: {
  patchNotesFromVersion: Ref<string>
  patchNotesToVersion: Ref<string>
  patchNotesTargetFilters: Ref<Set<PatchNotesTargetType>>
  championSearchQuery: Ref<string>
  statsFetch: <T>(url: string) => Promise<T>
  apiUrl: (path: string) => string
}) {
  const patchNotesData = ref<{
    fromVersion: string | null
    toVersion: string | null
    totalPatches: number
    rows: PatchNotesStatsRow[]
    message?: string
  } | null>(null)
  const patchNotesPending = ref(false)
  const patchNotesError = ref<string | null>(null)
  const patchNotesSortColumn = ref<PatchNotesSortCol>('totalChanges')
  const patchNotesSortDir = ref<'asc' | 'desc'>('desc')
  const patchNotesPage = ref(1)
  const patchNotesPageSize = ref(50)

  const activeTargetTypes = computed<PatchNotesTargetType[]>(() => {
    const selected = [...params.patchNotesTargetFilters.value]
    if (selected.length === 0 || selected.length === 3) {
      return ['champion', 'items', 'runes']
    }
    return selected
  })

  function buildPatchNotesUrl(): string {
    const q = new URLSearchParams()
    if (params.patchNotesFromVersion.value.trim()) {
      q.set('version', params.patchNotesFromVersion.value.trim())
    }
    if (params.patchNotesToVersion.value.trim()) {
      q.set('sinceVersion', params.patchNotesToVersion.value.trim())
    }
    const types = activeTargetTypes.value
    if (types.length > 0 && types.length < 3) {
      for (const type of types) q.append('targetType', type)
    }
    const qs = q.toString()
    return params.apiUrl(`/api/stats/patch-notes${qs ? `?${qs}` : ''}`)
  }

  async function loadPatchNotesStats(): Promise<void> {
    patchNotesPending.value = true
    patchNotesError.value = null
    try {
      patchNotesData.value = await params.statsFetch(buildPatchNotesUrl())
      patchNotesPage.value = 1
    } catch (e) {
      patchNotesData.value = null
      patchNotesError.value = e instanceof Error ? e.message : String(e)
    } finally {
      patchNotesPending.value = false
    }
  }

  function togglePatchNotesTarget(type: PatchNotesTargetType): void {
    const next = new Set(params.patchNotesTargetFilters.value)
    if (next.has(type)) {
      if (next.size > 1) next.delete(type)
    } else {
      next.add(type)
    }
    params.patchNotesTargetFilters.value = next
  }

  function patchNotesTargetActive(type: PatchNotesTargetType): boolean {
    return params.patchNotesTargetFilters.value.has(type)
  }

  const patchNotesAllTargetsSelected = computed(
    () => params.patchNotesTargetFilters.value.size === 3
  )

  const filteredPatchNotesRows = computed(() => {
    const q = params.championSearchQuery.value.trim().toLowerCase()
    const rows = patchNotesData.value?.rows ?? []
    if (!q) return rows
    return rows.filter(row => {
      const id = row.targetId.toLowerCase()
      return id.includes(q)
    })
  })

  function comparePatchNotesRows(a: PatchNotesStatsRow, b: PatchNotesStatsRow): number {
    const col = patchNotesSortColumn.value
    const dir = patchNotesSortDir.value === 'asc' ? 1 : -1

    if (col === 'target') {
      return dir * a.targetId.localeCompare(b.targetId, undefined, { sensitivity: 'base' })
    }
    if (col === 'lastMod') {
      const av = a.lastModPatch
      const bv = b.lastModPatch
      if (av !== bv) return dir * av.localeCompare(bv, undefined, { numeric: true })
      return dir * a.lastModType.localeCompare(b.lastModType)
    }
    if (col === 'regularity') {
      return dir * (a.regularity - b.regularity)
    }
    const key = col as keyof Pick<
      PatchNotesStatsRow,
      'countUp' | 'countNerf' | 'countAjust' | 'totalChanges'
    >
    return dir * (Number(a[key]) - Number(b[key]))
  }

  const sortedPatchNotesRows = computed(() =>
    [...filteredPatchNotesRows.value].sort(comparePatchNotesRows)
  )

  const totalPatchNotesPages = computed(() =>
    Math.max(1, Math.ceil(sortedPatchNotesRows.value.length / patchNotesPageSize.value))
  )

  const paginatedPatchNotesRows = computed(() => {
    const start = (patchNotesPage.value - 1) * patchNotesPageSize.value
    return sortedPatchNotesRows.value.slice(start, start + patchNotesPageSize.value)
  })

  function setPatchNotesSort(col: PatchNotesSortCol): void {
    if (patchNotesSortColumn.value === col) {
      patchNotesSortDir.value = patchNotesSortDir.value === 'asc' ? 'desc' : 'asc'
    } else {
      patchNotesSortColumn.value = col
      patchNotesSortDir.value = col === 'target' ? 'asc' : 'desc'
    }
    patchNotesPage.value = 1
  }

  return {
    patchNotesData,
    patchNotesPending,
    patchNotesError,
    patchNotesSortColumn,
    patchNotesSortDir,
    patchNotesPage,
    patchNotesPageSize,
    sortedPatchNotesRows,
    paginatedPatchNotesRows,
    totalPatchNotesPages,
    loadPatchNotesStats,
    setPatchNotesSort,
    togglePatchNotesTarget,
    patchNotesTargetActive,
    patchNotesAllTargetsSelected,
    activeTargetTypes,
  }
}

export function patchNotesMobileSortOptions(
  t: (key: string) => string
): StatisticsMobileSortOption[] {
  return [
    { value: 'totalChanges', label: t('statisticsPage.patchNotesColTotal') },
    { value: 'countUp', label: t('statisticsPage.patchNotesColUp') },
    { value: 'countNerf', label: t('statisticsPage.patchNotesColNerf') },
    { value: 'countAjust', label: t('statisticsPage.patchNotesColAdjust') },
    { value: 'regularity', label: t('statisticsPage.patchNotesColRegularity') },
    { value: 'lastMod', label: t('statisticsPage.patchNotesColLastMod') },
    { value: 'target', label: t('statisticsPage.patchNotesColTarget') },
  ]
}
