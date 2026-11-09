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
import {
  formatItemGoldEfficiency,
  getItemGoldEfficiency,
  getItemGoldValue,
} from '~/utils/formatItemStats'
import { matchesItemSearch } from '~/utils/multilingualEntitySearch'
import { barPct } from '~/utils/statistics/barPct'
import { surrenderDeltaView } from '~/utils/statistics/surrenderDivisionRows'
import {
  ITEM_TYPE_CHIPS,
  countItemTypes,
  type ItemTypeChip,
} from '~/utils/statistics/itemTypeCounts'

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

const { sortBy, sortDir, toggleSort, sortIcon } = useTableSort<SortKey>({ resettable: true })

const itemTypeFilter = computed<'all' | ItemType>(() => {
  const v = String(p.itemsTypeFilter ?? 'all')
  return v === 'starter' || v === 'core' || v === 'boots' || v === 'final' ? v : 'all'
})
const legendaryOnly = computed(() => p.itemsLegendaryFilter === 'legendary')

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

const itemTypeCounts = computed(() => countItemTypes(tableRows.value))
const ITEM_CHIP_KEYS: Record<ItemTypeChip, string> = {
  all: 'statisticsPage.itemsTypeAll',
  final: 'statisticsPage.itemsChipFinal',
  core: 'statisticsPage.itemsChipCore',
  boots: 'statisticsPage.itemsChipBoots',
  starter: 'statisticsPage.itemsChipStarter',
}
const itemTypeChipLabel = (chip: ItemTypeChip) => p.t(ITEM_CHIP_KEYS[chip])
const setItemTypeChip = (chip: ItemTypeChip) => {
  p.itemsTypeFilter = chip
}

const itemSearchQuery = computed(() => String(unref(p.championSearchQuery) ?? '').trim())

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

function fmtGoldEfficiency(row: TableRow): string {
  const item = itemById.value.get(row.itemId)
  if (!item) return '—'
  return formatItemGoldEfficiency(item)
}

function fmtEffLoc(row: TableRow): string {
  const raw = fmtGoldEfficiency(row)
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return `${fmtNum(n, 0)} %`
}

