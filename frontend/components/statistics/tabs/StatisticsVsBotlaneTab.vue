<script setup lang="ts">
import { computed, inject, ref, unref, watch } from 'vue'
import { getChampionImageUrl } from '~/utils/imageUrl'

const p = inject('statisticsPageCtx') as any

const isRanking = computed(() => unref(p.botlaneTierMode) === 'ranking')

type SortKey = 'rank' | 'winrate' | 'delta' | 'note' | 'tier' | 'games'

type Row = {
  rank: number
  adcId: number
  supportId: number
  oppAdcId: number
  oppSupportId: number
  games: number
  wins: number
  winrate: number
  deltaVsPeersPp: number | null
  note: number
  tier: string
}

const sortBy = ref<SortKey>('rank')
const sortDir = ref<'asc' | 'desc'>('asc')
const pageSize = ref(20)
const page = ref(1)

const PAGE_SIZE_OPTIONS = computed<number[]>(() =>
  Array.isArray(p.PAGE_SIZE_OPTIONS) && p.PAGE_SIZE_OPTIONS.length > 0
    ? p.PAGE_SIZE_OPTIONS
    : [10, 20, 50, 100]
)

const rows = computed<Row[]>(() =>
  isRanking.value ? (p.botlaneRankingData?.rows ?? []) : (p.botlaneVsData?.rows ?? [])
)

const activePending = computed(() =>
  isRanking.value ? Boolean(unref(p.botlaneRankingPending)) : Boolean(unref(p.botlaneVsPending))
)

const activeError = computed(() =>
  isRanking.value ? Boolean(unref(p.botlaneRankingError)) : Boolean(unref(p.botlaneVsError))
)

const searchQ = computed(() =>
  String(unref(p.championSearchQuery) ?? '')
    .trim()
    .toLowerCase()
)

function champText(id: number): string {
  const n = p.championName(id)
  return `${(n || '').toLowerCase()} ${id}`
}

const filteredRows = computed(() => {
  const q = searchQ.value
  if (!q) return rows.value
  return rows.value.filter(r => {
    const parts = [champText(r.adcId), champText(r.supportId)]
    if (!isRanking.value && r.oppAdcId && r.oppSupportId) {
      parts.push(champText(r.oppAdcId), champText(r.oppSupportId))
    }
    return parts.join(' ').includes(q)
  })
})

function sortIcon(key: SortKey): string {
  if (sortBy.value !== key) return ' ↕'
  return sortDir.value === 'asc' ? ' ▲' : ' ▼'
}

function toggleSort(key: SortKey) {
  if (sortBy.value !== key) {
    sortBy.value = key
    sortDir.value = key === 'rank' || key === 'games' ? 'asc' : 'desc'
    return
  }
  if (sortDir.value === 'desc') {
    sortDir.value = 'asc'
    return
  }
  sortDir.value = 'desc'
}

const TIER_ORDER: Record<string, number> = { 'S+': 6, S: 5, A: 4, B: 3, C: 2, D: 1, F: 1 }

const sortedRows = computed(() => {
  const out = [...filteredRows.value]
  const dir = sortDir.value === 'asc' ? 1 : -1
  const key = sortBy.value
  out.sort((a, b) => {
    if (key === 'rank') return dir * (a.rank - b.rank)
    if (key === 'games') return dir * (a.games - b.games)
    if (key === 'winrate') return dir * (a.winrate - b.winrate)
    if (key === 'delta') {
      const av = a.deltaVsPeersPp ?? Number.NEGATIVE_INFINITY
      const bv = b.deltaVsPeersPp ?? Number.NEGATIVE_INFINITY
      return dir * (av - bv)
    }
    if (key === 'note') return dir * (a.note - b.note)
    if (key === 'tier') return dir * ((TIER_ORDER[a.tier] ?? 0) - (TIER_ORDER[b.tier] ?? 0))
    return 0
  })
  return out
})

const totalRowsCount = computed(() => sortedRows.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalRowsCount.value / pageSize.value)))
const paginatedRows = computed(() => {
  const pnum = Math.min(page.value, totalPages.value)
  const start = (pnum - 1) * pageSize.value
  return sortedRows.value.slice(start, start + pageSize.value)
})

watch([searchQ, pageSize, sortBy, sortDir], () => {
  page.value = 1
})

function fmtPct01(v: number): string {
  return `${(v * 100).toFixed(2)}%`
}

function fmtDeltaPp(v: number | null | undefined): string {
  if (v == null) return '—'
  const x = Number(v)
  return `${x >= 0 ? '+' : ''}${x.toFixed(2)} pp`
}

