<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import {
  PING_METRIC_KEYS,
  PING_MOBILE_EXPANDED_KEYS,
  PING_MOBILE_PREVIEW_KEYS,
  pingsMobileSortOptions,
  type PingMetricKey,
  type PingsNumericKey,
  type PingsSortCol,
  type PingsTableRow,
} from '~/composables/statistics/useStatisticsPingsTab'

const p = inject('statisticsPageCtx') as Record<string, any>
const expandedPingsIds = ref<Set<number>>(new Set())

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

function togglePingsCardExpanded(championId: number): void {
  const next = new Set(expandedPingsIds.value)
  if (next.has(championId)) next.delete(championId)
  else next.add(championId)
  expandedPingsIds.value = next
}

function deltaSortKey(key: PingsNumericKey): PingsSortCol {
  return `${key}Delta`
}

function pingMetricLabel(key: PingMetricKey): string {
  return String(p.t?.('statisticsPage.pingsMetric.' + key) ?? key)
}
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
      <p class="text-xs text-text/55">{{ p.t('statisticsPage.pingsDeprecatedNote') }}</p>
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
          class="statistics-champion-stats-mobile-card statistics-pings-mobile-card w-full overflow-hidden rounded-lg border border-primary/30 bg-surface/40"
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
            <button
              type="button"
              class="flex min-w-0 flex-1 flex-col items-end justify-center text-right"
              @click="togglePingsCardExpanded(row.championId)"
            >
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
            </button>
          </div>

          <div class="border-t border-primary/15 px-3 py-2.5">
            <div class="grid grid-cols-3 gap-2 text-xs">
              <StatisticsPingMetricCardCell
                v-for="key in PING_MOBILE_PREVIEW_KEYS"
                :key="'ping-mobile-preview-' + row.championId + '-' + key"
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

            <button
              v-if="!expandedPingsIds.has(row.championId)"
              type="button"
              class="mt-2 w-full text-center text-xs font-medium text-accent underline decoration-accent/40 underline-offset-2"
              @click="togglePingsCardExpanded(row.championId)"
            >
              {{ p.t('statisticsPage.pingsShowMoreMetrics') }}
            </button>
          </div>

          <div
            v-if="expandedPingsIds.has(row.championId)"
            class="space-y-1.5 border-t border-primary/20 bg-black/20 px-3 py-2.5 text-sm text-text/85"
          >
            <div class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <StatisticsPingMetricCardCell
                v-for="key in PING_MOBILE_EXPANDED_KEYS"
                :key="'ping-mobile-expanded-' + row.championId + '-' + key"
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
            <button
              type="button"
              class="w-full text-center text-xs font-medium text-text/70 underline decoration-text/30 underline-offset-2"
              @click="togglePingsCardExpanded(row.championId)"
            >
              {{ p.t('statisticsPage.pingsShowLessMetrics') }}
            </button>
          </div>
        </article>
      </div>

      <div class="hidden overflow-x-auto md:block">
        <table class="statistics-table w-full min-w-[72rem] border-collapse text-sm">
          <thead>
            <tr
              class="border-b border-primary/30 text-left text-xs uppercase tracking-wide text-text/60"
            >
              <th class="sticky left-0 z-[1] bg-surface px-2 py-2">
                <button
                  type="button"
                  class="font-semibold hover:text-text"
                  @click="p.setPingsSort('champion')"
                >
                  {{ p.t('statisticsPage.pingsColChampion') }}{{ sortIndicator('champion') }}
                </button>
              </th>
              <th class="px-2 py-2 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    class="font-semibold hover:text-text"
                    @click="p.setPingsSort('totalPerGame')"
                  >
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
                class="px-2 py-2 text-right"
              >
                <div class="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    class="font-semibold hover:text-text"
                    @click="p.setPingsSort(key)"
                  >
                    {{ p.t('statisticsPage.pingsMetric.' + key) }}{{ sortIndicator(key) }}
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
          <tbody>
            <tr
              v-for="row in p.paginatedPingsRows"
              :key="'ping-' + row.championId"
              class="border-b border-primary/15 hover:bg-primary/5"
            >
              <td class="sticky left-0 z-[1] min-w-[220px] bg-surface px-2 py-2">
                <StatisticsChampionDetailLink
                  :champion-id="row.championId"
                  class="flex min-w-0 items-center gap-2"
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
              <td class="px-2 py-2 text-right tabular-nums">
                <div class="flex flex-col items-end gap-0 leading-tight">
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
                class="px-2 py-2 text-right tabular-nums"
              >
                <div class="flex flex-col items-end gap-0 leading-tight">
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
      </div>

      <StatisticsTabPagination
        v-if="p.totalPingsPages > 1"
        :page="p.pingsPage"
        :total-pages="p.totalPingsPages"
        @prev="p.onPingsPageUpdated(Math.max(1, p.pingsPage - 1))"
        @next="p.onPingsPageUpdated(Math.min(p.totalPingsPages, p.pingsPage + 1))"
      />
    </template>
  </div>
</template>