const { locale } = useI18n()
const maxPick = computed(() => Math.max(0, ...filteredRows.value.map(r => Number(r.pickrate) || 0)))
function fmtNum(v: number, digits: number): string {
  return v.toLocaleString(locale.value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}
function fmtPctLoc(v: number | null | undefined, digits: number): string {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  return `${fmtNum(Number(v), digits)} %`
}
function fmtCost(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return '—'
  return fmtNum(Math.round(v), 0)
}
function fmtDeltaPts(v: number | null | undefined): string {
  if (!hasComparison.value || p.overviewDetailBaselinePending) return ''
  const d = surrenderDeltaView(v)
  if (d.abs == null) return ''
  if (d.abs < 0.005) return '='
  return d.dir === 'up' ? `▲ +${fmtNum(d.abs, 2)}` : `▼ −${fmtNum(d.abs, 2)}`
}
function deltaTone(v: number | null | undefined): string {
  if (v == null || Math.abs(v) < 0.005) return ''
  return v > 0 ? 'is-up' : 'is-down'
}
</script>

<template>
  <div class="space-y-6 pt-2 md:pt-8">
    <div v-if="p.overviewDetailPending" class="text-text/70">
      {{ p.t('statisticsPage.loading') }}
    </div>
    <div v-else-if="p.overviewDetailError" class="rounded border border-error/50 p-3 text-error">
      {{ p.t('statisticsPage.overviewDetailTimeout') }}
    </div>
    <template v-else-if="tableRows.length > 0 || (p.overviewDetailData?.itemSets?.length ?? 0) > 0">
      <div v-if="tableRows.length > 0" class="statistics-items-tab space-y-3">
        <div class="it-head">
          <h2 class="it-title">{{ p.t('statisticsPage.itemsTitle') }}</h2>
          <div class="it-chips" role="group" :aria-label="p.t('statisticsPage.itemsTypeAria')">
            <button
              v-for="chip in ITEM_TYPE_CHIPS"
              :key="chip"
              type="button"
              :class="['it-chip', itemTypeFilter === chip ? 'is-active' : '']"
              :aria-pressed="itemTypeFilter === chip"
              @click="setItemTypeChip(chip)"
            >
              {{ itemTypeChipLabel(chip)
              }}<template v-if="itemTypeFilter === chip"> · {{ itemTypeCounts[chip] }}</template>
            </button>
          </div>
        </div>
        <div class="it-mlist md:hidden">
          <div v-for="row in paginatedRows" :key="`m-${row.type}-${row.itemId}`" class="it-mrow">
            <img
              v-if="p.itemImageName(row.itemId) && p.gameVersion"
              class="it-micon"
              loading="lazy"
              decoding="async"
              :src="p.getItemImageUrl(p.gameVersion, p.itemImageName(row.itemId)!)"
              alt=""
              width="40"
              height="40"
            />
            <div class="it-mbody">
              <StatisticsItemDetailLink :item-id="row.itemId" class="it-mname">
                {{ p.itemName(row.itemId) || row.itemId }}
              </StatisticsItemDetailLink>
              <div class="it-mtrack">
                <div class="it-fill" :style="{ width: `${barPct(row.pickrate, maxPick)}%` }" />
              </div>
            </div>
            <div class="it-mnums">
              <span class="it-mpick">{{ fmtPctLoc(row.pickrate, 1) }}</span>
              <span class="it-msub">
                {{ p.t('statisticsPage.itemsMobileCost', { cost: fmtCost(row.goldValue) }) }} · WR
                {{ fmtPctLoc(row.winrate, 1) }}
              </span>
            </div>
          </div>
        </div>
        <div class="it-card hidden md:block">
          <table class="it-table">
            <thead>
              <tr>
                <th class="it-th-name">
                  <button type="button" @click="toggleSort('item')">
                    {{ p.t('statisticsPage.itemsColItem') }}{{ sortIcon('item') }}
                  </button>
                </th>
                <th class="it-r">
                  <button type="button" @click="toggleSort('goldValue')">
                    {{ p.t('statisticsPage.itemsColCost') }}{{ sortIcon('goldValue') }}
                  </button>
                </th>
                <th class="it-r">
                  <button type="button" @click="toggleSort('goldEfficiency')">
                    {{ p.t('statisticsPage.itemsColProfit') }}{{ sortIcon('goldEfficiency') }}
                  </button>
                </th>
                <th class="it-th-bar" :title="p.t('statisticsPage.itemsTooltipPickrate')">
                  <button type="button" @click="toggleSort('pickrate')">
                    {{ p.t('statisticsPage.itemsColBoughtIn') }}{{ sortIcon('pickrate') }}
                  </button>
                </th>
                <th class="it-r" :title="p.t('statisticsPage.itemsTooltipWinrate')">
                  <button type="button" @click="toggleSort('winrate')">
                    {{ p.t('statisticsPage.spellsColWr') }}{{ sortIcon('winrate') }}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in paginatedRows" :key="`${row.type}-${row.itemId}`">
                <td>
                  <div class="it-name">
                    <img
                      v-if="p.itemImageName(row.itemId) && p.gameVersion"
                      loading="lazy"
                      decoding="async"
                      :src="p.getItemImageUrl(p.gameVersion, p.itemImageName(row.itemId)!)"
                      alt=""
                      width="32"
                      height="32"
                    />
                    <StatisticsItemDetailLink :item-id="row.itemId" class="it-link">
                      {{ p.itemName(row.itemId) || row.itemId }}
                    </StatisticsItemDetailLink>
                  </div>
                </td>
                <td class="it-r it-num">{{ fmtCost(row.goldValue) }}</td>
                <td class="it-r it-num">{{ fmtEffLoc(row) }}</td>
                <td>
                  <div class="it-bar-wrap">
                    <div class="it-track">
                      <div
                        class="it-fill"
                        :style="{ width: `${barPct(row.pickrate, maxPick)}%` }"
                      />
                    </div>
                    <b>{{ fmtPctLoc(row.pickrate, 1) }}</b>
                  </div>
                </td>
                <td class="it-r">
                  <div class="it-num">{{ fmtPctLoc(row.winrate, 2) }}</div>
                  <div class="it-delta" :class="deltaTone(row.deltaWin)">
                    {{ fmtDeltaPts(row.deltaWin) }}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <StatisticsRangePagination
            v-model:page="page"
            v-model:page-size="pageSize"
            class="it-pagination"
            :total-count="totalRowsCount"
            :total-pages="totalPages"
          >
            {{ totalRowsCount }} {{ p.t('statisticsPage.overviewDetailItems') }}
          </StatisticsRangePagination>
        </div>
        <StatisticsRangePagination
          v-if="totalPages > 1"
          v-model:page="page"
          v-model:page-size="pageSize"
          class="rounded-lg border border-primary/20 bg-surface/20 px-3 py-2 text-sm text-text/80 md:hidden"
          :total-count="totalRowsCount"
          :total-pages="totalPages"
        >
          {{ totalRowsCount }} {{ p.t('statisticsPage.overviewDetailItems') }}
        </StatisticsRangePagination>
        <p class="it-foot">{{ p.t('statisticsPage.itemsFootNote') }}</p>
      </div>
    </template>
    <div v-else class="text-text/70">{{ p.t('statisticsPage.overviewDetailNoData') }}</div>
  </div>
</template>

<style scoped>
.it-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px 16px;
}
.it-title {
  font-size: 20px;
  font-weight: 600;
  color: #f0e6d2;
}
.it-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.it-chip {
  height: 36px;
  padding: 0 14px;
  border: 1px solid #1e2328;
  border-radius: 999px;
  font-size: 14px;
  color: #a09b8c;
  background: transparent;
}
.it-chip:hover {
  color: #f0e6d2;
}
.it-chip.is-active {
  background: #0a323c;
  border-color: #0a323c;
  color: #f0e6d2;
  font-weight: 600;
}
.it-card {
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
  overflow: hidden;
}
.it-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  color: #f0e6d2;
}
.it-table th {
  padding: 12px 20px;
  font-size: 12px;
  font-weight: 600;
  color: #a09b8c;
  text-align: left;
  border-bottom: 1px solid #0a323c;
  white-space: nowrap;
}
.it-table td {
  padding: 10px 20px;
  border-bottom: 1px solid #1e2328;
  vertical-align: middle;
}
.it-table tbody tr:last-child td {
  border-bottom: 0;
}
.it-table .it-r {
  text-align: right;
}
.it-th-name {
  width: 30%;
}
.it-th-bar {
  width: 34%;
}
.it-name {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 500;
}
.it-name img {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid #0a323c;
}
.it-link {
  color: #f0e6d2;
}
.it-link:hover {
  color: #c8aa6e;
}
.it-bar-wrap {
  display: flex;
  align-items: center;
  gap: 16px;
}
.it-track {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: #1e2328;
  overflow: hidden;
}
.it-fill {
  height: 100%;
  border-radius: 4px;
  background: #c8aa6e;
}
.it-bar-wrap b {
  min-width: 56px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.it-num {
  font-variant-numeric: tabular-nums;
}
.it-delta {
  font-size: 11px;
  color: #a09b8c;
  font-variant-numeric: tabular-nums;
}
.it-delta.is-up {
  color: #0ac8b9;
}
.it-delta.is-down {
  color: #e2665a;
}
.it-pagination {
  border-top: 1px solid #0a323c;
  padding: 10px 20px;
  font-size: 14px;
  color: #a09b8c;
}
.it-foot {
  font-size: 12px;
  color: #a09b8c;
}
.it-mlist {
  display: flex;
  flex-direction: column;
  padding: 4px 16px;
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
}
.it-mrow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #1e2328;
}
.it-mrow:last-child {
  border-bottom: 0;
}
.it-micon {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 6px;
}
.it-mbody {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8px;
}
.it-mname {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
  color: #f0e6d2;
}
.it-mtrack {
  height: 6px;
  border-radius: 3px;
  background: #1e2328;
  overflow: hidden;
}
.it-mnums {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 2px;
  width: 116px;
}
.it-mpick {
  font-size: 14px;
  font-weight: 700;
  color: #f0e6d2;
  font-variant-numeric: tabular-nums;
}
.it-msub {
  font-size: 11px;
  color: #a09b8c;
  white-space: nowrap;
}
@media (max-width: 767px) {
  .it-chips {
    flex-wrap: nowrap;
    overflow-x: auto;
    width: 100%;
    scrollbar-width: none;
  }
  .it-chip {
    flex: none;
  }
}
</style>
