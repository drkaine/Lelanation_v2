<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DailyTrendSnapshotPoint } from '~/composables/statistics/useStatisticsDailyTrendCharts'
import {
  useChampionDurationByTierCharts,
  type ChampionDurationByTierData,
} from '~/composables/statistics/useChampionDurationByTierCharts'

const props = withDefaults(
  defineProps<{
    durationData: ChampionDurationByTierData | null
    trendPoints: DailyTrendSnapshotPoint[]
    filterRank: string[]
    pending?: boolean
    showGlobalLine?: boolean
  }>(),
  {
    pending: false,
    showGlobalLine: true,
  }
)

const { t } = useI18n()
const showGlobalLine = ref(props.showGlobalLine)

const charts = useChampionDurationByTierCharts({
  durationData: toRef(props, 'durationData'),
  trendPoints: toRef(props, 'trendPoints'),
  filterRank: toRef(props, 'filterRank'),
  showGlobalLine,
  winrateTitle: computed(() => t('statisticsPage.championStatsDurationWinrate')),
  gamesTitle: computed(() => t('statisticsPage.championStatsDurationGamesDistribution')),
})
</script>

<template>
  <div v-if="pending" class="rounded border border-primary/20 bg-background/30 p-3">
    <h3 class="mb-2 text-sm font-medium text-text">
      {{ t('statisticsPage.championStatsDurationChartsLoading') }}
    </h3>
    <div class="py-10 text-center text-xs text-text/60">{{ t('statisticsPage.loading') }}</div>
  </div>
  <div
    v-else-if="charts.durationTrendCards.value.length"
    class="grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-2"
  >
    <article
      v-for="card in charts.durationTrendCards.value"
      :key="`duration-${card.metricId}`"
      class="w-full min-w-0 rounded border border-primary/20 bg-background/30 p-3"
    >
      <h3 class="mb-2 text-sm font-medium text-text">{{ card.title }}</h3>
      <div class="max-w-full overflow-hidden">
        <svg
          :viewBox="`0 0 ${charts.DAILY_TREND_CHART_W} ${charts.DAILY_TREND_CHART_H}`"
          class="block h-auto w-full max-w-full"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <linearGradient :id="`duration-bg-${card.metricId}`" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="rgb(71 85 105 / 0.28)" />
              <stop offset="100%" stop-color="rgb(15 23 42 / 0.08)" />
            </linearGradient>
          </defs>
          <rect
            :x="charts.DAILY_TREND_CHART_PAD.left"
            :y="charts.DAILY_TREND_CHART_PAD.top"
            :width="charts.DAILY_TREND_PLOT_W"
            :height="charts.DAILY_TREND_PLOT_H"
            :fill="`url(#duration-bg-${card.metricId})`"
          />
          <g v-for="tick in card.yTicks" :key="`duration-${card.metricId}-y-${tick.value}`">
            <line
              :x1="charts.DAILY_TREND_CHART_PAD.left"
              :y1="tick.y"
              :x2="charts.DAILY_TREND_CHART_PAD.left + charts.DAILY_TREND_PLOT_W"
              :y2="tick.y"
              class="text-text/25"
              stroke="currentColor"
              stroke-width="1"
            />
            <text
              :x="charts.DAILY_TREND_CHART_PAD.left - 6"
              :y="tick.y + 4"
              text-anchor="end"
              class="fill-text/70 text-[10px]"
            >
              {{ tick.label }}
            </text>
          </g>
          <path
            v-for="serie in card.series"
            v-show="charts.isLegendTierVisible(serie.tier)"
            :key="`duration-${card.metricId}-${serie.tier}`"
            :d="serie.path"
            fill="none"
            :stroke="serie.color"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <g
            v-for="serie in card.series"
            v-show="charts.isLegendTierVisible(serie.tier)"
            :key="`duration-${card.metricId}-${serie.tier}-points`"
          >
            <circle
              v-for="pt in serie.points"
              v-show="(pt.games ?? 0) > 0"
              :key="`duration-${card.metricId}-${serie.tier}-${pt.idx}`"
              :cx="pt.x"
              :cy="pt.y"
              r="3"
              :fill="serie.color"
              class="cursor-pointer"
              @mouseenter="charts.onDurationChartHover($event, card.metricId, serie.tier, pt)"
              @mousemove="charts.onDurationChartHover($event, card.metricId, serie.tier, pt)"
              @mouseleave="charts.durationTooltip.value = null"
            />
          </g>
          <g v-for="tick in card.xTicks" :key="`duration-${card.metricId}-x-${tick.index}`">
            <text
              :x="tick.x"
              :y="charts.DAILY_TREND_CHART_H - 6"
              text-anchor="middle"
              class="fill-text/70 text-[10px]"
            >
              {{ tick.label }}
            </text>
          </g>
        </svg>
      </div>
      <div
        v-if="
          charts.durationTooltip.value && charts.durationTooltip.value.metricId === card.metricId
        "
        class="pointer-events-none fixed z-[90] rounded border border-primary/30 bg-surface/90 px-2 py-1 text-[11px] text-text/85 shadow-lg"
        :style="{
          left: `${charts.durationTooltip.value.mouseX}px`,
          top: `${charts.durationTooltip.value.mouseY}px`,
          transform: 'translate(-50%, -110%)',
        }"
      >
        <template v-if="charts.durationTooltip.value.metricId === 'winrate'">
          <strong>{{ charts.durationTooltip.value.tier }}</strong> ·
          {{ charts.durationTooltip.value.bucketLabel }} ·
          {{ Number(charts.durationTooltip.value.value).toFixed(2) }}% ·
          {{ charts.durationTooltip.value.games }}
          {{ t('statisticsPage.championStatsDurationWinrateTooltipMatches') }}
        </template>
        <template v-else>
          <strong>{{ charts.durationTooltip.value.tier }}</strong> ·
          {{ charts.durationTooltip.value.bucketLabel }} ·
          {{ Math.round(charts.durationTooltip.value.games) }}
          {{ t('statisticsPage.championStatsDurationWinrateTooltipMatches') }}
        </template>
      </div>
      <div class="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text/80">
        <button
          v-for="serie in card.series"
          :key="`duration-${card.metricId}-legend-${serie.tier}`"
          type="button"
          class="inline-flex items-center gap-1 rounded px-1 py-0.5 transition hover:bg-primary/20"
          :class="
            charts.isLegendTierVisible(serie.tier)
              ? 'text-text/85'
              : 'text-text/45 line-through opacity-70'
          "
          :title="t('statisticsPage.championStatsLegendToggleDivision')"
          @click="charts.toggleLegendTierVisibility(serie.tier)"
        >
          <span
            class="inline-block h-2.5 w-2.5 rounded-full"
            :style="{ backgroundColor: serie.color }"
          />
          {{ serie.tier }}
        </button>
      </div>
    </article>
  </div>
</template>
