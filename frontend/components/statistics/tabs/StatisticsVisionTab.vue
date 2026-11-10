<script setup lang="ts">
import { computed } from 'vue'
import {
  VISION_ROLE_QUICK,
  VISION_TABLE_COLUMNS,
  visionRoleQuickActive,
} from '~/utils/statistics/visionRoleQuick'
import { breakdownSharePct } from '~/utils/championDashboard'
import {
  injectStatisticsPageCtx,
  type StatisticsIndexPageCtx,
} from '~/composables/statistics/statisticsPageCtx'
import {
  VISION_METRIC_KEYS,
  visionMobileSortOptions,
  type VisionMetricKey,
  type VisionSortCol,
  type VisionTableRow,
} from '~/composables/statistics/useStatisticsVisionTab'

const p = injectStatisticsPageCtx<StatisticsIndexPageCtx>()

const visionRoleActive = computed(() => visionRoleQuickActive(p.statsRoleFilter))
function setVisionRole(value: string) {
  p.statsRoleFilter = value
}

const visionMobileSortColumn = computed({
  get: () => String(p.visionSortColumn ?? 'visionScore'),
  set: (v: string) => {
    ;(p.setVisionSort as (c: VisionSortCol) => void)?.(v as VisionSortCol)
  },
})

const visionMobileSortDir = computed({
  get: () => (p.visionSortDir === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
  set: (v: 'asc' | 'desc') => {
    p.visionSortDir = v
  },
})

const visionMobileSortOptionsComputed = computed(() =>
  visionMobileSortOptions((key: string) => String(p.t?.(key) ?? key))
)

function championPortraitSrc(championId: number): string | null {
  if (!p.gameVersion || !p.championByKey(championId)) return null
  return p.getChampionImageUrl(p.gameVersion, p.championByKey(championId)!.image.full)
}

function formatVisionValue(key: VisionMetricKey, value: number): string {
  const n = Number(value)
  if (key === 'visionScore') return n.toFixed(1)
  return n.toFixed(2)
}

function formatVisionDelta(key: VisionMetricKey, value: number): string {
  const sign = value > 0 ? '+' : ''
  if (key === 'visionScore') return `${sign}${Number(value).toFixed(1)}`
  return `${sign}${Number(value).toFixed(2)}`
}

function visionValue(row: VisionTableRow, key: VisionMetricKey): number {
  return Number(row[key] ?? 0)
}

function visionDelta(row: VisionTableRow, key: VisionMetricKey): number | null {
  return p.visionDelta?.(row, key) ?? null
}

function sortIndicator(col: VisionSortCol): string {
  return p.visionSortHint?.(col) ?? ''
}

function visionMessage(message: string | undefined): string {
  if (!message) return ''
  if (message === 'Database not configured.' || message === 'Database not configured') {
    return String(p.t?.('statisticsPage.visionDbNotConfigured') ?? message)
  }
  return message
}

function deltaSortKey(key: VisionMetricKey): VisionSortCol {
  return `${key}Delta`
}

function isSorted(col: VisionSortCol): boolean {
  return p.visionSortColumn === col
}

const maxVisionScore = computed(() => {
  const rows = (p.visionTableData?.rows ?? []) as VisionTableRow[]
  return rows.reduce((m, r) => Math.max(m, Number(r.visionScore) || 0), 0)
})

function deltaLabel(row: VisionTableRow, key: VisionMetricKey): string {
  const d = visionDelta(row, key)
  return d == null ? '' : formatVisionDelta(key, d)
}

function deltaClass(row: VisionTableRow, key: VisionMetricKey): string {
  const d = visionDelta(row, key)
  if (d == null || d === 0) return ''
  return d > 0 ? 'is-up' : 'is-down'
}

const visionPageSize = computed({
  get: () => Number(p.championsPageSize) || 20,
  set: (value: number) => {
    p.onVisionPageSizeUpdated?.(value)
  },
})
</script>

<template>
  <div class="vi-root">
    <div class="vi-head">
      <h2 class="vi-title">{{ p.t('statisticsPage.visionTitle') }}</h2>
      <div class="vision-role" role="group" :aria-label="p.t('statisticsPage.visionRoleAria')">
        <button
          v-for="o in VISION_ROLE_QUICK"
          :key="o.value || 'all'"
          type="button"
          class="vision-role__btn"
          :class="{ 'is-active': visionRoleActive === o.value }"
          :aria-pressed="visionRoleActive === o.value"
          @click="setVisionRole(o.value)"
        >
          {{ p.t(o.labelKey) }}
        </button>
      </div>
    </div>
    <div v-if="p.visionPending" class="text-text/70">{{ p.t('statisticsPage.loading') }}</div>
    <div v-else-if="p.visionError" class="rounded border border-error bg-surface p-3 text-error">
      {{ p.visionError }}
    </div>
    <div
      v-else-if="p.visionTableData?.message && !p.visionTableData?.rows?.length"
      class="text-text/70"
    >
      {{ visionMessage(p.visionTableData.message) }}
    </div>
    <div v-else-if="!p.paginatedVisionRows?.length" class="text-text/70">
      {{ p.t('statisticsPage.noData') }}
    </div>
    <template v-else>
      <StatisticsMobileSortBar
        id="vision-mobile-sort"
        v-model:column="visionMobileSortColumn"
        v-model:direction="visionMobileSortDir"
        :options="visionMobileSortOptionsComputed"
      />

      <div class="statistics-vision-mobile-list space-y-2 md:hidden">
        <article
          v-for="row in p.paginatedVisionRows"
          :key="'vision-mobile-' + row.championId"
          class="statistics-champion-stats-mobile-card statistics-vision-mobile-card w-full overflow-hidden"
        >
          <div
            class="statistics-champion-stats-mobile-card-header flex w-full items-center gap-3 p-3"
          >
            <StatisticsChampionStatsMobileCardHeader
              :champion-id="row.championId"
              :champion-name="String(p.championName(row.championId) || row.championId)"
              :search-query="p.championSearchQuery"
              :portrait-src="championPortraitSrc(row.championId)"
              :portrait-alt="p.championName(row.championId) || ''"
            />
            <div class="min-w-0 flex-1 text-right">
              <div class="text-[10px] font-medium uppercase tracking-wide text-text/55">
                {{ p.t('statisticsPage.visionMetric.visionScore') }}
              </div>
              <div class="text-2xl font-bold tabular-nums leading-none text-text sm:text-3xl">
                {{ formatVisionValue('visionScore', row.visionScore) }}
              </div>
              <div
                v-if="visionDelta(row, 'visionScore') != null"
                class="mt-0.5 text-xs tabular-nums leading-none"
                :class="p.championGlobalNumericDeltaClass(visionDelta(row, 'visionScore')!)"
              >
                {{ formatVisionDelta('visionScore', visionDelta(row, 'visionScore')!) }}
              </div>
            </div>
          </div>
          <div class="border-t border-primary/15 px-3 py-2.5">
            <div class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <div
                v-for="key in VISION_METRIC_KEYS.filter(k => k !== 'visionScore')"
                :key="'vision-mobile-metric-' + row.championId + '-' + key"
                class="rounded bg-primary/10 px-2 py-1.5"
              >
                <div class="text-[10px] uppercase text-text/55">
                  {{ p.t('statisticsPage.visionMetric.' + key) }}
                </div>
                <div class="font-bold tabular-nums text-text">
                  {{ formatVisionValue(key, visionValue(row, key)) }}
                </div>
                <div
                  v-if="visionDelta(row, key) != null"
                  class="mt-0.5 text-[10px] tabular-nums leading-none"
                  :class="p.championGlobalNumericDeltaClass(visionDelta(row, key)!)"
                >
                  {{ formatVisionDelta(key, visionDelta(row, key)!) }}
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div class="vi-dtable-wrap hidden md:block">
        <table class="vi-dtable">
          <thead>
            <tr class="vi-dhead">
              <th scope="col" class="vi-dleft">
                {{ p.t('statisticsPage.tierListColChampion') }}
              </th>
              <th
                v-for="key in VISION_TABLE_COLUMNS"
                :key="'vision-th-' + key"
                scope="col"
                :class="[
                  key === 'visionScore' ? 'vi-dleft vi-dbar-cell' : 'vi-dnum',
                  { 'is-sorted': isSorted(key) },
                ]"
              >
                <button type="button" class="vi-dsort" @click="p.setVisionSort(key)">
                  {{ p.t('statisticsPage.visionMetric.' + key) }}{{ sortIndicator(key) }}
                </button>
                <button
                  v-if="p.visionTableRefData"
                  type="button"
                  class="vi-dsort-delta"
                  :class="{ 'is-on': isSorted(deltaSortKey(key)) }"
                  :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                  @click="p.setVisionSort(deltaSortKey(key))"
                >
                  Δ{{ sortIndicator(deltaSortKey(key)) }}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in p.paginatedVisionRows"
              :key="'vision-' + row.championId"
              class="vi-drow"
            >
              <th scope="row" class="vi-dleft vi-dchamp">
                <StatisticsChampionTableLink
                  :champion-id="row.championId"
                  :query="p.championSearchQuery"
                />
              </th>
              <td
                v-for="key in VISION_TABLE_COLUMNS"
                :key="'vision-td-' + row.championId + '-' + key"
                :class="key === 'visionScore' ? 'vi-dbar-cell' : 'vi-dnum'"
              >
                <div v-if="key === 'visionScore'" class="vi-dbar-row">
                  <span class="vi-dbar" aria-hidden="true">
                    <span
                      class="vi-dbar-fill"
                      :style="{ width: breakdownSharePct(row.visionScore, maxVisionScore) + '%' }"
                    />
                  </span>
                  <span class="vi-dval vi-dstrong">{{
                    formatVisionValue(key, row.visionScore)
                  }}</span>
                  <span class="vi-ddelta vi-ddelta--inline" :class="deltaClass(row, key)">
                    {{ deltaLabel(row, key) }}
                  </span>
                </div>
                <template v-else>
                  <span class="vi-dval" :class="{ 'vi-dmuted': key === 'controlWardsPlaced' }">
                    {{ formatVisionValue(key, visionValue(row, key)) }}
                  </span>
                  <span
                    v-if="visionDelta(row, key) != null"
                    class="vi-ddelta"
                    :class="deltaClass(row, key)"
                  >
                    {{ deltaLabel(row, key) }}
                  </span>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
        <StatisticsRangePagination
          v-model:page-size="visionPageSize"
          :page="p.visionPage"
          class="vi-dpager"
          :total-count="p.totalVisionCount"
          :total-pages="p.totalVisionPages"
          indicator="pages"
          @update:page="p.onVisionPageUpdated"
        >
          <template v-if="p.championSearchQuery" #default>
            {{ p.t('statisticsPage.showing') }} {{ p.totalVisionCount }}
          </template>
        </StatisticsRangePagination>
      </div>
      <p class="vi-note hidden md:block">{{ p.t('statisticsPage.visionStealthImplicitNote') }}</p>
    </template>
  </div>
