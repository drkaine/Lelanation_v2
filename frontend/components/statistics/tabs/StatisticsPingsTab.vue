<script setup lang="ts">
import { computed, inject } from 'vue'
import { onPingIconError, pingIconSrc } from '~/utils/pingIcons'
import {
  PING_METRIC_KEYS,
  pingsMobileSortOptions,
  type PingMetricKey,
  type PingsNumericKey,
  type PingsSortCol,
  type PingsTableRow,
} from '~/composables/statistics/useStatisticsPingsTab'

const p = inject('statisticsPageCtx') as Record<string, any>

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
                      />{{ sortIndicator(key) }}
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
                  <StatisticsChampionDetailLink
                    :champion-id="row.championId"
                    class="flex items-center gap-2"
                  >
                    <img
                      v-if="championPortraitSrc(row.championId)"
                      :src="championPortraitSrc(row.championId)!"
                      :alt="p.championName(row.championId) || ''"
                      class="h-[50px] w-[50px] shrink-0 border-2 border-black object-cover"
                      width="50"
                      height="50"
                      loading="lazy"
                      decoding="async"
                    />
                    <span
                      class="min-w-0 truncate text-[12px] text-accent underline decoration-accent/40 underline-offset-2"
                    >
                      <StatisticsChampionNameHighlight
                        :name="String(p.championName(row.championId) || row.championId)"
                        :query="p.championSearchQuery"
                      />
                    </span>
                  </StatisticsChampionDetailLink>
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
          <div
            v-if="p.totalPingsCount > 0"
            class="flex flex-wrap items-center justify-between gap-2 border-t border-primary/20 px-4 py-2 text-sm text-text/80"
          >
            <span v-if="p.championSearchQuery"
              >{{ p.t('statisticsPage.showing') }} {{ p.totalPingsCount }}</span
            >
            <div class="flex items-center gap-3">
              <label class="flex items-center gap-1.5">
                <span class="text-text/70">{{ p.t('statisticsPage.perPage') }}</span>
                <select
                  v-model.number="pingsPageSize"
                  class="rounded border border-primary/40 bg-background px-2 py-1 text-text"
                >
                  <option v-for="n in p.PAGE_SIZE_OPTIONS" :key="'pings-ps-' + n" :value="n">
                    {{ n }}
                  </option>
                </select>
              </label>
              <span class="text-text/70">
                {{
                  p.t('statisticsPage.pageXOfY', {
                    current: p.pingsPage,
                    total: p.totalPingsPages,
                  })
                }}
              </span>
              <div class="flex gap-1">
                <button
                  type="button"
                  class="statistics-pagination-btn text-text"
                  :disabled="p.pingsPage <= 1"
                  @click="p.onPingsPageUpdated(Math.max(1, p.pingsPage - 1))"
                >
                  ‹
                </button>
                <button
                  type="button"
                  class="statistics-pagination-btn text-text"
                  :disabled="p.pingsPage >= p.totalPingsPages"
                  @click="p.onPingsPageUpdated(Math.min(p.totalPingsPages, p.pingsPage + 1))"
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
