<script setup lang="ts">
import { computed } from 'vue'
import { isLowSample } from '~/utils/statistics/lowSample'
import { surrenderBarWidths, surrenderDeltaView } from '~/utils/statistics/surrenderDivisionRows'
import {
  injectStatisticsPageCtx,
  type StatisticsIndexPageCtx,
} from '~/composables/statistics/statisticsPageCtx'

const p = injectStatisticsPageCtx<StatisticsIndexPageCtx>()

function rankLabel(rank: string): string {
  if (rank === 'ALL') return p.t('statisticsPage.allRanks')
  return p.formatDivisionLabel(rank)
}

function formatStatCount(value: number): string {
  return Math.round(Number(value))
    .toLocaleString('fr-FR')
    .replace(/\u202F/g, '')
}

const rows = computed(() => p.surrenderMatrixRows ?? [])

type Row = {
  rankTier: string
  team: 'ALL' | 100 | 200
  matchCount: number
  surrenderCount: number
  earlySurrenderCount: number
  surrenderRate: number
  earlySurrenderRate: number
  surrenderDelta: number | null
  earlySurrenderDelta: number | null
}

function rowHasData(row: Row | null | undefined): boolean {
  return !!row && Number(row.matchCount) > 0
}

function groupHasData(group: { all: Row | null; blue: Row | null; red: Row | null }): boolean {
  return rowHasData(group.all) || rowHasData(group.blue) || rowHasData(group.red)
}

const groupedRows = computed(() => {
  const byRank = new Map<string, { all: Row | null; blue: Row | null; red: Row | null }>()
  for (const row of rows.value as Row[]) {
    const rank = String(row.rankTier ?? 'ALL').toUpperCase()
    const slot = byRank.get(rank) ?? { all: null, blue: null, red: null }
    if (row.team === 'ALL') slot.all = row
    else if (row.team === 100) slot.blue = row
    else if (row.team === 200) slot.red = row
    byRank.set(rank, slot)
  }
  const order = [
    'ALL',
    'UNRANKED',
    'IRON',
    'BRONZE',
    'SILVER',
    'GOLD',
    'PLATINUM',
    'EMERALD',
    'DIAMOND',
    'MASTER',
    'GRANDMASTER',
    'CHALLENGER',
  ]
  return order
    .map(rank => ({ rank, ...(byRank.get(rank) ?? { all: null, blue: null, red: null }) }))
    .filter(groupHasData)
})

