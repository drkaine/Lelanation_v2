<script setup lang="ts">
import { computed, ref } from 'vue'
import { deltaToneClass, fmtLocNum, fmtLocSigned } from '~/utils/statistics/localeNum'
import {
  injectStatisticsPageCtx,
  type StatisticsIndexPageCtx,
} from '~/composables/statistics/statisticsPageCtx'
import { onPingIconError, pingIconSrc } from '~/utils/pingIcons'
import { topPingers } from '~/utils/statistics/topPingers'
import {
  PING_METRIC_KEYS,
  type PingMetricKey,
  type PingsNumericKey,
  type PingsSortCol,
  type PingsTableRow,
} from '~/composables/statistics/useStatisticsPingsTab'

const props = withDefaults(defineProps<{ section?: 'all' | 'talkers' | 'table' }>(), {
  section: 'all',
})
const section = computed(() => props.section)

const p = injectStatisticsPageCtx<StatisticsIndexPageCtx>()
const { locale } = useI18n()
const fmtLoc = (v: number | null | undefined, d: number) => fmtLocNum(v, d, locale.value)
const fmtSigned = (v: number | null | undefined, d: number) => fmtLocSigned(v, d, locale.value)

const talkers = computed(() => {
  const rows = (p.pingsTableData?.rows ?? []) as PingsTableRow[]
  const byId = new Map(rows.map(r => [r.championId, r]))
  return topPingers(rows, 8).map(tk => {
    const row = byId.get(tk.championId)
    const d = row ? p.pingsDelta?.(row, 'totalPerGame') : null
    return { ...tk, delta: typeof d === 'number' && Number.isFinite(d) ? d : null }
  })
})

const openPing = ref<number | null>(null)
const maxPingTotal = computed(() =>
  Math.max(
    1,
    ...((p.paginatedPingsRows ?? []) as PingsTableRow[]).map(r => Number(r.totalPerGame) || 0)
  )
)
function barPct(v: number): number {
  return Math.round(((Number(v) || 0) / maxPingTotal.value) * 100)
}

function championPortraitSrc(championId: number): string | null {
  if (!p.gameVersion || !p.championByKey(championId)) return null
  return p.getChampionImageUrl(p.gameVersion, p.championByKey(championId)!.image.full)
}

function pingValue(row: PingsTableRow, key: PingMetricKey): number {
  return Number(row[key] ?? 0)
}

function pingDelta(row: PingsTableRow, key: PingsNumericKey): number | null {
  return p.pingsDelta?.(row, key) ?? null
}

function sortIndicator(col: PingsSortCol): string {
  return p.pingsSortHint?.(col) ?? ''
}

function pingsMessage(message: string | undefined): string {
  if (!message) return ''
  if (message === 'Database not configured.' || message === 'Database not configured') {
    return String(p.t?.('statisticsPage.pingsDbNotConfigured') ?? message)
  }
  return message
}

function pingMetricLabel(key: PingMetricKey): string {
  return String(p.t?.('statisticsPage.pingsMetric.' + key) ?? key)
}

const pingsPageSize = computed({
  get: () => Number(p.championsPageSize) || 20,
  set: (value: number) => {
    p.onPingsPageSizeUpdated?.(value)
  },
})
</script>

