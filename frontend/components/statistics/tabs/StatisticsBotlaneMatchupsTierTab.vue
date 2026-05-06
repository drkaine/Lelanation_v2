<script setup lang="ts">
import { computed, inject, ref, unref, watch } from 'vue'
import { getChampionImageUrl } from '~/utils/imageUrl'

const p = inject('statisticsPageCtx') as any

type SortKey = 'rank' | 'tier' | 'score' | 'winrate' | 'delta' | 'pickrate' | 'games'

type Row = {
  rank: number
  adcId: number
  supportId: number
  oppAdcId: number
  oppSupportId: number
  games: number
  wins: number
  winrate: number
  note: number
  tier: string
  deltaVsPeersPp: number | null
}

type VsPayload = {
  version?: string | null
  rankTier?: string | string[] | null
  rows?: Row[]
} | null

const props = defineProps<{
  vsData?: VsPayload
  vsPending?: boolean
  vsError?: boolean
}>()

type ViewRow = Row & { score: number; pickrate: number }

const sortBy = ref<SortKey>('rank')
const sortDir = ref<'asc' | 'desc'>('asc')
const pageSize = ref(20)
const page = ref(1)

const PAGE_SIZE_OPTIONS = computed<number[]>(() =>
  Array.isArray(p?.PAGE_SIZE_OPTIONS) && p.PAGE_SIZE_OPTIONS.length > 0
    ? p.PAGE_SIZE_OPTIONS
    : [10, 20, 50, 100]
)

const rows = computed<Row[]>(() => (props.vsData ?? p?.botlaneVsData)?.rows ?? [])

const activePending = computed(() =>
  Boolean(unref(props.vsPending !== undefined ? props.vsPending : p?.botlaneVsPending))
)
const activeError = computed(() =>
  Boolean(unref(props.vsError !== undefined ? props.vsError : p?.botlaneVsError))
)

const searchQ = computed(() =>
  String(unref(p?.championSearchQuery) ?? '')
    .trim()
    .toLowerCase()
)

function champText(id: number): string {
  const n = p?.championName?.(id)
  return `${(n || '').toLowerCase()} ${id}`
}

const totalGames = computed(() => rows.value.reduce((sum, row) => sum + Number(row.games || 0), 0))

const rowsWithMetrics = computed<ViewRow[]>(() => {
  const gTotal = Math.max(1, totalGames.value)
  return rows.value.map(row => ({
    ...row,
    score: Number(row.note ?? 0),
    pickrate: Number(row.games || 0) / gTotal,
  }))
})

