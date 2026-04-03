<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'
import { getSpellImageUrl } from '~/utils/imageUrl'

export type SummonerSpellSoloRow = {
  spellId: number
  games: number
  wins: number
  pickrate: number
  winrate: number
  countSlot0?: number
  countSlot1?: number
  pctSlotD?: number
  pctSlotF?: number
  highEloGames?: number
  highEloWinrate?: number
  highEloRank?: number
}

export type SummonerSpellSetRow = {
  spellIdD: number
  spellIdF: number
  games: number
  wins: number
  pickrate: number
  winrate: number
  highEloGames?: number
  highEloWinrate?: number
  highEloRank?: number
}

type SoloEnriched = SummonerSpellSoloRow & {
  deltaPickPp?: number
  deltaWrPp?: number
  deltaHighEloWrPp?: number
  deltaHighEloGames?: number
}

type SetEnriched = SummonerSpellSetRow & {
  deltaPickPp?: number
  deltaWrPp?: number
  deltaHighEloWrPp?: number
  deltaHighEloGames?: number
}

const props = defineProps<{
  soloRows: SummonerSpellSoloRow[]
  setRows: SummonerSpellSetRow[]
  baselineSolo?: SummonerSpellSoloRow[] | null
  baselineSets?: SummonerSpellSetRow[] | null
  refVersionLabel: string | null
  baselinePending?: boolean
  gameVersion: string | null
}>()

const { t } = useI18n()
const summonerSpellsStore = useSummonerSpellsStore()

type SoloSortKey =
  | 'games'
  | 'pickrate'
  | 'winrate'
  | 'pctSlotD'
  | 'pctSlotF'
  | 'highEloRank'
  | 'highEloWinrate'
  | 'highEloGames'

type SetSortKey =
  | 'games'
  | 'pickrate'
  | 'winrate'
  | 'highEloRank'
  | 'highEloWinrate'
  | 'highEloGames'

const soloSortKey = ref<SoloSortKey>('games')
const soloSortDir = ref<'desc' | 'asc'>('desc')
const setSortKey = ref<SetSortKey>('games')
const setSortDir = ref<'desc' | 'asc'>('desc')

const refLabel = computed(() => (props.refVersionLabel ?? '').trim() || null)

const hasApexSolo = computed(() =>
  props.soloRows.some(r => (r.highEloGames ?? 0) > 0 || r.highEloRank != null)
)

const hasApexSets = computed(() =>
  props.setRows.some(r => (r.highEloGames ?? 0) > 0 || r.highEloRank != null)
)

function spellName(spellId: number): string | null {
  return summonerSpellsStore.getSpellById(String(spellId))?.name ?? null
}

function spellImageName(spellId: number): string | null {
  return summonerSpellsStore.getSpellById(String(spellId))?.image?.full ?? null
}

function formatDeltaPp(pp: number): string {
  const sign = pp > 0 ? '+' : ''
  return `${sign}${pp.toFixed(2)}`
}

function deltaClassPp(pp: number): string {
  if (pp > 0.05) return 'text-green-400/90'
  if (pp < -0.05) return 'text-red-400/90'
  return 'text-text/55'
}

function deltaClassGames(n: number): string {
  if (n > 0) return 'text-green-400/90'
  if (n < 0) return 'text-red-400/90'
  return 'text-text/55'
}

