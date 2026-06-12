<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  VISION_METRIC_KEYS,
  type VisionMetricKey,
  type VisionTableRow,
} from '~/composables/statistics/useStatisticsVisionTab'

export type ChampionVisionSummary = VisionTableRow & { games: number }

const props = defineProps<{
  data: ChampionVisionSummary | null
  baseline: ChampionVisionSummary | null
  pending: boolean
}>()

const { t } = useI18n()

const hasData = computed(() => Number(props.data?.games ?? 0) > 0)

function formatMetric(value: number): string {
  return Number(value).toFixed(2)
}

function formatDelta(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${Number(value).toFixed(2)}`
}

function metricValue(key: VisionMetricKey): number {
  return Number(props.data?.[key] ?? 0)
}

function metricDelta(key: VisionMetricKey): number | null {
  if (!props.baseline) return null
  return metricValue(key) - Number(props.baseline[key] ?? 0)
}

function deltaClass(delta: number): string {
  if (delta > 0) return 'text-emerald-400'
  if (delta < 0) return 'text-red-400'
  return 'text-text/55'
}

function metricLabel(key: VisionMetricKey): string {
  return t(`statisticsPage.visionMetric.${key}`)
}
</script>

<template>
  <div class="champion-vision-tab w-full min-w-0 max-w-full space-y-4">
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
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
          <div
            v-for="key in VISION_METRIC_KEYS"
            :key="key"
            class="flex flex-col rounded-lg border border-primary/20 bg-primary/5 px-3 py-2"
          >
            <span class="text-xs font-medium text-text/70">{{ metricLabel(key) }}</span>
            <span class="mt-1 text-lg font-bold tabular-nums text-text">
              {{ formatMetric(metricValue(key)) }}
            </span>
            <span
              v-if="metricDelta(key) != null"
              class="mt-0.5 text-xs tabular-nums"
              :class="deltaClass(metricDelta(key) ?? 0)"
            >
              {{ formatDelta(metricDelta(key) ?? 0) }}
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
