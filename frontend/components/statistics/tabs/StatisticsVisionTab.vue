<script setup lang="ts">
import { computed } from 'vue'
import { barPct } from '~/utils/statistics/barPct'
import { deltaToneClass, fmtLocNum, fmtLocSigned } from '~/utils/statistics/localeNum'
import { VISION_ROLE_QUICK, visionRoleQuickActive } from '~/utils/statistics/visionRoleQuick'
import {
  injectStatisticsPageCtx,
  type StatisticsIndexPageCtx,
} from '~/composables/statistics/statisticsPageCtx'
import {
  type VisionMetricKey,
  type VisionSortCol,
  type VisionTableRow,
} from '~/composables/statistics/useStatisticsVisionTab'

const p = injectStatisticsPageCtx<StatisticsIndexPageCtx>()
const { locale } = useI18n()
const fmtLoc = (v: number | null | undefined, d: number) => fmtLocNum(v, d, locale.value)
const fmtSigned = (v: number | null | undefined, d: number) => fmtLocSigned(v, d, locale.value)
const VISION_DESKTOP_COLS = [
  { key: 'visionScorePerMinute', label: 'statisticsPage.visionColPerMin', digits: 2 },
  { key: 'wardsPlaced', label: 'statisticsPage.visionMetric.wardsPlaced', digits: 1 },
  { key: 'controlWardsPlaced', label: 'statisticsPage.visionColControl', digits: 1 },
  { key: 'wardsKilled', label: 'statisticsPage.visionColKilled', digits: 1 },
] as const satisfies ReadonlyArray<{ key: VisionMetricKey; label: string; digits: number }>

const visionRoleActive = computed(() => visionRoleQuickActive(p.statsRoleFilter))
function setVisionRole(value: string) {
  p.statsRoleFilter = value
}

function championPortraitSrc(championId: number): string | null {
  if (!p.gameVersion || !p.championByKey(championId)) return null
  return p.getChampionImageUrl(p.gameVersion, p.championByKey(championId)!.image.full)
}

function visionValue(row: VisionTableRow, key: VisionMetricKey): number {
  return Number(row[key] ?? 0)
}

const visionScoreMax = computed(() =>
  Math.max(
    0,
    ...((p.visionTableData?.rows ?? []) as VisionTableRow[]).map(r => visionValue(r, 'visionScore'))
  )
)

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

const visionPageSize = computed({
  get: () => Number(p.championsPageSize) || 20,
  set: (value: number) => {
    p.onVisionPageSizeUpdated?.(value)
  },
})
</script>

<template>
  <div class="space-y-3">
    <div class="vi-head">
      <h2 class="vi-title">
        <span class="hidden md:inline">{{ p.t('statisticsPage.tabVision') }}</span>
        <span class="md:hidden">{{ p.t('statisticsPage.visionMetric.visionScore') }}</span>
      </h2>
      <select
        class="vi-mselect"
        :value="visionRoleActive"
        :aria-label="p.t('statisticsPage.visionRoleAria')"
        @change="setVisionRole(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="o in VISION_ROLE_QUICK" :key="'vm-' + (o.value || 'all')" :value="o.value">
          {{ p.t(o.labelKey) }}
        </option>
      </select>
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
      <div class="vi-mlist md:hidden">
        <StatisticsChampionDetailLink
          v-for="row in p.paginatedVisionRows"
          :key="'vim-' + row.championId"
          :champion-id="row.championId"
          class="vi-mcard"
        >
          <img
            v-if="championPortraitSrc(row.championId)"
            class="vi-mthumb"
            :src="championPortraitSrc(row.championId)!"
            alt=""
            width="40"
            height="40"
            loading="lazy"
          />
          <div class="vi-mbody">
            <div class="vi-mtop">
              <span class="vi-mname">{{ p.championName(row.championId) || row.championId }}</span>
              <b class="vi-mscore">{{ fmtLoc(row.visionScore, 1) }}</b>
              <span class="vi-delta" :class="deltaToneClass(visionDelta(row, 'visionScore'))">
                {{ fmtSigned(visionDelta(row, 'visionScore'), 1) }}
              </span>
            </div>
            <p class="vi-mline">
              {{
                p.t('statisticsPage.visionMobileLine', {
                  perMin: fmtLoc(visionValue(row, 'visionScorePerMinute'), 2),
                  placed: fmtLoc(visionValue(row, 'wardsPlaced'), 1),
                  control: fmtLoc(visionValue(row, 'controlWardsPlaced'), 1),
                  killed: fmtLoc(visionValue(row, 'wardsKilled'), 1),
                })
              }}
            </p>
          </div>
        </StatisticsChampionDetailLink>
      </div>

      <div class="vi-card hidden md:block">
        <table class="vi-table">
          <thead>
            <tr>
              <th class="vi-th-name">{{ p.t('statisticsPage.tierListColChampion') }}</th>
              <th class="vi-th-bar">
                <button type="button" @click="p.setVisionSort('visionScore')">
                  {{ p.t('statisticsPage.visionMetric.visionScore')
                  }}{{ sortIndicator('visionScore') }}
                </button>
              </th>
              <th v-for="c in VISION_DESKTOP_COLS" :key="'vi-th-' + c.key" class="vi-r">
                <button type="button" @click="p.setVisionSort(c.key)">
                  {{ p.t(c.label) }}{{ sortIndicator(c.key) }}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in p.paginatedVisionRows" :key="'vision-' + row.championId">
              <td>
                <div class="vi-name">
                  <img
                    v-if="championPortraitSrc(row.championId)"
                    :src="championPortraitSrc(row.championId)!"
                    alt=""
                    width="32"
                    height="32"
                    loading="lazy"
                  />
                  <StatisticsChampionDetailLink :champion-id="row.championId" class="vi-link">
                    {{ p.championName(row.championId) || row.championId }}
                  </StatisticsChampionDetailLink>
                </div>
              </td>
              <td>
                <div class="vi-bar-wrap">
                  <div class="vi-track">
                    <div
                      class="vi-fill"
                      :style="{
                        width: barPct(visionValue(row, 'visionScore'), visionScoreMax) + '%',
                      }"
                    />
                  </div>
                  <b>{{ fmtLoc(row.visionScore, 1) }}</b>
                  <span class="vi-delta" :class="deltaToneClass(visionDelta(row, 'visionScore'))">
                    {{ fmtSigned(visionDelta(row, 'visionScore'), 1) }}
                  </span>
                </div>
              </td>
              <td v-for="c in VISION_DESKTOP_COLS" :key="'vi-td-' + c.key" class="vi-r vi-num">
                {{ fmtLoc(visionValue(row, c.key), c.digits) }}
              </td>
            </tr>
          </tbody>
        </table>
        <StatisticsRangePagination
          v-model:page-size="visionPageSize"
          :page="p.visionPage"
          class="vi-pagination"
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
      <p class="vi-foot hidden md:block">{{ p.t('statisticsPage.visionFootNote') }}</p>
    </template>
  </div>