<template>
  <div class="space-y-3">
    <div v-if="p.pingsPending" class="text-text/70">{{ p.t('statisticsPage.loading') }}</div>
    <div v-else-if="p.pingsError" class="rounded border border-error bg-surface p-3 text-error">
      {{ p.pingsError }}
    </div>
    <div
      v-else-if="p.pingsTableData?.message && !p.pingsTableData?.rows?.length"
      class="text-text/70"
    >
      {{ pingsMessage(p.pingsTableData.message) }}
    </div>
    <div v-else-if="!p.paginatedPingsRows?.length" class="text-text/70">
      {{ p.t('statisticsPage.noData') }}
    </div>
    <template v-else>
      <h2 v-if="talkers.length && section === 'talkers'" class="pings-h2">
        {{ p.t('statisticsPage.tabPings') }}
      </h2>
      <article v-if="talkers.length && section !== 'table'" class="pings-talkers">
        <header class="pings-talkers__head">
          <h3 class="pings-talkers__title">{{ p.t('statisticsPage.pingsTalkersTitle') }}</h3>
          <span class="pings-talkers__unit">{{ p.t('statisticsPage.pingsTalkersUnit') }}</span>
        </header>
        <ol class="pings-talkers__list">
          <li v-for="tk in talkers" :key="'talker-' + tk.championId" class="pings-talkers__row">
            <div class="pings-talkers__name">
              <span>{{ p.championName(tk.championId) || tk.championId }}</span>
              <div class="pings-talkers__track">
                <div class="pings-talkers__bar" :style="{ width: tk.barPct + '%' }" />
              </div>
            </div>
            <b class="pings-talkers__num">{{ fmtLoc(tk.totalPerGame, 1) }}</b>
            <span
              class="pings-talkers__delta"
              :class="
                tk.delta == null || Math.abs(tk.delta) < 0.005
                  ? ''
                  : tk.delta > 0
                    ? 'is-up'
                    : 'is-down'
              "
            >
              {{ fmtSigned(tk.delta, 2) }}
            </span>
          </li>
        </ol>
      </article>
      <template v-if="section !== 'talkers'">
        <article class="pg-mcard md:hidden">
          <header class="pg-mhead">
            <h3 class="pg-mtitle">{{ p.t('statisticsPage.pingsMobileTitle') }}</h3>
          </header>
          <ul class="pg-mlist">
            <li v-for="row in p.paginatedPingsRows" :key="'ping-m-' + row.championId">
              <button
                type="button"
                class="pg-mrow"
                :aria-expanded="openPing === row.championId"
                @click="openPing = openPing === row.championId ? null : row.championId"
              >
                <span class="pg-mname">
                  <span class="truncate">{{
                    p.championName(row.championId) || row.championId
                  }}</span>
                  <span class="pg-mtrack">
                    <span class="pg-mbar" :style="{ width: barPct(row.totalPerGame) + '%' }" />
                  </span>
                </span>
                <b class="pg-mnum">{{ fmtLoc(row.totalPerGame, 1) }}</b>
                <span class="pg-mdelta" :class="deltaToneClass(pingDelta(row, 'totalPerGame'))">
                  {{ fmtSigned(pingDelta(row, 'totalPerGame'), 2) }}
                </span>
              </button>
              <div v-if="openPing === row.championId" class="pg-mdetail">
                <span
                  v-for="key in PING_METRIC_KEYS"
                  :key="'pm-' + row.championId + key"
                  class="pg-mmetric"
                >
                  <img
                    :src="pingIconSrc(key)"
                    alt=""
                    width="16"
                    height="16"
                    @error="onPingIconError($event, key)"
                  />
                  <span>{{ pingMetricLabel(key) }}</span>
                  <b>{{ fmtLoc(pingValue(row, key), 2) }}</b>
                </span>
              </div>
            </li>
          </ul>
          <p class="pg-mfoot">{{ p.t('statisticsPage.pingsMobileFoot') }}</p>
        </article>

        <h2 v-if="section === 'table'" class="pings-h2 hidden md:block">
          {{ p.t('statisticsPage.pingsDetailTitle') }}
        </h2>
        <div class="pg-card hidden md:block">
          <div class="pg-scroll">
            <table class="pg-table">
              <thead>
                <tr>
                  <th class="pg-th-name">{{ p.t('statisticsPage.tierListColChampion') }}</th>
                  <th class="pg-r">
                    <button type="button" @click="p.setPingsSort('totalPerGame')">
                      {{ p.t('statisticsPage.pingsColTotal') }}{{ sortIndicator('totalPerGame') }}
                    </button>
                  </th>
                  <th v-for="key in PING_METRIC_KEYS" :key="'ping-th-' + key" class="pg-r">
                    <button
                      type="button"
                      class="pings-th-btn"
                      :title="pingMetricLabel(key)"
                      @click="p.setPingsSort(key)"
                    >
                      <img
                        :src="pingIconSrc(key)"
                        alt=""
                        class="pings-th-icon"
                        width="16"
                        height="16"
                        loading="lazy"
                        decoding="async"
                        @error="onPingIconError($event, key)"
                      /><span class="pings-th-label"
                        >{{ pingMetricLabel(key) }}{{ sortIndicator(key) }}</span
                      >
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in p.paginatedPingsRows" :key="'ping-' + row.championId">
                  <td>
                    <div class="pg-name">
                      <img
                        v-if="championPortraitSrc(row.championId)"
                        :src="championPortraitSrc(row.championId)!"
                        alt=""
                        width="28"
                        height="28"
                        loading="lazy"
                      />
                      <StatisticsChampionDetailLink :champion-id="row.championId" class="pg-link">
                        {{ p.championName(row.championId) || row.championId }}
                      </StatisticsChampionDetailLink>
                    </div>
                  </td>
                  <td class="pg-r">
                    <b class="pg-num">{{ fmtLoc(row.totalPerGame, 1) }}</b>
                    <div
                      class="pings-talkers__delta"
                      :class="deltaToneClass(pingDelta(row, 'totalPerGame'))"
                    >
                      {{ fmtSigned(pingDelta(row, 'totalPerGame'), 2) }}
                    </div>
                  </td>
                  <td
                    v-for="key in PING_METRIC_KEYS"
                    :key="'ping-td-' + row.championId + '-' + key"
                    class="pg-r pg-num"
                  >
                    {{ fmtLoc(pingValue(row, key), 2) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <StatisticsRangePagination
            v-model:page-size="pingsPageSize"
            :page="p.pingsPage"
            class="pg-pagination"
            :total-count="p.totalPingsCount"
            :total-pages="p.totalPingsPages"
            indicator="pages"
            @update:page="p.onPingsPageUpdated"
          >
            <template v-if="p.championSearchQuery" #default>
              {{ p.t('statisticsPage.showing') }} {{ p.totalPingsCount }}
            </template>
          </StatisticsRangePagination>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.pings-h2 {
  margin-bottom: 16px;
  font-size: 20px;
  font-weight: 600;
  line-height: 36px;
  color: #f0e6d2;
}
.pings-talkers {
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
  padding: 20px;
}
.pings-talkers__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}
.pings-talkers__title {
  font-size: 15px;
  font-weight: 600;
  color: #f0e6d2;
}
.pings-talkers__unit {
  font-size: 12px;
  color: #a09b8c;
}
.pings-talkers__list {
  display: grid;
  gap: 12px;
}
.pings-talkers__row {
  display: grid;
  grid-template-columns: 1fr 3.5rem 3.5rem;
  align-items: center;
  gap: 12px;
}
.pings-talkers__name {
  display: grid;
  gap: 4px;
  font-size: 14px;
  font-weight: 500;
  color: #f0e6d2;
}
.pings-talkers__track {
  height: 4px;
  border-radius: 2px;
  background: #1e2328;
}
.pings-talkers__bar {
  height: 100%;
  border-radius: 2px;
  background: #c8aa6e;
}
.pings-talkers__num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 14px;
  color: #f0e6d2;
}
.pings-talkers__delta {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  color: #a09b8c;
}
.pings-talkers__delta.is-up {
  color: #0ac8b9;
}
.pings-talkers__delta.is-down {
  color: #e2665a;
}
.pg-card {
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
  overflow: hidden;
}
.pg-scroll {
  overflow-x: auto;
}
.pg-table {
  width: 100%;
  min-width: 900px;
  border-collapse: collapse;
  font-size: 14px;
  color: #f0e6d2;
}
.pg-table th {
  padding: 12px 14px;
  font-size: 12px;
  font-weight: 600;
  color: #a09b8c;
  text-align: left;
  border-bottom: 1px solid #0a323c;
  vertical-align: bottom;
}
.pg-table td {
  padding: 8px 14px;
  border-bottom: 1px solid #1e2328;
  vertical-align: middle;
}
.pg-table tbody tr:last-child td {
  border-bottom: 0;
}
.pg-table .pg-r {
  text-align: right;
}
.pg-th-name {
  min-width: 180px;
}
.pg-table th:nth-child(2) {
  white-space: nowrap;
}
.pg-name {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}
.pg-name img {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid #0a323c;
}
.pg-link {
  color: #f0e6d2;
}
.pg-link:hover {
  color: #c8aa6e;
}
.pg-num {
  font-variant-numeric: tabular-nums;
}
.pg-pagination {
  border-top: 1px solid #0a323c;
  padding: 10px 20px;
  font-size: 14px;
  color: #a09b8c;
}
.pings-th-btn {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  min-width: 4.5rem;
}
.pings-th-icon {
  width: 20px;
  height: 20px;
  flex: none;
  object-fit: contain;
}
.pings-th-label {
  font-size: 0.7rem;
  line-height: 1.15;
  text-align: center;
  white-space: normal;
  max-width: 6rem;
}

.pg-mcard {
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
  padding: 14px 14px 12px;
}
.pg-mtitle {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 700;
  color: #f0e6d2;
}
.pg-mlist {
  list-style: none;
  margin: 0;
  padding: 0;
}
.pg-mlist > li + li {
  border-top: 1px solid rgba(70, 55, 20, 0.5);
}
.pg-mrow {
  display: grid;
  grid-template-columns: 1fr auto 48px;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 0;
  background: none;
  border: 0;
  color: #f0e6d2;
  text-align: left;
}
.pg-mname {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
}
.pg-mtrack {
  display: block;
  height: 5px;
  border-radius: 3px;
  background: #1e2328;
  overflow: hidden;
}
.pg-mbar {
  display: block;
  height: 100%;
  background: #c8aa6e;
}
.pg-mnum {
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.pg-mdelta {
  font-size: 12px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.pg-mdetail {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
  padding: 0 0 10px;
}
.pg-mmetric {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #a09b8c;
}
.pg-mmetric b {
  margin-left: auto;
  color: #f0e6d2;
}
.pg-mfoot {
  margin: 8px 0 0;
  font-size: 11px;
  color: #a09b8c;
}
@media (max-width: 767px) {
  .pings-talkers {
    display: none !important;
  }
}
</style>
