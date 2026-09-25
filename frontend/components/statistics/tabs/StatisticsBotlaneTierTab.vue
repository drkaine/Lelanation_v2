<script setup lang="ts">
import { computed, unref } from 'vue'
import type { StatisticsMobileSortOption } from '~/components/statistics/StatisticsMobileSortBar.vue'
import {
  injectStatisticsPageCtx,
  type StatisticsTierListPageCtx,
} from '~/composables/statistics/statisticsPageCtx'
import { botlaneRowKey } from '~/composables/statistics/botlanePatchDeltas'
import { usePagination } from '~/composables/usePagination'
import { useTableSort } from '~/composables/useTableSort'
import { getChampionImageUrl } from '~/utils/imageUrl'
import { matchesChampionSearch } from '~/utils/multilingualEntitySearch'
import {
  botlaneChampionIds,
  sortBotlaneRows,
  tierLabelKey,
  withBotlaneMetrics,
  type BotlaneMode,
  type BotlaneSortKey,
} from '~/utils/statistics/botlaneTierTable'
import { useToggleSet } from '~/composables/useToggleSet'

/** `vs`: duo against duo (matchups) — `duo`: duo ranking. */
const props = defineProps<{ mode: BotlaneMode }>()

const p = injectStatisticsPageCtx<StatisticsTierListPageCtx>()

const MODE_UI = {
  vs: {
    loadError: 'statisticsPage.vsBotlaneLoadError',
    noData: 'statisticsPage.vsBotlaneNoData',
    rowsLabel: 'statisticsPage.vsBotlaneRowsLabel',
    sortBarId: 'botlane-matchups-mobile-sort',
    mobileKeyPrefix: 'botlane-vs-mob-',
    rowKeyPrefix: '',
    cardMode: 'matchups',
  },
  duo: {
    loadError: 'statisticsPage.vsBotlaneRankingLoadError',
    noData: 'statisticsPage.vsBotlaneRankingNoData',
    rowsLabel: 'statisticsPage.vsBotlaneRankingRowsLabel',
    sortBarId: 'botlane-duo-rank-mobile-sort',
    mobileKeyPrefix: 'botlane-rk-mob-',
    rowKeyPrefix: 'rk-',
    cardMode: 'duoRank',
  },
} as const

const ui = computed(() => MODE_UI[props.mode])

const source = computed(() =>
  props.mode === 'vs'
    ? { data: p.botlaneVsData, pending: p.botlaneVsPending, error: p.botlaneVsError }
    : { data: p.botlaneRankingData, pending: p.botlaneRankingPending, error: p.botlaneRankingError }
)
const rows = computed(() => source.value.data?.rows ?? [])
const activePending = computed(() => Boolean(unref(source.value.pending)))
const activeError = computed(() => Boolean(unref(source.value.error)))
const patchRefLabel = computed(() => p.botlanePatchDeltaRefLabel ?? null)

const { set: expandedBotlaneKeys, toggle: toggleBotlaneCard } = useToggleSet<string>()

const searchQ = computed(() => String(unref(p.championSearchQuery) ?? '').trim())

function championMatchesSearch(id: number): boolean {
  return matchesChampionSearch(searchQ.value, { championId: id, name: p.championName(id) })
}

const filteredRows = computed(() => {
  const all = withBotlaneMetrics(rows.value)
  if (!searchQ.value) return all
  return all.filter(r => botlaneChampionIds(r, props.mode).some(championMatchesSearch))
})

const { sortBy, sortDir, toggleSort, sortIcon } = useTableSort<BotlaneSortKey>({
  initialKey: 'rank',
  initialDir: 'asc',
  defaultDir: key => (key === 'rank' ? 'asc' : 'desc'),
})

const sortedRows = computed(() => sortBotlaneRows(filteredRows.value, sortBy.value, sortDir.value))

const { page, pageSize, totalRowsCount, totalPages, paginatedRows } = usePagination(sortedRows, {
  resetOn: [searchQ, sortBy, sortDir],
})

function rowKey(row: (typeof paginatedRows.value)[number]): string {
  return botlaneRowKey(row, props.mode)
}

function fmtPct01(v: number): string {
  return `${(v * 100).toFixed(2)}%`
}

