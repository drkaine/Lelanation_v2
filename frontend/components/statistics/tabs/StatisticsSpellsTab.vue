<script setup lang="ts">
import { computed, inject, ref, unref, watch } from 'vue'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'
import { getSpellImageUrl } from '~/utils/imageUrl'

const p = inject('statisticsPageCtx') as any
const summonerSpellsStore = useSummonerSpellsStore()

type SortKey =
  | 'spell'
  | 'pickrate'
  | 'deltaPick'
  | 'casts'
  | 'deltaCasts'
  | 'winrate'
  | 'deltaWin'
  | 'pctD'
  | 'deltaD'
  | 'pctF'
  | 'deltaF'

type SoloRow = {
  spellId: number
  games: number
  wins: number
  casts?: number
  pickrate: number
  winrate: number
  pctSlotD?: number
  pctSlotF?: number
}

type PairRow = {
  spellIdD: number
  spellIdF: number
  games: number
  wins: number
  spell1Casts?: number
  spell2Casts?: number
  pickrate: number
  winrate: number
}

type EnrichedRow = SoloRow & {
  deltaPick: number | null
  deltaCasts: number | null
  deltaWin: number | null
  deltaD: number | null
  deltaF: number | null
}

type EnrichedPairRow = PairRow & {
  deltaPick: number | null
  deltaSpell1Casts: number | null
  deltaSpell2Casts: number | null
  deltaWin: number | null
}

type DisplayRow = {
  key: string
  label: string
  imageSpellId: number | null
  imageSpellId2?: number | null
  imageOnly?: boolean
  pickrate: number
  deltaPick: number | null
  castsLabel: string
  castsSort: number
  deltaCastsLabel: string
  deltaCastsSort: number | null
  winrate: number
  deltaWin: number | null
  pctD: number | null
  deltaD: number | null
  pctF: number | null
  deltaF: number | null
}

const sortBy = ref<SortKey | null>(null)
const sortDir = ref<'asc' | 'desc'>('desc')
const spellsMode = computed<'solo' | 'pair'>({
  get: () => (p.spellsModeFilter === 'pair' ? 'pair' : 'solo'),
  set: (value: 'solo' | 'pair') => {
    p.spellsModeFilter = value
  },
})
const pageSize = ref<number>(20)
const page = ref<number>(1)
const expandedSpellKeys = ref<Set<string>>(new Set())

