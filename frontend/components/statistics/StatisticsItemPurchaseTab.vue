<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  DailyTrendMetricId,
  DailyTrendSnapshotPoint,
} from '~/composables/statistics/useStatisticsDailyTrendCharts'

export type ItemPurchaseOrderDailyPoint = {
  dateOfGame: string
  orderPosition: number
  games: number
  wins: number
  winrate: number | null
}

export type ItemPurchaseTimingDailyPoint = {
  dateOfGame: string
  rankTier: string
  games: number
  avgPurchaseMs: number | null
}

export type ItemPurchaseOrderRow = {
  orderPosition: number
  games: number
  wins: number
  winrate: number | null
}

export type ItemPurchaseTimingRow = {
  rankTier: string
  games: number
  avgPurchaseMs: number | null
}

export type ItemPurchaseOrderDivisionDailyPoint = {
  dateOfGame: string
  rankTier: string
  games: number
  wins: number
  winrate: number | null
  avgOrderPosition?: number | null
}

export type ItemPurchaseOrderStats = {
  byOrder: ItemPurchaseOrderRow[]
  orderTrendPoints: ItemPurchaseOrderDailyPoint[]
  orderDivisionTrendPoints: ItemPurchaseOrderDivisionDailyPoint[]
  timingTrendPoints: ItemPurchaseTimingDailyPoint[]
  purchaseTiming: ItemPurchaseTimingRow[]
  overallAvgPurchaseMs: number | null
}

const props = withDefaults(
  defineProps<{
    stats: ItemPurchaseOrderStats | null
    pending?: boolean
    error?: string | null
    filterRank?: string[]
    versionsCatalog?: Array<{ patchLabel: string; releaseDate: string }>
  }>(),
  {
    pending: false,
    error: null,
    filterRank: () => [],
    versionsCatalog: () => [],
  }
)

const { t, locale } = useI18n()

const ORDER_COLOR_PALETTE = [
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#f59e0b',
  '#ef4444',
  '#14b8a6',
  '#eab308',
  '#f97316',
]

function orderTierKey(position: number): string {
  return `P${position}`
}

function parseOrderTier(tier: string): number {
  const match = String(tier).match(/^P(\d+)$/i) ?? String(tier).match(/^ORDER_(\d+)$/i)
  return match ? parseInt(match[1]!, 10) : NaN
}

function orderLabel(position: number): string {
  if (position === 1) return t('statisticsPage.itemStatsOrderFirst')
  if (locale.value === 'en') {
    const suffix = position === 2 ? 'nd' : position === 3 ? 'rd' : 'th'
    return t('statisticsPage.itemStatsOrderNth', { n: position, suffix })
  }
  return t('statisticsPage.itemStatsOrderNth', { n: position, suffix: 'e' })
}

function orderTierLabel(tier: string): string {
  if (tier === 'GLOBAL') return t('statisticsPage.championStatsTrendsGlobalLine')
  const position = parseOrderTier(tier)
  return Number.isFinite(position) ? orderLabel(position) : tier
}

function orderTierColor(tier: string): string {
  if (tier === 'GLOBAL') return '#c084fc'
  const position = parseOrderTier(tier)
  return ORDER_COLOR_PALETTE[(position - 1) % ORDER_COLOR_PALETTE.length] ?? '#64748b'
}

function orderTierSort(a: string, b: string): number {
  if (a === 'GLOBAL') return 1
  if (b === 'GLOBAL') return -1
  return parseOrderTier(a) - parseOrderTier(b)
}

function formatDivision(tier: string): string {
  return tier.charAt(0) + tier.slice(1).toLowerCase()
}

const orderDivisionTrendPoints = computed((): DailyTrendSnapshotPoint[] =>
  (props.stats?.orderDivisionTrendPoints ?? [])
    .filter(p => p.games > 0)
    .map(p => ({
      dateOfGame: p.dateOfGame,
      rankTier: p.rankTier,
      role: 'ALL',
      games: p.games,
      wins: p.wins,
      banRatePct: 0,
      pickRatePct: 0,
    }))
)

const orderPositionByDivisionPoints = computed((): DailyTrendSnapshotPoint[] =>
  (props.stats?.orderDivisionTrendPoints ?? [])
    .filter(p => p.games > 0 && p.avgOrderPosition != null && p.avgOrderPosition > 0)
    .map(p => ({
      dateOfGame: p.dateOfGame,
      rankTier: p.rankTier,
      role: 'ALL',
      games: p.games,
      wins: p.wins,
      banRatePct: 0,
      pickRatePct: p.avgOrderPosition ?? 0,
    }))
)

