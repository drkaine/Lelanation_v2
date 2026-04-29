<script setup lang="ts">
import { computed, inject, ref, unref } from 'vue'
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
const spellsMode = ref<'solo' | 'pair'>('solo')

const rows = computed<SoloRow[]>(() => p.overviewDetailData?.summonerSpells ?? [])
const pairRows = computed<PairRow[]>(() => p.overviewDetailData?.summonerSpellSets ?? [])
const baselineBySpell = computed<Map<number, SoloRow>>(() => {
  const m = new Map<number, SoloRow>()
  const base = p.overviewDetailBaselineData?.summonerSpells ?? []
  for (const r of base) m.set(r.spellId, r)
  return m
})
const baselineByPair = computed<Map<string, PairRow>>(() => {
  const m = new Map<string, PairRow>()
  const base = p.overviewDetailBaselineData?.summonerSpellSets ?? []
  for (const r of base) m.set(`${r.spellIdD}:${r.spellIdF}`, r)
  return m
})

const enrichedRows = computed<EnrichedRow[]>(() =>
  rows.value.map(r => {
    const b = baselineBySpell.value.get(r.spellId)
    return {
      ...r,
      deltaPick: b ? r.pickrate - b.pickrate : null,
      deltaCasts: b && r.casts != null && b.casts != null ? r.casts - b.casts : null,
      deltaWin: b ? r.winrate - b.winrate : null,
      deltaD: b && r.pctSlotD != null && b.pctSlotD != null ? r.pctSlotD - b.pctSlotD : null,
      deltaF: b && r.pctSlotF != null && b.pctSlotF != null ? r.pctSlotF - b.pctSlotF : null,
    }
  })
)

const enrichedPairRows = computed<EnrichedPairRow[]>(() =>
  pairRows.value.map(r => {
    const b = baselineByPair.value.get(`${r.spellIdD}:${r.spellIdF}`)
    return {
      ...r,
      deltaPick: b ? r.pickrate - b.pickrate : null,
      deltaSpell1Casts:
        b && r.spell1Casts != null && b.spell1Casts != null ? r.spell1Casts - b.spell1Casts : null,
      deltaSpell2Casts:
        b && r.spell2Casts != null && b.spell2Casts != null ? r.spell2Casts - b.spell2Casts : null,
      deltaWin: b ? r.winrate - b.winrate : null,
    }
  })
)

const spellSearchQuery = computed(() =>
  String(unref(p.championSearchQuery) ?? '')
    .trim()
    .toLowerCase()
)

const filteredRows = computed<EnrichedRow[]>(() => {
  if (spellsMode.value !== 'solo') return []
  const q = spellSearchQuery.value
  if (!q) return enrichedRows.value
  return enrichedRows.value.filter(r => {
    const name = spellName(r.spellId).toLowerCase()
    return name.includes(q) || String(r.spellId).includes(q)
  })
})