function toggleSpellCardExpanded(key: string): void {
  const next = new Set(expandedSpellKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedSpellKeys.value = next
}
const PAGE_SIZE_OPTIONS = computed<number[]>(() =>
  Array.isArray(p.PAGE_SIZE_OPTIONS) && p.PAGE_SIZE_OPTIONS.length > 0
    ? p.PAGE_SIZE_OPTIONS
    : [10, 20, 50, 100]
)

const rows = computed<SoloRow[]>(() => p.overviewDetailData?.summonerSpells ?? [])
const pairRows = computed<PairRow[]>(() => p.overviewDetailData?.summonerSpellSets ?? [])
const baselineBySpell = computed<Map<number, SoloRow>>(() => {
  const m = new Map<number, SoloRow>()
  const base = p.overviewDetailBaselineData?.summonerSpells ?? []
  for (const r of base) m.set(Number(r.spellId), r)
  return m
})
const baselineByPair = computed<Map<string, PairRow>>(() => {
  const m = new Map<string, PairRow>()
  const base = p.overviewDetailBaselineData?.summonerSpellSets ?? []
  for (const r of base) m.set(`${r.spellIdD}:${r.spellIdF}`, r)
  return m
})

const hasComparison = computed(() => Boolean(p.overviewDetailComparisonVersion))

function wrPct(row: { games: number; wins: number; winrate: number }): number {
  const g = Number(row.games ?? 0)
  if (g > 0) return (Number(row.wins ?? 0) / g) * 100
  return Number(row.winrate ?? 0)
}

function deltaWhenComparison(
  cur: number | null | undefined,
  base: number | null | undefined
): number | null {
  if (!hasComparison.value || p.overviewDetailBaselinePending) return null
  if (cur == null || base == null || !Number.isFinite(cur) || !Number.isFinite(base)) return null
  return cur - base
}

const enrichedRows = computed<EnrichedRow[]>(() =>
  rows.value.map(r => {
    const b = baselineBySpell.value.get(Number(r.spellId))
    const castsAvg = Number(r.casts ?? 0) / Math.max(1, Number(r.games ?? 0))
    const baselineCastsAvg =
      b != null ? Number(b.casts ?? 0) / Math.max(1, Number(b.games ?? 0)) : null
    return {
      ...r,
      deltaPick: deltaWhenComparison(r.pickrate, b?.pickrate),
      deltaCasts: deltaWhenComparison(castsAvg, baselineCastsAvg),
      deltaWin: deltaWhenComparison(wrPct(r), b ? wrPct(b) : null),
      deltaD:
        r.pctSlotD != null && b?.pctSlotD != null
          ? deltaWhenComparison(r.pctSlotD, b.pctSlotD)
          : null,
      deltaF:
        r.pctSlotF != null && b?.pctSlotF != null
          ? deltaWhenComparison(r.pctSlotF, b.pctSlotF)
          : null,
    }
  })
)

const enrichedPairRows = computed<EnrichedPairRow[]>(() =>
  pairRows.value.map(r => {
    const b = baselineByPair.value.get(`${Number(r.spellIdD)}:${Number(r.spellIdF)}`)
    const spell1Avg = Number(r.spell1Casts ?? 0) / Math.max(1, Number(r.games ?? 0))
    const spell2Avg = Number(r.spell2Casts ?? 0) / Math.max(1, Number(r.games ?? 0))
    const baselineSpell1Avg =
      b != null ? Number(b.spell1Casts ?? 0) / Math.max(1, Number(b.games ?? 0)) : null
    const baselineSpell2Avg =
      b != null ? Number(b.spell2Casts ?? 0) / Math.max(1, Number(b.games ?? 0)) : null
    return {
      ...r,
      deltaPick: deltaWhenComparison(r.pickrate, b?.pickrate),
      deltaSpell1Casts: deltaWhenComparison(spell1Avg, baselineSpell1Avg),
      deltaSpell2Casts: deltaWhenComparison(spell2Avg, baselineSpell2Avg),
      deltaWin: deltaWhenComparison(wrPct(r), b ? wrPct(b) : null),
    }
  })
)

const spellSearchQuery = computed(() => normalizeSearch(String(unref(p.championSearchQuery) ?? '')))

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .trim()
    .toLowerCase()
}

function spellSearchText(spellId: number): string {
  const spell = summonerSpellsStore.getSpellById(String(spellId))
  const parts = [
    spell?.name ?? '',
    spell?.id ?? '', // ex: SummonerSmite
    spell?.key ?? '',
    spell?.image?.full ?? '',
    String(spellId),
  ]
  return normalizeSearch(parts.join(' '))
}

const filteredRows = computed<EnrichedRow[]>(() => {
  if (spellsMode.value !== 'solo') return []
  const q = spellSearchQuery.value
  if (!q) return enrichedRows.value
  return enrichedRows.value.filter(r => {
    return spellSearchText(r.spellId).includes(q)
  })
})

const filteredPairRows = computed<EnrichedPairRow[]>(() => {
  if (spellsMode.value !== 'pair') return []
  const q = spellSearchQuery.value
  if (!q) return enrichedPairRows.value
  return enrichedPairRows.value.filter(r => {
    return spellSearchText(r.spellIdD).includes(q) || spellSearchText(r.spellIdF).includes(q)
  })
})

function spellName(spellId: number): string {
  return summonerSpellsStore.getSpellById(String(spellId))?.name ?? String(spellId)
}

function spellImage(spellId: number): string | null {
  return summonerSpellsStore.getSpellById(String(spellId))?.image?.full ?? null
}

function toggleSort(key: SortKey) {
  if (sortBy.value !== key) {
    sortBy.value = key
    sortDir.value = 'desc'
    return
  }
  if (sortDir.value === 'desc') {
    sortDir.value = 'asc'
    return
  }
  sortBy.value = null
  sortDir.value = 'desc'
}

