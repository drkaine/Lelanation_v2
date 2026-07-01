<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  PING_METRIC_KEYS,
  type PingMetricKey,
  type PingsNumericKey,
  type PingsTableRow,
} from '~/composables/statistics/useStatisticsPingsTab'

export type ChampionPingsSummary = PingsTableRow

const props = defineProps<{
  data: ChampionPingsSummary | null
  baseline: ChampionPingsSummary | null
  pending: boolean
}>()

const { t } = useI18n()

const hasData = computed(() => Number(props.data?.games ?? 0) > 0)

function formatPing(value: number): string {
  return Number(value).toFixed(2)
}

function formatDelta(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${Number(value).toFixed(2)}`
}

function metricValue(key: PingsNumericKey): number {
  return Number(props.data?.[key] ?? 0)
}

function metricDelta(key: PingsNumericKey): number | null {
  if (!props.baseline) return null
  return metricValue(key) - Number(props.baseline[key] ?? 0)
}

function deltaClass(delta: number): string {
  if (delta > 0) return 'text-info'
  if (delta < 0) return 'text-error'
  return 'text-text/55'
}

function metricLabel(key: PingMetricKey): string {
  return t(`statisticsPage.pingsMetric.${key}`)
}
</script>

<template>
  <div class="champion-pings-tab w-full min-w-0 max-w-full space-y-4">
    <div v-if="pending" class="text-sm text-text/70">
      {{ t('statisticsPage.loading') }}
    </div>
    <div
      v-else-if="!hasData"
      class="rounded-lg border border-primary/30 bg-surface/50 p-4 text-sm text-text/70"
    >
      {{ t('statisticsPage.noData') }}
    </div>
    <template v-else>
      <div class="fast-stat-card rounded-lg border border-primary/30 bg-surface/30 p-3">
        <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 class="text-sm font-semibold text-text">
            {{ t('statisticsPage.pingsColTotal') }}
          </h3>
          <div class="text-right">
            <div class="text-lg font-bold tabular-nums text-text">
              {{ formatPing(metricValue('totalPerGame')) }}
            </div>
            <div
              v-if="metricDelta('totalPerGame') != null"
              class="text-xs tabular-nums"
              :class="deltaClass(metricDelta('totalPerGame') ?? 0)"
            >
              {{ formatDelta(metricDelta('totalPerGame') ?? 0) }}
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          <StatisticsPingMetricCardCell
            v-for="key in PING_METRIC_KEYS"
            :key="key"
            :metric-key="key"
            :label="metricLabel(key)"
            :value="formatPing(metricValue(key))"
            :delta="metricDelta(key) != null ? formatDelta(metricDelta(key) ?? 0) : null"
            :delta-class="metricDelta(key) != null ? deltaClass(metricDelta(key) ?? 0) : null"
          />
        </div>
      </div>
    </template>
  </div>
</template>
