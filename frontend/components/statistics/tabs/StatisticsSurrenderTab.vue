<script setup lang="ts">
import { computed, ref } from 'vue'
import { isLowSample } from '~/utils/statistics/lowSample'
import { surrenderBarSegments, surrenderDeltaTone } from '~/utils/statistics/teamSides'
import {
  injectStatisticsPageCtx,
  type StatisticsIndexPageCtx,
} from '~/composables/statistics/statisticsPageCtx'

const p = injectStatisticsPageCtx<StatisticsIndexPageCtx>()

function teamLabel(team: 'ALL' | 100 | 200): string {
  if (team === 100) return p.t('statisticsPage.sidesBlue')
  if (team === 200) return p.t('statisticsPage.sidesRed')
  return p.t('statisticsPage.allRanks')
}

function rankLabel(rank: string): string {
  if (rank === 'ALL') return p.t('statisticsPage.allRanks')
  return p.formatDivisionLabel(rank)
}

function pct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${Number(value).toFixed(2)}%`
}

function delta(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return ''
  const sign = value > 0 ? '+' : ''
  return `${sign}${Number(value).toFixed(2)}%`
}

function formatStatCount(value: number): string {
  return Math.round(Number(value))
    .toLocaleString('fr-FR')
    .replace(/\u202F/g, '')
}

const rows = computed(() => p.surrenderMatrixRows ?? [])

const openRanks = ref(new Set<string>())
function toggleRank(rank: string) {
  if (openRanks.value.has(rank)) openRanks.value.delete(rank)
  else openRanks.value.add(rank)
}

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
      <div v-else class="surr-card">
        <div class="surr-head" aria-hidden="true">
          <span>{{ p.t('statisticsPage.surrDivision') }}</span>
          <span class="surr-c-games">{{ p.t('statisticsPage.surrGames') }}</span>
          <span>{{ p.t('statisticsPage.surrRateHead') }}</span>
          <span class="surr-c-delta">
            {{ p.t('statisticsPage.surrDeltaVs', { v: p.progressionFromVersion || '—' }) }}
          </span>
        </div>
        <template v-for="group in groupedRows" :key="`surr-${group.rank}`">
          <template
            v-for="sub in [
              { key: 'all', row: group.all, label: rankLabel(group.rank), sub: false },
              ...(openRanks.has(group.rank)
                ? [
                    { key: 'blue', row: group.blue, label: teamLabel(100), sub: true },
                    { key: 'red', row: group.red, label: teamLabel(200), sub: true },
                  ]
                : []),
            ]"
            :key="`surr-${group.rank}-${sub.key}`"
          >
            <div
              v-if="sub.row && rowHasData(sub.row)"
              class="surr-row"
              :class="{ 'is-low': isLowSample(sub.row.matchCount), 'is-sub': sub.sub }"
            >
              <button
                v-if="!sub.sub"
                type="button"
                class="surr-name"
                :aria-expanded="openRanks.has(group.rank)"
                @click="toggleRank(group.rank)"
              >
                <img :src="rankIcon(group.rank)" alt="" class="surr-emblem" loading="lazy" />
                <span class="surr-name-txt">
                  {{ sub.label }}
                  <em class="surr-games-m">
                    {{
                      p.t('statisticsPage.surrGamesN', { n: formatStatCount(sub.row.matchCount) })
                    }}
                  </em>
                </span>
                <span v-if="isLowSample(sub.row.matchCount)" class="surr-badge">
                  {{ p.t('statisticsPage.surrLowBadge') }}
                </span>
              </button>
              <span
                v-else
                class="surr-name is-sub"
                :class="sub.key === 'blue' ? 'is-blue' : 'is-red'"
              >
                {{ sub.label }}
              </span>
              <span class="surr-c-games surr-num">{{ formatStatCount(sub.row.matchCount) }}</span>
              <div class="surr-rate">
                <span class="surr-bar" aria-hidden="true">
                  <span
                    class="surr-bar-early"
                    :style="{
                      width: `${surrenderBarSegments(sub.row.surrenderRate, sub.row.earlySurrenderRate).early}%`,
                    }"
                  />
                  <span
                    class="surr-bar-rest"
                    :style="{
                      width: `${surrenderBarSegments(sub.row.surrenderRate, sub.row.earlySurrenderRate).rest}%`,
                    }"
                  />
                </span>
                <span class="surr-num">
                  <b>{{ pct(sub.row.surrenderRate) }}</b>
                  <span class="surr-early">({{ pct(sub.row.earlySurrenderRate) }})</span>
                </span>
              </div>
              <span
                class="surr-c-delta surr-num"
                :class="`is-${surrenderDeltaTone(sub.row.surrenderDelta)}`"
              >
                <template v-if="surrenderDeltaTone(sub.row.surrenderDelta) === 'none'">—</template>
                <template v-else>
                  {{ surrenderDeltaTone(sub.row.surrenderDelta) === 'up' ? '▲' : '▼' }}
                  {{ delta(sub.row.surrenderDelta) }}
                </template>
              </span>
            </div>
          </template>
        </template>
        <p class="surr-note">{{ p.t('statisticsPage.surrNote') }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.surr-card {
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
  padding: 12px 16px;
}
.surr-head,
.surr-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: center;
}
.surr-head {
  display: none;
  font-size: 12px;
  color: #a09b8c;
  padding: 6px 0 10px;
  border-bottom: 1px solid #1e2328;
}
.surr-row {
  padding: 10px 0;
  border-bottom: 1px solid #1e2328;
}
.surr-row.is-low {
  opacity: 0.5;
}
.surr-row.is-sub {
  padding-left: 24px;
  background: #070f1e;
}
.surr-c-games,
.surr-c-delta {
  display: none;
}
.surr-name {
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  color: #f0e6d2;
  font-size: 14px;
  min-width: 0;
}
.surr-name.is-sub {
  font-size: 13px;
}
.surr-name.is-blue {
  color: #0397ab;
}
.surr-name.is-red {
  color: #e2665a;
}
.surr-name-txt {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.surr-games-m {
  font-style: normal;
  font-size: 11px;
  color: #a09b8c;
}
.surr-emblem {
  width: 28px;
  height: 28px;
  object-fit: contain;
  flex-shrink: 0;
}
.surr-badge {
  border: 1px solid #785a28;
  border-radius: 4px;
  font-size: 11px;
  padding: 0 5px;
  color: #c8aa6e;
  white-space: nowrap;
}
.surr-rate {
  display: flex;
  align-items: center;
  gap: 10px;
}
.surr-bar {
  flex: 1;
  display: flex;
  height: 10px;
  border-radius: 5px;
  background: #1e2328;
  overflow: hidden;
}
.surr-bar-early {
  background: #cdfafa;
}
.surr-bar-rest {
  background: #005a82;
}
.surr-num {
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  color: #f0e6d2;
  white-space: nowrap;
  text-align: right;
}
.surr-early {
  color: #a09b8c;
  font-size: 12px;
  margin-left: 2px;
}
.surr-c-delta.is-up {
  color: #e2665a;
}
.surr-c-delta.is-down {
  color: #0ac8b9;
}
.surr-c-delta.is-none {
  color: #a09b8c;
}
.surr-note {
  font-size: 12px;
  color: #a09b8c;
  padding-top: 10px;
}
@media (min-width: 768px) {
  .surr-card {
    padding: 16px 24px;
  }
  .surr-head,
  .surr-row {
    grid-template-columns: 190px 90px 1fr 120px;
    gap: 16px;
  }
  .surr-head {
    display: grid;
  }
  .surr-c-games,
  .surr-c-delta {
    display: block;
  }
  .surr-games-m {
    display: none;
  }
}

.is-low-sample {
  opacity: 0.5;
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

@media (max-width: 768px) {
  .statistics-surrender-mobile-card {
    width: 100%;
    padding-left: 0;
    padding-right: 0;
  }

  .statistics-surrender-mobile-list {
    gap: 1rem;
  }

  .statistics-surrender-mobile-side-block {
    border-top: none;
  }
}
</style>