function sortIcon(key: SortKey): string {
  if (sortBy.value !== key) return ' ↕'
  return sortDir.value === 'asc' ? ' ▲' : ' ▼'
}

function numOrNegInf(v: number | null | undefined): number {
  return v == null ? Number.NEGATIVE_INFINITY : v
}

const sortedRows = computed<EnrichedRow[]>(() => {
  if (spellsMode.value !== 'solo') return []
  const out = [...filteredRows.value]
  if (!sortBy.value) return out
  const key = sortBy.value
  const dir = sortDir.value
  out.sort((a, b) => {
    if (key === 'spell') {
      const av = spellName(a.spellId).toLowerCase()
      const bv = spellName(b.spellId).toLowerCase()
      if (av === bv) return 0
      return dir === 'asc' ? (av < bv ? -1 : 1) : av < bv ? 1 : -1
    }
    const mult = dir === 'asc' ? 1 : -1
    if (key === 'pickrate') return mult * (numOrNegInf(a.pickrate) - numOrNegInf(b.pickrate))
    if (key === 'deltaPick') return mult * (numOrNegInf(a.deltaPick) - numOrNegInf(b.deltaPick))
    if (key === 'casts') return mult * (numOrNegInf(a.casts) - numOrNegInf(b.casts))
    if (key === 'deltaCasts') return mult * (numOrNegInf(a.deltaCasts) - numOrNegInf(b.deltaCasts))
    if (key === 'winrate') return mult * (numOrNegInf(a.winrate) - numOrNegInf(b.winrate))
    if (key === 'deltaWin') return mult * (numOrNegInf(a.deltaWin) - numOrNegInf(b.deltaWin))
    if (key === 'pctD') return mult * (numOrNegInf(a.pctSlotD) - numOrNegInf(b.pctSlotD))
    if (key === 'deltaD') return mult * (numOrNegInf(a.deltaD) - numOrNegInf(b.deltaD))
    if (key === 'pctF') return mult * (numOrNegInf(a.pctSlotF) - numOrNegInf(b.pctSlotF))
    return mult * (numOrNegInf(a.deltaF) - numOrNegInf(b.deltaF))
  })
  return out
})

const sortedPairRows = computed<EnrichedPairRow[]>(() => {
  if (spellsMode.value !== 'pair') return []
  const out = [...filteredPairRows.value]
  if (!sortBy.value) return out
  const key = sortBy.value
  const dir = sortDir.value
  out.sort((a, b) => {
    if (key === 'spell') {
      const av = `${spellName(a.spellIdD)} + ${spellName(a.spellIdF)}`.toLowerCase()
      const bv = `${spellName(b.spellIdD)} + ${spellName(b.spellIdF)}`.toLowerCase()
      if (av === bv) return 0
      return dir === 'asc' ? (av < bv ? -1 : 1) : av < bv ? 1 : -1
    }
    const mult = dir === 'asc' ? 1 : -1
    if (key === 'pickrate') return mult * (numOrNegInf(a.pickrate) - numOrNegInf(b.pickrate))
    if (key === 'deltaPick') return mult * (numOrNegInf(a.deltaPick) - numOrNegInf(b.deltaPick))
    if (key === 'casts')
      return (
        mult *
        (numOrNegInf(
          (Number(a.spell1Casts ?? 0) + Number(a.spell2Casts ?? 0)) /
            Math.max(1, Number(a.games ?? 0))
        ) -
          numOrNegInf(
            (Number(b.spell1Casts ?? 0) + Number(b.spell2Casts ?? 0)) /
              Math.max(1, Number(b.games ?? 0))
          ))
      )
    if (key === 'deltaCasts')
      return (
        mult *
        (numOrNegInf(Number(a.deltaSpell1Casts ?? 0) + Number(a.deltaSpell2Casts ?? 0)) -
          numOrNegInf(Number(b.deltaSpell1Casts ?? 0) + Number(b.deltaSpell2Casts ?? 0)))
      )
    if (key === 'winrate') return mult * (numOrNegInf(a.winrate) - numOrNegInf(b.winrate))
    if (key === 'deltaWin') return mult * (numOrNegInf(a.deltaWin) - numOrNegInf(b.deltaWin))
    return 0
  })
  return out
})

