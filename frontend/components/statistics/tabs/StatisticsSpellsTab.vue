<script setup lang="ts">
import { computed, unref } from 'vue'
import { spellsDetail } from '~/utils/statistics/detailPayload'
import {
  injectStatisticsPageCtx,
  type RunesSpellsTabCtx,
} from '~/composables/statistics/statisticsPageCtx'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'
import { getSpellImageUrl } from '~/utils/imageUrl'
import type { StatisticsMobileSortOption } from '~/components/statistics/StatisticsMobileSortBar.vue'
import { usePagination } from '~/composables/usePagination'
import { useTableSort } from '~/composables/useTableSort'
import { useToggleSet } from '~/composables/useToggleSet'
import { spellBarPct, spellDeltaTone, spellSlotSplit } from '~/utils/statistics/spellsTable'

const p = injectStatisticsPageCtx<RunesSpellsTabCtx>()
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

const { sortBy, sortDir, toggleSort } = useTableSort<SortKey>({ resettable: true })
const spellsMode = computed<'solo' | 'pair'>({
  get: () => (p.spellsModeFilter === 'pair' ? 'pair' : 'solo'),
  set: (value: 'solo' | 'pair') => {
    p.spellsModeFilter = value
  },
})
const { set: expandedSpellKeys, toggle: toggleSpellCardExpanded } = useToggleSet<string>()