const orderTrendPoints = computed((): DailyTrendSnapshotPoint[] =>
  (props.stats?.orderTrendPoints ?? [])
    .filter(p => p.games > 0)
    .map(p => ({
      dateOfGame: p.dateOfGame,
      rankTier: orderTierKey(p.orderPosition),
      role: 'ALL',
      games: p.games,
      wins: p.wins,
      banRatePct: 0,
      pickRatePct: 0,
    }))
)

const timingTrendPoints = computed((): DailyTrendSnapshotPoint[] =>
  (props.stats?.timingTrendPoints ?? [])
    .filter(p => p.avgPurchaseMs != null && p.games > 0)
    .map(p => ({
      dateOfGame: p.dateOfGame,
      rankTier: p.rankTier,
      role: 'ALL',
      games: p.games,
      wins: 0,
      banRatePct: 0,
      pickRatePct: p.avgPurchaseMs ?? 0,
    }))
)

const winrateMetrics: DailyTrendMetricId[] = ['winrate']

function formatGameMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '—'
  const totalSec = Math.round(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${String(sec).padStart(2, '0')}`
}

function formatDurationMetric(metric: DailyTrendMetricId, value: number): string {
  if (metric === 'duration') return formatGameMs(value)
  if (metric === 'games') return `${Math.round(value)}`
  return `${value.toFixed(1)}%`
}

function formatOrderPositionMetric(metric: DailyTrendMetricId, value: number): string {
  if (metric === 'orderPosition') {
    return orderLabel(Math.max(1, Math.round(value)))
  }
  if (metric === 'games') return `${Math.round(value)}`
  return `${value.toFixed(1)}%`
}

const hasAnyData = computed(
  () =>
    orderTrendPoints.value.length > 0 ||
    orderDivisionTrendPoints.value.length > 0 ||
    orderPositionByDivisionPoints.value.length > 0 ||
    timingTrendPoints.value.length > 0
)
</script>

<template>
  <div class="item-purchase-tab space-y-4">
    <div v-if="pending" class="py-4 text-text/70">{{ t('statisticsPage.loading') }}</div>
    <p v-else-if="error" class="py-2 text-sm text-error">{{ error }}</p>
    <p v-else-if="!hasAnyData" class="text-text/70">
      {{ t('statisticsPage.itemStatsPurchaseOrderEmpty') }}
    </p>
    <div v-else class="flex w-full min-w-0 flex-col gap-6">
      <StatisticsDailyTrendChartsPanel
        v-if="orderTrendPoints.length"
        :points="orderTrendPoints"
        :filter-rank="[]"
        :versions-catalog="versionsCatalog"
        :title="t('statisticsPage.itemStatsWinrateByOrderTitle')"
        :show-division-presets="false"
        :enabled-metrics="winrateMetrics"
        :series-label="orderTierLabel"
        :tier-color="orderTierColor"
        :tier-sort-order="orderTierSort"
      />
      <StatisticsDailyTrendChartsPanel
        v-if="orderPositionByDivisionPoints.length"
        :points="orderPositionByDivisionPoints"
        :filter-rank="filterRank"
        :versions-catalog="versionsCatalog"
        :title="t('statisticsPage.itemStatsOrderPositionByDivisionTitle')"
        :enabled-metrics="['orderPosition']"
        :metric-titles-override="{
          orderPosition: t('statisticsPage.itemStatsOrderPositionByDivisionTitle'),
        }"
        :series-label="formatDivision"
        :format-metric-value="formatOrderPositionMetric"
      />
      <StatisticsDailyTrendChartsPanel
        v-if="orderDivisionTrendPoints.length"
        :points="orderDivisionTrendPoints"
        :filter-rank="filterRank"
        :versions-catalog="versionsCatalog"
        :title="t('statisticsPage.itemStatsWinrateByOrderDivisionTitle')"
        :enabled-metrics="winrateMetrics"
      />
      <StatisticsDailyTrendChartsPanel
        v-if="timingTrendPoints.length"
        :points="timingTrendPoints"
        :filter-rank="filterRank"
        :versions-catalog="versionsCatalog"
        :title="t('statisticsPage.itemStatsPurchaseTimingDailyTitle')"
        :enabled-metrics="['duration']"
        :metric-titles-override="{
          duration: t('statisticsPage.itemStatsPurchaseTimingMinutes'),
        }"
        :format-metric-value="formatDurationMetric"
      />
    </div>
  </div>
</template>