const displayRows = computed<DisplayRow[]>(() => {
  const soloBySpell = new Map<number, EnrichedRow>(enrichedRows.value.map(r => [r.spellId, r]))
  if (spellsMode.value === 'solo') {
    return sortedRows.value.map(r => ({
      key: `s-${r.spellId}`,
      label: spellName(r.spellId),
      imageSpellId: r.spellId,
      pickrate: r.pickrate,
      deltaPick: r.deltaPick,
      castsLabel: (Number(r.casts ?? 0) / Math.max(1, Number(r.games ?? 0))).toFixed(2),
      castsSort: Number(r.casts ?? 0) / Math.max(1, Number(r.games ?? 0)),
      deltaCastsLabel:
        r.deltaCasts != null ? `${r.deltaCasts >= 0 ? '+' : ''}${r.deltaCasts.toFixed(2)}` : '—',
      deltaCastsSort: r.deltaCasts,
      winrate: r.winrate,
      deltaWin: r.deltaWin,
      pctD: r.pctSlotD ?? null,
      deltaD: r.deltaD,
      pctF: r.pctSlotF ?? null,
      deltaF: r.deltaF,
    }))
  }
  return sortedPairRows.value.map(r => ({
    key: `p-${r.spellIdD}-${r.spellIdF}`,
    label: `${spellName(r.spellIdD)} + ${spellName(r.spellIdF)}`,
    imageSpellId: r.spellIdD,
    imageSpellId2: r.spellIdF,
    imageOnly: false,
    pickrate: r.pickrate,
    deltaPick: r.deltaPick,
    castsLabel: `${(Number(r.spell1Casts ?? 0) / Math.max(1, Number(r.games ?? 0))).toFixed(2)}/${(Number(r.spell2Casts ?? 0) / Math.max(1, Number(r.games ?? 0))).toFixed(2)}`,
    castsSort:
      (Number(r.spell1Casts ?? 0) + Number(r.spell2Casts ?? 0)) / Math.max(1, Number(r.games ?? 0)),
    deltaCastsLabel: `${r.deltaSpell1Casts != null ? `${r.deltaSpell1Casts >= 0 ? '+' : ''}${r.deltaSpell1Casts.toFixed(2)}` : '—'}/${r.deltaSpell2Casts != null ? `${r.deltaSpell2Casts >= 0 ? '+' : ''}${r.deltaSpell2Casts.toFixed(2)}` : '—'}`,
    deltaCastsSort:
      r.deltaSpell1Casts != null || r.deltaSpell2Casts != null
        ? Number(r.deltaSpell1Casts ?? 0) + Number(r.deltaSpell2Casts ?? 0)
        : null,
    winrate: r.winrate,
    deltaWin: r.deltaWin,
    pctD: soloBySpell.get(r.spellIdD)?.pickrate ?? null,
    deltaD: soloBySpell.get(r.spellIdD)?.deltaPick ?? null,
    pctF: soloBySpell.get(r.spellIdF)?.pickrate ?? null,
    deltaF: soloBySpell.get(r.spellIdF)?.deltaPick ?? null,
  }))
})
const totalRowsCount = computed(() => displayRows.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalRowsCount.value / pageSize.value)))
const paginatedDisplayRows = computed(() => {
  const pnum = Math.min(page.value, totalPages.value)
  const start = (pnum - 1) * pageSize.value
  return displayRows.value.slice(start, start + pageSize.value)
})

watch([spellsMode, sortBy, sortDir, spellSearchQuery, pageSize], () => {
  page.value = 1
})

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${Number(v).toFixed(2)}%`
}

function fmtDelta(v: number | null | undefined): string {
  if (!hasComparison.value || p.overviewDetailBaselinePending || v == null) return '—'
  const val = Number(v)
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`
}

