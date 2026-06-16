<script setup lang="ts">
import { computed, inject, ref, watch, unref } from 'vue'
import type { Item } from '@lelanation/shared-types'
import { useItemsStore } from '~/stores/ItemsStore'
import type { StatisticsMobileSortOption } from '~/components/statistics/StatisticsMobileSortBar.vue'
import {
  formatItemGoldEfficiency,
  getItemGoldEfficiency,
  getItemGoldValue,
} from '~/utils/formatItemStats'

const p = inject('statisticsPageCtx') as any
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

const sortBy = ref<SortKey | null>(null)
const sortDir = ref<'asc' | 'desc'>('desc')
const pageSize = ref<number>(20)
const page = ref<number>(1)
const expandedItemKeys = ref<Set<string>>(new Set())

function itemRowKey(row: TableRow): string {
  return `${row.type}:${row.itemId}`
}

function toggleItemCardExpanded(key: string): void {
  const next = new Set(expandedItemKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedItemKeys.value = next
}
const itemTypeFilter = computed<'all' | ItemType>(() => {
  const v = String(p.itemsTypeFilter ?? 'all')
  return v === 'starter' || v === 'core' || v === 'boots' || v === 'final' ? v : 'all'
})
const legendaryOnly = computed(() => p.itemsLegendaryFilter === 'legendary')

const PAGE_SIZE_OPTIONS = computed<number[]>(() =>
  Array.isArray(p.PAGE_SIZE_OPTIONS) && p.PAGE_SIZE_OPTIONS.length > 0
    ? p.PAGE_SIZE_OPTIONS
    : [10, 20, 50, 100]
)

const baseRows = computed<TableRow[]>(() => {
  const d = p.overviewDetailData
  if (!d) return []

  const pushTyped = (type: ItemType, rows: RawItemRow[] | undefined, out: TableRow[]) => {
    for (const row of rows ?? []) {
      const item = itemById.value.get(row.itemId)
      out.push({
        ...row,
        type,
        deltaPick: null,
        deltaWin: null,
        goldValue: item ? getItemGoldValue(item) : null,
        goldEfficiency: item ? getItemGoldEfficiency(item) : null,
      })
    }
  }

  const out: TableRow[] = []
  pushTyped('starter', d.itemsStarters, out)
  pushTyped('core', d.itemsCores, out)
  pushTyped('boots', d.itemsBoots, out)
  pushTyped('final', d.itemsFinals, out)
  return out
})

const baselineByKey = computed<Map<string, RawItemRow>>(() => {
  const b = p.overviewDetailBaselineData
  const map = new Map<string, RawItemRow>()
  if (!b) return map
  const add = (type: ItemType, rows: RawItemRow[] | undefined) => {
    for (const row of rows ?? []) map.set(`${type}:${row.itemId}`, row)
  }
  add('starter', b.itemsStarters)
  add('core', b.itemsCores)
  add('boots', b.itemsBoots)
  add('final', b.itemsFinals)
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
    const baseline = baselineByKey.value.get(`${row.type}:${row.itemId}`)
    return {
      ...row,
      deltaPick: deltaWhenComparison(row.pickrate, baseline?.pickrate),
      deltaWin: deltaWhenComparison(row.winrate, baseline?.winrate),
    }
  })
)

const itemSearchQuery = computed(() =>
  String(unref(p.championSearchQuery) ?? '')
    .trim()
    .toLowerCase()
)

const itemById = computed<Map<number, Item>>(
  () => new Map(itemsStore.items.map(i => [Number(i.id), i] as const))
)

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
    const name = (p.itemName(r.itemId) || '').toLowerCase()
    return name.includes(q) || String(r.itemId).includes(q)
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

const totalRowsCount = computed(() => sortedRows.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalRowsCount.value / pageSize.value)))
const paginatedRows = computed(() => {
  const pnum = Math.min(page.value, totalPages.value)
  const start = (pnum - 1) * pageSize.value
  return sortedRows.value.slice(start, start + pageSize.value)
})

watch([itemTypeFilter, sortBy, sortDir, pageSize, itemSearchQuery], () => {
  page.value = 1
})

function toggleSort(key: SortKey) {
  if (sortBy.value !== key) {
    // First click: descending, as requested.
    sortBy.value = key
    sortDir.value = 'desc'
    return
  }
  if (sortDir.value === 'desc') {
    sortDir.value = 'asc'
    return
  }
  // Third click: back to default (no explicit sort).
  sortBy.value = null
  sortDir.value = 'desc'
}

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