const { locale } = useI18n()
function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  return `${Number(v).toLocaleString(locale.value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
}
function barW(row: Row) {
  return surrenderBarWidths(row.surrenderRate, row.earlySurrenderRate)
}
function deltaV(row: Row) {
  return surrenderDeltaView(row.surrenderDelta)
}
function deltaText(row: Row): string {
  const d = deltaV(row)
  if (d.abs == null) return '—'
  const n = d.abs.toLocaleString(locale.value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return d.dir === 'up' ? `▲ +${n}` : `▼ −${n}`
}

function rankIcon(rank: string): string {
  if (rank === 'ALL') return '/data/community-dragon/ranked-emblem/Unranked.png'
  return p.getRankedEmblemUrl(rank) || '/data/community-dragon/ranked-emblem/Unranked.png'
}
</script>

<template>
  <div class="statistics-surrender-tab space-y-3">
    <div class="statistics-surrender-panel w-full max-w-full">
      <div v-if="p.surrenderMatrixPending" class="text-sm text-text/70">
        {{ p.t('statisticsPage.loading') }}
      </div>
      <div v-else-if="groupedRows.length === 0" class="text-sm text-text/70">
        {{ p.t('statisticsPage.noData') }}
      </div>
      <div v-else class="w-full min-w-0">
        <!-- Desktop : tableau de la maquette 03 -->
        <section class="sr-section flex">
          <h2 class="sr-h2">{{ p.t('statisticsPage.tabSurrender') }}</h2>
          <article class="sr-card">
            <div class="sr-grid sr-head">
              <span>{{ p.t('statisticsPage.surrenderColDivision') }}</span>
              <span class="sr-right">{{ p.t('statisticsPage.surrenderColGames') }}</span>
              <span>{{ p.t('statisticsPage.surrenderColRate') }}</span>
              <span class="sr-right">{{ p.t('statisticsPage.surrenderColDelta') }}</span>
            </div>
            <template v-for="group in groupedRows" :key="`rank-${group.rank}`">
              <div
                v-if="group.all"
                class="sr-grid sr-row"
                :class="{ 'is-low-sample': isLowSample(group.all.matchCount) }"
              >
                <span class="sr-div">
                  <img
                    :src="rankIcon(group.rank)"
                    alt=""
                    width="20"
                    height="20"
                    class="sr-emblem"
                  />
                  <span class="sr-divname">
                    {{ rankLabel(group.rank) }}
                    <small class="sr-mgames">{{
                      p.t('statisticsPage.surrenderMobileGames', {
                        n: formatStatCount(group.all.matchCount),
                      })
                    }}</small>
                  </span>
                  <span v-if="isLowSample(group.all.matchCount)" class="sr-badge">{{
                    p.t('statisticsPage.surrenderLowBadge')
                  }}</span>
                </span>
                <span class="sr-right sr-num sr-muted">{{
                  formatStatCount(group.all.matchCount)
                }}</span>
                <div class="sr-barcell">
                  <div class="sr-track">
                    <div
                      class="sr-seg sr-seg--early"
                      :style="{ width: `${barW(group.all).early}%` }"
                    />
                    <div
                      class="sr-seg sr-seg--rest"
                      :style="{ width: `${barW(group.all).rest}%` }"
                    />
                  </div>
                  <span class="sr-num sr-val"
                    ><strong>{{ fmtPct(group.all.surrenderRate) }}</strong>
                    <span class="sr-muted">
                      ({{ fmtPct(group.all.earlySurrenderRate) }})</span
                    ></span
                  >
                </div>
                <span class="sr-right sr-num" :class="`sr-delta--${deltaV(group.all).dir}`">{{
                  deltaText(group.all)
                }}</span>
              </div>
            </template>
            <p class="sr-foot">{{ p.t('statisticsPage.surrenderLowSampleNote') }}</p>
          </article>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.is-low-sample {
  opacity: 0.5;
}
.sr-section {
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
}
.sr-h2 {
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-size: 24px;
  font-weight: 700;
  color: #f0e6d2;
}
.sr-card {
  display: flex;
  flex-direction: column;
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
  padding: 20px 24px;
}
.sr-grid {
  display: grid;
  grid-template-columns: 220px 90px 1fr 120px;
  align-items: center;
  gap: 16px;
}
.sr-head {
  padding-bottom: 8px;
  border-bottom: 1px solid #0a323c;
  font-size: 12px;
  color: #a09b8c;
}
.sr-row {
  padding: 9px 0;
  border-bottom: 1px solid #1e2328;
  font-size: 14px;
  color: #f0e6d2;
}
.sr-right {
  text-align: right;
}
.sr-num {
  font-variant-numeric: tabular-nums;
}
.sr-muted {
  color: #a09b8c;
}
.sr-div {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}
.sr-emblem {
  width: 20px;
  height: 20px;
  object-fit: contain;
}
.sr-badge {
  white-space: nowrap;
  font-size: 11px;
  font-weight: 500;
  color: #a09b8c;
  border: 1px solid #785a28;
  border-radius: 4px;
  padding: 1px 6px;
}
.sr-barcell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sr-track {
  flex: 1;
  height: 10px;
  display: flex;
  overflow: hidden;
  border-radius: 5px;
  background: #1e2328;
}
.sr-seg--early {
  background: #cdfafa;
}
.sr-seg--rest {
  background: #005a82;
}
.sr-val {
  width: 130px;
  white-space: nowrap;
  font-size: 13px;
}
.sr-delta--up {
  color: #e2665a;
}
.sr-delta--down {
  color: #0ac8b9;
}
.sr-delta--none {
  color: #a09b8c;
}
.sr-foot {
  margin-top: 12px;
  font-size: 12px;
  color: #a09b8c;
}
.surrender-low-sample-note {
  font-size: 0.75rem;
  color: var(--color-grey-50, #a09b8c);
}
.statistics-surrender-panel,
.statistics-surrender-mobile-list {
  width: 100%;
  max-width: 100%;
}

.statistics-surrender-mobile-details {
  font-size: 0.875rem;
  line-height: 1.4;
}

.statistics-surrender-details-title {
  font-size: 0.875rem;
}

.statistics-surrender-stat-block {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.statistics-surrender-stat-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: rgb(var(--rgb-text) / 0.72);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.3;
}

.statistics-surrender-stat-dot {
  display: inline-block;
  height: 0.5rem;
  width: 0.5rem;
  flex-shrink: 0;
  border-radius: 9999px;
}

.statistics-surrender-stat-value {
  display: block;
  padding-left: 0.875rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  color: rgb(var(--rgb-text) / 0.92);
}

.statistics-surrender-stat-delta {
  margin-left: 0.25rem;
  font-size: 0.75rem;
}

.sr-mgames {
  display: none;
}
@media (max-width: 767px) {
  .sr-section {
    margin-top: 0;
  }
  .sr-h2 {
    font-family: Inter, system-ui, sans-serif;
    font-size: 18px;
    font-weight: 600;
  }
  .sr-card {
    padding: 8px 16px;
  }
  .sr-head,
  .sr-emblem,
  .sr-badge,
  .sr-row > .sr-right,
  .sr-val .sr-muted {
    display: none !important;
  }
  .sr-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
    gap: 12px;
  }
  .sr-val {
    width: 56px;
    text-align: right;
  }
  .sr-divname {
    display: flex;
    flex-direction: column;
  }
  .sr-mgames {
    display: block;
    font-size: 11px;
    color: #a09b8c;
  }
}
</style>
