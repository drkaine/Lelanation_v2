<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { isOneOf } from '~/utils/statistics/isOneOf'
import {
  CHAMPION_COLUMN_MODES,
  championColumnFlags,
  championColumnMode,
  type ChampionColumnMode,
} from '~/utils/statistics/championColumnGroups'
import { CHAMPION_GLOBAL_SORT_COLUMNS } from '~/utils/statistics/statisticsTableFormat'
import {
  injectStatisticsPageCtx,
  type StatisticsIndexPageCtx,
} from '~/composables/statistics/statisticsPageCtx'
import type { StatisticsMobileSortOption } from '~/components/statistics/StatisticsMobileSortBar.vue'
import {
  getChampionTransformPortraitSrc,
  normalizeChampionTransform,
  resolveTransformFromSearchQuery,
  type ChampionTransform,
} from '~/utils/championTransformStats'
import {
  CHAMPION_MOBILE_METRICS,
  championMobileBarPct,
  championMobileMetric,
  championMobileSubs,
} from '~/utils/statistics/championMobileCards'

const p = injectStatisticsPageCtx<StatisticsIndexPageCtx>()

const columnModeLabelKeys: Record<ChampionColumnMode, string> = {
  all: 'statisticsPage.championColumnsAll',
  heal: 'statisticsPage.championTableGroupHeal',
  dealt: 'statisticsPage.championTableGroupDealt',
  taken: 'statisticsPage.championTableGroupTaken',
}

const columnMode = computed(() =>
  championColumnMode({
    heal: Boolean(p.showChampionHealColumns),
    dealt: Boolean(p.showChampionDealtColumns),
    taken: Boolean(p.showChampionTakenColumns),
  })
)

function setColumnMode(mode: ChampionColumnMode): void {
  const flags = championColumnFlags(mode)
  p.showChampionHealColumns = flags.heal
  p.showChampionDealtColumns = flags.dealt
  p.showChampionTakenColumns = flags.taken
}
const showChampionDealtBreakdown = ref(false)
const showChampionTakenBreakdown = ref(false)
const showChampionHealBreakdown = ref(false)
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
  avgTotalHeal: number
  avgHealsOnTeammates: number
  avgEffectiveHealShield: number
  avgDamageShieldedOnTeammates: number
  avgDamageSelfMitigated: number
  avgTimeCcDealt: number
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
  return p.championGlobalTransformRows(championId)
}