function sortIcon(key: SortKey): string {
  if (sortBy.value !== key) return ' ↕'
  return sortDir.value === 'asc' ? ' ▲' : ' ▼'
}

function winrateClass(value: number | null | undefined): string {
  if (value == null) return 'text-text/55'
  if (value > 51) return 'text-green-400/90'
  if (value < 49) return 'text-red-400/90'
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
    <template v-else-if="tableRows.length > 0 || (p.overviewDetailData?.itemSets?.length ?? 0) > 0">
      <StatisticsItemSetsOverviewPanel
        v-if="p.overviewDetailData?.itemSets?.length"
        :game-version="p.gameVersion || p.versionStore.currentVersion || ''"
        :data="p.overviewDetailData"
        :baseline="p.overviewDetailBaselineData"
        :baseline-pending="p.overviewDetailBaselinePending"
        :comparison-version="p.overviewDetailComparisonVersion"
      />
      <div v-if="tableRows.length > 0" class="statistics-items-tab space-y-3">
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
            class="statistics-champion-stats-mobile-card statistics-item-mobile-card w-full overflow-hidden rounded-lg border border-primary/30 bg-surface/40"
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

        <div
          class="statistics-overview-surface hidden w-full overflow-x-auto rounded-lg border border-primary/30 md:block"
        >
          <div class="tier-list-lolalytics w-full min-w-[1180px] text-[13px]">
            <div
              class="tier-list-lolalytics-head sticky top-0 z-10 flex h-auto min-h-8 w-full items-stretch justify-between border-b border-black bg-[var(--color-grey-300)] text-text-primary/85"
            >
              <button
                type="button"
                class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex w-[320px] shrink-0 items-center justify-start border-b border-black px-2 hover:bg-primary/25"
                :title="p.t('statisticsPage.itemsTooltipItem')"
                @click="toggleSort('item')"
              >
                {{ p.t('statisticsPage.overviewDetailItems') }}{{ sortIcon('item') }}
              </button>
              <div
                class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex w-[160px] shrink-0 flex-col justify-center border-b border-black px-2 py-1"
                :title="p.t('statisticsPage.itemsTooltipType')"
              >
                <button
                  type="button"
                  class="w-fit hover:bg-primary/25"
                  :title="p.t('statisticsPage.itemsTooltipType')"
                  @click="toggleSort('type')"
                >
                  {{ p.t('statisticsPage.itemsColType') }}{{ sortIcon('type') }}
                </button>
              </div>
              <button
                type="button"
                class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex w-[100px] shrink-0 items-center justify-center border-b border-black hover:bg-primary/25"
                @click="toggleSort('goldValue')"
              >
                {{ p.t('statisticsPage.itemsColGoldValue') }}{{ sortIcon('goldValue') }}
              </button>
              <button
                type="button"
                class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex w-[100px] shrink-0 items-center justify-center border-b border-black hover:bg-primary/25"
                @click="toggleSort('goldEfficiency')"
              >
                {{ p.t('statisticsPage.itemsColGoldEfficiency') }}{{ sortIcon('goldEfficiency') }}
              </button>
              <button
                type="button"
                class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex w-[120px] shrink-0 items-center justify-center border-b border-black hover:bg-primary/25"
                :title="p.t('statisticsPage.itemsTooltipPickrate')"
                @click="toggleSort('pickrate')"
              >
                {{ p.t('statisticsPage.overviewDetailPickRate') }} %{{ sortIcon('pickrate') }}
              </button>
              <button
                type="button"
                class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex w-[120px] shrink-0 items-center justify-center border-b border-black hover:bg-primary/25"
                :title="p.t('statisticsPage.itemsTooltipDeltaPick')"
                @click="toggleSort('deltaPick')"
              >
                {{ p.t('statisticsPage.itemsColDeltaPick') }}{{ sortIcon('deltaPick') }}
              </button>
              <button
                type="button"
                class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex w-[120px] shrink-0 items-center justify-center border-b border-black hover:bg-primary/25"
                :title="p.t('statisticsPage.itemsTooltipWinrate')"
                @click="toggleSort('winrate')"
              >
                {{ p.t('statisticsPage.overviewDetailWinRate') }} %{{ sortIcon('winrate') }}
              </button>
              <button
                type="button"
                class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex w-[120px] shrink-0 items-center justify-center border-b border-black hover:bg-primary/25"
                :title="p.t('statisticsPage.itemsTooltipDeltaWin')"
                @click="toggleSort('deltaWin')"
              >
                {{ p.t('statisticsPage.itemsColDeltaWin') }}{{ sortIcon('deltaWin') }}
              </button>
            </div>

            <div
              v-for="row in paginatedRows"
              :key="`${row.type}-${row.itemId}`"
              class="tier-list-lolalytics-row flex min-h-[52px] w-full items-center justify-between py-0.5 text-text-primary/90 odd:bg-white/[0.04] even:bg-black/25 hover:brightness-110"
            >
              <div class="tier-list-lolalytics-td flex w-[320px] shrink-0 items-center gap-2 px-2">
                <img
                  v-if="p.itemImageName(row.itemId)"
                  :src="p.getItemImageUrl(p.gameVersion, p.itemImageName(row.itemId)!)"
                  :alt="p.itemName(row.itemId) || ''"
                  class="h-[50px] w-[50px] shrink-0 rounded border border-black/30 object-cover"
                  width="50"
                  height="50"
                />
                <StatisticsItemDetailLink :item-id="row.itemId" class="min-w-0 truncate text-left">
                  <span class="font-medium text-accent underline decoration-accent/40">{{
                    p.itemName(row.itemId) || row.itemId
                  }}</span>
                </StatisticsItemDetailLink>
              </div>
              <div
                class="tier-list-lolalytics-td flex w-[160px] shrink-0 items-center px-2 text-text/90"
              >
                {{ typeLabel(row.type) }}
              </div>
              <div
                class="tier-list-lolalytics-td flex w-[100px] shrink-0 items-center justify-center tabular-nums text-text/90"
              >
                {{ fmtGoldValue(row.goldValue) }}
              </div>
              <div
                class="tier-list-lolalytics-td flex w-[100px] shrink-0 items-center justify-center tabular-nums text-text/90"
              >
                {{ fmtGoldEfficiency(row) }}
              </div>
              <div
                class="tier-list-lolalytics-td flex w-[120px] shrink-0 items-center justify-center tabular-nums text-text/90"
              >
                {{ fmtPct(row.pickrate) }}
              </div>
              <div
                class="tier-list-lolalytics-td flex w-[120px] shrink-0 items-center justify-center tabular-nums"
                :class="deltaClass(row.deltaPick)"
              >
                {{ fmtDelta(row.deltaPick) }}
              </div>
              <div
                class="tier-list-lolalytics-td flex w-[120px] shrink-0 items-center justify-center tabular-nums"
                :class="winrateClass(row.winrate)"
              >
                {{ fmtPct(row.winrate) }}
              </div>
              <div
                class="tier-list-lolalytics-td flex w-[120px] shrink-0 items-center justify-center tabular-nums"
                :class="deltaClass(row.deltaWin)"
              >
                {{ fmtDelta(row.deltaWin) }}
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="totalRowsCount > 0"
          class="statistics-items-pagination flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-surface/20 px-3 py-2 text-sm text-text/80 md:rounded-none md:border-t md:bg-transparent md:px-4"
        >
          <span>{{ totalRowsCount }} {{ p.t('statisticsPage.overviewDetailItems') }}</span>
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-1.5">
              <span class="text-text/70">{{ p.t('statisticsPage.perPage') }}</span>
              <select
                v-model.number="pageSize"
                class="rounded border border-primary/40 bg-background px-2 py-1 text-text"
              >
                <option v-for="n in PAGE_SIZE_OPTIONS" :key="n" :value="n">{{ n }}</option>
              </select>
            </label>
            <span class="text-text/70">
              {{ (page - 1) * pageSize + 1 }}-{{ Math.min(page * pageSize, totalRowsCount) }} /
              {{ totalRowsCount }}
            </span>
            <div class="flex gap-1">
              <button
                type="button"
                class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                :disabled="page <= 1"
                @click="page = Math.max(1, page - 1)"
              >
                ‹
              </button>
              <button
                type="button"
                class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                :disabled="page >= totalPages"
                @click="page = Math.min(totalPages, page + 1)"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
    <div v-else class="text-text/70">{{ p.t('statisticsPage.overviewDetailNoData') }}</div>
  </div>
</template>