function deltaClass(v: number | null | undefined): string {
  if (!hasComparison.value || v == null || p.overviewDetailBaselinePending) return 'text-text/55'
  if (v > 0) return 'text-success'
  if (v < 0) return 'text-error'
  return 'text-text/75'
}

function deltaLabelClass(v: number | null | undefined): string {
  if (!hasComparison.value || v == null || p.overviewDetailBaselinePending) return 'text-text/55'
  if (v > 0) return 'text-success'
  if (v < 0) return 'text-error'
  return 'text-text/75'
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="p.overviewDetailPending" class="text-text/70">
      {{ p.t('statisticsPage.loading') }}
    </div>
    <div v-else-if="p.overviewDetailError" class="rounded border border-error/50 p-3 text-error">
      {{ p.t('statisticsPage.overviewDetailTimeout') }}
    </div>
    <div v-else-if="displayRows.length" class="statistics-spells-tab space-y-3">
      <div class="statistics-spells-mobile-list space-y-2 md:hidden">
        <article
          v-for="row in paginatedDisplayRows"
          :key="'spell-mobile-' + row.key"
          class="statistics-champion-stats-mobile-card statistics-spell-mobile-card w-full overflow-hidden rounded-lg border border-primary/30 bg-surface/40"
        >
          <button
            type="button"
            class="statistics-champion-stats-mobile-card-header flex w-full min-w-0 items-center gap-3 p-3 text-left"
            @click="toggleSpellCardExpanded(row.key)"
          >
            <StatisticsSpellStatsMobileCardHeader
              :label="row.label"
              :game-version="p.gameVersion"
              :image-spell-id="row.imageSpellId"
              :image-file1="row.imageSpellId != null ? spellImage(row.imageSpellId) : null"
              :image-spell-id2="row.imageSpellId2 ?? null"
              :image-file2="row.imageSpellId2 != null ? spellImage(row.imageSpellId2) : null"
              :is-pair="spellsMode === 'pair'"
            />
            <div
              class="statistics-spell-mobile-stats flex min-w-0 flex-1 justify-end gap-2 text-right sm:gap-3"
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
                <div class="text-xl font-bold tabular-nums leading-none text-text sm:text-2xl">
                  {{ fmtPct(row.winrate) }}
                </div>
                <div
                  class="mt-0.5 text-xs tabular-nums leading-none"
                  :class="deltaClass(row.deltaWin)"
                >
                  {{ fmtDelta(row.deltaWin) }}
                </div>
              </div>
            </div>
            <span
              class="shrink-0 text-xs text-text/50 transition-transform duration-200"
              :class="expandedSpellKeys.has(row.key) ? 'rotate-180' : ''"
              aria-hidden="true"
              >▼</span
            >
          </button>
          <div
            v-if="expandedSpellKeys.has(row.key)"
            class="space-y-1.5 border-t border-primary/20 bg-black/20 px-3 py-2.5 text-sm text-text/85"
          >
            <div
              class="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1"
              :class="
                spellsMode === 'pair' ? 'flex-col items-stretch sm:flex-row sm:items-baseline' : ''
              "
            >
              <span class="shrink-0">{{ p.t('statisticsPage.spellsCasts') }}</span>
              <span
                class="min-w-0 tabular-nums"
                :class="spellsMode === 'pair' ? 'break-words text-right' : ''"
              >
                <template v-if="spellsMode === 'pair'">
                  <span class="block">{{ row.castsLabel }}</span>
                  <span class="block text-xs" :class="deltaLabelClass(row.deltaCastsSort)">
                    {{ row.deltaCastsLabel }}
                  </span>
                </template>
                <template v-else>
                  {{ row.castsLabel }}
                  <span class="ml-1 text-xs" :class="deltaLabelClass(row.deltaCastsSort)">
                    {{ row.deltaCastsLabel }}
                  </span>
                </template>
              </span>
            </div>
            <div
              v-if="spellsMode === 'solo'"
              class="flex flex-wrap items-baseline justify-between gap-x-2"
            >
              <span>% D</span>
              <span class="tabular-nums">
                {{ fmtPct(row.pctD) }}
                <span class="ml-1 text-xs" :class="deltaClass(row.deltaD)">{{
                  fmtDelta(row.deltaD)
                }}</span>
              </span>
            </div>
            <div
              v-if="spellsMode === 'solo'"
              class="flex flex-wrap items-baseline justify-between gap-x-2"
            >
              <span>% F</span>
              <span class="tabular-nums">
                {{ fmtPct(row.pctF) }}
                <span class="ml-1 text-xs" :class="deltaClass(row.deltaF)">{{
                  fmtDelta(row.deltaF)
                }}</span>
              </span>
            </div>
            <div
              v-if="spellsMode === 'pair'"
              class="flex flex-wrap items-baseline justify-between gap-x-2"
            >
              <span>% D / % F</span>
              <span class="tabular-nums"> {{ fmtPct(row.pctD) }} / {{ fmtPct(row.pctF) }} </span>
            </div>
          </div>
        </article>
      </div>

      <div
        class="statistics-overview-surface hidden w-full overflow-x-auto rounded-lg border border-primary/30 md:block"
      >
        <table class="w-full min-w-[1100px] text-left text-sm">
          <thead class="border-b border-primary/30 bg-black/25">
            <tr>
              <th
                class="px-3 py-2 font-semibold text-text"
                :title="p.t('statisticsPage.spellsTooltipSummoner')"
              >
                <button type="button" class="hover:underline" @click="toggleSort('spell')">
                  {{ p.t('statisticsPage.overviewDetailSummonerSpells') }}{{ sortIcon('spell') }}
                </button>
              </th>
              <th
                class="px-3 py-2 font-semibold text-text"
                :title="p.t('statisticsPage.spellsTooltipPickrate')"
              >
                <button type="button" class="hover:underline" @click="toggleSort('pickrate')">
                  {{ p.t('statisticsPage.overviewDetailPickRate') }}{{ sortIcon('pickrate') }}
                </button>
              </th>
              <th
                class="px-3 py-2 font-semibold text-text"
                :title="p.t('statisticsPage.spellsTooltipDeltaPick')"
              >
                <button type="button" class="hover:underline" @click="toggleSort('deltaPick')">
                  {{ p.t('statisticsPage.championTableDeltaSymbol') }} pick{{
                    sortIcon('deltaPick')
                  }}
                </button>
              </th>
              <th
                class="px-3 py-2 font-semibold text-text"
                :title="p.t('statisticsPage.spellsTooltipCasts')"
              >
                <button type="button" class="hover:underline" @click="toggleSort('casts')">
                  {{ p.t('statisticsPage.spellsCasts') }}{{ sortIcon('casts') }}
                </button>
              </th>
              <th
                class="px-3 py-2 font-semibold text-text"
                :title="p.t('statisticsPage.spellsTooltipDeltaCasts')"
              >
                <button type="button" class="hover:underline" @click="toggleSort('deltaCasts')">
                  {{ p.t('statisticsPage.championTableDeltaSymbol') }}
                  {{ p.t('statisticsPage.spellsCasts') }}{{ sortIcon('deltaCasts') }}
                </button>
              </th>
              <th
                class="px-3 py-2 font-semibold text-text"
                :title="p.t('statisticsPage.spellsTooltipWinrate')"
              >
                <button type="button" class="hover:underline" @click="toggleSort('winrate')">
                  {{ p.t('statisticsPage.overviewDetailWinRate') }}{{ sortIcon('winrate') }}
                </button>
              </th>
              <th
                class="px-3 py-2 font-semibold text-text"
                :title="p.t('statisticsPage.spellsTooltipDeltaWin')"
              >
                <button type="button" class="hover:underline" @click="toggleSort('deltaWin')">
                  {{ p.t('statisticsPage.championTableDeltaSymbol') }} WR{{ sortIcon('deltaWin') }}
                </button>
              </th>
              <th
                class="px-3 py-2 font-semibold text-text"
                :title="p.t('statisticsPage.spellsTooltipPctD')"
              >
                <button type="button" class="hover:underline" @click="toggleSort('pctD')">
                  % D{{ sortIcon('pctD') }}
                </button>
              </th>
              <th
                class="px-3 py-2 font-semibold text-text"
                :title="p.t('statisticsPage.spellsTooltipDeltaD')"
              >
                <button type="button" class="hover:underline" @click="toggleSort('deltaD')">
                  {{ p.t('statisticsPage.championTableDeltaSymbol') }} D{{ sortIcon('deltaD') }}
                </button>
              </th>
              <th
                class="px-3 py-2 font-semibold text-text"
                :title="p.t('statisticsPage.spellsTooltipPctF')"
              >
                <button type="button" class="hover:underline" @click="toggleSort('pctF')">
                  % F{{ sortIcon('pctF') }}
                </button>
              </th>
              <th
                class="px-3 py-2 font-semibold text-text"
                :title="p.t('statisticsPage.spellsTooltipDeltaF')"
              >
                <button type="button" class="hover:underline" @click="toggleSort('deltaF')">
                  {{ p.t('statisticsPage.championTableDeltaSymbol') }} F{{ sortIcon('deltaF') }}
                </button>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-primary/20">
            <tr
              v-for="row in paginatedDisplayRows"
              :key="row.key"
              class="odd:bg-white/[0.04] even:bg-black/25 hover:brightness-110"
            >
              <td class="px-3 py-2">
                <div class="flex items-center gap-2">
                  <img
                    v-if="row.imageSpellId != null && spellImage(row.imageSpellId) && p.gameVersion"
                    :src="getSpellImageUrl(p.gameVersion, spellImage(row.imageSpellId)!)"
                    :alt="row.label"
                    class="h-[50px] w-[50px] rounded border border-black/30 object-cover"
                    width="50"
                    height="50"
                  />
                  <img
                    v-if="
                      row.imageSpellId2 != null && spellImage(row.imageSpellId2) && p.gameVersion
                    "
                    :src="getSpellImageUrl(p.gameVersion, spellImage(row.imageSpellId2)!)"
                    :alt="row.label"
                    class="h-[50px] w-[50px] rounded border border-black/30 object-cover"
                    width="50"
                    height="50"
                  />
                  <span v-if="!row.imageOnly" class="font-medium text-accent">{{ row.label }}</span>
                </div>
              </td>
              <td class="px-3 py-2 tabular-nums text-text/90">{{ fmtPct(row.pickrate) }}</td>
              <td class="px-3 py-2 tabular-nums" :class="deltaClass(row.deltaPick)">
                {{ fmtDelta(row.deltaPick) }}
              </td>
              <td class="px-3 py-2 tabular-nums text-text/90">{{ row.castsLabel }}</td>
              <td class="px-3 py-2 tabular-nums" :class="deltaLabelClass(row.deltaCastsSort)">
                {{ row.deltaCastsLabel }}
              </td>
              <td class="px-3 py-2 tabular-nums text-text/90">{{ fmtPct(row.winrate) }}</td>
              <td class="px-3 py-2 tabular-nums" :class="deltaClass(row.deltaWin)">
                {{ fmtDelta(row.deltaWin) }}
              </td>
              <td class="px-3 py-2 tabular-nums text-text/90">
                {{ fmtPct(row.pctD) }}
              </td>
              <td class="px-3 py-2 tabular-nums" :class="deltaClass(row.deltaD)">
                {{ fmtDelta(row.deltaD) }}
              </td>
              <td class="px-3 py-2 tabular-nums text-text/90">
                {{ fmtPct(row.pctF) }}
              </td>
              <td class="px-3 py-2 tabular-nums" :class="deltaClass(row.deltaF)">
                {{ fmtDelta(row.deltaF) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-if="totalRowsCount > 0"
        class="statistics-spells-pagination flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-surface/20 px-3 py-2 text-sm text-text/80 md:rounded-none md:border-t md:bg-transparent md:px-4"
      >
        <span>{{ totalRowsCount }} {{ p.t('statisticsPage.overviewDetailSummonerSpells') }}</span>
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
    <div v-else class="text-text/70">{{ p.t('statisticsPage.overviewDetailNoData') }}</div>
  </div>
</template>
