<script setup lang="ts">
import { inject, ref, unref, computed, watch } from 'vue'
import type { StatisticsMobileSortOption } from '~/components/statistics/StatisticsMobileSortBar.vue'
import {
  championTransformLabelKey,
  getChampionTransformPortraitSrc,
  normalizeChampionTransform,
  resolveTransformFromSearchQuery,
  type ChampionTransform,
} from '~/utils/championTransformStats'

const p = inject('statisticsPageCtx') as any
const showChampionDealtBreakdown = ref(false)
const showChampionTakenBreakdown = ref(false)
const expandedChampionIds = ref<Set<number>>(new Set())
const transformViewByChampionId = ref<Map<number, 'all' | ChampionTransform>>(new Map())

type ChampionGlobalRow = {
  championId: number
  championTransform?: ChampionTransform
  blue: { games: number; wins: number; winrate: number; pickrate: number; banrate: number }
  red: { games: number; wins: number; winrate: number; pickrate: number; banrate: number }
  totalGames: number
  avgDamageToChamps: number
  avgDamageToChampsPhys: number
  avgDamageToChampsMagic: number
  avgDamageToChampsTrue: number
  avgDamageTakenPhys: number
  avgDamageTakenMagic: number
  avgDamageTakenTrue: number
  avgDamageTakenTotal: number
  avgKills: number
  avgDeaths: number
  avgAssists: number
}

type TableDisplayEntry = {
  key: string
  row: ChampionGlobalRow
  sub: boolean
  championId: number
  showTransformDropdown: boolean
}

function getTransformView(championId: number): 'all' | ChampionTransform {
  return transformViewByChampionId.value.get(championId) ?? 'all'
}

function setTransformView(championId: number, value: 'all' | ChampionTransform): void {
  const next = new Map(transformViewByChampionId.value)
  if (value === 'all') next.delete(championId)
  else next.set(championId, value)
  transformViewByChampionId.value = next
}

function transformRowsForChampion(championId: number): ChampionGlobalRow[] {
  return p.championGlobalTransformRows(championId) as ChampionGlobalRow[]
}

function rowPortraitSrc(row: ChampionGlobalRow): string | null {
  const defaultSrc =
    p.gameVersion && p.championByKey(row.championId)
      ? p.getChampionImageUrl(p.gameVersion, p.championByKey(row.championId)!.image.full)
      : null
  return getChampionTransformPortraitSrc(
    row.championId,
    normalizeChampionTransform(row.championTransform),
    defaultSrc
  )
}

function rowSideDelta(
  row: ChampionGlobalRow,
  side: 'blue' | 'red',
  stat: 'winrate' | 'pickrate'
): number | undefined {
  return p.championGlobalSideStatDeltaPp(row.championId, side, stat, row.championTransform)
}

function rowNumericDelta(
  row: ChampionGlobalRow,
  key:
    | 'avgDamageToChamps'
    | 'avgDamageToChampsPhys'
    | 'avgDamageToChampsMagic'
    | 'avgDamageToChampsTrue'
    | 'avgDamageTakenTotal'
    | 'avgDamageTakenPhys'
    | 'avgDamageTakenMagic'
    | 'avgDamageTakenTrue'
    | 'avgKills'
    | 'avgDeaths'
    | 'avgAssists'
): number | undefined {
  return p.championGlobalNumericDelta(row.championId, key, row.championTransform)
}

watch(
  () => String(p.championSearchQuery ?? '').trim(),
  query => {
    if (!query || p.statsSplitTransformEnabled) return
    const qualified = resolveTransformFromSearchQuery(141, query)
    if (qualified == null || !p.championHasTransformBreakdown(141)) return
    setTransformView(141, qualified)
  }
)

watch(
  () => Boolean(p.statsSplitTransformEnabled),
  enabled => {
    if (enabled) transformViewByChampionId.value = new Map()
  }
)

const championTableDisplayEntries = computed<TableDisplayEntry[]>(() => {
  const entries: TableDisplayEntry[] = []
  for (const row of p.paginatedChampionGlobalRows as ChampionGlobalRow[]) {
    const showTransformDropdown =
      !p.statsSplitTransformEnabled && p.championHasTransformBreakdown(row.championId)
    entries.push({
      key: p.championGlobalRowKey(row),
      row,
      sub: false,
      championId: row.championId,
      showTransformDropdown,
    })
    const transformView = getTransformView(row.championId)
    if (!p.statsSplitTransformEnabled && transformView !== 'all') {
      for (const subRow of transformRowsForChampion(row.championId)) {
        if (normalizeChampionTransform(subRow.championTransform) !== transformView) continue
        entries.push({
          key: `${p.championGlobalRowKey(subRow)}-sub`,
          row: subRow,
          sub: true,
          championId: row.championId,
          showTransformDropdown: false,
        })
      }
    }
  }
  return entries
})

function onChampionPageSizeChange(event: Event): void {
  const target = event.target as HTMLSelectElement | null
  const fallback = unref(p.championsPageSize)
  p.onChampionGlobalPageSizeUpdated(Number(target?.value ?? fallback))
}

function toggleChampionCardExpanded(championId: number): void {
  const next = new Set(expandedChampionIds.value)
  if (next.has(championId)) next.delete(championId)
  else next.add(championId)
  expandedChampionIds.value = next
}

function combinedWinrate(row: {
  blue: { games: number; winrate: number }
  red: { games: number; winrate: number }
}): number | null {
  const games = row.blue.games + row.red.games
  if (games <= 0) return null
  return (row.blue.winrate * row.blue.games + row.red.winrate * row.red.games) / games
}

function combinedPickrate(row: {
  blue: { games: number; pickrate: number }
  red: { games: number; pickrate: number }
}): number | null {
  const games = row.blue.games + row.red.games
  if (games <= 0) return null
  return (row.blue.pickrate * row.blue.games + row.red.pickrate * row.red.games) / games
}

type ChampionSideRow = {
  championId: number
  blue: { games: number; winrate: number; pickrate: number }
  red: { games: number; winrate: number; pickrate: number }
}

