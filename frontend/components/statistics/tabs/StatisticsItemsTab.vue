<script setup lang="ts">
import { computed, inject, ref, watch, unref } from 'vue'
import type { Item } from '@lelanation/shared-types'
import { useItemsStore } from '~/stores/ItemsStore'

const p = inject('statisticsPageCtx') as any
const itemsStore = useItemsStore()

type ItemType = 'starter' | 'core' | 'boots' | 'final'
type SortKey = 'item' | 'type' | 'pickrate' | 'winrate' | 'deltaPick' | 'deltaWin'

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
}

const sortBy = ref<SortKey | null>(null)
const sortDir = ref<'asc' | 'desc'>('desc')
const pageSize = ref<number>(20)
const page = ref<number>(1)
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
      out.push({
        ...row,
        type,
        deltaPick: null,
        deltaWin: null,
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

function fmtPct(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${Number(value).toFixed(2)}%`
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
    <template v-else-if="tableRows.length > 0">
      <div
        class="statistics-overview-surface w-full overflow-x-auto rounded-lg border border-primary/30"
      >
        <div class="tier-list-lolalytics w-full min-w-[980px] text-[13px]">
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
              <span class="min-w-0 truncate text-left font-medium text-accent">{{
                p.itemName(row.itemId) || row.itemId
              }}</span>
            </div>
            <div
              class="tier-list-lolalytics-td flex w-[160px] shrink-0 items-center px-2 text-text/90"
            >
              {{ typeLabel(row.type) }}
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

        <div
          v-if="totalRowsCount > 0"
          class="flex flex-wrap items-center justify-between gap-2 border-t border-primary/20 px-4 py-2 text-sm text-text/80"
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
