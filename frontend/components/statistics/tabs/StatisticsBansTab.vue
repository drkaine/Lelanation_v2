<template>
  <div class="space-y-2">
    <div v-if="p.bansPending" class="text-text/70">{{ p.t('statisticsPage.loading') }}</div>
    <div v-else-if="p.bansError" class="rounded border border-error bg-surface p-3 text-error">
      {{ p.bansError }}
    </div>
    <div
      v-else-if="p.bansTableData?.message && !p.bansTableData?.rows?.length"
      class="text-text/70"
    >
      {{ p.bansTableData.message }}
    </div>
    <div v-else class="flex flex-col gap-3">
      <div class="bn-toolbar">
        <label class="bn-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="#A09B8C" stroke-width="2" />
            <path d="M20 20l-3.5-3.5" stroke="#A09B8C" stroke-width="2" stroke-linecap="round" />
          </svg>
          <input
            v-model.trim="searchModel"
            type="search"
            :placeholder="p.t('statisticsPage.searchChampionPlaceholder')"
            :aria-label="p.t('statisticsPage.searchChampion')"
          />
        </label>
        <div role="group" :aria-label="p.t('statisticsPage.bansSplitAria')" class="bn-seg">
          <button
            v-for="m in splitModes"
            :key="m.value"
            type="button"
            :aria-pressed="splitMode === m.value"
            :class="['bn-seg-btn', splitMode === m.value ? 'is-active' : '']"
            @click="splitMode = m.value"
          >
            {{ m.label }}
          </button>
        </div>
        <span class="bn-count hidden md:inline">{{
          p.t('statisticsPage.bansCount', { n: p.totalBansCount })
        }}</span>
      </div>
      <div class="bn-mlist md:hidden">
        <StatisticsChampionDetailLink
          v-for="row in p.paginatedBans"
          :key="'ban-m-' + row.championId"
          :champion-id="row.championId"
          class="bn-mcard"
        >
          <img
            v-if="p.gameVersion && p.championByKey(row.championId)"
            loading="lazy"
            decoding="async"
            :src="p.getChampionImageUrl(p.gameVersion, p.championByKey(row.championId)!.image.full)"
            :alt="p.championName(row.championId) || ''"
            class="bn-mthumb"
          />
          <span v-else class="bn-mthumb" />
          <div class="bn-mbody">
            <div class="bn-mtop">
              <span class="bn-mname">{{ p.championName(row.championId) || row.championId }}</span>
              <span class="bn-mrate">{{
                fmtPct(p.banRateForBansRow(row, p.bansTableData?.matchCount ?? 0))
              }}</span>
              <template v-if="p.bansTableRefData">
                <span
                  v-if="p.bansDeltaPct(row, 'bansTotal') != null"
                  class="bn-mdelta"
                  :class="`bn-delta--${surrenderDeltaView(p.bansDeltaPct(row, 'bansTotal')).dir}`"
                  >{{ fmtDelta(p.bansDeltaPct(row, 'bansTotal')) }}</span
                >
                <span v-else class="bn-mdelta bn-muted">{{ p.t('statisticsPage.bansNew') }}</span>
              </template>
            </div>
            <div class="bn-mbar">
              <div class="bn-track" aria-hidden="true">
                <div
                  class="bn-fill"
                  :style="{
                    width: `${banBarWidth(p.banRateForBansRow(row, p.bansTableData?.matchCount ?? 0), maxBanRate)}%`,
                  }"
                />
              </div>
              <span class="bn-msplit">
                <span :style="{ color: splitColors[0] }">{{ fmtPct(sidePct(row)[0]) }}</span>
                /
                <span :style="{ color: splitColors[1] }">{{ fmtPct(sidePct(row)[1]) }}</span>
              </span>
            </div>
          </div>
        </StatisticsChampionDetailLink>
        <p class="bn-mfoot">
          {{ p.t('statisticsPage.bansMobileFoot') }}
          <span :style="{ color: splitColors[0] }">{{ activeMode.left }}</span> /
          <span :style="{ color: splitColors[1] }">{{ activeMode.right }}</span
          >.
        </p>
      </div>
      <div class="bn-card hidden md:block">
        <table class="bn-table">
          <thead>
            <tr>
              <th class="bn-th-champ">{{ p.t('statisticsPage.tierListColChampion') }}</th>
              <th>
                <button type="button" class="bn-sort is-gold" @click="p.setBansSort('rate')">
                  {{ p.t('statisticsPage.bansColRate') }}{{ p.bansSortHint('rate') }}
                </button>
              </th>
              <th v-if="p.bansTableRefData" class="bn-right">
                <button type="button" class="bn-sort" @click="p.setBansSort('rateDelta')">
                  {{ p.t('statisticsPage.bansColDelta') }}{{ p.bansSortHint('rateDelta') }}
                </button>
              </th>
              <th class="bn-right">
                <button type="button" class="bn-sort" @click="p.setBansSort(sortKeys[0])">
                  {{ colLabels[0] }}{{ p.bansSortHint(sortKeys[0]) }}
                </button>
              </th>
              <th class="bn-right">
                <button type="button" class="bn-sort" @click="p.setBansSort(sortKeys[1])">
                  {{ colLabels[1] }}{{ p.bansSortHint(sortKeys[1]) }}
                </button>
              </th>
              <th class="bn-th-split">{{ p.t('statisticsPage.bansColSplit') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in p.paginatedBans" :key="'ban-' + row.championId">
              <td>
                <StatisticsChampionTableLink
                  class="bn-champ"
                  :champion-id="row.championId"
                  :query="p.championSearchQuery"
                />
              </td>
              <td>
                <div class="bn-rate">
                  <div class="bn-track" aria-hidden="true">
                    <div
                      class="bn-fill"
                      :style="{
                        width: `${banBarWidth(p.banRateForBansRow(row, p.bansTableData?.matchCount ?? 0), maxBanRate)}%`,
                      }"
                    />
                  </div>
                  <span class="bn-val">{{
                    fmtPct(p.banRateForBansRow(row, p.bansTableData?.matchCount ?? 0))
                  }}</span>
                </div>
              </td>
              <td v-if="p.bansTableRefData" class="bn-right bn-num">
                <span
                  v-if="p.bansDeltaPct(row, 'bansTotal') != null"
                  :class="`bn-delta--${surrenderDeltaView(p.bansDeltaPct(row, 'bansTotal')).dir}`"
                  >{{ fmtDelta(p.bansDeltaPct(row, 'bansTotal')) }}</span
                >
                <span v-else class="bn-muted">{{ p.t('statisticsPage.bansNew') }}</span>
              </td>
              <td class="bn-right bn-num">{{ fmtPct(sidePct(row)[0]) }}</td>
              <td class="bn-right bn-num">{{ fmtPct(sidePct(row)[1]) }}</td>
              <td>
                <div
                  v-if="splitShare(row) != null"
                  role="img"
                  :aria-label="splitAria(row)"
                  class="bn-split"
                >
                  <div :style="{ width: `${splitShare(row)}%`, background: splitColors[0] }" />
                  <div class="flex-1" :style="{ background: splitColors[1] }" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <StatisticsRangePagination
          :page="p.bansPage"
          :page-size="p.championsPageSize"
          class="bn-pagination"
          :total-count="p.totalBansCount"
          :total-pages="p.totalBansPages"
          @update:page="p.onBansPageUpdated"
          @update:page-size="p.onBansPageSizeUpdated"
        >
          <template v-if="p.championSearchQuery" #default>
            {{ p.t('statisticsPage.showing') }} {{ p.totalBansCount }}
          </template>
        </StatisticsRangePagination>
      </div>
      <div class="bn-foot hidden md:flex">
        <span>{{ p.t('statisticsPage.bansFootNote') }}</span>
        <span class="bn-legend">
          <span><i :style="{ background: splitColors[0] }" />{{ activeMode.left }}</span>
          <span><i :style="{ background: splitColors[1] }" />{{ activeMode.right }}</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  injectStatisticsPageCtx,
  type StatisticsIndexPageCtx,
} from '~/composables/statistics/statisticsPageCtx'
import type { BansSortCol } from '~/composables/statistics/useStatisticsBansTab'
import { banBarWidth, banSplitShare } from '~/utils/statistics/bansMath'
import { surrenderDeltaView } from '~/utils/statistics/surrenderDivisionRows'