function combinedStatDelta(row: ChampionSideRow, stat: 'winrate' | 'pickrate'): number | undefined {
  if (!p.championGlobalPatchDeltaRefLabel) return undefined
  const transform = (row as ChampionGlobalRow).championTransform
  const blueDelta = p.championGlobalSideStatDeltaPp(row.championId, 'blue', stat, transform)
  const redDelta = p.championGlobalSideStatDeltaPp(row.championId, 'red', stat, transform)
  let weighted = 0
  let weight = 0
  if (row.blue.games > 0 && blueDelta != null) {
    weighted += blueDelta * row.blue.games
    weight += row.blue.games
  }
  if (row.red.games > 0 && redDelta != null) {
    weighted += redDelta * row.red.games
    weight += row.red.games
  }
  if (weight <= 0) return undefined
  return weighted / weight
}

function sideStatDelta(
  row: ChampionSideRow,
  side: 'blue' | 'red',
  stat: 'winrate' | 'pickrate'
): number | undefined {
  if (!p.championGlobalPatchDeltaRefLabel) return undefined
  const sideRow = side === 'blue' ? row.blue : row.red
  if (sideRow.games <= 0) return undefined
  return rowSideDelta(row as ChampionGlobalRow, side, stat)
}

const activeRoleLabel = computed(() => {
  const role = p.statsRoleFilter as string
  if (!role) return p.t('statisticsPage.allRoles')
  const roles = (p.roles as Array<{ value: string; label: string }>) ?? []
  return roles.find(r => r.value === role)?.label ?? role
})

const activeRoleIconSrc = computed(() => {
  const role = p.statsRoleFilter as string
  if (!role) return '/icons/roles/all-role.png'
  return p.mainRoleIconSrc(role) ?? '/icons/roles/all-role.png'
})

const STAT_COL_MIN_PX = 48
const CHAMPION_COL_MIN_PX = 220
const KDA_COL_MIN_PX = 160

/** Colonnes stats (hors champion / KDA) actuellement affichées. */
const visibleStatColumnCount = computed(() => {
  let n = 0
  if (p.showChampionSideColumns) n += 4
  if (p.showChampionDealtColumns) {
    n += 1
    if (showChampionDealtBreakdown.value) n += 3
  }
  if (p.showChampionTakenColumns) {
    n += 1
    if (showChampionTakenBreakdown.value) n += 3
  }
  return n
})

const championTableMinWidthPx = computed(() => {
  const statCols = visibleStatColumnCount.value
  return CHAMPION_COL_MIN_PX + statCols * STAT_COL_MIN_PX + KDA_COL_MIN_PX
})

/** Variables CSS : colonnes restantes s’élargissent quand d’autres sont masquées. */
const championTableLayoutStyle = computed(() => {
  const statCols = visibleStatColumnCount.value
  const statMaxPx = statCols <= 3 ? 112 : statCols <= 6 ? 88 : statCols <= 9 ? 72 : STAT_COL_MIN_PX
  const championFlex = statCols <= 8 ? 1 : 0
  const kdaFlex = statCols <= 6 ? 1 : 0
  return {
    width: '100%',
    minWidth: `${championTableMinWidthPx.value}px`,
    '--cg-stat-min': `${STAT_COL_MIN_PX}px`,
    '--cg-stat-max': `${statMaxPx}px`,
    '--cg-champion-min': `${CHAMPION_COL_MIN_PX}px`,
    '--cg-champion-flex': String(championFlex),
    '--cg-kda-min': `${KDA_COL_MIN_PX}px`,
    '--cg-kda-flex': String(kdaFlex),
  } as Record<string, string>
})

const championMobileSortColumn = computed({
  get: () => String(p.championGlobalSortColumn ?? 'totalGames'),
  set: (v: string) => {
    p.championGlobalSortColumn = v
  },
})

