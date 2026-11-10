<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  injectStatisticsPageCtx,
  type StatisticsIndexPageCtx,
} from '~/composables/statistics/statisticsPageCtx'
import { onPingIconError, pingIconSrc } from '~/utils/pingIcons'
import { pingColumnsForMode, topPingers, type PingsViewMode } from '~/utils/statistics/topPingers'
import { breakdownSharePct } from '~/utils/championDashboard'
import {
  pingsMobileSortOptions,
  type PingMetricKey,
  type PingsNumericKey,
  type PingsSortCol,
  type PingsTableRow,
} from '~/composables/statistics/useStatisticsPingsTab'

const p = injectStatisticsPageCtx<StatisticsIndexPageCtx>()

const talkers = computed(() => {
  const rows = (p.pingsTableData?.rows ?? []) as PingsTableRow[]
  const byId = new Map(rows.map(r => [r.championId, r]))
  return topPingers(rows, 8).map(tk => {
    const row = byId.get(tk.championId)
    const d = row ? p.pingsDelta?.(row, 'totalPerGame') : null
    return { ...tk, delta: typeof d === 'number' && Number.isFinite(d) ? d : null }
  })
})

const pingsMobileSortColumn = computed({
  get: () => String(p.pingsSortColumn ?? 'totalPerGame'),
  set: (v: string) => {
    ;(p.setPingsSort as (c: PingsSortCol) => void)?.(v as PingsSortCol)
  },
})