const p = injectStatisticsPageCtx<StatisticsIndexPageCtx>()

/** Banrate max des lignes affichées : échelle des barres. */
type BansSplitMode = 'outcome' | 'side'
const splitMode = ref<BansSplitMode>('outcome')
const splitModes = computed(() => [
  {
    value: 'outcome' as const,
    label: p.t('statisticsPage.bansSplitOutcome'),
    left: p.t('statisticsPage.bansSplitWinner'),
    right: p.t('statisticsPage.bansSplitLoser'),
  },
  {
    value: 'side' as const,
    label: p.t('statisticsPage.bansSplitSide'),
    left: p.t('statisticsPage.bansColBlueSide'),
    right: p.t('statisticsPage.bansColRedSide'),
  },
])
const splitColors = computed(() =>
  splitMode.value === 'outcome' ? ['#0ac8b9', '#e2665a'] : ['#0397ab', '#e2665a']
)
function splitValues(row: (typeof p.paginatedBans)[number]): [number, number] {
  if (splitMode.value === 'outcome') {
    return [p.bansOutcomePct(row.championId, 'win'), p.bansOutcomePct(row.championId, 'loss')]
  }
  return [row.bansBlue, row.bansRed]
}
function splitShare(row: (typeof p.paginatedBans)[number]): number | null {
  const [a, b] = splitValues(row)
  return banSplitShare(a, b)
}
function splitAria(row: (typeof p.paginatedBans)[number]): string {
  const share = splitShare(row) ?? 0
  const mode = splitModes.value.find(m => m.value === splitMode.value)!
  return `${mode.left} ${share.toFixed(1)} %, ${mode.right} ${(100 - share).toFixed(1)} %`
}