function fmtDeltaPp(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}`
}

function deltaVsPeersClass(v: number | null): string {
  if (v == null) return 'text-text/55'
  if (v > 0) return 'text-info/90'
  if (v < 0) return 'text-error/90'
  return 'text-text/80'
}

function fmtPatchPp(v: number | undefined): string {
  if (v == null || !Number.isFinite(v)) return ''
  return p.formatTierListPatchDeltaPp(v)
}

function patchPpClass(v: number | undefined): string {
  if (v == null || !Number.isFinite(v)) return 'text-text/55'
  return p.tierListPatchDeltaClass(v)
}

function fmtPatchRank(v: number | undefined): string {
  if (v == null || !Number.isFinite(v)) return ''
  return p.formatTierListPatchDeltaRank(v)
}

function patchRankClass(v: number | undefined): string {
  if (v == null || !Number.isFinite(v)) return 'text-text/55'
  return p.tierListPatchDeltaRankClass(v)
}

const botlaneMobileSortOptions = computed<StatisticsMobileSortOption[]>(() => [
  { value: 'rank', label: p.t('statisticsPage.tierListRank') },
  { value: 'tier', label: p.t('statisticsPage.tierListTier') },
  { value: 'score', label: p.t('statisticsPage.tierListPbi') },
  { value: 'winrate', label: p.t('statisticsPage.winrate') },
  { value: 'delta', label: p.t('statisticsPage.vsBotlaneDeltaShort') },
  { value: 'pickrate', label: p.t('statisticsPage.tierListPickrate') },
  { value: 'games', label: p.t('statisticsPage.games') },
])
</script>

<template>
  <div class="space-y-4">
    <div v-if="activePending" class="text-text/70">
      {{ p.t('statisticsPage.loading') }}
    </div>
    <div v-else-if="activeError" class="rounded border border-error bg-surface p-3 text-error">
      {{ p.t(ui.loadError) }}
    </div>
    <div
      v-else-if="rows.length === 0"
      class="statistics-overview-surface rounded-lg border border-primary/30 p-4 text-text/70"
    >
      {{ p.t(ui.noData) }}
    </div>
    <div v-else class="space-y-3">
      <StatisticsMobileSortBar
        :id="ui.sortBarId"
        v-model:column="sortBy"
        v-model:direction="sortDir"
        :options="botlaneMobileSortOptions"
        :asc-default-columns="['rank']"
      />
      <div class="statistics-tier-list-mobile-list space-y-2 md:hidden">
        <StatisticsBotlaneDuoMobileCard
          v-for="row in paginatedRows"
          :key="ui.mobileKeyPrefix + rowKey(row)"
          :row="row"
          :mode="ui.cardMode"
          :patch-ref-label="patchRefLabel"
          :expanded="expandedBotlaneKeys.has(rowKey(row))"
          @toggle="toggleBotlaneCard(rowKey(row))"
        />
      </div>
      <div
        class="tier-list-mobile-rotate statistics-overview-surface hidden w-full overflow-x-auto rounded-lg border border-primary/30 md:block"
      >
        <div class="tier-list-lolalytics w-full min-w-0 text-[13px]">
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
              {{
                p.t(
                  mode === 'vs'
                    ? 'statisticsPage.vsBotlaneOurDuo'
                    : 'statisticsPage.tierListBotlaneDuoLabel'
                )
              }}
            </div>
            <div
              v-if="mode === 'vs'"
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
              class="tier-list-lolalytics-th tier-list-lolalytics-th-all flex w-14 shrink-0 items-center justify-center border-b border-black hover:bg-primary/25"
              :class="{ 'px-0.5': mode === 'vs' }"
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
            :key="ui.rowKeyPrefix + rowKey(row)"
            class="tier-list-lolalytics-row flex min-h-[60px] w-full items-center justify-between py-0.5 text-text-primary/90 odd:bg-white/[0.04] even:bg-black/25"
          >
            <div
              class="tier-list-lolalytics-td flex w-10 shrink-0 flex-col items-center justify-center gap-0 tabular-nums leading-tight"
            >
              <span>{{ row.rank }}</span>
              <span
                v-if="patchRefLabel && row.patchRefRankDelta != null"
                class="text-[10px] leading-none"
                :class="patchRankClass(row.patchRefRankDelta)"
                :title="p.t('statisticsPage.tierListPatchDeltaRankTitle', { ref: patchRefLabel })"
                >{{ fmtPatchRank(row.patchRefRankDelta) }}</span
              >
            </div>
            <div
              v-for="duo in mode === 'vs'
                ? [
                    [row.adcId, row.supportId],
                    [row.oppAdcId, row.oppSupportId],
                  ]
                : [[row.adcId, row.supportId]]"
              :key="duo.join('-')"
              class="tier-list-lolalytics-td flex w-[120px] shrink-0 items-center justify-center gap-1 px-1 max-lg:w-[96px]"
            >
              <template v-if="p.gameVersion">
                <template v-for="id in duo" :key="id">
                  <StatisticsChampionDetailLink
                    v-if="p.championByKey(id)"
                    :champion-id="id"
                    class="shrink-0"
                  >
                    <img
                      loading="lazy"
                      decoding="async"
                      :src="getChampionImageUrl(p.gameVersion, p.championByKey(id)!.image.full)"
                      :alt="p.championName(id) || ''"
                      class="h-[50px] w-[50px] border-2 border-black object-cover max-lg:h-10 max-lg:w-10"
                      width="50"
                      height="50"
                    />
                  </StatisticsChampionDetailLink>
                </template>
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
                {{ p.t(tierLabelKey(row.tier)) }}
              </span>
            </div>
            <div
              class="tier-list-lolalytics-td flex w-14 shrink-0 flex-col items-center justify-center gap-0 text-[11px] tabular-nums leading-tight text-text/90"
            >
              <span>{{ row.score.toFixed(2) }}</span>
              <span
                v-if="patchRefLabel && row.patchRefScorePp != null"
                class="text-[10px] leading-none"
                :class="patchPpClass(row.patchRefScorePp)"
                :title="p.t('statisticsPage.tierListPatchDeltaTitle', { ref: patchRefLabel })"
                >{{ fmtPatchPp(row.patchRefScorePp) }}</span
              >
            </div>
            <div
              class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 tabular-nums leading-tight"
              :class="p.tierListWinrateClass(row.winrate * 100)"
            >
              <span>{{ fmtPct01(row.winrate) }}</span>
              <span
                v-if="patchRefLabel && row.patchRefWinratePp != null"
                class="text-[10px] leading-none"
                :class="patchPpClass(row.patchRefWinratePp)"
                :title="p.t('statisticsPage.tierListPatchDeltaTitle', { ref: patchRefLabel })"
                >{{ fmtPatchPp(row.patchRefWinratePp) }}</span
              >
            </div>
            <div
              class="tier-list-lolalytics-td hidden w-12 shrink-0 flex-col items-center justify-center gap-0 text-[11px] tabular-nums leading-tight sm:flex"
            >
              <span :class="deltaVsPeersClass(row.deltaVsPeersPp)">{{
                fmtDeltaPp(row.deltaVsPeersPp)
              }}</span>
              <span
                v-if="patchRefLabel && row.patchRefDeltaVsPeersPp != null"
                class="text-[10px] leading-none"
                :class="patchPpClass(row.patchRefDeltaVsPeersPp)"
                :title="p.t('statisticsPage.tierListPatchDeltaTitle', { ref: patchRefLabel })"
                >{{ fmtPatchPp(row.patchRefDeltaVsPeersPp) }}</span
              >
            </div>
            <div
              class="tier-list-lolalytics-td flex w-12 shrink-0 flex-col items-center justify-center gap-0 tabular-nums leading-tight text-text/80"
            >
              <span>{{ fmtPct01(row.pickrate) }}</span>
              <span
                v-if="patchRefLabel && row.patchRefPickratePp != null"
                class="text-[10px] leading-none"
                :class="patchPpClass(row.patchRefPickratePp)"
                :title="p.t('statisticsPage.tierListPatchDeltaTitle', { ref: patchRefLabel })"
                >{{ fmtPatchPp(row.patchRefPickratePp) }}</span
              >
            </div>
            <div
              class="tier-list-lolalytics-td flex w-11 shrink-0 flex-col items-center justify-center gap-0 tabular-nums leading-tight text-text/80"
            >
              <span>{{ row.games }}</span>
              <span
                v-if="patchRefLabel && row.patchRefGamesDelta != null"
                class="text-[10px] leading-none"
                :class="p.tierListPatchDeltaGamesClass(row.patchRefGamesDelta)"
                :title="p.t('statisticsPage.tierListPatchDeltaGamesTitle', { ref: patchRefLabel })"
                >{{ p.formatTierListPatchDeltaGames(row.patchRefGamesDelta) }}</span
              >
            </div>
          </div>

          <StatisticsRangePagination
            v-model:page="page"
            v-model:page-size="pageSize"
            class="border-t border-primary/20 px-4 py-2 text-sm text-text/80"
            :total-count="totalRowsCount"
            :total-pages="totalPages"
          >
            {{ totalRowsCount }} {{ p.t(ui.rowsLabel) }}
          </StatisticsRangePagination>
        </div>
      </div>
    </div>
  </div>
</template>
