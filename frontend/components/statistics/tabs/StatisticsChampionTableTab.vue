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
import {
  championDesktopColumns,
  championDesktopGroups,
  championDeltaTone,
  championDamageSegments,
  type ChampionDesktopColumn,
} from '~/utils/statistics/championDesktopColumns'

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

const desktopColumns = computed(() =>
  championDesktopColumns(
    {
      heal: Boolean(p.showChampionHealColumns),
      dealt: Boolean(p.showChampionDealtColumns),
      taken: Boolean(p.showChampionTakenColumns),
    },
    {
      heal: showChampionHealBreakdown.value,
      dealt: showChampionDealtBreakdown.value,
      taken: showChampionTakenBreakdown.value,
    }
  )
)
const desktopGroups = computed(() => championDesktopGroups(desktopColumns.value))
const groupLabelKeys = {
  heal: 'statisticsPage.championTableGroupHeal',
  dealt: 'statisticsPage.championTableGroupDealt',
  taken: 'statisticsPage.championTableGroupTaken',
} as const
const breakdownRefs = {
  heal: showChampionHealBreakdown,
  dealt: showChampionDealtBreakdown,
  taken: showChampionTakenBreakdown,
} as const
const desktopBarMax = computed(() =>
  Math.max(0, ...championTableDisplayEntries.value.map(e => Number(e.row.avgDamageToChamps) || 0))
)
function sortState(col: ChampionDesktopColumn | 'kills'): 'ascending' | 'descending' | 'none' {
  const key = typeof col === 'string' ? col : col.sort
  if (p.championGlobalSortColumn !== key && p.championGlobalSortColumn !== `${key}Delta`)
    return 'none'
  return p.championGlobalSortDir === 'asc' ? 'ascending' : 'descending'
}
function damageSegments(row: ChampionGlobalRow) {
  return championDamageSegments(
    {
      phys: Number(row.avgDamageToChampsPhys) || 0,
      magic: Number(row.avgDamageToChampsMagic) || 0,
      true: Number(row.avgDamageToChampsTrue) || 0,
    },
    Number(row.avgDamageToChamps) || 0,
    desktopBarMax.value
  )
}
function damageBarTitle(row: ChampionGlobalRow): string {
  return [
    `${p.t('statisticsPage.championTableColPhys')} ${p.formatChampionGlobalNum(row.avgDamageToChampsPhys)}`,
    `${p.t('statisticsPage.championTableColMagic')} ${p.formatChampionGlobalNum(row.avgDamageToChampsMagic)}`,
    `${p.t('statisticsPage.championTableColBrut')} ${p.formatChampionGlobalNum(row.avgDamageToChampsTrue)}`,
  ].join(' · ')
}
function cellDelta(row: ChampionGlobalRow, col: ChampionDesktopColumn): number | undefined {
  if (!p.championGlobalPatchDeltaRefLabel) return undefined
  return rowNumericDelta(row, col.field) ?? undefined
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
      <label class="ct-search-wrap">
        <svg class="ct-search-icon" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.5" />
          <path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.5" />
        </svg>
        <input
          v-model.trim="p.championSearchQuery"
          type="search"
          class="ct-search"
          :placeholder="p.t('statisticsPage.searchChampionPlaceholder')"
          :aria-label="p.t('statisticsPage.searchChampion')"
        />
      </label>
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

      <!-- Desktop : tableau (maquette) -->
      <div class="ct-dtable-wrap hidden md:block">
        <table class="ct-dtable">
          <thead>
            <tr class="ct-dgroups">
              <th />
              <th v-for="g in desktopGroups" :key="g.group" :colspan="g.span" class="ct-dgroup">
                <button
                  type="button"
                  class="ct-dgroup-btn"
                  :aria-expanded="breakdownRefs[g.group].value"
                  @click="breakdownRefs[g.group].value = !breakdownRefs[g.group].value"
                >
                  {{ p.t(groupLabelKeys[g.group]) }}
                  <span aria-hidden="true">{{ breakdownRefs[g.group].value ? '−' : '+' }}</span>
                </button>
                <span v-if="g.group === 'dealt'" class="ct-dlegend">
                  <span
                    ><i class="ct-dbar-fill is-phys" />{{
                      p.t('statisticsPage.championTableColPhys')
                    }}</span
                  >
                  <span
                    ><i class="ct-dbar-fill is-magic" />{{
                      p.t('statisticsPage.championTableColMagic')
                    }}</span
                  >
                  <span
                    ><i class="ct-dbar-fill is-true" />{{
                      p.t('statisticsPage.championTableColBrut')
                    }}</span
                  >
                </span>
              </th>
              <th />
            </tr>
            <tr class="ct-dhead">
              <th class="ct-dchamp" scope="col">{{ p.t('statisticsPage.tierListColChampion') }}</th>
              <th
                v-for="col in desktopColumns"
                :key="col.sort"
                scope="col"
                class="ct-dnum"
                :class="{ 'is-sorted': sortState(col) !== 'none' }"
                :aria-sort="sortState(col)"
              >
                <button type="button" class="ct-dsort" @click="p.setChampionGlobalSort(col.sort)">
                  {{ p.t(col.labelKey) }}
                  <svg
                    v-if="sortState(col) !== 'none'"
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    aria-hidden="true"
                    :style="sortState(col) === 'ascending' ? 'transform:rotate(180deg)' : ''"
                  >
                    <path
                      d="M2 3.5 5 6.5 8 3.5"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                    />
                  </svg>
                </button>
                <button
                  v-if="p.championGlobalPatchDeltaRefLabel"
                  type="button"
                  class="ct-dsort-delta"
                  :class="{ 'is-on': p.championGlobalSortColumn === col.sortDelta }"
                  :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                  @click="p.setChampionGlobalSort(col.sortDelta)"
                >
                  {{ p.t('statisticsPage.championTableDeltaSymbol') }}
                </button>
              </th>
              <th
                scope="col"
                class="ct-dnum"
                :class="{ 'is-sorted': sortState('kills') !== 'none' }"
                :aria-sort="sortState('kills')"
              >
                <button type="button" class="ct-dsort" @click="p.setChampionGlobalSort('kills')">
                  K/D/A
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in championTableDisplayEntries"
              :key="entry.key"
              class="ct-drow"
              :class="{ 'is-sub': entry.sub }"
            >
              <th scope="row" class="ct-dchamp">
                <StatisticsTierListChampionCell
                  :champion-id="entry.row.championId"
                  :highlight-query="p.championSearchQuery"
                  width-class="ct-dchamp-cell"
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
              </th>
              <td
                v-for="col in desktopColumns"
                :key="col.sort"
                class="ct-dnum"
                :class="{ 'ct-dbar-cell': col.bar }"
              >
                <div v-if="col.bar" class="ct-dbar-row">
                  <span class="ct-dbar" :title="damageBarTitle(entry.row)">
                    <span
                      v-for="seg in damageSegments(entry.row)"
                      :key="seg.type"
                      class="ct-dbar-fill"
                      :class="`is-${seg.type}`"
                      :style="{ width: seg.pct + '%' }"
                    />
                  </span>
                  <span class="ct-dval">{{ p.formatChampionGlobalNum(entry.row[col.field]) }}</span>
                </div>
                <span v-else class="ct-dval">{{
                  p.formatChampionGlobalNum(entry.row[col.field])
                }}</span>
                <span
                  v-if="cellDelta(entry.row, col) != null"
                  class="ct-ddelta"
                  :class="`is-${championDeltaTone(cellDelta(entry.row, col)!, col.invert)}`"
                  >{{ p.formatChampionGlobalNumericDelta(cellDelta(entry.row, col)!) }}</span
                >
              </td>
              <td class="ct-dnum">
                <span class="ct-dkda" :title="kdaDeltaTitle(entry.row)">
                  {{ p.formatChampionGlobalNum(entry.row.avgKills) }} /
                  {{ p.formatChampionGlobalNum(entry.row.avgDeaths) }} /
                  {{ p.formatChampionGlobalNum(entry.row.avgAssists) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <StatisticsRangePagination
          :page="p.championGlobalPage"
          :page-size="p.championsPageSize"
          class="ct-dpager"
          :total-count="p.totalChampionGlobalCount"
          :total-pages="p.totalChampionGlobalPages"
          @update:page="p.onChampionGlobalPageUpdated"
          @update:page-size="p.onChampionGlobalPageSizeUpdated"
        >
          {{ p.t('statisticsPage.showing') }} {{ p.totalChampionGlobalCount }}
        </StatisticsRangePagination>
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
.ct-dtable-wrap {
  overflow-x: auto;
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
}
.ct-dtable {
  width: 100%;
  min-width: 1080px;
  border-collapse: collapse;
  font-size: 14px;
  color: #f0e6d2;
}
.ct-dgroups th {
  padding: 10px 16px 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #a09b8c;
}
.ct-dgroup {
  text-align: center;
  border-bottom: 1px solid #0a323c;
}
.ct-dgroup-btn {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  text-transform: inherit;
  letter-spacing: inherit;
}
.ct-dgroup-btn:hover {
  color: #f0e6d2;
}
.ct-dhead th {
  padding: 10px 16px;
  font-size: 12px;
  font-weight: 600;
  color: #a09b8c;
  border-bottom: 1px solid #0a323c;
  white-space: nowrap;
}
.ct-dhead th.is-sorted {
  color: #c8aa6e;
}
.ct-dsort {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: inherit;
}
.ct-dsort:hover {
  color: #f0e6d2;
}
.ct-dsort-delta {
  margin-left: 4px;
  font-size: 11px;
  color: #5b5a56;
}
.ct-dsort-delta.is-on,
.ct-dsort-delta:hover {
  color: #c8aa6e;
}
.ct-dchamp {
  position: sticky;
  left: 0;
  z-index: 1;
  background: #0a1428;
  text-align: left;
  padding: 8px 20px !important;
  font-weight: 400;
}
.ct-dnum {
  text-align: right;
  padding: 10px 16px;
  white-space: nowrap;
  vertical-align: middle;
}
.ct-drow {
  border-bottom: 1px solid #1e2328;
}
.ct-drow:hover,
.ct-drow:hover .ct-dchamp {
  background: #0e1a2e;
}
.ct-drow.is-sub,
.ct-drow.is-sub .ct-dchamp {
  background: #070f1e;
}
.ct-dval {
  display: block;
  font-variant-numeric: tabular-nums;
}
.ct-ddelta {
  display: block;
  font-size: 11px;
  line-height: 1.2;
  color: #5b5a56;
}
.ct-ddelta.is-up {
  color: #0ac8b9;
}
.ct-ddelta.is-down {
  color: #e2665a;
}
.ct-dbar-cell {
  min-width: 200px;
}
.ct-dbar-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ct-dbar {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: #1e2328;
  overflow: hidden;
}
.ct-dbar {
  display: flex;
}
.ct-dbar-fill {
  display: block;
  height: 100%;
  flex: none;
}
.ct-dbar-fill.is-phys {
  background: #e2665a;
}
.ct-dbar-fill.is-magic {
  background: #0397ab;
}
.ct-dbar-fill.is-true {
  background: #f0e6d2;
}
.ct-dlegend {
  display: inline-flex;
  gap: 10px;
  margin-left: 8px;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
}
.ct-dlegend i {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  margin-right: 4px;
}
.ct-dbar-row .ct-dval {
  width: 56px;
  text-align: right;
}
.ct-dchamp :deep(a),
.ct-dchamp :deep(.underline) {
  color: #f0e6d2;
  font-size: 14px;
  text-decoration: none;
}
.ct-dkda {
  font-weight: 600;
}
.ct-dpager {
  border-top: 1px solid #0a323c;
  padding: 8px 16px;
  font-size: 14px;
  color: #a09b8c;
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
.ct-search-wrap {
  position: relative;
  display: block;
  width: 340px;
  max-width: 100%;
}
.ct-search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  width: 16px;
  height: 16px;
  transform: translateY(-50%);
  color: #a09b8c;
  pointer-events: none;
}
.ct-search {
  height: 40px;
  width: 100%;
  padding: 0 12px 0 36px;
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
  .ct-search-wrap {
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
@media (min-width: 768px) {
  .ct-mlist {
    display: none;
  }
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
  .ct-search-wrap {
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