const filteredRows = computed(() => {
  const q = searchQ.value
  if (!q) return rowsWithMetrics.value
  return rowsWithMetrics.value.filter(r => {
    const parts = [
      champText(r.adcId),
      champText(r.supportId),
      champText(r.oppAdcId),
      champText(r.oppSupportId),
    ]
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
    sortDir.value = key === 'rank' ? 'asc' : 'desc'
    return
  }
  sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
}

const TIER_ORDER: Record<string, number> = { 'S+': 6, S: 5, A: 4, B: 3, C: 2, D: 1, F: 1 }

function deltaSortValue(v: number | null | undefined): number {
  if (v == null || !Number.isFinite(v)) return Number.NEGATIVE_INFINITY
  return v
}

const sortedRows = computed(() => {
  const out = [...filteredRows.value]
  const dir = sortDir.value === 'asc' ? 1 : -1
  const key = sortBy.value
  out.sort((a, b) => {
    if (key === 'rank') return dir * (a.rank - b.rank)
    if (key === 'tier') return dir * ((TIER_ORDER[a.tier] ?? 0) - (TIER_ORDER[b.tier] ?? 0))
    if (key === 'score') return dir * (a.score - b.score)
    if (key === 'winrate') return dir * (a.winrate - b.winrate)
    if (key === 'delta')
      return dir * (deltaSortValue(a.deltaVsPeersPp) - deltaSortValue(b.deltaVsPeersPp))
    if (key === 'pickrate') return dir * (a.pickrate - b.pickrate)
    if (key === 'games') return dir * (a.games - b.games)
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
  if (v == null || !Number.isFinite(v)) return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}`
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
      {{ p.t('statisticsPage.vsBotlaneLoadError') }}
    </div>
    <div
      v-else-if="rows.length === 0"
      class="statistics-overview-surface rounded-lg border border-primary/30 p-4 text-text/70"
    >
      {{ p.t('statisticsPage.vsBotlaneNoData') }}
    </div>
    <div
      v-else
      class="tier-list-mobile-rotate statistics-overview-surface w-full overflow-x-auto rounded-lg border border-primary/30"
    >
      <div class="tier-list-lolalytics w-full min-w-0 text-[13px] max-lg:min-w-[924px]">
        <div
          class="tier-list-lolalytics-head sticky top-0 z-10 flex h-auto min-h-8 w-full items-stretch justify-between border-b border-black bg-[var(--color-grey-300)] text-text-primary/85"
        >
          <button
            type="button"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all flex w-10 shrink-0 items-center justify-center border-b border-black px-0.5 hover:bg-primary/25"
            @click="toggleSort('rank')"
          >
            {{ p.t('statisticsPage.tierListRank') }}{{ sortIcon('rank') }}
          </button>
          <div
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all flex w-[120px] shrink-0 items-center justify-center border-b border-black px-1 max-lg:w-[96px]"
          >
            {{ p.t('statisticsPage.vsBotlaneOurDuo') }}
          </div>
          <div
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all flex w-[120px] shrink-0 items-center justify-center border-b border-black px-1 max-lg:w-[96px]"
          >
            {{ p.t('statisticsPage.vsBotlaneEnemyDuo') }}
          </div>
          <button
            type="button"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all flex w-10 shrink-0 items-center justify-center border-b border-black hover:bg-primary/25"
            @click="toggleSort('tier')"
          >
            {{ p.t('statisticsPage.tierListTier') }}{{ sortIcon('tier') }}
          </button>
          <button
            type="button"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all flex w-14 shrink-0 items-center justify-center border-b border-black px-0.5 hover:bg-primary/25"
            :title="p.t('statisticsPage.tierListPbiTooltip')"
            @click="toggleSort('score')"
          >
            {{ p.t('statisticsPage.tierListPbi') }}{{ sortIcon('score') }}
          </button>
          <button
            type="button"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all flex w-12 shrink-0 items-center justify-center border-b border-black hover:bg-primary/25"
            @click="toggleSort('winrate')"
          >
            {{ p.t('statisticsPage.winrate') }}{{ sortIcon('winrate') }}
          </button>
          <button
            type="button"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all hidden w-12 shrink-0 items-center justify-center border-b border-black hover:bg-primary/25 sm:flex"
            :title="p.t('statisticsPage.vsBotlaneDeltaTooltip')"
            @click="toggleSort('delta')"
          >
            {{ p.t('statisticsPage.vsBotlaneDeltaShort') }}{{ sortIcon('delta') }}
          </button>
          <button
            type="button"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all flex w-12 shrink-0 items-center justify-center border-b border-black hover:bg-primary/25"
            @click="toggleSort('pickrate')"
          >
            {{ p.t('statisticsPage.tierListPickrate') }}{{ sortIcon('pickrate') }}
          </button>
          <button
            type="button"
            class="tier-list-lolalytics-th tier-list-lolalytics-th-all flex w-11 shrink-0 items-center justify-center border-b border-black hover:bg-primary/25"
            @click="toggleSort('games')"
          >
            {{ p.t('statisticsPage.tierListGames') }}{{ sortIcon('games') }}
          </button>
        </div>

        <div
          v-for="row in paginatedRows"
          :key="`${row.adcId}-${row.supportId}-${row.oppAdcId}-${row.oppSupportId}`"
          class="tier-list-lolalytics-row flex min-h-[60px] w-full items-center justify-between py-0.5 text-text-primary/90 odd:bg-white/[0.04] even:bg-black/25"
        >
          <div
            class="tier-list-lolalytics-td flex w-10 shrink-0 items-center justify-center tabular-nums"
          >
            {{ row.rank }}
          </div>
          <div
            class="tier-list-lolalytics-td flex w-[120px] shrink-0 items-center justify-center gap-1 px-1 max-lg:w-[96px]"
          >
            <template v-if="p.gameVersion">
              <img
                v-if="p.championByKey(row.adcId)"
                :src="getChampionImageUrl(p.gameVersion, p.championByKey(row.adcId)!.image.full)"
                :alt="p.championName(row.adcId) || ''"
                class="h-[50px] w-[50px] shrink-0 border-2 border-black object-cover max-lg:h-10 max-lg:w-10"
                width="50"
                height="50"
              />
              <img
                v-if="p.championByKey(row.supportId)"
                :src="
                  getChampionImageUrl(p.gameVersion, p.championByKey(row.supportId)!.image.full)
                "
                :alt="p.championName(row.supportId) || ''"
                class="h-[50px] w-[50px] shrink-0 border-2 border-black object-cover max-lg:h-10 max-lg:w-10"
                width="50"
                height="50"
              />
            </template>
          </div>
          <div
            class="tier-list-lolalytics-td flex w-[120px] shrink-0 items-center justify-center gap-1 px-1 max-lg:w-[96px]"
          >
            <template v-if="p.gameVersion">
              <img
                v-if="p.championByKey(row.oppAdcId)"
                :src="getChampionImageUrl(p.gameVersion, p.championByKey(row.oppAdcId)!.image.full)"
                :alt="p.championName(row.oppAdcId) || ''"
                class="h-[50px] w-[50px] shrink-0 border-2 border-black object-cover max-lg:h-10 max-lg:w-10"
                width="50"
                height="50"
              />
              <img
                v-if="p.championByKey(row.oppSupportId)"
                :src="
                  getChampionImageUrl(p.gameVersion, p.championByKey(row.oppSupportId)!.image.full)
                "
                :alt="p.championName(row.oppSupportId) || ''"
                class="h-[50px] w-[50px] shrink-0 border-2 border-black object-cover max-lg:h-10 max-lg:w-10"
                width="50"
                height="50"
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
            class="tier-list-lolalytics-td flex w-14 shrink-0 items-center justify-center text-[11px] tabular-nums text-text/90"
          >
            {{ row.score.toFixed(2) }}
          </div>
          <div
            class="tier-list-lolalytics-td flex w-12 shrink-0 items-center justify-center tabular-nums"
            :class="p.tierListWinrateClass(row.winrate * 100)"
          >
            {{ fmtPct01(row.winrate) }}
          </div>
          <div
            class="tier-list-lolalytics-td hidden w-12 shrink-0 items-center justify-center text-[11px] tabular-nums sm:flex"
            :class="
              row.deltaVsPeersPp == null
                ? 'text-text/55'
                : row.deltaVsPeersPp > 0
                  ? 'text-green-400/90'
                  : row.deltaVsPeersPp < 0
                    ? 'text-red-400/90'
                    : 'text-text/80'
            "
          >
            {{ fmtDeltaPp(row.deltaVsPeersPp) }}
          </div>
          <div
            class="tier-list-lolalytics-td flex w-12 shrink-0 items-center justify-center tabular-nums text-text/80"
          >
            {{ fmtPct01(row.pickrate) }}
          </div>
          <div
            class="tier-list-lolalytics-td flex w-11 shrink-0 items-center justify-center tabular-nums text-text/80"
          >
            {{ row.games }}
          </div>
        </div>

        <div
          v-if="totalRowsCount > 0"
          class="flex flex-wrap items-center justify-between gap-2 border-t border-primary/20 px-4 py-2 text-sm text-text/80"
        >
          <span>{{ totalRowsCount }} {{ p.t('statisticsPage.vsBotlaneRowsLabel') }}</span>
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
