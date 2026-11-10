<script setup lang="ts">
import { computed, unref } from 'vue'
import type { Item } from '@lelanation/shared-types'
import {
  injectStatisticsPageCtx,
  type StatisticsIndexPageCtx,
} from '~/composables/statistics/statisticsPageCtx'
import { useItemsStore } from '~/stores/ItemsStore'
import { usePagination } from '~/composables/usePagination'
import { useTableSort } from '~/composables/useTableSort'
import type { StatisticsMobileSortOption } from '~/components/statistics/StatisticsMobileSortBar.vue'
import {
  formatItemGoldEfficiency,
  getItemGoldEfficiency,
  getItemGoldValue,
} from '~/utils/formatItemStats'
import { matchesItemSearch } from '~/utils/multilingualEntitySearch'
import { useToggleSet } from '~/composables/useToggleSet'
import {
  ITEM_TYPE_CHIPS,
  classifyItemType,
  countItemTypes,
  type ItemTypeChip,
} from '~/utils/statistics/itemTypeCounts'
import { championMobileBarPct } from '~/utils/statistics/championMobileCards'
import { itemSetsForDisplay, type ItemSetStat } from '~/utils/statistics/itemSetsDisplay'

const p = injectStatisticsPageCtx<StatisticsIndexPageCtx>()
const itemsStore = useItemsStore()

type ItemType = 'starter' | 'core' | 'boots' | 'final'
type SortKey =
  | 'item'
  | 'type'
  | 'goldValue'
  | 'goldEfficiency'
  | 'pickrate'
  | 'winrate'
  | 'deltaPick'
  | 'deltaWin'

type RawItemRow = {
  itemId: number
  games: number
  wins: number
  pickrate: number
  winrate: number
}

type TableRow = RawItemRow & {
  type: ItemType
  deltaPick: number | null
  deltaWin: number | null
  goldValue: number | null
  goldEfficiency: number | null
}

const { sortBy, sortDir, toggleSort } = useTableSort<SortKey>({ resettable: true })
const { set: expandedItemKeys, toggle: toggleItemCardExpanded } = useToggleSet<string>()

function itemRowKey(row: TableRow): string {
  return `${row.type}:${row.itemId}`
}

const itemTypeFilter = computed<'all' | ItemType>(() => {
  const v = String(p.itemsTypeFilter ?? 'all')
  return v === 'starter' || v === 'core' || v === 'boots' || v === 'final' ? v : 'all'
})
const legendaryOnly = computed(() => p.itemsLegendaryFilter === 'legendary')

const baseRows = computed<TableRow[]>(() => {
  const d = p.overviewDetailData
  if (!d) return []

  const seen = new Set<number>()
  const pushTyped = (rows: RawItemRow[] | undefined, out: TableRow[]) => {
    for (const row of rows ?? []) {
      if (seen.has(row.itemId)) continue
      seen.add(row.itemId)
      const item = itemById.value.get(row.itemId)
      out.push({
        ...row,
        type: classifyItemType(item),
        deltaPick: null,
        deltaWin: null,
        goldValue: item ? getItemGoldValue(item) : null,
        goldEfficiency: item ? getItemGoldEfficiency(item) : null,
      })
    }
  }

  const out: TableRow[] = []
  pushTyped(d.items, out)
  pushTyped(d.itemsBoots, out)
  return out
})

const baselineByKey = computed<Map<string, RawItemRow>>(() => {
  const b = p.overviewDetailBaselineData
  const map = new Map<string, RawItemRow>()
  if (!b) return map
  const add = (rows: RawItemRow[] | undefined) => {
    for (const row of rows ?? []) map.set(String(row.itemId), row)
  }
  add(b.items)
  add(b.itemsBoots)
  return map
})

const hasComparison = computed(() => Boolean(p.overviewDetailComparisonVersion))

