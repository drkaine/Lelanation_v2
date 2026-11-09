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

const VISION_SUB_KEYS = VISION_METRIC_KEYS.filter(
  k => k !== 'visionScore' && k !== 'visionScorePerMinute'
)

function formatOne(value: number): string {
  return Number(value).toLocaleString('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

function formatDeltaOne(value: number): string {
  return `${value > 0 ? '▲ +' : value < 0 ? '▼ ' : ''}${formatOne(value)}`
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
  if (delta > 0) return 'text-info'
  if (delta < 0) return 'text-error'
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
    <div v-else-if="!hasData" class="statistics-empty-panel p-4">
      {{ t('statisticsPage.noData') }}
    </div>
    <template v-else>
      <div class="vp-card">
        <div class="vp-hero">
          <span class="vp-big">{{ formatOne(metricValue('visionScore')) }}</span>
          <span class="vp-hero-txt">
            <span>{{ t('statisticsPage.visionScorePerGame') }}</span>
            <span
              v-if="metricDelta('visionScore') != null"
              :class="deltaClass(metricDelta('visionScore') ?? 0)"
            >
              {{ formatDeltaOne(metricDelta('visionScore') ?? 0) }} ·
              {{ formatMetric(metricValue('visionScorePerMinute')) }} / min
            </span>
          </span>
        </div>
        <dl class="vp-grid">
          <div v-for="key in VISION_SUB_KEYS" :key="key">
            <dt>{{ metricLabel(key) }}</dt>
            <dd>
              {{ formatOne(metricValue(key)) }}
              <small v-if="metricDelta(key) != null" :class="deltaClass(metricDelta(key) ?? 0)">
                {{ formatDelta(metricDelta(key) ?? 0) }}
              </small>
            </dd>
          </div>
        </dl>
      </div>
    </template>
  </div>
</template>

<style scoped>
.vp-card {
  padding: 20px;
  border: 1px solid #463714;
  border-radius: 10px;
  background: #0a1428;
}
.vp-hero {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  margin-bottom: 20px;
}
.vp-big {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: 44px;
  line-height: 1;
  color: #f0e6d2;
}
.vp-hero-txt {
  display: flex;
  flex-direction: column;
  font-size: 13px;
  color: #f0e6d2;
}
.vp-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 24px;
  margin: 0;
  padding: 0 12px;
}
.vp-grid dt {
  font-size: 12px;
  color: #a09b8c;
}
.vp-grid dd {
  margin: 2px 0 0;
  font-size: 15px;
  font-weight: 700;
  color: #f0e6d2;
  font-variant-numeric: tabular-nums;
}
.vp-grid small {
  margin-left: 4px;
  font-size: 11px;
  font-weight: 500;
}
</style>
