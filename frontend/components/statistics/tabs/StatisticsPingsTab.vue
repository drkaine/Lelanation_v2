<script setup lang="ts">
import { computed } from 'vue'
import {
  injectStatisticsPageCtx,
  type StatisticsIndexPageCtx,
} from '~/composables/statistics/statisticsPageCtx'
import { onPingIconError, pingIconSrc } from '~/utils/pingIcons'
import { topPingers } from '~/utils/statistics/topPingers'
import {
  PING_METRIC_KEYS,
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
            <span
              class="pings-talkers__num"
              :class="tk.delta != null ? p.championGlobalNumericDeltaClass(tk.delta) : ''"
            >
              {{ tk.delta != null ? (tk.delta > 0 ? '+' : '') + tk.delta.toFixed(2) : '' }}
            </span>
          </li>
        </ol>
      </article>
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
                v-for="key in PING_METRIC_KEYS"
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

      <div
        class="tier-list-mobile-rotate statistics-overview-surface hidden w-full overflow-x-auto rounded-lg border border-primary/30 md:block"
      >
        <div class="tier-list-lolalytics w-full min-w-0 text-[13px] max-lg:min-w-[720px]">
          <table class="w-full min-w-[520px] text-left text-[13px]">
            <thead
              class="sticky top-0 z-10 border-b border-black bg-[var(--color-grey-300)] text-text-primary/85"
            >
              <tr>
                <th class="min-w-[220px] px-2 py-1.5 text-left font-semibold text-text">
                  {{ p.t('statisticsPage.tierListColChampion') }}
                </th>
                <th class="cursor-pointer select-none px-3 py-1.5 font-semibold text-text">
                  <div class="flex items-center justify-center gap-1">
                    <button type="button" @click="p.setPingsSort('totalPerGame')">
                      {{ p.t('statisticsPage.pingsColTotal') }}{{ sortIndicator('totalPerGame') }}
                    </button>
                    <button
                      v-if="p.pingsTableRefData"
                      type="button"
                      class="text-[10px] text-text/70 hover:text-text"
                      :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                      @click="p.setPingsSort('totalPerGameDelta')"
                    >
                      Δ{{ sortIndicator('totalPerGameDelta') }}
                    </button>
                  </div>
                </th>
                <th
                  v-for="key in PING_METRIC_KEYS"
                  :key="'ping-th-' + key"
                  class="cursor-pointer select-none px-3 py-1.5 font-semibold text-text"
                >
                  <div class="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      class="inline-flex items-center gap-1"
                      :title="pingMetricLabel(key)"
                      @click="p.setPingsSort(key)"
                    >
                      <img
                        :src="pingIconSrc(key)"
                        :alt="pingMetricLabel(key)"
                        class="h-4 w-4 object-contain"
                        width="16"
                        height="16"
                        loading="lazy"
                        decoding="async"
                        @error="onPingIconError($event, key)"
                      /><span class="pings-th-label">{{ pingMetricLabel(key) }}</span
                      >{{ sortIndicator(key) }}
                    </button>
                    <button
                      v-if="p.pingsTableRefData"
                      type="button"
                      class="text-[10px] text-text/70 hover:text-text"
                      :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                      @click="p.setPingsSort(deltaSortKey(key))"
                    >
                      Δ{{ sortIndicator(deltaSortKey(key)) }}
                    </button>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-primary/20">
              <tr
                v-for="row in p.paginatedPingsRows"
                :key="'ping-' + row.championId"
                class="text-text-primary/90 odd:bg-white/[0.04] even:bg-black/25 hover:brightness-110"
              >
                <td class="min-w-[220px] py-0.5 pl-2 pr-0">
                  <StatisticsChampionTableLink
                    :champion-id="row.championId"
                    :query="p.championSearchQuery"
                  />
                </td>
                <td class="px-1 py-0.5 align-middle">
                  <div
                    class="flex min-h-[60px] flex-col items-center justify-center gap-0 text-center tabular-nums leading-tight"
                  >
                    <span class="font-semibold">{{ formatPing(row.totalPerGame) }}</span>
                    <span
                      v-if="pingDelta(row, 'totalPerGame') != null"
                      class="text-[10px] leading-none"
                      :class="p.championGlobalNumericDeltaClass(pingDelta(row, 'totalPerGame')!)"
                    >
                      {{ formatPingDelta(pingDelta(row, 'totalPerGame')!) }}
                    </span>
                  </div>
                </td>
                <td
                  v-for="key in PING_METRIC_KEYS"
                  :key="'ping-td-' + row.championId + '-' + key"
                  class="px-1 py-0.5 align-middle"
                >
                  <div
                    class="flex min-h-[60px] flex-col items-center justify-center gap-0 text-center tabular-nums leading-tight"
                  >
                    <span>{{ formatPing(pingValue(row, key)) }}</span>
                    <span
                      v-if="pingDelta(row, key) != null"
                      class="text-[10px] leading-none"
                      :class="p.championGlobalNumericDeltaClass(pingDelta(row, key)!)"
                    >
                      {{ formatPingDelta(pingDelta(row, key)!) }}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <StatisticsRangePagination
            v-model:page-size="pingsPageSize"
            :page="p.pingsPage"
            class="border-t border-primary/20 px-4 py-2 text-sm text-text/80"
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
      </div>
    </template>
  </div>
</template>

<style scoped>
.pings-talkers {
  border: 1px solid rgb(200 155 60 / 0.25);
  border-radius: 0.375rem;
  padding: 0.75rem 1rem;
}
.pings-talkers__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
.pings-talkers__title {
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-size: 1.05rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-gold-50, #f0e6d2);
}
.pings-talkers__unit {
  font-size: 0.75rem;
  color: var(--color-grey-50, #a09b8c);
}
.pings-talkers__list {
  display: grid;
  gap: 0.35rem;
}
.pings-talkers__row {
  display: grid;
  grid-template-columns: 1fr 4rem 4rem;
  align-items: center;
  gap: 0.5rem;
}
.pings-talkers__name {
  display: grid;
  gap: 0.15rem;
  font-size: 0.85rem;
  color: var(--color-gold-50, #f0e6d2);
}
.pings-talkers__track {
  height: 4px;
  border-radius: 2px;
  background: rgb(160 155 140 / 0.2);
}
.pings-talkers__bar {
  height: 100%;
  border-radius: 2px;
  background: var(--color-blue-100, #0ac8b9);
}
.pings-talkers__num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 0.85rem;
}
.pings-th-label {
  font-size: 0.7rem;
  white-space: nowrap;
}
</style>