const pingsMobileSortDir = computed({
  get: () => (p.pingsSortDir === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
  set: (v: 'asc' | 'desc') => {
    p.pingsSortDir = v
  },
})

const pingsMobileSortOptionsComputed = computed(() =>
  pingsMobileSortOptions((key: string) => String(p.t?.(key) ?? key))
)

function championPortraitSrc(championId: number): string | null {
  if (!p.gameVersion || !p.championByKey(championId)) return null
  return p.getChampionImageUrl(p.gameVersion, p.championByKey(championId)!.image.full)
}

function formatPing(value: number): string {
  return Number(value).toFixed(2)
}

function formatPingDelta(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${Number(value).toFixed(2)}`
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

function deltaSortKey(key: PingsNumericKey): PingsSortCol {
  return `${key}Delta`
}

function pingMetricLabel(key: PingMetricKey): string {
  return String(p.t?.('statisticsPage.pingsMetric.' + key) ?? key)
}

const viewMode = ref<PingsViewMode>('simple')
const VIEW_MODES: PingsViewMode[] = ['simple', 'detailed']
const visibleKeys = computed(() => pingColumnsForMode(viewMode.value))

const maxTotal = computed(() => {
  const rows = (p.pingsTableData?.rows ?? []) as PingsTableRow[]
  return rows.reduce((m, r) => Math.max(m, Number(r.totalPerGame) || 0), 0)
})

function isSorted(col: PingsSortCol): boolean {
  return p.pingsSortColumn === col
}

function deltaClass(d: number | null): string {
  if (d == null || d === 0) return ''
  return d > 0 ? 'is-up' : 'is-down'
}

const pingsPageSize = computed({
  get: () => Number(p.championsPageSize) || 20,
  set: (value: number) => {
    p.onPingsPageSizeUpdated?.(value)
  },
})
</script>

<template>
  <div class="pi-root">
    <div class="pi-head">
      <h2 class="pi-title">{{ p.t('statisticsPage.pingsTitle') }}</h2>
      <div class="pi-mode" role="group" :aria-label="p.t('statisticsPage.pingsModeAria')">
        <button
          v-for="m in VIEW_MODES"
          :key="m"
          type="button"
          class="pi-mode-btn"
          :class="{ 'is-active': viewMode === m }"
          :aria-pressed="viewMode === m"
          @click="viewMode = m"
        >
          {{
            p.t(
              m === 'simple' ? 'statisticsPage.pingsModeSimple' : 'statisticsPage.pingsModeDetailed'
            )
          }}
        </button>
      </div>
    </div>
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
      <StatisticsMobileSortBar
        id="pings-mobile-sort"
        v-model:column="pingsMobileSortColumn"
        v-model:direction="pingsMobileSortDir"
        :options="pingsMobileSortOptionsComputed"
      />

      <div class="statistics-pings-mobile-list space-y-2 md:hidden">
        <article
          v-for="row in p.paginatedPingsRows"
          :key="'ping-mobile-' + row.championId"
          class="statistics-champion-stats-mobile-card statistics-pings-mobile-card w-full overflow-hidden"
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
            <div class="flex min-w-0 flex-1 flex-col items-end justify-center text-right">
              <div class="text-[10px] font-medium uppercase tracking-wide text-text/55">
                {{ p.t('statisticsPage.pingsColTotal') }}
              </div>
              <div class="text-2xl font-bold tabular-nums leading-none text-text sm:text-3xl">
                {{ formatPing(row.totalPerGame) }}
              </div>
              <div
                v-if="pingDelta(row, 'totalPerGame') != null"
                class="mt-0.5 text-xs tabular-nums leading-none"
                :class="p.championGlobalNumericDeltaClass(pingDelta(row, 'totalPerGame')!)"
              >
                {{ formatPingDelta(pingDelta(row, 'totalPerGame')!) }}
              </div>
            </div>
          </div>

          <div class="border-t border-primary/15 px-3 py-2.5">
            <div class="grid grid-cols-3 gap-2 text-xs sm:grid-cols-4">
              <StatisticsPingMetricCardCell
                v-for="key in visibleKeys"
                :key="'ping-mobile-metric-' + row.championId + '-' + key"
                :metric-key="key"
                :label="pingMetricLabel(key)"
                :value="formatPing(pingValue(row, key))"
                :delta="pingDelta(row, key) != null ? formatPingDelta(pingDelta(row, key)!) : null"
                :delta-class="
                  pingDelta(row, key) != null
                    ? p.championGlobalNumericDeltaClass(pingDelta(row, key)!)
                    : null
                "
              />
            </div>
          </div>
        </article>
      </div>

      <div class="pi-layout hidden md:grid" :class="{ 'is-detailed': viewMode === 'detailed' }">
        <div class="pi-dtable-wrap">
          <table class="pi-dtable">
            <thead>
              <tr class="pi-dhead">
                <th scope="col" class="pi-dleft">
                  {{ p.t('statisticsPage.tierListColChampion') }}
                </th>
                <th
                  scope="col"
                  class="pi-dleft pi-dbar-cell"
                  :class="{ 'is-sorted': isSorted('totalPerGame') }"
                >
                  <button type="button" class="pi-dsort" @click="p.setPingsSort('totalPerGame')">
                    {{ p.t('statisticsPage.pingsColTotal') }}{{ sortIndicator('totalPerGame') }}
                  </button>
                  <button
                    v-if="p.pingsTableRefData"
                    type="button"
                    class="pi-dsort-delta"
                    :class="{ 'is-on': isSorted('totalPerGameDelta') }"
                    :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                    @click="p.setPingsSort('totalPerGameDelta')"
                  >
                    Δ{{ sortIndicator('totalPerGameDelta') }}
                  </button>
                </th>
                <th
                  v-for="key in visibleKeys"
                  :key="'ping-th-' + key"
                  scope="col"
                  class="pi-dnum"
                  :class="{ 'is-sorted': isSorted(key) }"
                >
                  <button type="button" class="pi-dsort" @click="p.setPingsSort(key)">
                    <img
                      :src="pingIconSrc(key)"
                      alt=""
                      class="pi-dicon"
                      width="16"
                      height="16"
                      loading="lazy"
                      decoding="async"
                      @error="onPingIconError($event, key)"
                    />{{ pingMetricLabel(key) }}{{ sortIndicator(key) }}
                  </button>
                  <button
                    v-if="p.pingsTableRefData"
                    type="button"
                    class="pi-dsort-delta"
                    :class="{ 'is-on': isSorted(deltaSortKey(key)) }"
                    :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                    @click="p.setPingsSort(deltaSortKey(key))"
                  >
                    Δ{{ sortIndicator(deltaSortKey(key)) }}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in p.paginatedPingsRows"
                :key="'ping-' + row.championId"
                class="pi-drow"
              >
                <th scope="row" class="pi-dleft pi-dchamp">
                  <StatisticsChampionTableLink
                    :champion-id="row.championId"
                    :query="p.championSearchQuery"
                  />
                </th>
                <td class="pi-dbar-cell">
                  <div class="pi-dbar-row">
                    <span class="pi-dbar" aria-hidden="true">
                      <span
                        class="pi-dbar-fill"
                        :style="{ width: breakdownSharePct(row.totalPerGame, maxTotal) + '%' }"
                      />
                    </span>
                    <span class="pi-dval pi-dstrong">{{ formatPing(row.totalPerGame) }}</span>
                    <span
                      class="pi-ddelta pi-ddelta--inline"
                      :class="deltaClass(pingDelta(row, 'totalPerGame'))"
                    >
                      {{
                        pingDelta(row, 'totalPerGame') != null
                          ? formatPingDelta(pingDelta(row, 'totalPerGame')!)
                          : ''
                      }}
                    </span>
                  </div>
                </td>
                <td
                  v-for="key in visibleKeys"
                  :key="'ping-td-' + row.championId + '-' + key"
                  class="pi-dnum"
                >
                  <span class="pi-dval">{{ formatPing(pingValue(row, key)) }}</span>
                  <span
                    v-if="pingDelta(row, key) != null"
                    class="pi-ddelta"
                    :class="deltaClass(pingDelta(row, key))"
                  >
                    {{ formatPingDelta(pingDelta(row, key)!) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <StatisticsRangePagination
            v-model:page-size="pingsPageSize"
            :page="p.pingsPage"
            class="pi-dpager"
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
        <article v-if="talkers.length" class="pings-talkers">
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
              <span class="pings-talkers__num">{{ tk.totalPerGame.toFixed(2) }}</span>
              <span class="pings-talkers__num" :class="deltaClass(tk.delta)">
                {{ tk.delta != null ? (tk.delta > 0 ? '+' : '') + tk.delta.toFixed(2) : '' }}
              </span>
            </li>
          </ol>
        </article>
      </div>
    </template>
  </div>
</template>

<style scoped>
.pi-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.pi-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.pi-title {
  font-size: 20px;
  font-weight: 600;
  color: #f0e6d2;
}
.pi-mode {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid #0a323c;
  border-radius: 8px;
  background: #0a1428;
}
.pi-mode-btn {
  height: 34px;
  padding: 0 14px;
  border-radius: 6px;
  font-size: 14px;
  color: #a09b8c;
}
.pi-mode-btn:hover {
  color: #f0e6d2;
}
.pi-mode-btn.is-active {
  color: #f0e6d2;
  font-weight: 600;
  background: #0a323c;
}
.pi-layout {
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.pi-layout.is-detailed {
  grid-template-columns: minmax(0, 1fr);
}
.pi-layout.is-detailed .pings-talkers {
  display: none;
}
.pi-dtable-wrap {
  overflow-x: auto;
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
}
.pi-dtable {
  width: 100%;
  min-width: 600px;
  border-collapse: collapse;
  font-size: 14px;
  color: #f0e6d2;
}
.pi-dhead th {
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #a09b8c;
  border-bottom: 1px solid #0a323c;
  white-space: nowrap;
}
.pi-dhead th.is-sorted {
  color: #c8aa6e;
}
.pi-dsort {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: inherit;
}
.pi-dsort:hover {
  color: #f0e6d2;
}
.pi-dicon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}
.pi-dsort-delta {
  margin-left: 4px;
  font-size: 11px;
  color: #5b5a56;
}
.pi-dsort-delta.is-on,
.pi-dsort-delta:hover {
  color: #c8aa6e;
}
.pi-dleft {
  text-align: left;
  padding: 9px 20px;
}
.pi-dchamp {
  font-weight: 500;
}
.pi-dnum {
  text-align: right;
  padding: 9px 12px;
  white-space: nowrap;
  vertical-align: middle;
}
.pi-dnum:last-child {
  padding-right: 20px;
}
.pi-drow {
  border-bottom: 1px solid #1e2328;
}
.pi-drow:hover {
  background: #0e1a2e;
}
.pi-dval {
  display: block;
  font-variant-numeric: tabular-nums;
}
.pi-dstrong {
  font-weight: 600;
}
.pi-ddelta {
  display: block;
  font-size: 11px;
  line-height: 1.2;
  color: #5b5a56;
  font-variant-numeric: tabular-nums;
}
.is-up {
  color: #0ac8b9;
}
.is-down {
  color: #e2665a;
}
.pi-dbar-cell {
  min-width: 200px;
  padding: 9px 16px;
}
.pi-dbar-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pi-dbar-row .pi-dval {
  width: 40px;
  text-align: right;
}
.pi-ddelta--inline {
  width: 44px;
}
.pi-dbar {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: #1e2328;
  overflow: hidden;
}
.pi-dbar-fill {
  display: block;
  height: 100%;
  border-radius: 4px;
  background: #c89b3c;
}
.pi-dpager {
  border-top: 1px solid #1e2328;
  padding: 8px 16px;
  font-size: 14px;
  color: #a09b8c;
}
.pings-talkers {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
}
.pings-talkers__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
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
  grid-template-columns: 1fr 44px 52px;
  align-items: center;
  gap: 10px;
}
.pings-talkers__name {
  display: flex;
  flex-direction: column;
  gap: 4px;
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
  background: #c89b3c;
}
.pings-talkers__num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.pings-talkers__num + .pings-talkers__num {
  font-size: 12px;
  font-weight: 400;
  color: #5b5a56;
}
.pings-talkers__num + .pings-talkers__num.is-up {
  color: #0ac8b9;
}
.pings-talkers__num + .pings-talkers__num.is-down {
  color: #e2665a;
}
</style>