const rows = computed<SoloRow[]>(() => spellsDetail(p.overviewDetailData)?.summonerSpells ?? [])
const pairRows = computed<PairRow[]>(
  () => spellsDetail(p.overviewDetailData)?.summonerSpellSets ?? []
)
const baselineBySpell = computed<Map<number, SoloRow>>(() => {
  const m = new Map<number, SoloRow>()
  const base = spellsDetail(p.overviewDetailBaselineData)?.summonerSpells ?? []
  for (const r of base) m.set(Number(r.spellId), r)
  return m
})
const baselineByPair = computed<Map<string, PairRow>>(() => {
  const m = new Map<string, PairRow>()
  const base = spellsDetail(p.overviewDetailBaselineData)?.summonerSpellSets ?? []
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
const {
  page,
  pageSize,
  totalRowsCount,
  totalPages,
  paginatedRows: paginatedDisplayRows,
} = usePagination(displayRows, {
  resetOn: [spellsMode, sortBy, sortDir, spellSearchQuery],
})

const spellsMobileSortColumn = computed({
  get: () => String(sortBy.value ?? 'pickrate'),
  set: (v: string) => {
    sortBy.value = v as SortKey
  },
})

const spellsMobileSortOptions = computed<StatisticsMobileSortOption[]>(() => {
  const t = p.t
  const delta = t('statisticsPage.championTableDeltaSymbol')
  const opts: StatisticsMobileSortOption[] = [
    { value: 'spell', label: t('statisticsPage.overviewDetailSummonerSpells') },
    { value: 'pickrate', label: t('statisticsPage.overviewDetailPickRate') },
    { value: 'casts', label: t('statisticsPage.spellsCasts') },
    { value: 'winrate', label: t('statisticsPage.overviewDetailWinRate') },
  ]
  if (spellsMode.value === 'solo') {
    opts.push({ value: 'pctD', label: '% D' }, { value: 'pctF', label: '% F' })
  }
  if (hasComparison.value) {
    opts.push(
      { value: 'deltaPick', label: `${delta} pick` },
      { value: 'deltaCasts', label: `${delta} ${t('statisticsPage.spellsCasts')}` },
      { value: 'deltaWin', label: `${delta} WR` }
    )
    if (spellsMode.value === 'solo') {
      opts.push({ value: 'deltaD', label: `${delta} D` }, { value: 'deltaF', label: `${delta} F` })
    }
  }
  return opts
})

interface DesktopColumn {
  sort: SortKey
  deltaSort?: SortKey
  label: string
  tooltipKey: string
  align?: 'left'
}

const desktopColumns = computed<DesktopColumn[]>(() => {
  const t = p.t
  const cols: DesktopColumn[] = [
    {
      sort: 'spell',
      label: t('statisticsPage.spellsColSpell'),
      tooltipKey: 'statisticsPage.spellsTooltipSummoner',
      align: 'left',
    },
    {
      sort: 'pickrate',
      deltaSort: 'deltaPick',
      label: t('statisticsPage.overviewDetailPickRate'),
      tooltipKey: 'statisticsPage.spellsTooltipPickrate',
    },
    {
      sort: 'casts',
      deltaSort: 'deltaCasts',
      label: t('statisticsPage.spellsCastsPerGame'),
      tooltipKey: 'statisticsPage.spellsTooltipCasts',
    },
    {
      sort: 'winrate',
      deltaSort: 'deltaWin',
      label: t('statisticsPage.overviewDetailWinRate'),
      tooltipKey: 'statisticsPage.spellsTooltipWinrate',
    },
  ]
  if (spellsMode.value === 'solo') {
    cols.push({
      sort: 'pctD',
      deltaSort: 'deltaD',
      label: t('statisticsPage.spellsKeyCol'),
      tooltipKey: 'statisticsPage.spellsTooltipPctD',
    })
  }
  return cols
})

const pickrateMax = computed(() =>
  Math.max(0, ...displayRows.value.map(r => Number(r.pickrate ?? 0)))
)

function showDelta(v: number | null | undefined): boolean {
  return hasComparison.value && !p.overviewDetailBaselinePending && v != null
}

function fmtShort(v: number | null | undefined): string {
  return v == null ? '—' : `${Number(v).toFixed(0)}%`
}

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
    <div class="sp-head">
      <h2 class="sp-title">{{ p.t('statisticsPage.overviewDetailSummonerSpells') }}</h2>
      <div class="spells-mode" role="group" :aria-label="p.t('statisticsPage.spellsModeAria')">
        <button
          v-for="mode in ['solo', 'pair'] as const"
          :key="mode"
          type="button"
          class="spells-mode-btn"
          :class="{ 'is-active': spellsMode === mode }"
          :aria-pressed="spellsMode === mode"
          @click="spellsMode = mode"
        >
          {{
            p.t(mode === 'solo' ? 'statisticsPage.spellsModeSolo' : 'statisticsPage.spellsModePair')
          }}
        </button>
      </div>
    </div>
    <div v-if="p.overviewDetailPending" class="text-text/70">
      {{ p.t('statisticsPage.loading') }}
    </div>
    <div v-else-if="p.overviewDetailError" class="rounded border border-error/50 p-3 text-error">
      {{ p.t('statisticsPage.overviewDetailTimeout') }}
    </div>
    <div v-else-if="displayRows.length" class="statistics-spells-tab space-y-3">
      <StatisticsMobileSortBar
        id="spells-mobile-sort"
        v-model:column="spellsMobileSortColumn"
        v-model:direction="sortDir"
        :options="spellsMobileSortOptions"
        :asc-default-columns="['spell']"
        :help-aria-label="p.t('statisticsPage.tooltipTableSpellsAria')"
        :help-text="p.t('statisticsPage.tooltipTableSpells')"
        :help-secondary-text="p.t('statisticsPage.tooltipTableSpellsSecondary')"
      />
      <div class="statistics-spells-mobile-list space-y-2 md:hidden">
        <article
          v-for="row in paginatedDisplayRows"
          :key="'spell-mobile-' + row.key"
          class="statistics-champion-stats-mobile-card statistics-spell-mobile-card w-full overflow-hidden"
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

      <div class="sp-dtable-wrap hidden md:block">
        <table class="sp-dtable">
          <thead>
            <tr class="sp-dhead">
              <th
                v-for="col in desktopColumns"
                :key="col.sort"
                scope="col"
                :class="[
                  col.align === 'left' ? 'sp-dleft' : 'sp-dnum',
                  { 'is-sorted': sortBy === col.sort },
                ]"
                :title="p.t(col.tooltipKey)"
                :aria-sort="
                  sortBy === col.sort ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
                "
              >
                <button type="button" class="sp-dsort" @click="toggleSort(col.sort)">
                  {{ col.label }}
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
                  class="sp-dsort-delta"
                  :class="{ 'is-on': sortBy === col.deltaSort }"
                  @click="toggleSort(col.deltaSort)"
                >
                  {{ p.t('statisticsPage.championTableDeltaSymbol') }}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in paginatedDisplayRows" :key="row.key" class="sp-drow">
              <th scope="row" class="sp-dleft sp-dspell">
                <div class="sp-dspell-cell">
                  <template v-for="sid in [row.imageSpellId, row.imageSpellId2]" :key="String(sid)">
                    <img
                      v-if="sid != null && spellImage(sid) && p.gameVersion"
                      loading="lazy"
                      decoding="async"
                      :src="getSpellImageUrl(p.gameVersion, spellImage(sid)!)"
                      alt=""
                      class="sp-dicon"
                      width="32"
                      height="32"
                    />
                  </template>
                  <span>{{ row.label }}</span>
                </div>
              </th>
              <td class="sp-dnum sp-dbar-cell">
                <div class="sp-dbar-row">
                  <span class="sp-dbar" aria-hidden="true">
                    <span
                      class="sp-dbar-fill"
                      :style="{ width: spellBarPct(row.pickrate, pickrateMax) + '%' }"
                    />
                  </span>
                  <span class="sp-dval sp-dstrong">{{ fmtPct(row.pickrate) }}</span>
                </div>
                <span
                  v-if="showDelta(row.deltaPick)"
                  class="sp-ddelta"
                  :class="`is-${spellDeltaTone(row.deltaPick!)}`"
                  >{{ fmtDelta(row.deltaPick) }}</span
                >
              </td>
              <td class="sp-dnum">
                <span class="sp-dval">{{ row.castsLabel }}</span>
                <span
                  v-if="showDelta(row.deltaCastsSort)"
                  class="sp-ddelta"
                  :class="`is-${spellDeltaTone(row.deltaCastsSort!)}`"
                  >{{ row.deltaCastsLabel }}</span
                >
              </td>
              <td class="sp-dnum">
                <span class="sp-dval">{{ fmtPct(row.winrate) }}</span>
                <span
                  v-if="showDelta(row.deltaWin)"
                  class="sp-ddelta"
                  :class="`is-${spellDeltaTone(row.deltaWin!)}`"
                  >{{ fmtDelta(row.deltaWin) }}</span
                >
              </td>
              <td v-if="spellsMode === 'solo'" class="sp-dnum sp-dkey-cell">
                <div v-if="spellSlotSplit(row.pctD, row.pctF)" class="sp-dkey-row">
                  <span class="sp-dkey-val">D {{ fmtShort(row.pctD) }}</span>
                  <span class="sp-dkey-bar" aria-hidden="true">
                    <span
                      class="sp-dkey-d"
                      :style="{ width: spellSlotSplit(row.pctD, row.pctF)!.d + '%' }"
                    />
                    <span
                      class="sp-dkey-f"
                      :style="{ width: spellSlotSplit(row.pctD, row.pctF)!.f + '%' }"
                    />
                  </span>
                  <span class="sp-dkey-val">{{ fmtShort(row.pctF) }} F</span>
                </div>
                <span v-else class="sp-dval">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <StatisticsRangePagination
        v-model:page="page"
        v-model:page-size="pageSize"
        class="statistics-spells-pagination rounded-lg border border-primary/20 bg-surface/20 px-3 py-2 text-sm text-text/80 md:rounded-none md:border-t md:bg-transparent md:px-4"
        :total-count="totalRowsCount"
        :total-pages="totalPages"
      >
        {{ totalRowsCount }} {{ p.t('statisticsPage.overviewDetailSummonerSpells') }}
      </StatisticsRangePagination>
    </div>
    <div v-else class="text-text/70">{{ p.t('statisticsPage.overviewDetailNoData') }}</div>
  </div>
</template>

<style scoped>
.sp-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.sp-title {
  font-size: 20px;
  font-weight: 600;
  color: #f0e6d2;
}
.spells-mode {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid #0a323c;
  border-radius: 8px;
  background: #0a1428;
}
.spells-mode-btn {
  height: 34px;
  padding: 0 14px;
  border-radius: 6px;
  font-size: 14px;
  color: #a09b8c;
}
.spells-mode-btn:hover {
  color: #f0e6d2;
}
.spells-mode-btn.is-active {
  color: #f0e6d2;
  background: #0a323c;
}
.sp-dtable-wrap {
  overflow-x: auto;
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
}
.sp-dtable {
  width: 100%;
  min-width: 900px;
  border-collapse: collapse;
  font-size: 14px;
  color: #f0e6d2;
}
.sp-dhead th {
  padding: 10px 16px;
  font-size: 12px;
  font-weight: 600;
  color: #a09b8c;
  border-bottom: 1px solid #0a323c;
  white-space: nowrap;
}
.sp-dhead th.is-sorted {
  color: #c8aa6e;
}
.sp-dsort {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: inherit;
}
.sp-dsort:hover {
  color: #f0e6d2;
}
.sp-dsort-delta {
  margin-left: 4px;
  font-size: 11px;
  color: #5b5a56;
}
.sp-dsort-delta.is-on,
.sp-dsort-delta:hover {
  color: #c8aa6e;
}
.sp-dleft {
  text-align: left;
  padding: 8px 20px;
}
.sp-dnum {
  text-align: right;
  padding: 10px 16px;
  white-space: nowrap;
  vertical-align: middle;
}
.sp-dspell {
  font-weight: 400;
}
.sp-dspell-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sp-dicon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  object-fit: cover;
}
.sp-drow {
  border-bottom: 1px solid #1e2328;
}
.sp-drow:hover {
  background: #0e1a2e;
}
.sp-dval {
  display: block;
  font-variant-numeric: tabular-nums;
}
.sp-dstrong {
  font-weight: 600;
}
.sp-ddelta {
  display: block;
  font-size: 11px;
  line-height: 1.2;
  color: #5b5a56;
}
.sp-ddelta.is-up {
  color: #0ac8b9;
}
.sp-ddelta.is-down {
  color: #e2665a;
}
.sp-dbar-cell {
  min-width: 200px;
}
.sp-dbar-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sp-dbar {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: #1e2328;
  overflow: hidden;
}
.sp-dbar-fill {
  display: block;
  height: 100%;
  background: #c89b3c;
  border-radius: 4px;
}
.sp-dbar-row .sp-dval {
  width: 64px;
  text-align: right;
}
.sp-dkey-cell {
  width: 200px;
}
.sp-dkey-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.sp-dkey-bar {
  display: flex;
  flex: 1;
  gap: 2px;
  height: 8px;
}
.sp-dkey-d {
  background: #0397ab;
  border-radius: 4px 0 0 4px;
}
.sp-dkey-f {
  background: #005a82;
  border-radius: 0 4px 4px 0;
}
</style>