function formatDeltaGames(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${Math.round(n).toLocaleString()}`
}

function winrateClass(pct: number): string {
  if (!Number.isFinite(pct)) return 'text-text/80'
  if (pct >= 52.5) return 'font-medium text-green-400'
  if (pct >= 51) return 'text-green-500/95'
  if (pct >= 50) return 'text-sky-200/85'
  return 'text-red-400/90'
}

const soloEnriched = computed((): SoloEnriched[] => {
  const base = props.baselineSolo
  const m = base?.length ? new Map(base.map(r => [r.spellId, r])) : null
  return props.soloRows.map(r => {
    const b = m?.get(r.spellId)
    let deltaHighEloWrPp: number | undefined
    let deltaHighEloGames: number | undefined
    if (
      b != null &&
      r.highEloWinrate != null &&
      b.highEloWinrate != null &&
      Number.isFinite(r.highEloWinrate) &&
      Number.isFinite(b.highEloWinrate)
    ) {
      deltaHighEloWrPp = r.highEloWinrate - b.highEloWinrate
    }
    if (b != null && r.highEloGames != null && b.highEloGames != null) {
      deltaHighEloGames = r.highEloGames - b.highEloGames
    }
    return {
      ...r,
      deltaPickPp: b != null ? r.pickrate - b.pickrate : undefined,
      deltaWrPp: b != null ? r.winrate - b.winrate : undefined,
      deltaHighEloWrPp,
      deltaHighEloGames,
    }
  })
})

const setEnriched = computed((): SetEnriched[] => {
  const base = props.baselineSets
  const m = base?.length ? new Map(base.map(r => [`${r.spellIdD}:${r.spellIdF}`, r])) : null
  return props.setRows.map(r => {
    const key = `${r.spellIdD}:${r.spellIdF}`
    const b = m?.get(key)
    let deltaHighEloWrPp: number | undefined
    let deltaHighEloGames: number | undefined
    if (
      b != null &&
      r.highEloWinrate != null &&
      b.highEloWinrate != null &&
      Number.isFinite(r.highEloWinrate) &&
      Number.isFinite(b.highEloWinrate)
    ) {
      deltaHighEloWrPp = r.highEloWinrate - b.highEloWinrate
    }
    if (b != null && r.highEloGames != null && b.highEloGames != null) {
      deltaHighEloGames = r.highEloGames - b.highEloGames
    }
    return {
      ...r,
      deltaPickPp: b != null ? r.pickrate - b.pickrate : undefined,
      deltaWrPp: b != null ? r.winrate - b.winrate : undefined,
      deltaHighEloWrPp,
      deltaHighEloGames,
    }
  })
})

function cycleSoloSort(key: SoloSortKey) {
  if (soloSortKey.value === key) {
    soloSortDir.value = soloSortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    soloSortKey.value = key
    soloSortDir.value = 'desc'
  }
}

function cycleSetSort(key: SetSortKey) {
  if (setSortKey.value === key) {
    setSortDir.value = setSortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    setSortKey.value = key
    setSortDir.value = 'desc'
  }
}

function soloSortIcon(key: SoloSortKey): string {
  if (soloSortKey.value !== key) return ''
  return soloSortDir.value === 'desc' ? ' ▼' : ' ▲'
}

function setSortIcon(key: SetSortKey): string {
  if (setSortKey.value !== key) return ''
  return setSortDir.value === 'desc' ? ' ▼' : ' ▲'
}

function soloSortVal(row: SoloEnriched, key: SoloSortKey): number {
  switch (key) {
    case 'games':
      return row.games
    case 'pickrate':
      return row.pickrate
    case 'winrate':
      return row.winrate
    case 'pctSlotD':
      return row.pctSlotD ?? 0
    case 'pctSlotF':
      return row.pctSlotF ?? 0
    case 'highEloRank':
      return row.highEloRank ?? 999999
    case 'highEloWinrate':
      return row.highEloWinrate ?? 0
    case 'highEloGames':
      return row.highEloGames ?? 0
    default:
      return 0
  }
}

function setSortVal(row: SetEnriched, key: SetSortKey): number {
  switch (key) {
    case 'games':
      return row.games
    case 'pickrate':
      return row.pickrate
    case 'winrate':
      return row.winrate
    case 'highEloRank':
      return row.highEloRank ?? 999999
    case 'highEloWinrate':
      return row.highEloWinrate ?? 0
    case 'highEloGames':
      return row.highEloGames ?? 0
    default:
      return 0
  }
}

const sortedSolo = computed(() => {
  const list = soloEnriched.value
  const key = soloSortKey.value
  const dir = soloSortDir.value
  const mult = dir === 'desc' ? 1 : -1
  return [...list].sort((a, b) => mult * (soloSortVal(a, key) - soloSortVal(b, key)))
})

const sortedSets = computed(() => {
  const list = setEnriched.value
  const key = setSortKey.value
  const dir = setSortDir.value
  const mult = dir === 'desc' ? 1 : -1
  return [...list].sort((a, b) => mult * (setSortVal(a, key) - setSortVal(b, key)))
})

function pctD(row: SummonerSpellSoloRow): string {
  const v = row.pctSlotD
  return v != null && Number.isFinite(v) ? v.toFixed(1) : '—'
}

function pctF(row: SummonerSpellSoloRow): string {
  const v = row.pctSlotF
  return v != null && Number.isFinite(v) ? v.toFixed(1) : '—'
}
</script>

<template>
  <div class="space-y-8">
    <section v-if="soloRows.length">
      <h3 class="mb-2 text-lg font-semibold text-text-accent">
        {{ t('statisticsPage.summonerSpellsTableSolo') }}
      </h3>
      <div
        class="statistics-overview-surface w-full overflow-x-auto rounded-lg border border-primary/30"
      >
        <div class="tier-list-lolalytics w-full min-w-0 text-[13px]">
          <div
            class="tier-list-lolalytics-head sticky top-0 z-10 flex h-8 w-full items-stretch justify-between border-b border-black bg-[var(--color-grey-300)] text-text-primary/85"
          >
            <div
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all hidden w-8 shrink-0 items-center justify-center border-b border-t border-black border-t-[var(--color-grey-300)] px-0.5 text-center text-[11px] md:flex"
            >
              #
            </div>
            <div
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all flex w-[200px] shrink-0 items-center justify-start border-b border-t border-black border-t-[var(--color-grey-300)] px-2"
            >
              {{ t('statisticsPage.overviewDetailSummonerSpells') }}
            </div>
            <button
              type="button"
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all flex w-12 shrink-0 cursor-pointer items-center justify-center border-b border-t border-black border-t-[var(--color-grey-300)] hover:bg-primary/25"
              @click="cycleSoloSort('pickrate')"
            >
              {{ t('statisticsPage.overviewDetailPickRate') }}{{ soloSortIcon('pickrate') }}
            </button>
            <button
              type="button"
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all flex w-12 shrink-0 cursor-pointer items-center justify-center border-b border-t border-black border-t-[var(--color-grey-300)] hover:bg-primary/25"
              @click="cycleSoloSort('winrate')"
            >
              {{ t('statisticsPage.overviewDetailWinRate') }}{{ soloSortIcon('winrate') }}
            </button>
            <button
              type="button"
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all flex w-11 shrink-0 cursor-pointer flex-col items-center justify-center border-b border-t border-black border-t-[var(--color-grey-300)] text-[10px] leading-tight hover:bg-primary/25"
              :title="t('statisticsPage.summonerSpellsSlotDTooltip')"
              @click="cycleSoloSort('pctSlotD')"
            >
              D{{ soloSortIcon('pctSlotD') }}
            </button>
            <button
              type="button"
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all flex w-11 shrink-0 cursor-pointer flex-col items-center justify-center border-b border-t border-black border-t-[var(--color-grey-300)] text-[10px] leading-tight hover:bg-primary/25"
              :title="t('statisticsPage.summonerSpellsSlotFTooltip')"
              @click="cycleSoloSort('pctSlotF')"
            >
              F{{ soloSortIcon('pctSlotF') }}
            </button>
            <button
              type="button"
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all hidden w-[68px] shrink-0 cursor-pointer items-center justify-center border-b border-t border-black border-t-[var(--color-grey-300)] hover:bg-primary/25 sm:flex"
              @click="cycleSoloSort('games')"
            >
              {{ t('statisticsPage.tierListGames') }}{{ soloSortIcon('games') }}
            </button>
            <template v-if="hasApexSolo">
              <button
                type="button"
                class="tier-list-lolalytics-th tier-list-lolalytics-th-apex hidden w-9 shrink-0 cursor-pointer items-center justify-center border-b border-t border-black border-t-[var(--color-grey-300)] text-[rgb(var(--rgb-gold-100))] hover:bg-primary/25 sm:flex"
                :title="t('statisticsPage.tierListApexRankTooltip')"
                @click="cycleSoloSort('highEloRank')"
              >
                {{ t('statisticsPage.tierListApexRank') }}{{ soloSortIcon('highEloRank') }}
              </button>
              <button
                type="button"
                class="tier-list-lolalytics-th tier-list-lolalytics-th-apex hidden w-12 shrink-0 cursor-pointer items-center justify-center border-b border-t border-black border-t-[var(--color-grey-300)] text-[rgb(var(--rgb-gold-100))] hover:bg-primary/25 sm:flex"
                @click="cycleSoloSort('highEloWinrate')"
              >
                {{ t('statisticsPage.winrate') }}{{ soloSortIcon('highEloWinrate') }}
              </button>
              <button
                type="button"
                class="tier-list-lolalytics-th tier-list-lolalytics-th-apex hidden w-12 shrink-0 cursor-pointer items-center justify-center border-b border-t border-black border-t-[var(--color-grey-300)] text-[rgb(var(--rgb-gold-100))] hover:bg-primary/25 sm:flex"
                @click="cycleSoloSort('highEloGames')"
              >
                {{ t('statisticsPage.tierListGames') }}{{ soloSortIcon('highEloGames') }}
              </button>
            </template>
          </div>

          <div
            v-for="(row, idx) in sortedSolo"
            :key="row.spellId"
            class="tier-list-lolalytics-row flex min-h-[52px] w-full items-center justify-between py-0.5 text-text-primary/90 odd:bg-white/[0.04] even:bg-black/25"
          >
            <div
              class="tier-list-lolalytics-td hidden w-8 shrink-0 flex-col items-center justify-center text-[11px] md:flex"
            >
              {{ idx + 1 }}
            </div>
            <div class="tier-list-lolalytics-td flex w-[200px] shrink-0 items-center gap-2 px-2">
              <img
                v-if="gameVersion && spellImageName(row.spellId)"
                :src="getSpellImageUrl(gameVersion, spellImageName(row.spellId)!)"
                :alt="spellName(row.spellId) || ''"
                class="h-9 w-9 shrink-0 border-2 border-black object-cover"
                width="36"
                height="36"
              />
              <span class="min-w-0 truncate font-medium text-accent">{{
                spellName(row.spellId) || row.spellId
              }}</span>
            </div>
            <div
              class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight"
            >
              <span>{{ row.pickrate.toFixed(2) }}</span>
              <span
                v-if="refLabel && row.deltaPickPp != null && !baselinePending"
                class="text-[10px] leading-none"
                :class="deltaClassPp(row.deltaPickPp)"
                :title="t('statisticsPage.tierListPatchDeltaTitle', { ref: refLabel })"
                >{{ formatDeltaPp(row.deltaPickPp) }}</span
              >
            </div>
            <div
              class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight"
            >
              <span :class="winrateClass(row.winrate)">{{ row.winrate.toFixed(2) }}</span>
              <span
                v-if="refLabel && row.deltaWrPp != null && !baselinePending"
                class="text-[10px] leading-none"
                :class="deltaClassPp(row.deltaWrPp)"
                :title="t('statisticsPage.tierListPatchDeltaTitle', { ref: refLabel })"
                >{{ formatDeltaPp(row.deltaWrPp) }}</span
              >
            </div>
            <div
              class="tier-list-lolalytics-td flex w-11 shrink-0 flex-col items-center justify-center text-center text-[11px] leading-tight"
              :title="t('statisticsPage.summonerSpellsSlotDTooltip')"
            >
              {{ pctD(row) }}
            </div>
            <div
              class="tier-list-lolalytics-td flex w-11 shrink-0 flex-col items-center justify-center text-center text-[11px] leading-tight"
              :title="t('statisticsPage.summonerSpellsSlotFTooltip')"
            >
              {{ pctF(row) }}
            </div>
            <div
              class="tier-list-lolalytics-td hidden w-[68px] shrink-0 flex-col items-center justify-center text-center text-[11px] leading-tight sm:flex"
            >
              <span>{{ row.games.toLocaleString() }}</span>
            </div>
            <template v-if="hasApexSolo">
              <div
                class="tier-list-lolalytics-td tier-list-lolalytics-td-apex hidden w-9 shrink-0 items-center justify-center sm:flex"
              >
                {{ row.highEloRank != null ? row.highEloRank : '—' }}
              </div>
              <div
                class="tier-list-lolalytics-td tier-list-lolalytics-td-apex hidden w-12 shrink-0 flex-col items-center justify-center gap-0 leading-tight sm:flex"
              >
                <template v-if="row.highEloWinrate != null">
                  <span :class="winrateClass(row.highEloWinrate)">{{
                    row.highEloWinrate.toFixed(2)
                  }}</span>
                  <span
                    v-if="refLabel && row.deltaHighEloWrPp != null && !baselinePending"
                    class="text-[10px] leading-none"
                    :class="deltaClassPp(row.deltaHighEloWrPp)"
                    :title="t('statisticsPage.tierListPatchDeltaTitle', { ref: refLabel })"
                    >{{ formatDeltaPp(row.deltaHighEloWrPp) }}</span
                  >
                </template>
                <span v-else>—</span>
              </div>
              <div
                class="tier-list-lolalytics-td tier-list-lolalytics-td-apex hidden w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight sm:flex"
              >
                <span>{{
                  row.highEloGames != null ? row.highEloGames.toLocaleString() : '—'
                }}</span>
                <span
                  v-if="refLabel && row.deltaHighEloGames != null && !baselinePending"
                  class="text-[10px] leading-none"
                  :class="deltaClassGames(row.deltaHighEloGames)"
                  :title="t('statisticsPage.tierListPatchDeltaGamesTitle', { ref: refLabel })"
                  >{{ formatDeltaGames(row.deltaHighEloGames) }}</span
                >
              </div>
            </template>
          </div>
        </div>
      </div>
    </section>

    <section v-if="setRows.length">
      <h3 class="mb-2 text-lg font-semibold text-text-accent">
        {{ t('statisticsPage.summonerSpellsTableSets') }}
      </h3>
      <p class="mb-2 text-xs text-text/65">{{ t('statisticsPage.summonerSpellsSetsOrderHint') }}</p>
      <div
        class="statistics-overview-surface w-full overflow-x-auto rounded-lg border border-primary/30"
      >
        <div class="tier-list-lolalytics w-full min-w-0 text-[13px]">
          <div
            class="tier-list-lolalytics-head sticky top-0 z-10 flex h-8 w-full items-stretch justify-between border-b border-black bg-[var(--color-grey-300)] text-text-primary/85"
          >
            <div
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all hidden w-8 shrink-0 items-center justify-center border-b border-t border-black border-t-[var(--color-grey-300)] text-[11px] md:flex"
            >
              #
            </div>
            <div
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all flex min-w-[220px] shrink-0 items-center justify-start border-b border-t border-black border-t-[var(--color-grey-300)] px-2"
            >
              {{ t('statisticsPage.summonerSpellsColPairOrder') }}
            </div>
            <button
              type="button"
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all flex w-12 shrink-0 cursor-pointer items-center justify-center border-b border-t border-black border-t-[var(--color-grey-300)] hover:bg-primary/25"
              @click="cycleSetSort('pickrate')"
            >
              {{ t('statisticsPage.overviewDetailPickRate') }}{{ setSortIcon('pickrate') }}
            </button>
            <button
              type="button"
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all flex w-12 shrink-0 cursor-pointer items-center justify-center border-b border-t border-black border-t-[var(--color-grey-300)] hover:bg-primary/25"
              @click="cycleSetSort('winrate')"
            >
              {{ t('statisticsPage.overviewDetailWinRate') }}{{ setSortIcon('winrate') }}
            </button>
            <button
              type="button"
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all hidden w-[68px] shrink-0 cursor-pointer items-center justify-center border-b border-t border-black border-t-[var(--color-grey-300)] hover:bg-primary/25 sm:flex"
              @click="cycleSetSort('games')"
            >
              {{ t('statisticsPage.tierListGames') }}{{ setSortIcon('games') }}
            </button>
            <template v-if="hasApexSets">
              <button
                type="button"
                class="tier-list-lolalytics-th tier-list-lolalytics-th-apex hidden w-9 shrink-0 cursor-pointer items-center justify-center border-b border-t border-black border-t-[var(--color-grey-300)] text-[rgb(var(--rgb-gold-100))] hover:bg-primary/25 sm:flex"
                :title="t('statisticsPage.tierListApexRankTooltip')"
                @click="cycleSetSort('highEloRank')"
              >
                {{ t('statisticsPage.tierListApexRank') }}{{ setSortIcon('highEloRank') }}
              </button>
              <button
                type="button"
                class="tier-list-lolalytics-th tier-list-lolalytics-th-apex hidden w-12 shrink-0 cursor-pointer items-center justify-center border-b border-t border-black border-t-[var(--color-grey-300)] text-[rgb(var(--rgb-gold-100))] hover:bg-primary/25 sm:flex"
                @click="cycleSetSort('highEloWinrate')"
              >
                {{ t('statisticsPage.winrate') }}{{ setSortIcon('highEloWinrate') }}
              </button>
              <button
                type="button"
                class="tier-list-lolalytics-th tier-list-lolalytics-th-apex hidden w-12 shrink-0 cursor-pointer items-center justify-center border-b border-t border-black border-t-[var(--color-grey-300)] text-[rgb(var(--rgb-gold-100))] hover:bg-primary/25 sm:flex"
                @click="cycleSetSort('highEloGames')"
              >
                {{ t('statisticsPage.tierListGames') }}{{ setSortIcon('highEloGames') }}
              </button>
            </template>
          </div>

          <div
            v-for="(row, idx) in sortedSets"
            :key="`${row.spellIdD}-${row.spellIdF}`"
            class="tier-list-lolalytics-row flex min-h-[52px] w-full items-center justify-between py-0.5 text-text-primary/90 odd:bg-white/[0.04] even:bg-black/25"
          >
            <div
              class="tier-list-lolalytics-td hidden w-8 shrink-0 flex-col items-center justify-center text-[11px] md:flex"
            >
              {{ idx + 1 }}
            </div>
            <div
              class="tier-list-lolalytics-td flex min-w-[220px] shrink-0 items-center gap-2 px-2"
            >
              <div class="flex shrink-0 items-center gap-0.5">
                <img
                  v-if="gameVersion && spellImageName(row.spellIdD)"
                  :src="getSpellImageUrl(gameVersion, spellImageName(row.spellIdD)!)"
                  :alt="spellName(row.spellIdD) || ''"
                  class="h-8 w-8 border-2 border-black object-cover"
                  width="32"
                  height="32"
                />
                <span class="text-text/50">→</span>
                <img
                  v-if="gameVersion && spellImageName(row.spellIdF)"
                  :src="getSpellImageUrl(gameVersion, spellImageName(row.spellIdF)!)"
                  :alt="spellName(row.spellIdF) || ''"
                  class="h-8 w-8 border-2 border-black object-cover"
                  width="32"
                  height="32"
                />
              </div>
              <div class="min-w-0 flex-1 text-[11px] leading-tight text-text/90">
                <div class="truncate">
                  {{ spellName(row.spellIdD) || row.spellIdD }}
                </div>
                <div class="truncate">
                  {{ spellName(row.spellIdF) || row.spellIdF }}
                </div>
              </div>
            </div>
            <div
              class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight"
            >
              <span>{{ row.pickrate.toFixed(2) }}</span>
              <span
                v-if="refLabel && row.deltaPickPp != null && !baselinePending"
                class="text-[10px] leading-none"
                :class="deltaClassPp(row.deltaPickPp)"
                :title="t('statisticsPage.tierListPatchDeltaTitle', { ref: refLabel })"
                >{{ formatDeltaPp(row.deltaPickPp) }}</span
              >
            </div>
            <div
              class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight"
            >
              <span :class="winrateClass(row.winrate)">{{ row.winrate.toFixed(2) }}</span>
              <span
                v-if="refLabel && row.deltaWrPp != null && !baselinePending"
                class="text-[10px] leading-none"
                :class="deltaClassPp(row.deltaWrPp)"
                :title="t('statisticsPage.tierListPatchDeltaTitle', { ref: refLabel })"
                >{{ formatDeltaPp(row.deltaWrPp) }}</span
              >
            </div>
            <div
              class="tier-list-lolalytics-td hidden w-[68px] shrink-0 flex-col items-center justify-center text-center text-[11px] leading-tight sm:flex"
            >
              <span>{{ row.games.toLocaleString() }}</span>
            </div>
            <template v-if="hasApexSets">
              <div
                class="tier-list-lolalytics-td tier-list-lolalytics-td-apex hidden w-9 shrink-0 items-center justify-center sm:flex"
              >
                {{ row.highEloRank != null ? row.highEloRank : '—' }}
              </div>
              <div
                class="tier-list-lolalytics-td tier-list-lolalytics-td-apex hidden w-12 shrink-0 flex-col items-center justify-center gap-0 leading-tight sm:flex"
              >
                <template v-if="row.highEloWinrate != null">
                  <span :class="winrateClass(row.highEloWinrate)">{{
                    row.highEloWinrate.toFixed(2)
                  }}</span>
                  <span
                    v-if="refLabel && row.deltaHighEloWrPp != null && !baselinePending"
                    class="text-[10px] leading-none"
                    :class="deltaClassPp(row.deltaHighEloWrPp)"
                    :title="t('statisticsPage.tierListPatchDeltaTitle', { ref: refLabel })"
                    >{{ formatDeltaPp(row.deltaHighEloWrPp) }}</span
                  >
                </template>
                <span v-else>—</span>
              </div>
              <div
                class="tier-list-lolalytics-td tier-list-lolalytics-td-apex hidden w-12 shrink-0 flex-col items-center justify-center gap-0 text-center leading-tight sm:flex"
              >
                <span>{{
                  row.highEloGames != null ? row.highEloGames.toLocaleString() : '—'
                }}</span>
                <span
                  v-if="refLabel && row.deltaHighEloGames != null && !baselinePending"
                  class="text-[10px] leading-none"
                  :class="deltaClassGames(row.deltaHighEloGames)"
                  :title="t('statisticsPage.tierListPatchDeltaGamesTitle', { ref: refLabel })"
                  >{{ formatDeltaGames(row.deltaHighEloGames) }}</span
                >
              </div>
            </template>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