const { locale } = useI18n()
const activeMode = computed(() => splitModes.value.find(m => m.value === splitMode.value)!)
const sortKeys = computed<[BansSortCol, BansSortCol]>(() =>
  splitMode.value === 'outcome' ? ['win', 'loss'] : ['blue', 'red']
)
const colLabels = computed(() =>
  splitMode.value === 'outcome'
    ? [p.t('statisticsPage.bansColByWinner'), p.t('statisticsPage.bansColByLoser')]
    : [p.t('statisticsPage.bansColByBlue'), p.t('statisticsPage.bansColByRed')]
)
function sidePct(row: (typeof p.paginatedBans)[number]): [number, number] {
  if (splitMode.value === 'outcome') {
    return [p.bansOutcomePct(row.championId, 'win'), p.bansOutcomePct(row.championId, 'loss')]
  }
  const n = p.bansTableData?.matchCount ?? 0
  return [p.banPctForCount(row.bansBlue, n), p.banPctForCount(row.bansRed, n)]
}
function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  return `${Number(v).toLocaleString(locale.value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`
}
function fmtDelta(v: number | null | undefined): string {
  const d = surrenderDeltaView(v)
  if (d.abs == null) return '—'
  const n = d.abs.toLocaleString(locale.value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return d.dir === 'up' ? `▲ +${n}` : `▼ −${n}`
}
const searchModel = computed({
  get: () => p.championSearchQuery,
  set: (v: string) => {
    p.championSearchQuery = v
  },
})

const maxBanRate = computed(() =>
  Math.max(
    0,
    ...(p.paginatedBans ?? []).map(row =>
      p.banRateForBansRow(row, p.bansTableData?.matchCount ?? 0)
    )
  )
)
</script>

<style scoped>
.bn-toolbar {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.bn-search {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 340px;
  height: 40px;
  padding: 0 12px;
  border: 1px solid #785a28;
  border-radius: 8px;
  background: #0a1428;
}
.bn-search input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: 0;
  outline: none;
  color: #f0e6d2;
  font-size: 14px;
}
.bn-search input::placeholder {
  color: #a09b8c;
}
.bn-seg {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: #0a1428;
  border: 1px solid #0a323c;
  border-radius: 8px;
}
.bn-seg-btn {
  height: 34px;
  padding: 0 12px;
  border-radius: 6px;
  font-size: 14px;
  color: #a09b8c;
}
.bn-seg-btn.is-active {
  background: #0a323c;
  color: #f0e6d2;
  font-weight: 600;
}
.bn-count {
  margin-left: auto;
  font-size: 13px;
  color: #a09b8c;
}
.bn-card {
  overflow-x: auto;
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
}
.bn-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  color: #f0e6d2;
}
.bn-table th {
  padding: 12px 20px;
  font-size: 12px;
  font-weight: 600;
  color: #a09b8c;
  text-align: left;
  border-bottom: 1px solid #0a323c;
  white-space: nowrap;
}
.bn-table td {
  padding: 8px 20px;
  border-bottom: 1px solid #1e2328;
  vertical-align: middle;
}
.bn-table tbody tr:last-child td {
  border-bottom: 0;
}
.bn-table tbody tr:hover {
  background: rgb(255 255 255 / 0.03);
}
.bn-champ :deep(img) {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 6px;
}
.bn-champ :deep(span) {
  font-size: 14px;
  font-weight: 600;
  color: #f0e6d2;
  text-decoration: none;
}
.bn-champ:hover :deep(span) {
  color: #c8aa6e;
}
.bn-th-champ {
  min-width: 200px;
}
.bn-th-split {
  width: 200px;
}
.bn-sort {
  font-weight: 600;
}
.bn-sort:hover {
  color: #f0e6d2;
}
.bn-sort.is-gold {
  color: #c8aa6e;
}
.bn-right {
  text-align: right !important;
}
.bn-num {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.bn-muted {
  color: #a09b8c;
}
.bn-rate {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 260px;
}
.bn-track {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: #1e2328;
}
.bn-fill {
  height: 100%;
  border-radius: 3px;
  background: #c8aa6e;
}
.bn-val {
  width: 64px;
  text-align: right;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.bn-delta--up {
  color: #0ac8b9;
}
.bn-delta--down {
  color: #e2665a;
}
.bn-delta--none {
  color: #a09b8c;
}
.bn-split {
  display: flex;
  gap: 2px;
  height: 6px;
  overflow: hidden;
  border-radius: 3px;
}
.bn-pagination {
  border-top: 1px solid #1e2328;
  padding: 8px 16px;
  font-size: 14px;
  color: #a09b8c;
}
.bn-foot {
  justify-content: space-between;
  gap: 16px;
  font-size: 12px;
  color: #a09b8c;
}
.bn-legend {
  display: flex;
  gap: 16px;
}
.bn-legend span {
  display: flex;
  align-items: center;
  gap: 6px;
}
.bn-legend i {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}
.bn-mlist {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bn-mcard {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 10px;
  color: #f0e6d2;
}
.bn-mthumb {
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 6px;
  background: #0a323c;
}
.bn-mbody {
  flex: 1;
  min-width: 0;
}
.bn-mtop {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.bn-mname {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  font-size: 14px;
}
.bn-mrate {
  font-weight: 700;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.bn-mdelta {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.bn-mbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.bn-mbar .bn-track {
  flex: 1;
}
.bn-msplit {
  font-size: 11px;
  white-space: nowrap;
  color: #a09b8c;
  font-variant-numeric: tabular-nums;
}
.bn-mfoot {
  font-size: 12px;
  color: #a09b8c;
  margin-top: 8px;
}
@media (max-width: 767px) {
  .bn-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .bn-search {
    width: 100%;
  }
  .bn-seg {
    display: flex;
  }
  .bn-seg-btn {
    flex: 1;
  }
}
</style>
