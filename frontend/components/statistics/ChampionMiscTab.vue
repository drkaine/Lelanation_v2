<template>
  <div class="champion-misc-tab space-y-4">
    <div v-if="pending" class="text-sm text-text/70">
      {{ t('statisticsPage.loading') }}
    </div>
    <div
      v-else-if="!hasData"
      class="rounded border border-primary/30 bg-surface/50 p-4 text-sm text-text/70"
    >
      {{ t('statisticsPage.championMiscEmpty') }}
    </div>
    <template v-else>
      <div
        v-for="group in displayGroups"
        :key="group.key"
        class="fast-stat-card w-full rounded-lg border border-primary/30 bg-surface/30 p-3"
      >
        <h4 class="mb-3 text-sm font-semibold text-text/90">
          {{ t(`statisticsPage.championMiscGroup_${group.key}`) }}
        </h4>
        <ul class="grid gap-2.5 text-xs text-text/85 sm:grid-cols-2 lg:grid-cols-3">
          <li
            v-for="metric in group.metrics"
            :key="metric.key"
            class="flex items-start justify-between gap-3 rounded border border-primary/15 bg-black/10 px-2 py-1.5"
          >
            <span class="min-w-0 leading-snug text-text/70">
              {{ t(`statisticsPage.championMisc_${group.key}_${metric.key}`) }}
            </span>
            <span class="shrink-0 font-semibold tabular-nums text-accent">
              {{ formatMetric(metric) }}
            </span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export type ChampionMiscMetric = { key: string; avgPerGame: number }
export type ChampionMiscMetricGroup = { key: string; metrics: ChampionMiscMetric[] }
export type ChampionMiscSummary = {
  games?: number
  groups?: ChampionMiscMetricGroup[]
}

const props = defineProps<{
  data: ChampionMiscSummary | null
  pending?: boolean
}>()

const { t } = useI18n()

const displayGroups = computed(() => props.data?.groups ?? [])
const hasData = computed(
  () =>
    (props.data?.games ?? 0) > 0 &&
    displayGroups.value.some(g => g.metrics.some(m => Number(m.avgPerGame) > 0))
)

function formatMetric(metric: ChampionMiscMetric): string {
  const v = Number(metric.avgPerGame)
  if (!Number.isFinite(v)) return '—'
  if (
    metric.key === 'double' ||
    metric.key === 'triple' ||
    metric.key === 'quadra' ||
    metric.key === 'penta' ||
    metric.key === 'unreal'
  ) {
    return v < 0.01 ? '< 0.01' : v.toFixed(2)
  }
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 })
}
</script>