function deltaClass(v: number | null | undefined): string {
  if (v == null) return 'text-text/55'
  if (v > 0.05) return 'text-green-400/90'
  if (v < -0.05) return 'text-red-400/90'
  return 'text-text/75'
}

function tierLabel(tier: string): string {
  switch (tier) {
    case 'S+':
      return p.t('statisticsPage.tierS+')
    case 'S':
      return p.t('statisticsPage.tierS')
    case 'A':
      return p.t('statisticsPage.tierA')
    case 'B':
      return p.t('statisticsPage.tierB')
    case 'C':
      return p.t('statisticsPage.tierC')
    default:
      return p.t('statisticsPage.tierF')
  }
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="activePending" class="text-text/70">
      {{ p.t('statisticsPage.loading') }}
    </div>
    <div v-else-if="activeError" class="rounded border border-error bg-surface p-3 text-error">
      {{
        isRanking
          ? p.t('statisticsPage.vsBotlaneRankingLoadError')
          : p.t('statisticsPage.vsBotlaneLoadError')
      }}
    </div>
    <div
      v-else-if="rows.length === 0"
      class="statistics-overview-surface rounded-lg border border-primary/30 p-4 text-text/70"
    >
      {{
        isRanking
          ? p.t('statisticsPage.vsBotlaneRankingNoData')
          : p.t('statisticsPage.vsBotlaneNoData')
      }}
    </div>
    <div
      v-else
      class="tier-list-mobile-rotate statistics-overview-surface w-full overflow-x-auto rounded-lg border border-primary/30"
    >
      <div class="tier-list-lolalytics w-full min-w-0 text-[13px] max-lg:min-w-[600px]">
        <div
          class="tier-list-lolalytics-head sticky top-0 z-10 flex h-auto min-h-8 w-full items-stretch justify-between border-b border-black bg-[var(--color-grey-300)] text-text-primary/85"
        >
          <button
            type="button"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex w-10 shrink-0 items-center justify-center border-b border-black px-0.5 hover:bg-primary/25"
            @click="toggleSort('rank')"
          >
            {{ p.t('statisticsPage.tierListRank') }}{{ sortIcon('rank') }}
          </button>
          <div
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex w-[88px] shrink-0 items-center justify-center border-b border-black px-1"
          >
            {{
              isRanking
                ? p.t('statisticsPage.tierListBotlaneDuoLabel')
                : p.t('statisticsPage.vsBotlaneOurDuo')
            }}
          </div>
          <div
            v-if="!isRanking"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex w-[88px] shrink-0 items-center justify-center border-b border-black px-1"
          >
            {{ p.t('statisticsPage.vsBotlaneEnemyDuo') }}
          </div>
          <button
            type="button"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex w-10 shrink-0 items-center justify-center border-b border-black hover:bg-primary/25"
            :title="p.t('statisticsPage.tierListTierTooltip')"
            @click="toggleSort('tier')"
          >
            {{ p.t('statisticsPage.tierListTier') }}{{ sortIcon('tier') }}
          </button>
          <button
            type="button"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex w-12 shrink-0 items-center justify-center border-b border-black hover:bg-primary/25"
            @click="toggleSort('winrate')"
          >
            {{ p.t('statisticsPage.winrate') }}{{ sortIcon('winrate') }}
          </button>
          <button
            type="button"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-w-[88px] shrink-0 items-center justify-center border-b border-black px-0.5 text-center hover:bg-primary/25"
            :title="
              isRanking
                ? p.t('statisticsPage.vsBotlaneDeltaGlobalTooltip')
                : p.t('statisticsPage.vsBotlaneDeltaTooltip')
            "
            @click="toggleSort('delta')"
          >
            {{
              isRanking
                ? p.t('statisticsPage.vsBotlaneDeltaGlobalShort')
                : p.t('statisticsPage.vsBotlaneDeltaShort')
            }}{{ sortIcon('delta') }}
          </button>
          <button
            type="button"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex w-14 shrink-0 items-center justify-center border-b border-black hover:bg-primary/25"
            :title="p.t('statisticsPage.tierListPbiTooltip')"
            @click="toggleSort('note')"
          >
            {{ p.t('statisticsPage.tierListPbi') }}{{ sortIcon('note') }}
          </button>
          <button
            type="button"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex w-12 shrink-0 items-center justify-center border-b border-black hover:bg-primary/25"
            @click="toggleSort('games')"
          >
            {{ p.t('statisticsPage.tierListGames') }}{{ sortIcon('games') }}
          </button>
        </div>

        <div
          v-for="row in paginatedRows"
          :key="
            isRanking
              ? `rk-${row.adcId}-${row.supportId}`
              : `${row.adcId}-${row.supportId}-${row.oppAdcId}-${row.oppSupportId}`
          "
          class="tier-list-lolalytics-row flex min-h-[44px] w-full items-center justify-between py-0.5 text-text-primary/90 odd:bg-white/[0.04] even:bg-black/25"
        >
          <div
            class="tier-list-lolalytics-td flex w-10 shrink-0 items-center justify-center tabular-nums"
          >
            {{ row.rank }}
          </div>
          <div
            class="tier-list-lolalytics-td flex w-[88px] shrink-0 items-center justify-center gap-1 px-1"
          >
            <template v-if="p.gameVersion">
              <img
                v-if="p.championByKey(row.adcId)"
                :src="getChampionImageUrl(p.gameVersion, p.championByKey(row.adcId)!.image.full)"
                :alt="p.championName(row.adcId) || ''"
                class="h-8 w-8 shrink-0 border border-black object-cover"
                width="32"
                height="32"
              />
              <img
                v-if="p.championByKey(row.supportId)"
                :src="
                  getChampionImageUrl(p.gameVersion, p.championByKey(row.supportId)!.image.full)
                "
                :alt="p.championName(row.supportId) || ''"
                class="h-8 w-8 shrink-0 border border-black object-cover"
                width="32"
                height="32"
              />
            </template>
          </div>
          <div
            v-if="!isRanking"
            class="tier-list-lolalytics-td flex w-[88px] shrink-0 items-center justify-center gap-1 px-1"
          >
            <template v-if="p.gameVersion">
              <img
                v-if="p.championByKey(row.oppAdcId)"
                :src="getChampionImageUrl(p.gameVersion, p.championByKey(row.oppAdcId)!.image.full)"
                :alt="p.championName(row.oppAdcId) || ''"
                class="h-8 w-8 shrink-0 border border-black object-cover"
                width="32"
                height="32"
              />
              <img
                v-if="p.championByKey(row.oppSupportId)"
                :src="
                  getChampionImageUrl(p.gameVersion, p.championByKey(row.oppSupportId)!.image.full)
                "
                :alt="p.championName(row.oppSupportId) || ''"
                class="h-8 w-8 shrink-0 border border-black object-cover"
                width="32"
                height="32"
              />
            </template>
          </div>
          <div class="tier-list-lolalytics-td flex w-10 shrink-0 items-center justify-center">
            <span
              :class="[
                'inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded px-0.5 text-[11px] font-bold leading-none text-background',
                row.tier === 'S+' && 'bg-[#f5c542]',
                row.tier === 'S' && 'bg-[#22c55e]',
                row.tier === 'A' && 'bg-[#2563eb]',
                row.tier === 'B' && 'bg-[#60a5fa]',
                row.tier === 'C' && 'bg-[#a855f7]',
                (row.tier === 'D' || row.tier === 'F') && 'bg-[#dc2626]',
              ]"
            >
              {{ tierLabel(row.tier) }}
            </span>
          </div>
          <div
            class="tier-list-lolalytics-td flex w-12 shrink-0 items-center justify-center tabular-nums"
            :class="p.tierListWinrateClass(row.winrate * 100)"
          >
            {{ fmtPct01(row.winrate) }}
          </div>
          <div
            class="tier-list-lolalytics-td flex min-w-[88px] shrink-0 items-center justify-center text-[11px] tabular-nums"
            :class="deltaClass(row.deltaVsPeersPp)"
          >
            {{ fmtDeltaPp(row.deltaVsPeersPp) }}
          </div>
          <div
            class="tier-list-lolalytics-td flex w-14 shrink-0 items-center justify-center text-[11px] tabular-nums text-text/90"
          >
            {{ row.note.toFixed(2) }}
          </div>
          <div
            class="tier-list-lolalytics-td flex w-12 shrink-0 items-center justify-center tabular-nums text-text/80"
          >
            {{ row.games.toLocaleString() }}
          </div>
        </div>

        <div
          v-if="totalRowsCount > 0"
          class="flex flex-wrap items-center justify-between gap-2 border-t border-primary/20 px-4 py-2 text-sm text-text/80"
        >
          <span>{{
            isRanking
              ? `${totalRowsCount} ${p.t('statisticsPage.vsBotlaneRankingRowsLabel')}`
              : `${totalRowsCount} ${p.t('statisticsPage.vsBotlaneRowsLabel')}`
          }}</span>
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
    </div>
  </div>
</template>
