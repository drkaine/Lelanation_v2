<script setup lang="ts">
import { computed, ref, unref } from 'vue'
import { spellsDetail } from '~/utils/statistics/detailPayload'
import {
  injectStatisticsPageCtx,
  type RunesSpellsTabCtx,
} from '~/composables/statistics/statisticsPageCtx'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'
import { getSpellImageUrl } from '~/utils/imageUrl'
import { usePagination } from '~/composables/usePagination'
import { useTableSort } from '~/composables/useTableSort'
import { barPct } from '~/utils/statistics/barPct'
import { surrenderDeltaView } from '~/utils/statistics/surrenderDivisionRows'
import { spellSlotSplit } from '~/utils/statistics/spellSlotSplit'
import { spellCardSplit } from '~/utils/statistics/spellCardSplit'

const props = defineProps<{ cardSummary?: boolean }>()
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

const { sortBy, sortDir, toggleSort, sortIcon } = useTableSort<SortKey>({ resettable: true })
const spellsMode = computed<'solo' | 'pair'>({
  get: () => (p.spellsModeFilter === 'pair' ? 'pair' : 'solo'),
  set: (value: 'solo' | 'pair') => {
    p.spellsModeFilter = value
  },
})
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
/** Maquette 26 : sorts ≥ 1 % des parties en cartes, les autres repliés. */
const SPELL_CARD_MIN_PICK = 1
const showAllSpells = ref(false)
const spellCards = computed(() =>
  props.cardSummary && spellsMode.value === 'solo'
    ? spellCardSplit(displayRows.value, SPELL_CARD_MIN_PICK, 4)
    : null
)
const showFullSpellList = computed(() => !spellCards.value?.cards.length || showAllSpells.value)
const {
  page,
  pageSize,
  totalRowsCount,
  totalPages,
  paginatedRows: paginatedDisplayRows,
} = usePagination(displayRows, {
  resetOn: [spellsMode, sortBy, sortDir, spellSearchQuery],
})

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${fmtNum(Number(v), 2)} %`
}

const { locale } = useI18n()
const maxPick = computed(() => Math.max(0, ...displayRows.value.map(r => Number(r.pickrate) || 0)))
function fmtNum(v: number, digits: number): string {
  return v.toLocaleString(locale.value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}
function fmtCasts(label: string): string {
  return label
    .split('/')
    .map(x => (Number.isFinite(Number(x)) ? fmtNum(Number(x), 1) : x))
    .join(' / ')
}
function fmtDeltaPts(v: number | null | undefined): string {
  if (!hasComparison.value || p.overviewDetailBaselinePending) return ''
  const d = surrenderDeltaView(v)
  if (d.abs == null) return ''
  if (d.abs < 0.005) return '='
  return d.dir === 'up' ? `▲ +${fmtNum(d.abs, 2)}` : `▼ −${fmtNum(d.abs, 2)}`
}
function fmtPct1(v: number | null | undefined): string {
  return v == null ? '—' : `${fmtNum(Number(v), 1)} %`
}
function deltaTone(v: number | null | undefined): string {
  if (v == null || Math.abs(v) < 0.005) return ''
  return v > 0 ? 'is-up' : 'is-down'
}
</script>

<template>
  <div class="space-y-4 pt-2 md:pt-8">
    <div class="sp-head">
      <h2 class="sp-title">{{ p.t('statisticsPage.overviewDetailSummonerSpells') }}</h2>
      <div class="sp-seg" role="group" :aria-label="p.t('statisticsPage.spellsModeAria')">
        <button
          v-for="mode in ['solo', 'pair'] as const"
          :key="mode"
          type="button"
          :class="['sp-seg-btn', spellsMode === mode ? 'is-active' : '']"
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
      <template v-if="spellCards?.cards.length">
        <div class="sp-cards">
          <article v-for="row in spellCards.cards" :key="'spc-' + row.key" class="sp-cardx">
            <div class="sp-cardx-head">
              <img
                v-if="row.imageSpellId != null && spellImage(row.imageSpellId) && p.gameVersion"
                loading="lazy"
                decoding="async"
                :src="getSpellImageUrl(p.gameVersion, spellImage(row.imageSpellId)!)"
                alt=""
                width="36"
                height="36"
              />
              <span class="sp-cardx-name">{{ row.label }}</span>
            </div>
            <span class="sp-cardx-pick">{{ fmtPct1(row.pickrate) }}</span>
            <div class="sp-cardx-track">
              <div class="sp-cardx-fill" :style="{ width: `${barPct(row.pickrate, 100)}%` }" />
            </div>
            <span class="sp-cardx-sub">
              WR {{ fmtPct1(row.winrate) }} · {{ fmtCasts(row.castsLabel) }}
              {{ p.t('statisticsPage.spellsCardCasts')
              }}<template v-if="spellSlotSplit(row.pctD, row.pctF)">
                ·
                {{
                  p.t('statisticsPage.spellsCardKeyD', {
                    pct: spellSlotSplit(row.pctD, row.pctF)!.d,
                  })
                }}</template
              >
            </span>
          </article>
        </div>
        <p v-if="spellCards.rest.length" class="sp-cards-note">
          {{ p.t('statisticsPage.spellsCardRest', { n: spellCards.rest.length }) }}
          <button type="button" class="sp-cards-toggle" @click="showAllSpells = !showAllSpells">
            {{
              p.t(
                showAllSpells
                  ? 'statisticsPage.spellsCardHideAll'
                  : 'statisticsPage.spellsCardShowAll'
              )
            }}
          </button>
        </p>
      </template>
      <template v-if="showFullSpellList">
        <div class="sp-mlist md:hidden">
          <div v-for="row in paginatedDisplayRows" :key="'spm-' + row.key" class="sp-mrow">
            <div class="sp-micons">
              <img
                v-if="row.imageSpellId != null && spellImage(row.imageSpellId) && p.gameVersion"
                loading="lazy"
                decoding="async"
                :src="getSpellImageUrl(p.gameVersion, spellImage(row.imageSpellId)!)"
                alt=""
                width="40"
                height="40"
              />
              <img
                v-if="row.imageSpellId2 != null && spellImage(row.imageSpellId2) && p.gameVersion"
                loading="lazy"
                decoding="async"
                :src="getSpellImageUrl(p.gameVersion, spellImage(row.imageSpellId2)!)"
                alt=""
                width="40"
                height="40"
              />
            </div>
            <div class="sp-mbody">
              <span class="sp-mname">{{ row.label }}</span>
              <div class="sp-track">
                <div class="sp-fill" :style="{ width: `${barPct(row.pickrate, maxPick)}%` }" />
              </div>
            </div>
            <div class="sp-mnums">
              <span class="sp-mpick">{{ fmtPct1(row.pickrate) }}</span>
              <span class="sp-msub">
                WR {{ fmtPct1(row.winrate)
                }}<template v-if="spellsMode === 'solo' && spellSlotSplit(row.pctD, row.pctF)">
                  · D {{ spellSlotSplit(row.pctD, row.pctF)!.d }} %</template
                >
              </span>
            </div>
          </div>
        </div>
        <div class="sp-card hidden md:block">
          <table class="sp-table">
            <thead>
              <tr>
                <th class="sp-th-name">
                  <button type="button" @click="toggleSort('spell')">
                    {{ p.t('statisticsPage.spellsColSpell') }}{{ sortIcon('spell') }}
                  </button>
                </th>
                <th class="sp-th-pick" :title="p.t('statisticsPage.spellsTooltipPickrate')">
                  <button type="button" @click="toggleSort('pickrate')">
                    {{ p.t('statisticsPage.spellsColPick') }}{{ sortIcon('pickrate') }}
                  </button>
                </th>
                <th class="sp-r" :title="p.t('statisticsPage.spellsTooltipCasts')">
                  <button type="button" @click="toggleSort('casts')">
                    {{ p.t('statisticsPage.spellsColCasts') }}{{ sortIcon('casts') }}
                  </button>
                </th>
                <th class="sp-r" :title="p.t('statisticsPage.spellsTooltipWinrate')">
                  <button type="button" @click="toggleSort('winrate')">
                    {{ p.t('statisticsPage.spellsColWr') }}{{ sortIcon('winrate') }}
                  </button>
                </th>
                <th v-if="spellsMode === 'solo'" class="sp-th-split">
                  <button type="button" @click="toggleSort('pctD')">
                    {{ p.t('statisticsPage.spellsColSlot') }}{{ sortIcon('pctD') }}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in paginatedDisplayRows" :key="row.key">
                <td>
                  <div class="sp-name">
                    <img
                      v-if="
                        row.imageSpellId != null && spellImage(row.imageSpellId) && p.gameVersion
                      "
                      loading="lazy"
                      decoding="async"
                      :src="getSpellImageUrl(p.gameVersion, spellImage(row.imageSpellId)!)"
                      alt=""
                      width="32"
                      height="32"
                    />
                    <img
                      v-if="
                        row.imageSpellId2 != null && spellImage(row.imageSpellId2) && p.gameVersion
                      "
                      loading="lazy"
                      decoding="async"
                      :src="getSpellImageUrl(p.gameVersion, spellImage(row.imageSpellId2)!)"
                      alt=""
                      width="32"
                      height="32"
                    />
                    <span>{{ row.label }}</span>
                  </div>
                </td>
                <td class="sp-td-bar">
                  <div class="sp-bar-wrap">
                    <div class="sp-track">
                      <div
                        class="sp-fill"
                        :style="{ width: `${barPct(row.pickrate, maxPick)}%` }"
                      />
                    </div>
                    <b>{{ fmtPct(row.pickrate) }}</b>
                  </div>
                </td>
                <td class="sp-r sp-num">{{ fmtCasts(row.castsLabel) }}</td>
                <td class="sp-r">
                  <div class="sp-num">{{ fmtPct(row.winrate) }}</div>
                  <div class="sp-delta" :class="deltaTone(row.deltaWin)">
                    {{ fmtDeltaPts(row.deltaWin) }}
                  </div>
                </td>
                <td v-if="spellsMode === 'solo'">
                  <div v-if="spellSlotSplit(row.pctD, row.pctF)" class="sp-split">
                    <span>{{ spellSlotSplit(row.pctD, row.pctF)!.d }}</span>
                    <div class="sp-split-bar">
                      <div
                        class="sp-split-d"
                        :style="{ width: `${spellSlotSplit(row.pctD, row.pctF)!.d}%` }"
                      />
                      <div class="sp-split-f" />
                    </div>
                    <span>{{ spellSlotSplit(row.pctD, row.pctF)!.f }}</span>
                  </div>
                  <span v-else class="sp-muted">—</span>
                </td>
              </tr>
            </tbody>
          </table>
          <StatisticsRangePagination
            v-model:page="page"
            v-model:page-size="pageSize"
            class="sp-pagination"
            :total-count="totalRowsCount"
            :total-pages="totalPages"
          >
            {{ totalRowsCount }} {{ p.t('statisticsPage.overviewDetailSummonerSpells') }}
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
          {{ totalRowsCount }} {{ p.t('statisticsPage.overviewDetailSummonerSpells') }}
        </StatisticsRangePagination>
      </template>
    </div>
    <div v-else class="text-text/70">{{ p.t('statisticsPage.overviewDetailNoData') }}</div>
  </div>
</template>

<style scoped>
.sp-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.sp-cardx {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid #463714;
  border-radius: 12px;
  background: #0a1428;
}
.sp-cardx-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sp-cardx-head img {
  width: 36px;
  height: 36px;
  border-radius: 8px;
}
.sp-cardx-name {
  font-weight: 600;
  color: #f0e6d2;
}
.sp-cardx-pick {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 30px;
  font-weight: 700;
  line-height: 1;
  color: #f0e6d2;
  font-variant-numeric: tabular-nums;
}
.sp-cardx-track {
  height: 6px;
  border-radius: 3px;
  background: #1e2328;
}
.sp-cardx-fill {
  height: 6px;
  border-radius: 3px;
  background: #c89b3c;
}
.sp-cardx-sub,
.sp-cards-note {
  font-size: 12px;
  color: #a09b8c;
  font-variant-numeric: tabular-nums;
}
.sp-cards-note {
  margin: 0;
}
.sp-cards-toggle {
  border: 0;
  background: transparent;
  padding: 0;
  font: inherit;
  font-weight: 600;
  color: #c8aa6e;
  cursor: pointer;
}
@media (max-width: 1023px) {
  .sp-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.sp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.sp-title {
  font-size: 20px;
  font-weight: 600;
  color: #f0e6d2;
}
.sp-seg {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: #0a1428;
  border: 1px solid #0a323c;
  border-radius: 8px;
}
.sp-seg-btn {
  height: 34px;
  padding: 0 12px;
  border-radius: 6px;
  font-size: 14px;
  color: #a09b8c;
}
.sp-seg-btn.is-active {
  background: #0a323c;
  color: #f0e6d2;
  font-weight: 600;
}
.sp-card {
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
  overflow: hidden;
}
.sp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  color: #f0e6d2;
}
.sp-table th {
  padding: 12px 20px;
  font-size: 12px;
  font-weight: 600;
  color: #a09b8c;
  text-align: left;
  border-bottom: 1px solid #0a323c;
  white-space: nowrap;
}
.sp-table td {
  padding: 10px 20px;
  border-bottom: 1px solid #1e2328;
  vertical-align: middle;
}
.sp-table tbody tr:last-child td {
  border-bottom: 0;
}
.sp-table .sp-r {
  text-align: right;
}
.sp-th-name {
  width: 22%;
}
.sp-th-pick {
  width: 34%;
}
.sp-th-split {
  width: 18%;
}
.sp-name {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 500;
}
.sp-name img {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid #0a323c;
}
.sp-bar-wrap {
  display: flex;
  align-items: center;
  gap: 16px;
}
.sp-track {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: #1e2328;
  overflow: hidden;
}
.sp-fill {
  height: 100%;
  border-radius: 4px;
  background: #c8aa6e;
}
.sp-bar-wrap b {
  min-width: 64px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.sp-num {
  font-variant-numeric: tabular-nums;
}
.sp-delta {
  font-size: 11px;
  color: #a09b8c;
  font-variant-numeric: tabular-nums;
}
.sp-delta.is-up {
  color: #0ac8b9;
}
.sp-delta.is-down {
  color: #e2665a;
}
.sp-split {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #a09b8c;
  font-variant-numeric: tabular-nums;
}
.sp-split-bar {
  flex: 1;
  display: flex;
  gap: 2px;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
}
.sp-split-d {
  background: #0ac8b9;
  opacity: 0.8;
}
.sp-split-f {
  flex: 1;
  background: #005a82;
}
.sp-muted {
  color: #a09b8c;
}
.sp-pagination {
  border-top: 1px solid #0a323c;
  padding: 10px 20px;
  font-size: 14px;
  color: #a09b8c;
}
.sp-mlist {
  display: flex;
  flex-direction: column;
  padding: 4px 16px;
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
}
.sp-mrow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #1e2328;
}
.sp-mrow:last-child {
  border-bottom: 0;
}
.sp-micons {
  display: flex;
  flex: none;
  gap: 4px;
}
.sp-micons img {
  width: 40px;
  height: 40px;
  border-radius: 6px;
}
.sp-mbody {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8px;
}
.sp-mname {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
  color: #f0e6d2;
}
.sp-mnums {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 116px;
}
.sp-mbody .sp-track {
  flex: none;
  height: 6px;
}
.sp-mpick {
  font-size: 14px;
  font-weight: 700;
  color: #f0e6d2;
  font-variant-numeric: tabular-nums;
}
.sp-msub {
  font-size: 11px;
  color: #a09b8c;
  white-space: nowrap;
}
</style>
