import { computed, ref, watch, type Ref } from 'vue'
import type { StatisticsMobileSortOption } from '~/components/statistics/StatisticsMobileSortBar.vue'
import {
  CHAMPION_MISC_BASE_STAT_KEYS,
  CHAMPION_MISC_GROWTH_STAT_KEYS,
  CHAMPION_MISC_MAX_LEVEL,
  CHAMPION_MISC_MIN_LEVEL,
  championMiscStatUnavailable,
  championMiscStatValueAtLevel,
  loadAllChampionMiscStatsFromJson,
  type ChampionMiscBaseStatKey,
  type ChampionMiscGrowthStatKey,
  type ChampionMiscSortCol,
  type ChampionMiscStatRow,
} from '~/utils/championBaseStatsFromJson'
import {
  championMiscRowMatchesSearch,
  compareChampionMiscStatRowsByChampion,
} from '~/utils/championMiscStatVariants'

export function miscSortValue(
  row: ChampionMiscStatRow,
  col: ChampionMiscSortCol,
  level = 1
): number | string {
  if (col === 'champion') return row.name
  if (col.startsWith('base_')) {
    const key = col.slice('base_'.length) as ChampionMiscBaseStatKey
    if (championMiscStatUnavailable(row, key)) return Number.NEGATIVE_INFINITY
    return championMiscStatValueAtLevel(row, key, level)
  }
  const key = col.slice('growth_'.length) as ChampionMiscGrowthStatKey
  if (championMiscStatUnavailable(row, key)) return Number.NEGATIVE_INFINITY
  return row.growth[key] ?? 0
}

export function useStatisticsMiscTab(params: {
  championSearchQuery: Ref<string>
  gameVersion: Ref<string>
  riotLocale: Ref<string>
  championsPageSize: Ref<number>
  miscLevel: Ref<number>
  resolveGameVersion: () => Promise<string>
}) {
  const miscRows = ref<ChampionMiscStatRow[]>([])
  const miscPending = ref(false)
  const miscError = ref<string | null>(null)
  const miscLoadedVersion = ref('')
  const miscLoadedLocale = ref('')
  const miscSortColumn = ref<ChampionMiscSortCol>('base_hp')
  const miscSortDir = ref<'asc' | 'desc'>('desc')
  const miscPage = ref(1)
  const miscLevel = params.miscLevel

  const filteredMiscRows = computed(() => {
    const q = params.championSearchQuery.value.trim()
    const rows = miscRows.value
    if (!q) return rows
    return rows.filter(row => championMiscRowMatchesSearch(row, q))
  })

  function compareMiscRows(a: ChampionMiscStatRow, b: ChampionMiscStatRow): number {
    const col = miscSortColumn.value
    const dir = miscSortDir.value === 'asc' ? 1 : -1
    if (col === 'champion') {
      return dir * compareChampionMiscStatRowsByChampion(a, b)
    }
    const av = miscSortValue(a, col, miscLevel.value)
    const bv = miscSortValue(b, col, miscLevel.value)
    if (typeof av === 'string' || typeof bv === 'string') {
      return dir * String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' })
    }
    return dir * (Number(av) - Number(bv))
  }

  const sortedMiscRows = computed(() => [...filteredMiscRows.value].sort(compareMiscRows))

  const totalMiscCount = computed(() => sortedMiscRows.value.length)

  const totalMiscPages = computed(() =>
    Math.max(1, Math.ceil(totalMiscCount.value / params.championsPageSize.value))
  )

  const paginatedMiscRows = computed(() => {
    const size = params.championsPageSize.value
    const page = Math.min(miscPage.value, totalMiscPages.value)
    const start = (page - 1) * size
    return sortedMiscRows.value.slice(start, start + size)
  })

  watch(
    [params.championSearchQuery, miscSortColumn, miscSortDir, params.championsPageSize, miscLevel],
    () => {
      miscPage.value = 1
    }
  )

  function miscSortHint(col: ChampionMiscSortCol): string {
    if (miscSortColumn.value !== col) return ''
    return miscSortDir.value === 'desc' ? ' ↓' : ' ↑'
  }

  function setMiscSort(col: ChampionMiscSortCol): void {
    if (miscSortColumn.value === col) {
      miscSortDir.value = miscSortDir.value === 'asc' ? 'desc' : 'asc'
    } else {
      miscSortColumn.value = col
      miscSortDir.value = col === 'champion' ? 'asc' : 'desc'
    }
    miscPage.value = 1
  }

  async function loadMiscTable(): Promise<void> {
    miscPending.value = true
    miscError.value = null
    try {
      const version = (await params.resolveGameVersion()).trim()
      const language = params.riotLocale.value
      if (
        miscRows.value.length > 0 &&
        miscLoadedVersion.value === version &&
        miscLoadedLocale.value === language
      ) {
        return
      }
      miscRows.value = await loadAllChampionMiscStatsFromJson(version, language)
      miscLoadedVersion.value = version
      miscLoadedLocale.value = language
      miscPage.value = 1
    } catch (e) {
      miscRows.value = []
      miscError.value = e instanceof Error ? e.message : String(e)
    } finally {
      miscPending.value = false
    }
  }

  return {
    miscRows,
    miscPending,
    miscError,
    miscSortColumn,
    miscSortDir,
    miscPage,
    miscLevel,
    miscMinLevel: CHAMPION_MISC_MIN_LEVEL,
    miscMaxLevel: CHAMPION_MISC_MAX_LEVEL,
    sortedMiscRows,
    totalMiscCount,
    paginatedMiscRows,
    totalMiscPages,
    miscSortHint,
    loadMiscTable,
    setMiscSort,
  }
}

export function miscMobileSortOptions(t: (key: string) => string): StatisticsMobileSortOption[] {
  return [
    { value: 'champion', label: t('statisticsPage.miscColChampion') },
    { value: 'base_hp', label: `${t('stats.labels.health')} (${t('statisticsPage.miscColBase')})` },
    {
      value: 'growth_hp',
      label: `${t('stats.labels.health')} (${t('statisticsPage.miscColGrowth')})`,
    },
    {
      value: 'base_armor',
      label: `${t('stats.labels.armor')} (${t('statisticsPage.miscColBase')})`,
    },
    {
      value: 'base_attackDamage',
      label: `${t('stats.labels.attackDamage')} (${t('statisticsPage.miscColBase')})`,
    },
    {
      value: 'base_attackSpeed',
      label: `${t('stats.labels.attackSpeed')} (${t('statisticsPage.miscColBase')})`,
    },
    {
      value: 'base_movespeed',
      label: `${t('stats.labels.movementSpeed')} (${t('statisticsPage.miscColBase')})`,
    },
  ]
}

export { CHAMPION_MISC_BASE_STAT_KEYS, CHAMPION_MISC_GROWTH_STAT_KEYS }