function deltaWhenComparison(
  cur: number | null | undefined,
  base: number | null | undefined
): number | null {
  if (!hasComparison.value || p.overviewDetailBaselinePending) return null
  if (cur == null || base == null || !Number.isFinite(cur) || !Number.isFinite(base)) return null
  return cur - base
}

const tableRows = computed<TableRow[]>(() =>
  baseRows.value.map(row => {
    const baseline = baselineByKey.value.get(String(row.itemId))
    return {
      ...row,
      deltaPick: deltaWhenComparison(row.pickrate, baseline?.pickrate),
      deltaWin: deltaWhenComparison(row.winrate, baseline?.winrate),
    }
  })
)

const itemTypeCounts = computed(() => countItemTypes(tableRows.value))
const ITEM_CHIP_LABEL_KEYS: Record<ItemTypeChip, string> = {
  all: 'statisticsPage.itemsTypeAll',
  final: 'statisticsPage.itemsChipFinal',
  core: 'statisticsPage.itemsChipCore',
  boots: 'statisticsPage.itemsChipBoots',
  starter: 'statisticsPage.itemsChipStarter',
}
const itemTypeChipLabel = (chip: ItemTypeChip) => p.t(ITEM_CHIP_LABEL_KEYS[chip])
const setItemTypeChip = (chip: ItemTypeChip) => {
  p.itemsTypeFilter = chip
}

const itemSearchQuery = computed(() => String(unref(p.championSearchQuery) ?? '').trim())

const itemById = computed<Map<number, Item>>(
  () => new Map(itemsStore.items.map(i => [Number(i.id), i] as const))
)

type ItemSetsDetail = { totalParticipants: number; itemSets: ItemSetStat[] }

function itemSetsDetail(
  d: { totalParticipants?: number; itemSets?: ItemSetStat[] } | null | undefined
): ItemSetsDetail | null {
  if (!d) return null
  return {
    totalParticipants: d.totalParticipants ?? 0,
    itemSets: itemSetsForDisplay(d.itemSets ?? [], id => classifyItemType(itemById.value.get(id))),
  }
}
const itemSetsData = computed(() => itemSetsDetail(p.overviewDetailData))
const itemSetsBaseline = computed(() => itemSetsDetail(p.overviewDetailBaselineData))

function isCompleteLegendary(item: Item | undefined): boolean {
  if (!item) return false
  if (item.isMasterwork) return true
  if (item.id === '2526') return true
  if (item.tags?.includes('Boots')) return false
  if (item.tags?.includes('Consumable')) return false
  const hasFrom = Array.isArray(item.from) && item.from.length > 0
  const hasInto = Array.isArray(item.into) && item.into.length > 0
  return hasFrom && !hasInto
}

const BOOT_PARENT_IDS = new Set([
  '1001',
  '3005',
  '3006',
  '3009',
  '3010',
  '3020',
  '3047',
  '3111',
  '3117',
  '3158',
])

function isBootsTier2Or3(item: Item | undefined, itemId: number): boolean {
  if (itemId === 1001) return false
  if (item?.tags?.includes('Boots') && item.id !== '1001') return true
  if (item?.from?.some(parentId => BOOT_PARENT_IDS.has(parentId))) return true
  return false
}

const filteredRows = computed<TableRow[]>(() => {
  const byLegendary = legendaryOnly.value
    ? tableRows.value.filter(r => {
        if (r.type === 'starter') return false
        const item = itemById.value.get(r.itemId)
        if (r.type === 'boots') return isBootsTier2Or3(item, r.itemId)
        return isCompleteLegendary(item)
      })
    : tableRows.value
  const byType =
    itemTypeFilter.value === 'all'
      ? byLegendary
      : byLegendary.filter(r => {
          if (r.type !== itemTypeFilter.value) return false
          if (itemTypeFilter.value === 'boots') {
            return isBootsTier2Or3(itemById.value.get(r.itemId), r.itemId)
          }
          return true
        })
  const q = itemSearchQuery.value
  if (!q) return byType
  return byType.filter(r => {
    const item = itemById.value.get(r.itemId)
    return matchesItemSearch(q, {
      id: r.itemId,
      name: p.itemName(r.itemId),
      colloq: item?.colloq,
      plaintext: item?.plaintext,
    })
  })
})