</template>

<style scoped>
.vi-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}
.vi-title {
  font-size: 20px;
  font-weight: 600;
  color: #f0e6d2;
}
.vision-role {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: #0a1428;
  border: 1px solid #0a323c;
  border-radius: 8px;
}
.vision-role__btn {
  height: 30px;
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
.vi-card {
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
  overflow: hidden;
}
.vi-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  color: #f0e6d2;
}
.vi-table th {
  padding: 12px 20px;
  font-size: 12px;
  font-weight: 600;
  color: #a09b8c;
  text-align: left;
  border-bottom: 1px solid #0a323c;
  white-space: nowrap;
}
.vi-table td {
  padding: 8px 20px;
  border-bottom: 1px solid #1e2328;
  vertical-align: middle;
}
.vi-table tbody tr:last-child td {
  border-bottom: 0;
}
.vi-table .vi-r {
  text-align: right;
}
.vi-th-name {
  width: 22%;
}
.vi-th-bar {
  width: 30%;
}
.vi-name {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 500;
}
.vi-name img {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid #0a323c;
}
.vi-link {
  color: #f0e6d2;
}
.vi-link:hover {
  color: #c8aa6e;
}
.vi-bar-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}
.vi-track {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: #1e2328;
  overflow: hidden;
}
.vi-fill {
  height: 100%;
  border-radius: 3px;
  background: #c8aa6e;
}
.vi-bar-wrap b {
  min-width: 36px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.vi-delta {
  min-width: 32px;
  font-size: 11px;
  color: #a09b8c;
  font-variant-numeric: tabular-nums;
}
.vi-delta.is-up {
  color: #0ac8b9;
}
.vi-delta.is-down {
  color: #e2665a;
}
.vi-num {
  font-variant-numeric: tabular-nums;
}
.vi-pagination {
  border-top: 1px solid #0a323c;
  padding: 10px 20px;
  font-size: 14px;
  color: #a09b8c;
}
.vi-foot {
  margin-top: 12px;
  font-size: 12px;
  color: #a09b8c;
}
.vi-mselect {
  display: none;
}
.vi-mlist {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.vi-mcard {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
  color: inherit;
  text-decoration: none;
}
.vi-mthumb {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 8px;
}
.vi-mbody {
  min-width: 0;
  flex: 1;
}
.vi-mtop {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.vi-mname {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
  color: #f0e6d2;
}
.vi-mscore {
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-weight: 700;
  font-size: 20px;
  color: #f0e6d2;
  font-variant-numeric: tabular-nums;
}
.vi-mline {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.35;
  color: #a09b8c;
}
@media (max-width: 767px) {
  .vi-head {
    flex-wrap: nowrap;
  }
  .vision-role {
    display: none !important;
  }
  .vi-mselect {
    display: block;
    height: 40px;
    padding: 0 12px;
    border: 1px solid #785a28;
    border-radius: 8px;
    background: #0a1428;
    color: #f0e6d2;
    font-weight: 600;
    font-size: 14px;
  }
}
</style>