</template>

<style scoped>
.vi-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.vi-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.vi-title {
  font-size: 20px;
  font-weight: 600;
  color: #f0e6d2;
}
.vision-role {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 3px;
  border: 1px solid #0a323c;
  border-radius: 8px;
  background: #0a1428;
}
.vision-role__btn {
  height: 34px;
  padding: 0 12px;
  border-radius: 6px;
  font-size: 14px;
  color: #a09b8c;
}
.vision-role__btn:hover {
  color: #f0e6d2;
}
.vision-role__btn.is-active {
  background: #0a323c;
  color: #f0e6d2;
  font-weight: 600;
}
.vi-dtable-wrap {
  overflow-x: auto;
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
}
.vi-dtable {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
  font-size: 14px;
  color: #f0e6d2;
}
.vi-dhead th {
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #a09b8c;
  border-bottom: 1px solid #0a323c;
  white-space: nowrap;
}
.vi-dhead th.is-sorted {
  color: #c8aa6e;
}
.vi-dsort {
  color: inherit;
}
.vi-dsort:hover {
  color: #f0e6d2;
}
.vi-dsort-delta {
  margin-left: 4px;
  font-size: 11px;
  color: #5b5a56;
}
.vi-dsort-delta.is-on,
.vi-dsort-delta:hover {
  color: #c8aa6e;
}
.vi-dleft {
  text-align: left;
  padding: 9px 20px;
}
.vi-dchamp {
  font-weight: 500;
}
.vi-dnum {
  text-align: right;
  padding: 9px 12px;
  white-space: nowrap;
  vertical-align: middle;
}
.vi-dnum:last-child {
  padding-right: 20px;
}
.vi-drow {
  border-bottom: 1px solid #1e2328;
}
.vi-drow:hover {
  background: #0e1a2e;
}
.vi-dval {
  display: block;
  font-variant-numeric: tabular-nums;
}
.vi-dmuted {
  color: #cbc3b0;
}
.vi-dstrong {
  font-weight: 600;
}
.vi-ddelta {
  display: block;
  font-size: 11px;
  line-height: 1.2;
  color: #5b5a56;
  font-variant-numeric: tabular-nums;
}
.vi-ddelta.is-up {
  color: #0ac8b9;
}
.vi-ddelta.is-down {
  color: #e2665a;
}
.vi-dbar-cell {
  min-width: 200px;
  padding: 9px 16px;
}
.vi-dbar-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.vi-dbar-row .vi-dval {
  width: 36px;
  text-align: right;
}
.vi-ddelta--inline {
  width: 44px;
}
.vi-dbar {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: #1e2328;
  overflow: hidden;
}
.vi-dbar-fill {
  display: block;
  height: 100%;
  border-radius: 4px;
  background: #c89b3c;
}
.vi-dpager {
  border-top: 1px solid #1e2328;
  padding: 8px 16px;
  font-size: 14px;
  color: #a09b8c;
}
.vi-note {
  font-size: 12px;
  color: #a09b8c;
}
</style>