const typeLabel = (type: ItemType) => {
  if (type === 'starter') return p.t('statisticsPage.itemKindStarter')
  if (type === 'core') return p.t('statisticsPage.itemKindCore')
  if (type === 'boots') return p.t('statisticsPage.itemKindBoots')
  if (type === 'final') return p.t('statisticsPage.itemKindFinal')
  return p.t('statisticsPage.itemKindFinal')
}

function sortNumber(a: number | null, b: number | null, dir: 'asc' | 'desc'): number {
  const an = a == null ? Number.NEGATIVE_INFINITY : a
  const bn = b == null ? Number.NEGATIVE_INFINITY : b
  return dir === 'asc' ? an - bn : bn - an
}

const sortedRows = computed<TableRow[]>(() => {
  const list = [...filteredRows.value]
  if (!sortBy.value) return list
  const dir = sortDir.value
  const key = sortBy.value
  list.sort((a, b) => {
    if (key === 'item') {
      const an = (p.itemName(a.itemId) || String(a.itemId)).toLowerCase()
      const bn = (p.itemName(b.itemId) || String(b.itemId)).toLowerCase()
      if (an === bn) return 0
      return dir === 'asc' ? (an < bn ? -1 : 1) : an < bn ? 1 : -1
    }
    if (key === 'type') {
      const av = typeLabel(a.type).toLowerCase()
      const bv = typeLabel(b.type).toLowerCase()
      if (av === bv) return 0
      return dir === 'asc' ? (av < bv ? -1 : 1) : av < bv ? 1 : -1
    }
    if (key === 'goldValue') return sortNumber(a.goldValue, b.goldValue, dir)
    if (key === 'goldEfficiency') return sortNumber(a.goldEfficiency, b.goldEfficiency, dir)
    if (key === 'pickrate') return sortNumber(a.pickrate, b.pickrate, dir)
    if (key === 'winrate') return sortNumber(a.winrate, b.winrate, dir)
    if (key === 'deltaPick') return sortNumber(a.deltaPick, b.deltaPick, dir)
    return sortNumber(a.deltaWin, b.deltaWin, dir)
  })
  return list
})

const { page, pageSize, totalRowsCount, totalPages, paginatedRows } = usePagination(sortedRows, {
  resetOn: [itemTypeFilter, sortBy, sortDir, itemSearchQuery],
})

const itemsMobileSortColumn = computed({
  get: () => String(sortBy.value ?? 'pickrate'),
  set: (v: string) => {
    sortBy.value = v as SortKey
  },
})

const itemsMobileSortOptions = computed<StatisticsMobileSortOption[]>(() => {
  const t = p.t
  const opts: StatisticsMobileSortOption[] = [
    { value: 'item', label: t('statisticsPage.itemsColumn') },
    { value: 'type', label: t('statisticsPage.itemsColType') },
    { value: 'goldValue', label: t('statisticsPage.itemsColGoldValue') },
    { value: 'goldEfficiency', label: t('statisticsPage.itemsColGoldEfficiency') },
    { value: 'pickrate', label: t('statisticsPage.pickrate') },
    { value: 'winrate', label: t('statisticsPage.winrate') },
  ]
  if (hasComparison.value) {
    opts.push(
      { value: 'deltaPick', label: `Δ ${t('statisticsPage.pickrate')}` },
      { value: 'deltaWin', label: `Δ ${t('statisticsPage.winrate')}` }
    )
  }
  return opts
})

interface DesktopColumn {
  sort: SortKey
  deltaSort?: SortKey
  labelKey: string
  tooltipKey?: string
  cls: string
}