function kdaDeltaTitle(row: ChampionGlobalRow): string | undefined {
  if (!p.championGlobalPatchDeltaRefLabel) return undefined
  const parts = (['avgKills', 'avgDeaths', 'avgAssists'] as const).flatMap((k, i) => {
    const d = rowNumericDelta(row, k)
    return d == null ? [] : [`${'KDA'[i]} ${p.formatChampionGlobalNumericDelta(d)}`]
  })
  return parts.length ? parts.join(' · ') : undefined
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
    | 'avgTotalHeal'
    | 'avgHealsOnTeammates'
    | 'avgEffectiveHealShield'
    | 'avgDamageShieldedOnTeammates'
    | 'avgDamageSelfMitigated'
    | 'avgTimeCcDealt'
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
  for (const row of p.paginatedChampionGlobalRows) {
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

const STAT_COL_MIN_PX = 52
const CHAMPION_COL_MIN_PX = 220
const KDA_COL_MIN_PX = 160

/** Colonnes stats (hors champion / KDA) actuellement affichées. */
const visibleStatColumnCount = computed(() => {
  let n = 0
  if (p.showChampionHealColumns) {
    n += 3
    if (showChampionHealBreakdown.value) n += 3
  }
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

/** Variables CSS : les colonnes stats se partagent l’espace horizontal restant. */
const championTableLayoutStyle = computed(() => {
  const statCols = visibleStatColumnCount.value
  const statMinPx = statCols >= 12 ? 60 : statCols >= 9 ? 56 : statCols >= 6 ? 54 : STAT_COL_MIN_PX
  return {
    width: '100%',
    minWidth: `${championTableMinWidthPx.value}px`,
    '--cg-stat-min': `${statMinPx}px`,
    '--cg-champion-min': `${CHAMPION_COL_MIN_PX}px`,
    '--cg-kda-min': `${KDA_COL_MIN_PX}px`,
  } as Record<string, string>
})

const championMobileSortColumn = computed({
  get: () => p.championGlobalSortColumn,
  set: (v: string) => {
    if (isOneOf(CHAMPION_GLOBAL_SORT_COLUMNS, v)) p.championGlobalSortColumn = v
  },
})

const localePath = useLocalePath()
const mobileVisible = ref(8)
const mobileField = computed(() => championMobileMetric(p.championGlobalSortColumn))
const mobileSubs = computed(() => championMobileSubs(mobileField.value))
const mobileRows = computed(() => p.championGlobalSortedRows.slice(0, mobileVisible.value))
const mobileMax = computed(() =>
  Math.max(0, ...p.championGlobalSortedRows.map(r => r[mobileField.value] ?? 0))
)
const mobileMetricModel = computed({
  get: () => championMobileMetric(p.championGlobalSortColumn),
  set: (field: string) => {
    const m = CHAMPION_MOBILE_METRICS.find(x => x.field === field)
    if (m) {
      championMobileSortColumn.value = m.sort
      p.championGlobalSortDir = 'desc'
    }
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
    { value: 'healTotal', label: t('statisticsPage.championTableColTotalHeal') },
    { value: 'mitigated', label: t('statisticsPage.championTableColMitigation') },
    { value: 'ccTime', label: t('statisticsPage.championTableColCcTime') },
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
      { value: 'healTotalDelta', label: `Δ ${t('statisticsPage.championTableColTotalHeal')}` },
      { value: 'mitigatedDelta', label: `Δ ${t('statisticsPage.championTableColMitigation')}` },
      { value: 'ccTimeDelta', label: `Δ ${t('statisticsPage.championTableColCcTime')}` },
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
    <div class="ct-toolbar">
      <input
        v-model.trim="p.championSearchQuery"
        type="search"
        class="ct-search"
        :placeholder="p.t('statisticsPage.searchChampionPlaceholder')"
        :aria-label="p.t('statisticsPage.searchChampion')"
      />
      <select
        v-model="mobileMetricModel"
        class="ct-msort md:hidden"
        :aria-label="p.t('statisticsPage.championMobileMetricAria')"
      >
        <option v-for="m in CHAMPION_MOBILE_METRICS" :key="m.field" :value="m.field">
          {{ p.t(`statisticsPage.championMobileSub_${m.field}`) }}
        </option>
      </select>
      <div class="ct-seg" role="group" :aria-label="p.t('statisticsPage.championColumnsAria')">
        <button
          v-for="mode in CHAMPION_COLUMN_MODES"
          :key="mode"
          type="button"
          class="ct-seg-btn"
          :class="{ 'is-active': columnMode === mode }"
          :aria-pressed="columnMode === mode"
          @click="setColumnMode(mode)"
        >
          {{ p.t(columnModeLabelKeys[mode]) }}
        </button>
      </div>
      <label class="ct-check" title="Shift + T">
        <input
          type="checkbox"
          :checked="p.statsSplitTransformEnabled"
          @change="p.toggleStatsSplitTransformEnabled()"
        />
        {{ p.t('statisticsPage.filterTransformSplit') }}
      </label>
      <span v-if="p.totalChampionGlobalCount > 0" class="ct-info">
        <span class="hidden md:inline">{{
          p.t('statisticsPage.championTableToolbarInfo', { n: p.totalChampionGlobalCount })
        }}</span>
        <span class="md:hidden">{{
          p.progressionFromVersion
            ? p.t('statisticsPage.championMobileInfo', {
                n: p.totalChampionGlobalCount,
                v: p.progressionFromVersion,
              })
            : p.t('statisticsPage.championTableToolbarInfo', { n: p.totalChampionGlobalCount })
        }}</span>
      </span>
    </div>
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
        class="ct-msortbar"
        :options="championMobileSortOptions"
        :asc-default-columns="['champion']"
        :help-aria-label="p.t('statisticsPage.tooltipTableChampionAria')"
        :help-text="p.t('statisticsPage.tooltipTableChampion')"
        :help-secondary-text="p.t('statisticsPage.championTableDeltaColumnsHint')"
      />
      <!-- Mobile : cartes compactes (maquette 11) -->
      <div class="ct-mlist md:hidden">
        <NuxtLink
          v-for="row in mobileRows"
          :key="'mobile-' + p.championGlobalRowKey(row)"
          :to="
            localePath(
              `/statistics/champion/${p.championByKey(row.championId)?.id ?? row.championId}`
            )
          "
          class="ct-mcard"
        >
          <img
            v-if="rowPortraitSrc(row)"
            :src="rowPortraitSrc(row)!"
            :alt="p.championName(row.championId) || ''"
            class="ct-mcard-img"
            loading="lazy"
          />
          <div class="ct-mcard-body">
            <div class="ct-mcard-top">
              <span class="ct-mcard-name">{{
                p.championName(row.championId) || row.championId
              }}</span>
              <span class="ct-mcard-val">
                {{ p.formatChampionGlobalNum(row[mobileField]) }}
                <span
                  v-if="rowNumericDelta(row, mobileField) != null"
                  class="ct-mcard-delta"
                  :class="rowNumericDelta(row, mobileField)! >= 0 ? 'is-up' : 'is-down'"
                >
                  {{ p.formatChampionGlobalNumericDelta(rowNumericDelta(row, mobileField)!) }}
                </span>
              </span>
            </div>
            <div class="ct-mcard-track">
              <span
                :style="{ width: championMobileBarPct(row[mobileField] ?? 0, mobileMax) + '%' }"
              />
            </div>
            <div class="ct-mcard-subs">
              <span v-for="f in mobileSubs" :key="f">
                <em>{{ p.t(`statisticsPage.championMobileSub_${f}`) }}</em>
                {{ p.formatChampionGlobalNum(row[f]) }}
              </span>
              <span>
                <em>KDA</em>
                {{ p.formatChampionGlobalNum(row.avgKills) }}/{{
                  p.formatChampionGlobalNum(row.avgDeaths)
                }}/{{ p.formatChampionGlobalNum(row.avgAssists) }}
              </span>
            </div>
          </div>
        </NuxtLink>
        <button
          v-if="mobileVisible < p.championGlobalSortedRows.length"
          type="button"
          class="ct-mmore"
          @click="mobileVisible += 20"
        >
          {{ p.t('statisticsPage.championMobileShowMore', { n: 20 }) }}
        </button>
      </div>

      <!-- Desktop : tableau -->
      <div class="tier-list-mobile-rotate ct-card hidden w-full overflow-x-auto md:block">
        <div
          class="tier-list-lolalytics champion-global-table w-full min-w-0 text-[13px] text-text-primary/90"
          :style="championTableLayoutStyle"
        >
          <div
            class="tier-list-lolalytics-head ct-head sticky top-0 z-10 flex h-auto min-h-8 w-full items-stretch justify-start border-b"
          >
            <div
              class="champion-global-champ-col tier-list-lolalytics-th tier-list-lolalytics-th-all flex items-center justify-start border-b border-t border-black border-t-[var(--color-grey-300)] px-2 max-lg:w-[56px] max-lg:flex-none max-lg:shrink-0 max-lg:justify-center max-lg:px-0.5"
              :title="p.t('statisticsPage.championTableTooltipChampion')"
            >
              <span class="max-lg:hidden">{{ p.t('statisticsPage.tierListColChampion') }}</span>
            </div>
            <!-- Soins & combat -->
            <div
              v-show="p.showChampionHealColumns"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-info hover:bg-primary/25"
                :title="p.t('statisticsPage.championTableColTotalHeal')"
                @click="p.setChampionGlobalSort('healTotal')"
              >
                {{ p.t('statisticsPage.championTableColTotalHeal')
                }}{{ p.championGlobalSortIcon('healTotal') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('healTotalDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('healTotalDelta') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[10px] leading-tight text-text/80 hover:bg-primary/20"
                :title="showChampionHealBreakdown ? 'Masquer le détail' : 'Afficher le détail'"
                @click="showChampionHealBreakdown = !showChampionHealBreakdown"
              >
                {{ showChampionHealBreakdown ? '▴' : '▾' }}
              </button>
            </div>
            <div
              v-show="p.showChampionHealColumns && showChampionHealBreakdown"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-info hover:bg-primary/25"
                @click="p.setChampionGlobalSort('healTeam')"
              >
                {{ p.t('statisticsPage.championTableColHealAllies')
                }}{{ p.championGlobalSortIcon('healTeam') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('healTeamDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('healTeamDelta') }}
              </button>
            </div>
            <div
              v-show="p.showChampionHealColumns && showChampionHealBreakdown"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-info hover:bg-primary/25"
                @click="p.setChampionGlobalSort('healEffective')"
              >
                {{ p.t('statisticsPage.championTableColEffectiveHealShield')
                }}{{ p.championGlobalSortIcon('healEffective') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('healEffectiveDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('healEffectiveDelta') }}
              </button>
            </div>
            <div
              v-show="p.showChampionHealColumns && showChampionHealBreakdown"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-info hover:bg-primary/25"
                @click="p.setChampionGlobalSort('shieldTeam')"
              >
                {{ p.t('statisticsPage.championTableColShieldAllies')
                }}{{ p.championGlobalSortIcon('shieldTeam') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('shieldTeamDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('shieldTeamDelta') }}
              </button>
            </div>
            <div
              v-show="p.showChampionHealColumns"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-info hover:bg-primary/25"
                :title="p.t('statisticsPage.championTableColMitigation')"
                @click="p.setChampionGlobalSort('mitigated')"
              >
                {{ p.t('statisticsPage.championTableColMitigation')
                }}{{ p.championGlobalSortIcon('mitigated') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('mitigatedDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('mitigatedDelta') }}
              </button>
            </div>
            <div
              v-show="p.showChampionHealColumns"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-violet-200 hover:bg-primary/25"
                :title="p.t('statisticsPage.championTableColCcTime')"
                @click="p.setChampionGlobalSort('ccTime')"
              >
                {{ p.t('statisticsPage.championTableColCcTime')
                }}{{ p.championGlobalSortIcon('ccTime') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('ccTimeDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('ccTimeDelta') }}
              </button>
            </div>
            <!-- Dégâts infligés -->
            <div
              v-show="p.showChampionDealtColumns"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 py-1"
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
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-text-accent hover:bg-primary/25"
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
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 py-1"
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
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 py-1"
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
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 py-1"
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
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-text-accent hover:bg-primary/25"
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
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 py-1"
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
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 py-1"
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
              class="champion-global-kda-col tier-list-lolalytics-th tier-list-lolalytics-th-all flex min-h-8 flex-col items-stretch justify-center border-b border-t border-black border-t-[var(--color-grey-300)] px-1 py-1"
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
            class="tier-list-lolalytics-row ct-row flex min-h-[60px] w-full flex-nowrap items-center justify-start py-0.5"
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
                v-show="p.showChampionHealColumns"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 text-[13px] leading-tight"
              >
                <span class="font-medium">{{ p.formatChampionGlobalNum(row.avgTotalHeal) }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgTotalHeal') != null
                  "
                  class="text-[10px] leading-none"
                  :class="p.championGlobalNumericDeltaClass(rowNumericDelta(row, 'avgTotalHeal')!)"
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgTotalHeal')!)
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionHealColumns && showChampionHealBreakdown"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 text-[13px] leading-tight"
              >
                <span class="font-medium">{{
                  p.formatChampionGlobalNum(row.avgHealsOnTeammates)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgHealsOnTeammates') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(rowNumericDelta(row, 'avgHealsOnTeammates')!)
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgHealsOnTeammates')!)
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionHealColumns && showChampionHealBreakdown"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 text-[13px] leading-tight"
              >
                <span class="font-medium">{{
                  p.formatChampionGlobalNum(row.avgEffectiveHealShield)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgEffectiveHealShield') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(
                      rowNumericDelta(row, 'avgEffectiveHealShield')!
                    )
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(
                      rowNumericDelta(row, 'avgEffectiveHealShield')!
                    )
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionHealColumns && showChampionHealBreakdown"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 text-[13px] leading-tight"
              >
                <span class="font-medium">{{
                  p.formatChampionGlobalNum(row.avgDamageShieldedOnTeammates)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgDamageShieldedOnTeammates') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(
                      rowNumericDelta(row, 'avgDamageShieldedOnTeammates')!
                    )
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(
                      rowNumericDelta(row, 'avgDamageShieldedOnTeammates')!
                    )
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionHealColumns"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 text-[13px] leading-tight"
              >
                <span class="font-medium">{{
                  p.formatChampionGlobalNum(row.avgDamageSelfMitigated)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgDamageSelfMitigated') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(
                      rowNumericDelta(row, 'avgDamageSelfMitigated')!
                    )
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(
                      rowNumericDelta(row, 'avgDamageSelfMitigated')!
                    )
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionHealColumns"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 text-[13px] leading-tight"
              >
                <span class="font-medium text-violet-200">{{
                  p.formatChampionGlobalNum(row.avgTimeCcDealt)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgTimeCcDealt') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(rowNumericDelta(row, 'avgTimeCcDealt')!)
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgTimeCcDealt')!)
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionDealtColumns"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 text-[13px] leading-tight"
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
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 text-[13px] leading-tight"
              >
                <span class="font-medium text-text-accent">{{
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
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 text-[13px] leading-tight"
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
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 text-[13px] leading-tight"
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
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 text-[13px] leading-tight"
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
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 text-[13px] leading-tight"
              >
                <span class="font-medium text-text-accent">{{
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
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 text-[13px] leading-tight"
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
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 text-[13px] leading-tight"
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
                class="champion-global-kda-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0.5 text-[13px] leading-tight"
              >
                <span class="font-semibold" :title="kdaDeltaTitle(row)">
                  {{ p.formatChampionGlobalNum(row.avgKills) }} /
                  {{ p.formatChampionGlobalNum(row.avgDeaths) }} /
                  {{ p.formatChampionGlobalNum(row.avgAssists) }}
                </span>
              </div>
            </template>
          </div>
          <StatisticsRangePagination
            :page="p.championGlobalPage"
            :page-size="p.championsPageSize"
            class="border-t border-primary/20 px-4 py-2 text-sm text-text/80"
            :total-count="p.totalChampionGlobalCount"
            :total-pages="p.totalChampionGlobalPages"
            @update:page="p.onChampionGlobalPageUpdated"
            @update:page-size="p.onChampionGlobalPageSizeUpdated"
          >
            {{ p.t('statisticsPage.showing') }} {{ p.totalChampionGlobalCount }}
          </StatisticsRangePagination>
        </div>
      </div>
      <p v-if="p.championGlobalPatchDeltaRefLabel" class="ct-note">
        {{
          p.t('statisticsPage.championTableDeltaNote', { ref: p.championGlobalPatchDeltaRefLabel })
        }}
      </p>
    </template>
  </div>
</template>

<style scoped>
.ct-card {
  border: 1px solid #463714;
  border-radius: 12px;
  background: #0a1428;
}
.ct-card .champion-global-table {
  font-family: Inter, system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
  color: #f0e6d2;
}
.ct-head {
  border-color: #463714;
  background: #0a1428;
  color: #a09b8c;
  font-size: 12px;
  font-weight: 600;
}
.ct-row {
  color: #f0e6d2;
  border-top: 1px solid #1e2328;
}
.ct-row:hover {
  background: rgb(10 50 60 / 0.35);
}
.ct-card :deep(.text-info\/90) {
  color: #0ac8b9;
}
.ct-card :deep(.text-error\/90) {
  color: #e2665a;
}
.ct-note {
  font-size: 12px;
  color: #a09b8c;
}
.ct-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
}
.ct-search {
  height: 40px;
  width: 260px;
  max-width: 100%;
  padding: 0 12px;
  border: 1px solid #785a28;
  border-radius: 8px;
  background: #0a1428;
  color: #f0e6d2;
  font-size: 14px;
}
.ct-search::placeholder {
  color: #a09b8c;
}
.ct-seg {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid #0a323c;
  border-radius: 8px;
  background: #0a1428;
  max-width: 100%;
  overflow-x: auto;
}
.ct-seg-btn {
  height: 34px;
  padding: 0 12px;
  border-radius: 6px;
  font-size: 14px;
  color: #a09b8c;
  white-space: nowrap;
}
.ct-seg-btn:hover {
  color: #f0e6d2;
}
.ct-seg-btn.is-active {
  background: #0a323c;
  color: #f0e6d2;
  font-weight: 600;
}
.ct-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #cbc3b0;
  cursor: pointer;
}
.ct-check input {
  accent-color: #c8aa6e;
}
.ct-info {
  margin-left: auto;
  font-size: 13px;
  color: #a09b8c;
}
@media (max-width: 767px) {
  .ct-toolbar {
    gap: 8px;
  }
  .ct-search {
    flex: 1;
    width: auto;
    min-width: 0;
  }
  .ct-seg,
  .ct-check,
  .ct-msortbar {
    display: none !important;
  }
  .ct-info {
    width: 100%;
    font-size: 12px;
  }
}
.ct-msort {
  height: 36px;
  padding: 0 10px;
  border: 1px solid #785a28;
  border-radius: 8px;
  background: #0a1428;
  color: #f0e6d2;
  font-size: 13px;
}
.ct-mlist {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ct-mcard {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid #463714;
  border-radius: 12px;
  background: #0a1428;
  color: #f0e6d2;
}
.ct-mcard-img {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 8px;
  border: 1px solid #785a28;
}
.ct-mcard-body {
  flex: 1;
  min-width: 0;
}
.ct-mcard-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}
.ct-mcard-name {
  font-weight: 600;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ct-mcard-val {
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.ct-mcard-delta {
  margin-left: 4px;
  font-size: 11px;
  font-weight: 600;
}
.ct-mcard-delta.is-up {
  color: #0ac8b9;
}
.ct-mcard-delta.is-down {
  color: #e2665a;
}
.ct-mcard-track {
  height: 4px;
  margin: 6px 0;
  border-radius: 2px;
  background: #1e2328;
  overflow: hidden;
}
.ct-mcard-track > span {
  display: block;
  height: 100%;
  background: #c8aa6e;
}
.ct-mcard-subs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.ct-mcard-subs em {
  display: block;
  font-style: normal;
  font-size: 10px;
  color: #a09b8c;
  text-transform: uppercase;
}
.ct-mmore {
  height: 40px;
  border: 1px solid #785a28;
  border-radius: 8px;
  background: transparent;
  color: #c8aa6e;
  font-size: 13px;
  font-weight: 600;
}
@media (max-width: 767px) {
  .ct-search {
    width: 100%;
  }
  .ct-info {
    margin-left: 0;
  }
}

.champion-global-table :deep(.tier-list-lolalytics-head),
.champion-global-table :deep(.tier-list-lolalytics-row) {
  width: 100%;
}

.champion-global-table :deep(.champion-global-stat-col) {
  flex: 1 1 0;
  min-width: var(--cg-stat-min, 3.25rem);
  width: auto;
}

.champion-global-table :deep(.champion-global-champ-col) {
  flex: 0 1 var(--cg-champion-min, 220px);
  min-width: var(--cg-champion-min, 220px);
  width: auto;
}

.champion-global-table :deep(.champion-global-kda-col) {
  flex: 0 1 var(--cg-kda-min, 10rem);
  min-width: var(--cg-kda-min, 10rem);
  width: auto;
}
</style>