const championMobileSortDir = computed({
  get: () => (p.championGlobalSortDir === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
  set: (v: 'asc' | 'desc') => {
    p.championGlobalSortDir = v
  },
})

const championMobileSortOptions = computed<StatisticsMobileSortOption[]>(() => {
  const t = p.t
  const opts: StatisticsMobileSortOption[] = [
    { value: 'champion', label: t('statisticsPage.champion') },
    { value: 'totalGames', label: t('statisticsPage.games') },
    {
      value: 'blueWinrate',
      label: `${t('statisticsPage.championTableGroupBlue')} · ${t('statisticsPage.winrate')}`,
    },
    {
      value: 'bluePickrate',
      label: `${t('statisticsPage.championTableGroupBlue')} · ${t('statisticsPage.pickrate')}`,
    },
    {
      value: 'redWinrate',
      label: `${t('statisticsPage.championTableGroupRed')} · ${t('statisticsPage.winrate')}`,
    },
    {
      value: 'redPickrate',
      label: `${t('statisticsPage.championTableGroupRed')} · ${t('statisticsPage.pickrate')}`,
    },
    { value: 'dmgTotal', label: t('statisticsPage.championTableColTotalInflicted') },
    { value: 'takenTotal', label: t('statisticsPage.championTableColTotalTaken') },
    { value: 'kills', label: t('statisticsPage.championTableColKill') },
    { value: 'deaths', label: t('statisticsPage.championTableColDeath') },
    { value: 'assists', label: t('statisticsPage.championTableColAssist') },
  ]
  if (p.championGlobalPatchDeltaRefLabel) {
    opts.splice(
      2,
      0,
      {
        value: 'blueWinrateDelta',
        label: `${t('statisticsPage.championTableGroupBlue')} · Δ ${t('statisticsPage.winrate')}`,
      },
      {
        value: 'bluePickrateDelta',
        label: `${t('statisticsPage.championTableGroupBlue')} · Δ ${t('statisticsPage.pickrate')}`,
      },
      {
        value: 'redWinrateDelta',
        label: `${t('statisticsPage.championTableGroupRed')} · Δ ${t('statisticsPage.winrate')}`,
      },
      {
        value: 'redPickrateDelta',
        label: `${t('statisticsPage.championTableGroupRed')} · Δ ${t('statisticsPage.pickrate')}`,
      },
      { value: 'dmgTotalDelta', label: `Δ ${t('statisticsPage.championTableColTotalInflicted')}` },
      { value: 'takenTotalDelta', label: `Δ ${t('statisticsPage.championTableColTotalTaken')}` },
      { value: 'killsDelta', label: `Δ ${t('statisticsPage.championTableColKill')}` },
      { value: 'deathsDelta', label: `Δ ${t('statisticsPage.championTableColDeath')}` },
      { value: 'assistsDelta', label: `Δ ${t('statisticsPage.championTableColAssist')}` }
    )
  }
  return opts
})
</script>

<template>
  <div class="space-y-4">
    <div v-if="p.championGlobalTablePending" class="text-text/70">
      {{ p.t('statisticsPage.loading') }}
    </div>
    <div
      v-else-if="p.championGlobalTableError"
      class="rounded border border-error bg-surface p-3 text-error"
    >
      {{ p.championGlobalTableError }}
    </div>
    <div
      v-else-if="p.championGlobalSortedRows.length === 0"
      class="statistics-overview-surface rounded-lg border border-primary/30 p-4 text-text/70"
    >
      {{ p.t('statisticsPage.championTableNoData') }}
    </div>
    <template v-else>
      <StatisticsMobileSortBar
        id="champion-global-mobile-sort"
        v-model:column="championMobileSortColumn"
        v-model:direction="championMobileSortDir"
        :options="championMobileSortOptions"
        :asc-default-columns="['champion']"
        :help-aria-label="p.t('statisticsPage.tooltipTableChampionAria')"
        :help-text="p.t('statisticsPage.tooltipTableChampion')"
        :help-secondary-text="p.t('statisticsPage.championTableDeltaColumnsHint')"
      />
      <!-- Mobile : cards -->
      <div class="statistics-champion-mobile-list space-y-2 md:hidden">
        <article
          v-for="row in p.paginatedChampionGlobalRows"
          :key="'mobile-' + p.championGlobalRowKey(row)"
          class="statistics-champion-stats-mobile-card statistics-champion-mobile-card w-full overflow-hidden rounded-lg border border-primary/30 bg-surface/40"
        >
          <div
            class="statistics-champion-stats-mobile-card-header flex w-full items-center gap-3 p-3"
          >
            <StatisticsChampionStatsMobileCardHeader
              :champion-id="row.championId"
              :champion-name="
                p.statsSplitTransformEnabled && row.championTransform != null
                  ? `${p.championName(row.championId) || row.championId} · ${p.t(championTransformLabelKey(normalizeChampionTransform(row.championTransform)))}`
                  : String(p.championName(row.championId) || row.championId)
              "
              :search-query="p.championSearchQuery"
              :role-label="activeRoleLabel"
              :role-icon-src="activeRoleIconSrc"
              :portrait-src="rowPortraitSrc(row)"
              :portrait-alt="p.championName(row.championId) || ''"
            />
            <button
              type="button"
              class="flex min-w-0 flex-1 justify-end gap-3 text-right"
              @click="toggleChampionCardExpanded(row.championId)"
            >
              <div>
                <div class="text-[10px] font-medium uppercase tracking-wide text-text/55">
                  {{ p.t('statisticsPage.winrate') }}
                </div>
                <div
                  class="text-2xl font-bold tabular-nums leading-none sm:text-3xl"
                  :class="
                    combinedWinrate(row) != null
                      ? p.tierListWinrateClass(combinedWinrate(row)!)
                      : 'text-text/55'
                  "
                >
                  {{ combinedWinrate(row) != null ? combinedWinrate(row)!.toFixed(2) : '—' }}
                </div>
                <div
                  v-if="combinedStatDelta(row, 'winrate') != null"
                  class="mt-0.5 text-xs tabular-nums leading-none"
                  :class="p.tierListPatchDeltaClass(combinedStatDelta(row, 'winrate')!)"
                >
                  {{ p.formatTierListPatchDeltaPp(combinedStatDelta(row, 'winrate')!) }}
                </div>
              </div>
              <div>
                <div class="text-[10px] font-medium uppercase tracking-wide text-text/55">
                  {{ p.t('statisticsPage.pickrate') }}
                </div>
                <div
                  class="text-2xl font-bold tabular-nums leading-none sm:text-3xl"
                  :class="
                    combinedPickrate(row) != null
                      ? p.championGlobalPickrateClass(combinedPickrate(row)!)
                      : 'text-text/55'
                  "
                >
                  {{ combinedPickrate(row) != null ? combinedPickrate(row)!.toFixed(2) : '—' }}
                </div>
                <div
                  v-if="combinedStatDelta(row, 'pickrate') != null"
                  class="mt-0.5 text-xs tabular-nums leading-none"
                  :class="p.tierListPatchDeltaClass(combinedStatDelta(row, 'pickrate')!)"
                >
                  {{ p.formatTierListPatchDeltaPp(combinedStatDelta(row, 'pickrate')!) }}
                </div>
              </div>
            </button>
          </div>
          <div
            v-if="!p.statsSplitTransformEnabled && p.championHasTransformBreakdown(row.championId)"
            class="border-t border-primary/20 bg-black/10 px-3 py-2"
          >
            <StatisticsChampionTransformSelect
              :champion-id="row.championId"
              :transform-rows="transformRowsForChampion(row.championId)"
              :model-value="getTransformView(row.championId)"
              @update:model-value="setTransformView(row.championId, $event)"
            />
          </div>
          <div
            v-if="!p.statsSplitTransformEnabled && getTransformView(row.championId) !== 'all'"
            class="space-y-2 border-t border-primary/20 bg-black/15 px-3 py-2"
          >
            <article
              v-for="subRow in transformRowsForChampion(row.championId).filter(
                sr =>
                  normalizeChampionTransform(sr.championTransform) ===
                  getTransformView(row.championId)
              )"
              :key="'mobile-sub-' + p.championGlobalRowKey(subRow)"
              class="rounded border border-primary/20 bg-black/20 p-2 text-sm"
            >
              <div class="mb-2 flex items-center gap-2">
                <img
                  v-if="rowPortraitSrc(subRow)"
                  :src="rowPortraitSrc(subRow)!"
                  alt=""
                  class="h-8 w-8 border border-black object-cover"
                  width="32"
                  height="32"
                />
                <span class="text-xs font-semibold text-text/90">
                  {{
                    p.t(
                      championTransformLabelKey(
                        normalizeChampionTransform(subRow.championTransform)
                      )
                    )
                  }}
                </span>
              </div>
              <div class="grid grid-cols-2 gap-2 text-xs tabular-nums">
                <div>
                  WR
                  {{ combinedWinrate(subRow) != null ? combinedWinrate(subRow)!.toFixed(2) : '—' }}
                </div>
                <div>
                  PR
                  {{
                    combinedPickrate(subRow) != null ? combinedPickrate(subRow)!.toFixed(2) : '—'
                  }}
                </div>
                <div class="col-span-2 font-mono text-text/85">
                  K {{ p.formatChampionGlobalNum(subRow.avgKills) }} / D
                  {{ p.formatChampionGlobalNum(subRow.avgDeaths) }} / A
                  {{ p.formatChampionGlobalNum(subRow.avgAssists) }}
                </div>
              </div>
            </article>
          </div>
          <div
            v-if="expandedChampionIds.has(row.championId)"
            class="border-t border-primary/20 bg-black/20 px-3 py-2 text-sm"
          >
            <div class="font-mono text-text/90">
              <div>
                K {{ p.formatChampionGlobalNum(row.avgKills) }} / D
                {{ p.formatChampionGlobalNum(row.avgDeaths) }} / A
                {{ p.formatChampionGlobalNum(row.avgAssists) }}
              </div>
              <div
                v-if="
                  p.championGlobalPatchDeltaRefLabel &&
                  (rowNumericDelta(row, 'avgKills') != null ||
                    rowNumericDelta(row, 'avgDeaths') != null ||
                    rowNumericDelta(row, 'avgAssists') != null)
                "
                class="mt-1 text-[11px] leading-none text-text/75"
              >
                <template v-if="rowNumericDelta(row, 'avgKills') != null">
                  <span
                    :class="p.championGlobalNumericDeltaClass(rowNumericDelta(row, 'avgKills')!)"
                    >K
                    {{
                      p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgKills')!)
                    }}</span
                  >
                </template>
                <template
                  v-if="
                    rowNumericDelta(row, 'avgKills') != null &&
                    rowNumericDelta(row, 'avgDeaths') != null
                  "
                >
                  <span class="px-1 text-text/45">|</span>
                </template>
                <template v-if="rowNumericDelta(row, 'avgDeaths') != null">
                  <span
                    :class="
                      p.championGlobalNumericDeltaClass(rowNumericDelta(row, 'avgDeaths')!, true)
                    "
                    >D
                    {{
                      p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgDeaths')!)
                    }}</span
                  >
                </template>
                <template
                  v-if="
                    (rowNumericDelta(row, 'avgKills') != null ||
                      rowNumericDelta(row, 'avgDeaths') != null) &&
                    rowNumericDelta(row, 'avgAssists') != null
                  "
                >
                  <span class="px-1 text-text/45">|</span>
                </template>
                <template v-if="rowNumericDelta(row, 'avgAssists') != null">
                  <span
                    :class="p.championGlobalNumericDeltaClass(rowNumericDelta(row, 'avgAssists')!)"
                    >A
                    {{
                      p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgAssists')!)
                    }}</span
                  >
                </template>
              </div>
            </div>
            <div v-if="p.showChampionSideColumns" class="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span class="text-sky-300">{{
                  p.t('statisticsPage.championTableTooltipBlue')
                }}</span>
                <div class="tabular-nums">
                  WR {{ row.blue.games ? row.blue.winrate.toFixed(2) : '—' }}
                  <span
                    v-if="sideStatDelta(row, 'blue', 'winrate') != null"
                    class="ml-0.5"
                    :class="p.tierListPatchDeltaClass(sideStatDelta(row, 'blue', 'winrate')!)"
                  >
                    {{ p.formatTierListPatchDeltaPp(sideStatDelta(row, 'blue', 'winrate')!) }}
                  </span>
                </div>
                <div class="tabular-nums">
                  PR {{ row.blue.games ? row.blue.pickrate.toFixed(2) : '—' }}
                  <span
                    v-if="sideStatDelta(row, 'blue', 'pickrate') != null"
                    class="ml-0.5"
                    :class="p.tierListPatchDeltaClass(sideStatDelta(row, 'blue', 'pickrate')!)"
                  >
                    {{ p.formatTierListPatchDeltaPp(sideStatDelta(row, 'blue', 'pickrate')!) }}
                  </span>
                </div>
              </div>
              <div>
                <span class="text-red-300">{{
                  p.t('statisticsPage.championTableTooltipRed')
                }}</span>
                <div class="tabular-nums">
                  WR {{ row.red.games ? row.red.winrate.toFixed(2) : '—' }}
                  <span
                    v-if="sideStatDelta(row, 'red', 'winrate') != null"
                    class="ml-0.5"
                    :class="p.tierListPatchDeltaClass(sideStatDelta(row, 'red', 'winrate')!)"
                  >
                    {{ p.formatTierListPatchDeltaPp(sideStatDelta(row, 'red', 'winrate')!) }}
                  </span>
                </div>
                <div class="tabular-nums">
                  PR {{ row.red.games ? row.red.pickrate.toFixed(2) : '—' }}
                  <span
                    v-if="sideStatDelta(row, 'red', 'pickrate') != null"
                    class="ml-0.5"
                    :class="p.tierListPatchDeltaClass(sideStatDelta(row, 'red', 'pickrate')!)"
                  >
                    {{ p.formatTierListPatchDeltaPp(sideStatDelta(row, 'red', 'pickrate')!) }}
                  </span>
                </div>
              </div>
            </div>
            <div
              v-if="p.showChampionDealtColumns || p.showChampionTakenColumns"
              class="mt-2 space-y-1 text-xs text-text/80"
            >
              <div v-if="p.showChampionDealtColumns" class="tabular-nums">
                {{ p.t('statisticsPage.championTableColTotalInflicted') }}:
                {{ p.formatChampionGlobalNum(row.avgDamageToChamps) }}
                <span
                  v-if="rowNumericDelta(row, 'avgDamageToChamps') != null"
                  class="ml-1"
                  :class="
                    p.championGlobalNumericDeltaClass(rowNumericDelta(row, 'avgDamageToChamps')!)
                  "
                >
                  {{
                    p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgDamageToChamps')!)
                  }}
                </span>
              </div>
              <div v-if="p.showChampionTakenColumns" class="tabular-nums">
                {{ p.t('statisticsPage.championTableColTotalTaken') }}:
                {{ p.formatChampionGlobalNum(row.avgDamageTakenTotal) }}
                <span
                  v-if="rowNumericDelta(row, 'avgDamageTakenTotal') != null"
                  class="ml-1"
                  :class="
                    p.championGlobalNumericDeltaClass(rowNumericDelta(row, 'avgDamageTakenTotal')!)
                  "
                >
                  {{
                    p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgDamageTakenTotal')!)
                  }}
                </span>
              </div>
            </div>
          </div>
        </article>
        <div
          v-if="p.totalChampionGlobalCount > 0"
          class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 px-3 py-2 text-sm text-text/80"
        >
          <span>{{ p.t('statisticsPage.showing') }} {{ p.totalChampionGlobalCount }}</span>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded border border-primary/40 bg-surface/50 px-2 py-1 disabled:opacity-50"
              :disabled="p.championGlobalPage <= 1"
              @click="p.onChampionGlobalPageUpdated(Math.max(1, p.championGlobalPage - 1))"
            >
              ‹
            </button>
            <span class="text-xs tabular-nums">
              {{ (p.championGlobalPage - 1) * p.championsPageSize + 1 }}-{{
                Math.min(p.championGlobalPage * p.championsPageSize, p.totalChampionGlobalCount)
              }}
            </span>
            <button
              type="button"
              class="rounded border border-primary/40 bg-surface/50 px-2 py-1 disabled:opacity-50"
              :disabled="p.championGlobalPage >= p.totalChampionGlobalPages"
              @click="
                p.onChampionGlobalPageUpdated(
                  Math.min(p.totalChampionGlobalPages, p.championGlobalPage + 1)
                )
              "
            >
              ›
            </button>
          </div>
        </div>
      </div>

      <!-- Desktop : tableau -->
      <div
        class="tier-list-mobile-rotate statistics-overview-surface hidden w-full overflow-x-auto rounded-lg border border-primary/30 md:block"
      >
        <div
          class="tier-list-lolalytics champion-global-table w-full min-w-0 text-[13px] text-text-primary/90"
          :style="championTableLayoutStyle"
        >
          <div
            class="tier-list-lolalytics-head sticky top-0 z-10 flex h-auto min-h-8 w-full items-stretch justify-start border-b border-black bg-[var(--color-grey-300)] text-text-primary/85"
          >
            <div
              class="champion-global-champ-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex items-center justify-start border-b border-black px-2 max-lg:w-[56px] max-lg:flex-none max-lg:shrink-0 max-lg:justify-center max-lg:px-0.5"
              :title="p.t('statisticsPage.championTableTooltipChampion')"
            >
              <span class="max-lg:hidden">{{ p.t('statisticsPage.tierListColChampion') }}</span>
            </div>
            <!-- Bleu : couleur uniquement sur le texte des titres -->
            <div
              v-show="p.showChampionSideColumns"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[11px] font-medium leading-tight text-sky-300 hover:bg-primary/25"
                :title="
                  p.t('statisticsPage.championTableTooltipBlue') +
                  ' — ' +
                  p.t('statisticsPage.tierListWinrateTooltip')
                "
                @click="p.setChampionGlobalSort('blueWinrate')"
              >
                {{ p.t('statisticsPage.winrate') }}{{ p.championGlobalSortIcon('blueWinrate') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('blueWinrateDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('blueWinrateDelta') }}
              </button>
            </div>
            <div
              v-show="p.showChampionSideColumns"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[11px] font-medium leading-tight text-sky-300 hover:bg-primary/25"
                :title="
                  p.t('statisticsPage.championTableTooltipBlue') +
                  ' — ' +
                  p.t('statisticsPage.tierListPickrateTooltip')
                "
                @click="p.setChampionGlobalSort('bluePickrate')"
              >
                {{ p.t('statisticsPage.pickrate') }}{{ p.championGlobalSortIcon('bluePickrate') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('bluePickrateDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('bluePickrateDelta') }}
              </button>
            </div>
            <!-- Rouge -->
            <div
              v-show="p.showChampionSideColumns"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[11px] font-medium leading-tight text-red-300 hover:bg-primary/25"
                :title="
                  p.t('statisticsPage.championTableTooltipRed') +
                  ' — ' +
                  p.t('statisticsPage.tierListWinrateTooltip')
                "
                @click="p.setChampionGlobalSort('redWinrate')"
              >
                {{ p.t('statisticsPage.winrate') }}{{ p.championGlobalSortIcon('redWinrate') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('redWinrateDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('redWinrateDelta') }}
              </button>
            </div>
            <div
              v-show="p.showChampionSideColumns"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[11px] font-medium leading-tight text-red-300 hover:bg-primary/25"
                :title="
                  p.t('statisticsPage.championTableTooltipRed') +
                  ' — ' +
                  p.t('statisticsPage.tierListPickrateTooltip')
                "
                @click="p.setChampionGlobalSort('redPickrate')"
              >
                {{ p.t('statisticsPage.pickrate') }}{{ p.championGlobalSortIcon('redPickrate') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('redPickrateDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('redPickrateDelta') }}
              </button>
            </div>
            <!-- Dégâts infligés -->
            <div
              v-show="p.showChampionDealtColumns"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
                :title="p.t('statisticsPage.championTableTooltipDealt')"
                @click="p.setChampionGlobalSort('dmgTotal')"
              >
                {{ p.t('statisticsPage.championTableColTotalInflicted')
                }}{{ p.championGlobalSortIcon('dmgTotal') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('dmgTotalDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('dmgTotalDelta') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[10px] leading-tight text-text/80 hover:bg-primary/20"
                :title="showChampionDealtBreakdown ? 'Masquer le détail' : 'Afficher le détail'"
                @click="showChampionDealtBreakdown = !showChampionDealtBreakdown"
              >
                {{ showChampionDealtBreakdown ? '▴' : '▾' }}
              </button>
            </div>
            <div
              v-show="p.showChampionDealtColumns && showChampionDealtBreakdown"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-amber-300 hover:bg-primary/25"
                :title="p.t('statisticsPage.championTableDealtPhys')"
                @click="p.setChampionGlobalSort('dmgPhys')"
              >
                {{ p.t('statisticsPage.championTableColPhys')
                }}{{ p.championGlobalSortIcon('dmgPhys') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('dmgPhysDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('dmgPhysDelta') }}
              </button>
            </div>
            <div
              v-show="p.showChampionDealtColumns && showChampionDealtBreakdown"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-violet-300 hover:bg-primary/25"
                :title="p.t('statisticsPage.championTableDealtMagic')"
                @click="p.setChampionGlobalSort('dmgMagic')"
              >
                {{ p.t('statisticsPage.championTableColMagic')
                }}{{ p.championGlobalSortIcon('dmgMagic') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('dmgMagicDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('dmgMagicDelta') }}
              </button>
            </div>
            <div
              v-show="p.showChampionDealtColumns && showChampionDealtBreakdown"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-slate-200 hover:bg-primary/25"
                :title="p.t('statisticsPage.championTableDealtTrue')"
                @click="p.setChampionGlobalSort('dmgTrue')"
              >
                {{ p.t('statisticsPage.championTableColBrut')
                }}{{ p.championGlobalSortIcon('dmgTrue') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('dmgTrueDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('dmgTrueDelta') }}
              </button>
            </div>
            <!-- Dégâts subis -->
            <div
              v-show="p.showChampionTakenColumns"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
                :title="p.t('statisticsPage.championTableTooltipTaken')"
                @click="p.setChampionGlobalSort('takenTotal')"
              >
                {{ p.t('statisticsPage.championTableColTotalTaken')
                }}{{ p.championGlobalSortIcon('takenTotal') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('takenTotalDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('takenTotalDelta') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[10px] leading-tight text-text/80 hover:bg-primary/20"
                :title="showChampionTakenBreakdown ? 'Masquer le détail' : 'Afficher le détail'"
                @click="showChampionTakenBreakdown = !showChampionTakenBreakdown"
              >
                {{ showChampionTakenBreakdown ? '▴' : '▾' }}
              </button>
            </div>
            <div
              v-show="p.showChampionTakenColumns && showChampionTakenBreakdown"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-amber-300 hover:bg-primary/25"
                :title="p.t('statisticsPage.championTableTakenPhys')"
                @click="p.setChampionGlobalSort('takenPhys')"
              >
                {{ p.t('statisticsPage.championTableColPhys')
                }}{{ p.championGlobalSortIcon('takenPhys') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('takenPhysDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('takenPhysDelta') }}
              </button>
            </div>
            <div
              v-show="p.showChampionTakenColumns && showChampionTakenBreakdown"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-violet-300 hover:bg-primary/25"
                :title="p.t('statisticsPage.championTableTakenMagic')"
                @click="p.setChampionGlobalSort('takenMagic')"
              >
                {{ p.t('statisticsPage.championTableColMagic')
                }}{{ p.championGlobalSortIcon('takenMagic') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('takenMagicDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('takenMagicDelta') }}
              </button>
            </div>
            <div
              v-show="p.showChampionTakenColumns && showChampionTakenBreakdown"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-slate-200 hover:bg-primary/25"
                :title="p.t('statisticsPage.championTableTakenTrue')"
                @click="p.setChampionGlobalSort('takenTrue')"
              >
                {{ p.t('statisticsPage.championTableColBrut')
                }}{{ p.championGlobalSortIcon('takenTrue') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('takenTrueDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('takenTrueDelta') }}
              </button>
            </div>
            <!-- KDA compact -->
            <div
              class="champion-global-kda-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-col items-stretch justify-center border-b border-black px-1 py-1"
            >
              <div class="text-center text-[10px] font-semibold leading-tight text-text/90">
                K / D / A
              </div>
              <div class="mt-0.5 flex items-center justify-center gap-1 text-[9px] leading-tight">
                <button
                  type="button"
                  class="rounded px-1 hover:bg-primary/20"
                  :title="p.t('statisticsPage.championTableColKill')"
                  @click="p.setChampionGlobalSort('kills')"
                >
                  K{{ p.championGlobalSortIcon('kills') }}
                </button>
                <button
                  type="button"
                  class="rounded px-1 hover:bg-primary/20"
                  :title="p.t('statisticsPage.championTableColDeath')"
                  @click="p.setChampionGlobalSort('deaths')"
                >
                  D{{ p.championGlobalSortIcon('deaths') }}
                </button>
                <button
                  type="button"
                  class="rounded px-1 hover:bg-primary/20"
                  :title="p.t('statisticsPage.championTableColAssist')"
                  @click="p.setChampionGlobalSort('assists')"
                >
                  A{{ p.championGlobalSortIcon('assists') }}
                </button>
              </div>
            </div>
          </div>

          <div
            v-for="entry in championTableDisplayEntries"
            :key="entry.key"
            class="tier-list-lolalytics-row flex min-h-[60px] w-full flex-nowrap items-center justify-start py-0.5 text-text-primary/90 odd:bg-white/[0.04] even:bg-black/25 hover:brightness-110"
            :class="entry.sub ? 'bg-black/35' : ''"
          >
            <StatisticsTierListChampionCell
              :champion-id="entry.row.championId"
              :highlight-query="p.championSearchQuery"
              width-class="champion-global-champ-col max-lg:w-[56px]"
              allow-grow
              :portrait-src-override="rowPortraitSrc(entry.row)"
              :champion-transform="
                p.statsSplitTransformEnabled || entry.sub
                  ? normalizeChampionTransform(entry.row.championTransform)
                  : undefined
              "
              :show-transform-dropdown="entry.showTransformDropdown"
              :transform-rows="transformRowsForChampion(entry.championId)"
              :transform-view="getTransformView(entry.championId)"
              :is-transform-sub-row="entry.sub"
              @update:transform-view="setTransformView(entry.championId, $event)"
            />
            <template v-for="row in [entry.row]" :key="p.championGlobalRowKey(row) + '-stats'">
              <div
                v-show="p.showChampionSideColumns"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 text-center leading-tight"
              >
                <span
                  :class="
                    row.blue.games ? p.tierListWinrateClass(row.blue.winrate) : 'text-text/55'
                  "
                  >{{ row.blue.games ? row.blue.winrate.toFixed(2) : '—' }}</span
                >
                <span
                  v-if="
                    row.blue.games &&
                    p.championGlobalPatchDeltaRefLabel &&
                    rowSideDelta(row, 'blue', 'winrate') != null
                  "
                  class="text-[10px] leading-none"
                  :class="p.tierListPatchDeltaClass(rowSideDelta(row, 'blue', 'winrate')!)"
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel ?? 'ref',
                    })
                  "
                  >{{ p.formatTierListPatchDeltaPp(rowSideDelta(row, 'blue', 'winrate')!) }}</span
                >
              </div>
              <div
                v-show="p.showChampionSideColumns"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 text-center leading-tight"
              >
                <span
                  :class="
                    row.blue.games
                      ? p.championGlobalPickrateClass(row.blue.pickrate)
                      : 'text-text/55'
                  "
                  >{{ row.blue.games ? row.blue.pickrate.toFixed(2) : '—' }}</span
                >
                <span
                  v-if="
                    row.blue.games &&
                    p.championGlobalPatchDeltaRefLabel &&
                    rowSideDelta(row, 'blue', 'pickrate') != null
                  "
                  class="text-[10px] leading-none"
                  :class="p.tierListPatchDeltaClass(rowSideDelta(row, 'blue', 'pickrate')!)"
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel ?? 'ref',
                    })
                  "
                  >{{ p.formatTierListPatchDeltaPp(rowSideDelta(row, 'blue', 'pickrate')!) }}</span
                >
              </div>
              <div
                v-show="p.showChampionSideColumns"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 text-center leading-tight"
              >
                <span
                  :class="row.red.games ? p.tierListWinrateClass(row.red.winrate) : 'text-text/55'"
                  >{{ row.red.games ? row.red.winrate.toFixed(2) : '—' }}</span
                >
                <span
                  v-if="
                    row.red.games &&
                    p.championGlobalPatchDeltaRefLabel &&
                    rowSideDelta(row, 'red', 'winrate') != null
                  "
                  class="text-[10px] leading-none"
                  :class="p.tierListPatchDeltaClass(rowSideDelta(row, 'red', 'winrate')!)"
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel ?? 'ref',
                    })
                  "
                  >{{ p.formatTierListPatchDeltaPp(rowSideDelta(row, 'red', 'winrate')!) }}</span
                >
              </div>
              <div
                v-show="p.showChampionSideColumns"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 text-center leading-tight"
              >
                <span
                  :class="
                    row.red.games ? p.championGlobalPickrateClass(row.red.pickrate) : 'text-text/55'
                  "
                  >{{ row.red.games ? row.red.pickrate.toFixed(2) : '—' }}</span
                >
                <span
                  v-if="
                    row.red.games &&
                    p.championGlobalPatchDeltaRefLabel &&
                    rowSideDelta(row, 'red', 'pickrate') != null
                  "
                  class="text-[10px] leading-none"
                  :class="p.tierListPatchDeltaClass(rowSideDelta(row, 'red', 'pickrate')!)"
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel ?? 'ref',
                    })
                  "
                  >{{ p.formatTierListPatchDeltaPp(rowSideDelta(row, 'red', 'pickrate')!) }}</span
                >
              </div>
              <div
                v-show="p.showChampionDealtColumns"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
              >
                <span class="font-medium">{{
                  p.formatChampionGlobalNum(row.avgDamageToChamps)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgDamageToChamps') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(rowNumericDelta(row, 'avgDamageToChamps')!)
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgDamageToChamps')!)
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionDealtColumns && showChampionDealtBreakdown"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
              >
                <span class="font-medium text-amber-300">{{
                  p.formatChampionGlobalNum(row.avgDamageToChampsPhys)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgDamageToChampsPhys') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(
                      rowNumericDelta(row, 'avgDamageToChampsPhys')!
                    )
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(
                      rowNumericDelta(row, 'avgDamageToChampsPhys')!
                    )
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionDealtColumns && showChampionDealtBreakdown"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
              >
                <span class="font-medium text-violet-300">{{
                  p.formatChampionGlobalNum(row.avgDamageToChampsMagic)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgDamageToChampsMagic') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(
                      rowNumericDelta(row, 'avgDamageToChampsMagic')!
                    )
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(
                      rowNumericDelta(row, 'avgDamageToChampsMagic')!
                    )
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionDealtColumns && showChampionDealtBreakdown"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
              >
                <span class="font-medium text-slate-200">{{
                  p.formatChampionGlobalNum(row.avgDamageToChampsTrue)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgDamageToChampsTrue') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(
                      rowNumericDelta(row, 'avgDamageToChampsTrue')!
                    )
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(
                      rowNumericDelta(row, 'avgDamageToChampsTrue')!
                    )
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionTakenColumns"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
              >
                <span class="font-medium">{{
                  p.formatChampionGlobalNum(row.avgDamageTakenTotal)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgDamageTakenTotal') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(
                      rowNumericDelta(row, 'avgDamageTakenTotal')!,
                      true
                    )
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgDamageTakenTotal')!)
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionTakenColumns && showChampionTakenBreakdown"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
              >
                <span class="font-medium text-amber-300">{{
                  p.formatChampionGlobalNum(row.avgDamageTakenPhys)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgDamageTakenPhys') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(
                      rowNumericDelta(row, 'avgDamageTakenPhys')!,
                      true
                    )
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgDamageTakenPhys')!)
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionTakenColumns && showChampionTakenBreakdown"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
              >
                <span class="font-medium text-violet-300">{{
                  p.formatChampionGlobalNum(row.avgDamageTakenMagic)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgDamageTakenMagic') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(
                      rowNumericDelta(row, 'avgDamageTakenMagic')!,
                      true
                    )
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgDamageTakenMagic')!)
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionTakenColumns && showChampionTakenBreakdown"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
              >
                <span class="font-medium text-slate-200">{{
                  p.formatChampionGlobalNum(row.avgDamageTakenTrue)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgDamageTakenTrue') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(
                      rowNumericDelta(row, 'avgDamageTakenTrue')!,
                      true
                    )
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgDamageTakenTrue')!)
                  }}</span
                >
              </div>
              <div
                class="champion-global-kda-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0.5 font-mono text-[13px] leading-tight"
              >
                <span class="font-semibold">
                  {{ p.formatChampionGlobalNum(row.avgKills) }} /
                  {{ p.formatChampionGlobalNum(row.avgDeaths) }} /
                  {{ p.formatChampionGlobalNum(row.avgAssists) }}
                </span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    (rowNumericDelta(row, 'avgKills') != null ||
                      rowNumericDelta(row, 'avgDeaths') != null ||
                      rowNumericDelta(row, 'avgAssists') != null)
                  "
                  class="text-[10px] leading-none text-text/75"
                >
                  <template v-if="rowNumericDelta(row, 'avgKills') != null">
                    <span
                      :class="p.championGlobalNumericDeltaClass(rowNumericDelta(row, 'avgKills')!)"
                      >K
                      {{
                        p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgKills')!)
                      }}</span
                    >
                  </template>
                  <template
                    v-if="
                      rowNumericDelta(row, 'avgKills') != null &&
                      rowNumericDelta(row, 'avgDeaths') != null
                    "
                  >
                    <span class="px-1 text-text/45">|</span>
                  </template>
                  <template v-if="rowNumericDelta(row, 'avgDeaths') != null">
                    <span
                      :class="
                        p.championGlobalNumericDeltaClass(rowNumericDelta(row, 'avgDeaths')!, true)
                      "
                      >D
                      {{
                        p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgDeaths')!)
                      }}</span
                    >
                  </template>
                  <template
                    v-if="
                      (rowNumericDelta(row, 'avgKills') != null ||
                        rowNumericDelta(row, 'avgDeaths') != null) &&
                      rowNumericDelta(row, 'avgAssists') != null
                    "
                  >
                    <span class="px-1 text-text/45">|</span>
                  </template>
                  <template v-if="rowNumericDelta(row, 'avgAssists') != null">
                    <span
                      :class="
                        p.championGlobalNumericDeltaClass(rowNumericDelta(row, 'avgAssists')!)
                      "
                      >A
                      {{
                        p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgAssists')!)
                      }}</span
                    >
                  </template>
                </span>
              </div>
            </template>
          </div>
          <div
            v-if="p.totalChampionGlobalCount > 0"
            class="border-p.t flex flex-wrap items-center justify-between gap-2 border-primary/20 px-4 py-2 text-sm text-text/80"
          >
            <span>{{ p.t('statisticsPage.showing') }} {{ p.totalChampionGlobalCount }}</span>
            <div class="flex items-center gap-3">
              <label class="flex items-center gap-1.5">
                <span class="text-text/70">{{ p.t('statisticsPage.perPage') }}</span>
                <select
                  :value="p.championsPageSize"
                  class="rounded border border-primary/40 bg-background px-2 py-1 text-text"
                  @change="onChampionPageSizeChange"
                >
                  <option v-for="n in p.PAGE_SIZE_OPTIONS" :key="n" :value="n">{{ n }}</option>
                </select>
              </label>
              <span class="text-text/70">
                {{ (p.championGlobalPage - 1) * p.championsPageSize + 1 }}-{{
                  Math.min(p.championGlobalPage * p.championsPageSize, p.totalChampionGlobalCount)
                }}
                / {{ p.totalChampionGlobalCount }}
              </span>
              <div class="flex gap-1">
                <button
                  type="button"
                  class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                  :disabled="p.championGlobalPage <= 1"
                  @click="p.onChampionGlobalPageUpdated(Math.max(1, p.championGlobalPage - 1))"
                >
                  ‹
                </button>
                <button
                  type="button"
                  class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                  :disabled="p.championGlobalPage >= p.totalChampionGlobalPages"
                  @click="
                    p.onChampionGlobalPageUpdated(
                      Math.min(p.totalChampionGlobalPages, p.championGlobalPage + 1)
                    )
                  "
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.champion-global-table :deep(.champion-global-stat-col) {
  flex: 1 1 var(--cg-stat-min, 3rem);
  min-width: var(--cg-stat-min, 3rem);
  max-width: var(--cg-stat-max, 3rem);
  width: auto;
}

.champion-global-table :deep(.champion-global-champ-col) {
  flex: var(--cg-champion-flex, 0) 1 var(--cg-champion-min, 220px);
  min-width: var(--cg-champion-min, 220px);
  width: auto;
}

.champion-global-table :deep(.champion-global-kda-col) {
  flex: var(--cg-kda-flex, 0) 1 var(--cg-kda-min, 10rem);
  min-width: var(--cg-kda-min, 10rem);
  width: auto;
}
</style>