const desktopColumns = computed<DesktopColumn[]>(() => [
  {
    sort: 'item',
    labelKey: 'statisticsPage.itemsColItem',
    tooltipKey: 'statisticsPage.itemsTooltipItem',
    cls: 'it-dleft',
  },
  { sort: 'goldValue', labelKey: 'statisticsPage.itemsColCost', cls: 'it-dnum' },
  { sort: 'goldEfficiency', labelKey: 'statisticsPage.itemsColProfit', cls: 'it-dnum' },
  {
    sort: 'pickrate',
    deltaSort: 'deltaPick',
    labelKey: 'statisticsPage.itemsColBoughtIn',
    cls: 'it-dleft',
  },
  {
    sort: 'winrate',
    deltaSort: 'deltaWin',
    labelKey: 'statisticsPage.overviewDetailWinRate',
    cls: 'it-dnum it-dlast',
  },
])

const pickrateMax = computed(() =>
  Math.max(0, ...sortedRows.value.map(r => Number(r.pickrate) || 0))
)

function showDelta(v: number | null | undefined): boolean {
  return hasComparison.value && !p.overviewDetailBaselinePending && v != null
}

function deltaTone(v: number): 'up' | 'down' | 'flat' {
  return v > 0 ? 'up' : v < 0 ? 'down' : 'flat'
}