const filteredPairRows = computed<EnrichedPairRow[]>(() => {
  if (spellsMode.value !== 'pair') return []
  const q = spellSearchQuery.value
  if (!q) return enrichedPairRows.value
  return enrichedPairRows.value.filter(r => {
    const nameD = spellName(r.spellIdD).toLowerCase()
    const nameF = spellName(r.spellIdF).toLowerCase()
    const pairName = `${nameD} + ${nameF}`
    return (
      pairName.includes(q) ||
      nameD.includes(q) ||
      nameF.includes(q) ||
      String(r.spellIdD).includes(q) ||
      String(r.spellIdF).includes(q)
    )
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

function n(v: number | null | undefined): number {
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
    if (key === 'pickrate') return mult * (n(a.pickrate) - n(b.pickrate))
    if (key === 'deltaPick') return mult * (n(a.deltaPick) - n(b.deltaPick))
    if (key === 'casts') return mult * (n(a.casts) - n(b.casts))
    if (key === 'deltaCasts') return mult * (n(a.deltaCasts) - n(b.deltaCasts))
    if (key === 'winrate') return mult * (n(a.winrate) - n(b.winrate))
    if (key === 'deltaWin') return mult * (n(a.deltaWin) - n(b.deltaWin))
    if (key === 'pctD') return mult * (n(a.pctSlotD) - n(b.pctSlotD))
    if (key === 'deltaD') return mult * (n(a.deltaD) - n(b.deltaD))
    if (key === 'pctF') return mult * (n(a.pctSlotF) - n(b.pctSlotF))
    return mult * (n(a.deltaF) - n(b.deltaF))
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
    if (key === 'pickrate') return mult * (n(a.pickrate) - n(b.pickrate))
    if (key === 'deltaPick') return mult * (n(a.deltaPick) - n(b.deltaPick))
    if (key === 'casts')
      return (
        mult *
        (n(Number(a.spell1Casts ?? 0) + Number(a.spell2Casts ?? 0)) -
          n(Number(b.spell1Casts ?? 0) + Number(b.spell2Casts ?? 0)))
      )
    if (key === 'deltaCasts')
      return (
        mult *
        (n(Number(a.deltaSpell1Casts ?? 0) + Number(a.deltaSpell2Casts ?? 0)) -
          n(Number(b.deltaSpell1Casts ?? 0) + Number(b.deltaSpell2Casts ?? 0)))
      )
    if (key === 'winrate') return mult * (n(a.winrate) - n(b.winrate))
    if (key === 'deltaWin') return mult * (n(a.deltaWin) - n(b.deltaWin))
    return 0
  })
  return out
})

const displayRows = computed<DisplayRow[]>(() => {
  if (spellsMode.value === 'solo') {
    return sortedRows.value.map(r => ({
      key: `s-${r.spellId}`,
      label: spellName(r.spellId),
      imageSpellId: r.spellId,
      pickrate: r.pickrate,
      deltaPick: r.deltaPick,
      castsLabel: Number(r.casts ?? 0).toLocaleString(),
      castsSort: Number(r.casts ?? 0),
      deltaCastsLabel: fmtDelta(r.deltaCasts),
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
    imageSpellId: null,
    pickrate: r.pickrate,
    deltaPick: r.deltaPick,
    castsLabel: `${Number(r.spell1Casts ?? 0).toLocaleString()}/${Number(r.spell2Casts ?? 0).toLocaleString()}`,
    castsSort: Number(r.spell1Casts ?? 0) + Number(r.spell2Casts ?? 0),
    deltaCastsLabel: `${fmtDelta(r.deltaSpell1Casts)}/${fmtDelta(r.deltaSpell2Casts)}`,
    deltaCastsSort:
      r.deltaSpell1Casts != null || r.deltaSpell2Casts != null
        ? Number(r.deltaSpell1Casts ?? 0) + Number(r.deltaSpell2Casts ?? 0)
        : null,
    winrate: r.winrate,
    deltaWin: r.deltaWin,
    pctD: null,
    deltaD: null,
    pctF: null,
    deltaF: null,
  }))
})

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${Number(v).toFixed(2)}%`
}

function fmtDelta(v: number | null | undefined): string {
  if (v == null || p.overviewDetailBaselinePending) return '—'
  const val = Number(v)
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`
}

function deltaClass(v: number | null | undefined): string {
  if (v == null) return 'text-text/55'
  if (v > 0) return 'text-success'
  if (v < 0) return 'text-error'
  return 'text-text/75'
}

function deltaLabelClass(v: number | null | undefined): string {
  if (v == null || p.overviewDetailBaselinePending) return 'text-text/55'
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
    <div
      v-else-if="displayRows.length"
      class="statistics-overview-surface w-full overflow-x-auto rounded-lg border border-primary/30"
    >
      <div class="flex items-center gap-2 border-b border-primary/30 px-3 py-2">
        <button
          type="button"
          class="rounded border border-primary/40 px-2 py-1 text-xs"
          :class="spellsMode === 'solo' ? 'bg-primary/20 text-text' : 'bg-background text-text/70'"
          @click="spellsMode = 'solo'"
        >
          {{ p.t('statisticsPage.spellsModeSolo') }}
        </button>
        <button
          type="button"
          class="rounded border border-primary/40 px-2 py-1 text-xs"
          :class="spellsMode === 'pair' ? 'bg-primary/20 text-text' : 'bg-background text-text/70'"
          @click="spellsMode = 'pair'"
        >
          {{ p.t('statisticsPage.spellsModePair') }}
        </button>
      </div>
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
                {{ p.t('statisticsPage.championTableDeltaSymbol') }} pick{{ sortIcon('deltaPick') }}
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
            v-for="row in displayRows"
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
                <span class="font-medium text-accent">{{ row.label }}</span>
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
    <div v-else class="text-text/70">{{ p.t('statisticsPage.overviewDetailNoData') }}</div>
  </div>
</template>