function fmtPct(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${Number(value).toFixed(2)}%`
}

function fmtGoldValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return '—'
  return String(Math.round(value))
}

function fmtGoldEfficiency(row: TableRow): string {
  const item = itemById.value.get(row.itemId)
  if (!item) return '—'
  return formatItemGoldEfficiency(item)
}

function fmtDelta(value: number | null | undefined): string {
  if (!hasComparison.value || p.overviewDetailBaselinePending || value == null) return '—'
  const n = Number(value)
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

function winrateClass(value: number | null | undefined): string {
  if (value == null) return 'text-text/55'
  if (value > 51) return 'text-info/90'
  if (value < 49) return 'text-error/90'
  return 'text-text/80'
}

function deltaClass(value: number | null | undefined): string {
  if (!hasComparison.value || value == null || p.overviewDetailBaselinePending)
    return 'text-text/55'
  if (value > 0) return 'text-success'
  if (value < 0) return 'text-error'
  return 'text-text/75'
}
</script>

<template>
  <div class="space-y-6">
    <div v-if="p.overviewDetailPending" class="text-text/70">
      {{ p.t('statisticsPage.loading') }}
    </div>
    <div v-else-if="p.overviewDetailError" class="rounded border border-error/50 p-3 text-error">
      {{ p.t('statisticsPage.overviewDetailTimeout') }}
    </div>
    <template v-else-if="tableRows.length > 0">
      <div v-if="tableRows.length > 0" class="statistics-items-tab space-y-3">
        <div class="it-head">
          <div class="items-type" role="group" :aria-label="p.t('statisticsPage.itemsTypeAria')">
            <button
              v-for="chip in ITEM_TYPE_CHIPS"
              :key="chip"
              type="button"
              class="items-type-btn"
              :class="{ 'is-active': itemTypeFilter === chip }"
              :aria-pressed="itemTypeFilter === chip"
              @click="setItemTypeChip(chip)"
            >
              {{ itemTypeChipLabel(chip) }}
              <template v-if="chip === 'all'"> · {{ itemTypeCounts[chip] }}</template>
            </button>
          </div>
        </div>
        <StatisticsMobileSortBar
          id="items-mobile-sort"
          v-model:column="itemsMobileSortColumn"
          v-model:direction="sortDir"
          :options="itemsMobileSortOptions"
          :asc-default-columns="['item', 'type']"
          :help-aria-label="p.t('statisticsPage.tooltipTableItemsAria')"
          :help-text="p.t('statisticsPage.tooltipTableItems')"
          :help-secondary-text="p.t('statisticsPage.tooltipTableItemsSecondary')"
        />
        <div class="statistics-items-mobile-list space-y-2 md:hidden">
          <article
            v-for="row in paginatedRows"
            :key="'item-mobile-' + row.type + '-' + row.itemId"
            class="statistics-champion-stats-mobile-card statistics-item-mobile-card w-full overflow-hidden"
          >
            <div
              class="statistics-champion-stats-mobile-card-header flex w-full min-w-0 items-center gap-3 p-3"
            >
              <StatisticsItemStatsMobileCardHeader
                :item-id="row.itemId"
                :item-name="String(p.itemName(row.itemId) || row.itemId)"
                :type-label="typeLabel(row.type)"
                :image-src="
                  p.itemImageName(row.itemId) && p.gameVersion
                    ? p.getItemImageUrl(p.gameVersion, p.itemImageName(row.itemId)!)
                    : null
                "
                :image-alt="p.itemName(row.itemId) || ''"
              />
              <button
                type="button"
                class="statistics-item-mobile-stats flex min-w-0 flex-1 justify-end gap-2 text-right sm:gap-3"
                @click="toggleItemCardExpanded(itemRowKey(row))"
              >
                <div class="min-w-0 shrink">
                  <div class="text-[10px] font-medium uppercase tracking-wide text-text/55">
                    {{ p.t('statisticsPage.overviewDetailPickRate') }}
                  </div>
                  <div class="text-xl font-bold tabular-nums leading-none text-text sm:text-2xl">
                    {{ fmtPct(row.pickrate) }}
                  </div>
                  <div
                    class="mt-0.5 text-xs tabular-nums leading-none"
                    :class="deltaClass(row.deltaPick)"
                  >
                    {{ fmtDelta(row.deltaPick) }}
                  </div>
                </div>
                <div class="min-w-0 shrink">
                  <div class="text-[10px] font-medium uppercase tracking-wide text-text/55">
                    {{ p.t('statisticsPage.overviewDetailWinRate') }}
                  </div>
                  <div
                    class="text-xl font-bold tabular-nums leading-none sm:text-2xl"
                    :class="winrateClass(row.winrate)"
                  >
                    {{ fmtPct(row.winrate) }}
                  </div>
                  <div
                    class="mt-0.5 text-xs tabular-nums leading-none"
                    :class="deltaClass(row.deltaWin)"
                  >
                    {{ fmtDelta(row.deltaWin) }}
                  </div>
                </div>
              </button>
            </div>
            <div
              v-if="expandedItemKeys.has(itemRowKey(row))"
              class="space-y-2 border-t border-primary/20 bg-black/20 px-3 py-2.5 text-sm text-text/85"
            >
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="rounded bg-primary/10 px-2 py-1.5">
                  <div class="text-[10px] uppercase text-text/55">
                    {{ p.t('statisticsPage.itemsColGoldValue') }}
                  </div>
                  <div class="font-bold tabular-nums text-text">
                    {{ fmtGoldValue(row.goldValue) }}
                  </div>
                </div>
                <div class="rounded bg-primary/10 px-2 py-1.5">
                  <div class="text-[10px] uppercase text-text/55">
                    {{ p.t('statisticsPage.itemsColGoldEfficiency') }}
                  </div>
                  <div class="font-bold tabular-nums text-text">
                    {{ fmtGoldEfficiency(row) }}
                  </div>
                </div>
                <div class="rounded bg-primary/10 px-2 py-1.5">
                  <div class="text-[10px] uppercase text-text/55">
                    {{ p.t('statisticsPage.games') }}
                  </div>
                  <div class="font-bold tabular-nums text-text">
                    {{ row.games.toLocaleString() }}
                  </div>
                </div>
                <div class="rounded bg-primary/10 px-2 py-1.5">
                  <div class="text-[10px] uppercase text-text/55">
                    {{ p.t('statisticsPage.wins') }}
                  </div>
                  <div class="font-bold tabular-nums text-text">
                    {{ row.wins.toLocaleString() }}
                  </div>
                </div>
              </div>
              <StatisticsItemDetailLink
                :item-id="row.itemId"
                class="block text-center text-xs font-medium text-accent underline decoration-accent/40 underline-offset-2"
                :stop-propagation="false"
              >
              </StatisticsItemDetailLink>
            </div>
          </article>
        </div>

        <div class="it-dtable-wrap hidden md:block">
          <table class="it-dtable">
            <thead>
              <tr class="it-dhead">
                <th
                  v-for="col in desktopColumns"
                  :key="col.sort"
                  scope="col"
                  :class="[col.cls, { 'is-sorted': sortBy === col.sort }]"
                  :title="col.tooltipKey ? p.t(col.tooltipKey) : undefined"
                  :aria-sort="
                    sortBy === col.sort ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
                  "
                >
                  <button type="button" class="it-dsort" @click="toggleSort(col.sort)">
                    {{ p.t(col.labelKey) }}
                    <svg
                      v-if="sortBy === col.sort"
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      aria-hidden="true"
                      :style="sortDir === 'asc' ? 'transform:rotate(180deg)' : ''"
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
                    v-if="hasComparison && col.deltaSort"
                    type="button"
                    class="it-dsort-delta"
                    :class="{ 'is-on': sortBy === col.deltaSort }"
                    @click="toggleSort(col.deltaSort)"
                  >
                    {{ p.t('statisticsPage.championTableDeltaSymbol') }}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in paginatedRows" :key="`${row.type}-${row.itemId}`" class="it-drow">
                <th scope="row" class="it-dleft it-ditem">
                  <div class="it-ditem-cell">
                    <img
                      v-if="p.itemImageName(row.itemId)"
                      loading="lazy"
                      decoding="async"
                      :src="p.getItemImageUrl(p.gameVersion, p.itemImageName(row.itemId)!)"
                      alt=""
                      class="it-dicon"
                      width="32"
                      height="32"
                    />
                    <span class="min-w-0">
                      <StatisticsItemDetailLink :item-id="row.itemId" class="it-dname">
                        {{ p.itemName(row.itemId) || row.itemId }}
                      </StatisticsItemDetailLink>
                      <span v-if="itemTypeFilter === 'all'" class="it-dtype">{{
                        typeLabel(row.type)
                      }}</span>
                    </span>
                  </div>
                </th>
                <td class="it-dnum it-dmuted">{{ fmtGoldValue(row.goldValue) }}</td>
                <td class="it-dnum it-dmuted">{{ fmtGoldEfficiency(row) }}</td>
                <td class="it-dbar-cell">
                  <div class="it-dbar-row">
                    <span class="it-dbar" aria-hidden="true">
                      <span
                        class="it-dbar-fill"
                        :style="{
                          width: championMobileBarPct(Number(row.pickrate) || 0, pickrateMax) + '%',
                        }"
                      />
                    </span>
                    <span class="it-dval it-dstrong">{{ fmtPct(row.pickrate) }}</span>
                  </div>
                  <span
                    v-if="showDelta(row.deltaPick)"
                    class="it-ddelta it-ddelta-bar"
                    :class="`is-${deltaTone(row.deltaPick!)}`"
                    >{{ fmtDelta(row.deltaPick) }}</span
                  >
                </td>
                <td class="it-dnum it-dlast">
                  <span class="it-dval">{{ fmtPct(row.winrate) }}</span>
                  <span
                    v-if="showDelta(row.deltaWin)"
                    class="it-ddelta"
                    :class="`is-${deltaTone(row.deltaWin!)}`"
                    >{{ fmtDelta(row.deltaWin) }}</span
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <StatisticsRangePagination
          v-model:page="page"
          v-model:page-size="pageSize"
          class="statistics-items-pagination rounded-lg border border-primary/20 bg-surface/20 px-3 py-2 text-sm text-text/80 md:rounded-none md:border-t md:bg-transparent md:px-4"
          :total-count="totalRowsCount"
          :total-pages="totalPages"
        >
          {{ totalRowsCount }} {{ p.t('statisticsPage.overviewDetailItems') }}
        </StatisticsRangePagination>
      </div>
      <StatisticsItemSetsOverviewPanel
        v-if="itemSetsData && itemSetsData.itemSets.length > 0"
        class="mt-4"
        :game-version="p.gameVersion || p.versionStore.currentVersion || ''"
        :data="itemSetsData"
        :baseline="itemSetsBaseline"
        :baseline-pending="p.overviewDetailBaselinePending"
        :comparison-version="p.overviewDetailComparisonVersion"
      />
    </template>
    <div v-else class="text-text/70">{{ p.t('statisticsPage.overviewDetailNoData') }}</div>
  </div>
</template>

<style scoped>
.it-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.items-type {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.items-type-btn {
  height: 36px;
  padding: 0 14px;
  border: 1px solid #0a323c;
  border-radius: 18px;
  background: transparent;
  color: #cbc3b0;
  font-size: 14px;
  cursor: pointer;
}
.items-type-btn:hover {
  color: #f0e6d2;
}
.items-type-btn.is-active {
  border-color: #0a323c;
  background: #0a323c;
  color: #f0e6d2;
  font-weight: 600;
}
.it-dtable-wrap {
  overflow-x: auto;
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
}
.it-dtable {
  width: 100%;
  min-width: 900px;
  border-collapse: collapse;
  font-size: 14px;
  color: #f0e6d2;
}
.it-dhead th {
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 600;
  color: #a09b8c;
  border-bottom: 1px solid #0a323c;
  white-space: nowrap;
}
.it-dhead th.is-sorted {
  color: #c8aa6e;
}
.it-dsort {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: inherit;
}
.it-dsort:hover {
  color: #f0e6d2;
}
.it-dsort-delta {
  margin-left: 4px;
  font-size: 11px;
  color: #5b5a56;
}
.it-dsort-delta.is-on,
.it-dsort-delta:hover {
  color: #c8aa6e;
}
.it-dleft {
  text-align: left;
}
.it-dhead th:first-child,
.it-ditem {
  padding-left: 20px;
}
.it-dnum {
  text-align: right;
  padding: 10px 16px;
  white-space: nowrap;
  vertical-align: middle;
}
.it-dhead th.it-dlast,
.it-dlast {
  padding-right: 20px;
}
.it-ditem {
  padding-top: 10px;
  padding-bottom: 10px;
  font-weight: 500;
}
.it-ditem-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}
.it-dicon {
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 6px;
  object-fit: cover;
}
.it-dname {
  display: block;
  text-align: left;
  color: #f0e6d2;
}
.it-dname:hover {
  color: #c8aa6e;
}
.it-dtype {
  display: block;
  font-size: 11px;
  font-weight: 400;
  color: #5b5a56;
}
.it-dmuted {
  color: #cbc3b0;
  font-variant-numeric: tabular-nums;
}
.it-drow {
  border-bottom: 1px solid #1e2328;
}
.it-drow:hover {
  background: #0e1a2e;
}
.it-dval {
  display: block;
  font-variant-numeric: tabular-nums;
}
.it-dstrong {
  font-weight: 600;
}
.it-ddelta {
  display: block;
  font-size: 11px;
  line-height: 1.2;
  color: #5b5a56;
}
.it-ddelta-bar {
  text-align: right;
}
.it-ddelta.is-up {
  color: #0ac8b9;
}
.it-ddelta.is-down {
  color: #e2665a;
}
.it-dbar-cell {
  min-width: 240px;
  padding: 10px 16px;
  vertical-align: middle;
}
.it-dbar-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.it-dbar {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: #1e2328;
  overflow: hidden;
}
.it-dbar-fill {
  display: block;
  height: 100%;
  background: #c89b3c;
  border-radius: 4px;
}
.it-dbar-row .it-dval {
  width: 64px;
  text-align: right;
}
</style>
