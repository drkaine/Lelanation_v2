<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  DAILY_TREND_CHART_H,
  DAILY_TREND_CHART_PAD,
  DAILY_TREND_CHART_W,
  DAILY_TREND_PLOT_H,
  DAILY_TREND_PLOT_W,
  useStatisticsDailyTrendCharts,
  type DailyTrendMetricId,
  type DailyTrendSnapshotPoint,
} from '~/composables/statistics/useStatisticsDailyTrendCharts'

const props = withDefaults(
  defineProps<{
    points: DailyTrendSnapshotPoint[]
    pending?: boolean
    error?: string | null
    filterRank: string[]
    showBanrate?: boolean
    versionsCatalog?: Array<{ patchLabel: string; releaseDate: string }>
  }>(),
  {
    pending: false,
    error: null,
    showBanrate: false,
    versionsCatalog: () => [],
  }
)

const { t } = useI18n()

const metricTitles = computed(() => ({
  games: t('statisticsPage.championStatsTrendGames'),
  winrate: t('statisticsPage.championStatsTrendWinrate'),
  pickrate: t('statisticsPage.championStatsTrendPickrate'),
  banrate: t('statisticsPage.championStatsTrendBanrate'),
}))

const charts = useStatisticsDailyTrendCharts({
  points: toRef(props, 'points'),
  filterRank: toRef(props, 'filterRank'),
  showBanrate: computed(() => props.showBanrate),
  versionsCatalog: computed(() => props.versionsCatalog ?? []),
  metricTitles,
})
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
      <h2 class="shrink-0 text-base font-semibold text-text">
        {{ t('statisticsPage.championStatsTrendsTitle') }}
      </h2>
      <label class="inline-flex shrink-0 items-center gap-2 text-text/80">
        <span>{{ t('statisticsPage.championStatsTrendsGranularity') }}</span>
        <select
          v-model="charts.trendGranularity.value"
          class="rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
        >
          <option value="day">{{ t('statisticsPage.championStatsTrendsDay') }}</option>
          <option value="week">{{ t('statisticsPage.championStatsTrendsWeek') }}</option>
          <option value="month">{{ t('statisticsPage.championStatsTrendsMonth') }}</option>
          <option value="patch">{{ t('statisticsPage.championStatsTrendsPatch') }}</option>
        </select>
      </label>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded px-2 py-1 font-medium transition-colors"
          :class="
            charts.trendRangeMode.value === '7d'
              ? 'bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/60'
              : 'bg-black/20 text-text/85 hover:bg-white/10'
          "
          @click="charts.trendRangeMode.value = '7d'"
        >
          {{ t('statisticsPage.championStatsTrendsRange7d') }}
        </button>
        <button
          type="button"
          class="rounded px-2 py-1 font-medium transition-colors"
          :class="
            charts.trendRangeMode.value === '14d'
              ? 'bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/60'
              : 'bg-black/20 text-text/85 hover:bg-white/10'
          "
          @click="charts.trendRangeMode.value = '14d'"
        >
          {{ t('statisticsPage.championStatsTrendsRange14d') }}
        </button>
        <button
          type="button"
          class="rounded px-2 py-1 font-medium transition-colors"
          :class="
            charts.trendRangeMode.value === 'months'
              ? 'bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/60'
              : 'bg-black/20 text-text/85 hover:bg-white/10'
          "
          @click="charts.trendRangeMode.value = 'months'"
        >
          {{ t('statisticsPage.championStatsTrendsRangeMonths') }}
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded px-2 py-1 font-medium transition-colors"
          :class="
            charts.trendDivisionPreset.value === 'selected'
              ? 'bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/60'
              : 'bg-black/20 text-text/85 hover:bg-white/10'
          "
          @click="charts.setTrendDivisionPreset('selected')"
        >
          {{ t('statisticsPage.championStatsTrendsPresetSelected') }}
        </button>
        <button
          type="button"
          class="rounded px-2 py-1 font-medium transition-colors"
          :class="
            charts.trendDivisionPreset.value === 'average'
              ? 'bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/60'
              : 'bg-black/20 text-text/85 hover:bg-white/10'
          "
          @click="charts.setTrendDivisionPreset('average')"
        >
          Average
        </button>
        <button
          type="button"
          class="rounded px-2 py-1 font-medium transition-colors"
          :class="
            charts.trendDivisionPreset.value === 'skilled'
              ? 'bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/60'
              : 'bg-black/20 text-text/85 hover:bg-white/10'
          "
          @click="charts.setTrendDivisionPreset('skilled')"
        >
          Skilled
        </button>
        <button
          type="button"
          class="rounded px-2 py-1 font-medium transition-colors"
          :class="
            charts.trendDivisionPreset.value === 'elite'
              ? 'bg-blue-500/20 text-blue-200 ring-1 ring-blue-400/60'
              : 'bg-black/20 text-text/85 hover:bg-white/10'
          "
          @click="charts.setTrendDivisionPreset('elite')"
        >
          Elite
        </button>
        <label class="inline-flex items-center gap-1 text-text/80">
          <input
            v-model="charts.trendShowGlobalLine.value"
            type="checkbox"
            class="rounded border-primary/50"
          />
          <span>{{ t('statisticsPage.championStatsTrendsGlobalLine') }}</span>
        </label>
      </div>
    </div>

    <div v-if="pending" class="py-4 text-text/70">{{ t('statisticsPage.loading') }}</div>
    <p v-else-if="error" class="py-2 text-sm text-red-400">{{ error }}</p>
    <div
      v-else-if="charts.trendChartCards.value.length"
      class="grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-2"
    >
      <article
        v-for="card in charts.trendChartCards.value"
        :key="card.metricId"
        class="w-full min-w-0 rounded border border-primary/20 bg-background/30 p-3"
      >
        <h3 class="mb-2 text-sm font-medium text-text">{{ card.title }}</h3>
        <div class="max-w-full overflow-hidden">
          <svg
            :viewBox="`0 0 ${DAILY_TREND_CHART_W} ${DAILY_TREND_CHART_H}`"
            class="block h-auto w-full max-w-full"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <defs>
              <linearGradient :id="`daily-trend-bg-${card.metricId}`" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="rgb(71 85 105 / 0.28)" />
                <stop offset="100%" stop-color="rgb(15 23 42 / 0.08)" />
              </linearGradient>
            </defs>
            <rect
              :x="DAILY_TREND_CHART_PAD.left"
              :y="DAILY_TREND_CHART_PAD.top"
              :width="DAILY_TREND_PLOT_W"
              :height="DAILY_TREND_PLOT_H"
              :fill="`url(#daily-trend-bg-${card.metricId})`"
            />
            <g v-for="tick in card.yTicks" :key="`${card.metricId}-y-${tick.value}`">
              <line
                :x1="DAILY_TREND_CHART_PAD.left"
                :y1="tick.y"
                :x2="DAILY_TREND_CHART_PAD.left + DAILY_TREND_PLOT_W"
                :y2="tick.y"
                class="text-text/25"
                stroke="currentColor"
                stroke-width="1"
              />
              <text
                :x="DAILY_TREND_CHART_PAD.left - 6"
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
              :key="`${card.metricId}-${serie.tier}`"
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
              :key="`${card.metricId}-${serie.tier}-points`"
            >
              <circle
                v-for="pt in serie.points"
                :key="`${card.metricId}-${serie.tier}-${pt.idx}`"
                :cx="pt.x"
                :cy="pt.y"
                r="3"
                :fill="serie.color"
                class="cursor-pointer"
                @mouseenter="
                  charts.onTrendPointHover(
                    $event,
                    card.metricId as DailyTrendMetricId,
                    serie.tier,
                    pt
                  )
                "
                @mousemove="
                  charts.onTrendPointHover(
                    $event,
                    card.metricId as DailyTrendMetricId,
                    serie.tier,
                    pt
                  )
                "
                @mouseleave="charts.trendTooltip.value = null"
              />
            </g>
            <g v-for="tick in card.xTicks" :key="`${card.metricId}-x-${tick.index}`">
              <text
                :x="tick.x"
                :y="DAILY_TREND_CHART_H - 6"
                text-anchor="middle"
                class="fill-text/70 text-[10px]"
              >
                {{ tick.label }}
              </text>
            </g>
          </svg>
        </div>
        <div
          v-if="charts.trendTooltip.value && charts.trendTooltip.value.metricId === card.metricId"
          class="pointer-events-none fixed z-[90] rounded border border-primary/30 bg-surface/90 px-2 py-1 text-[11px] text-text/85 shadow-lg"
          :style="{
            left: `${charts.trendTooltip.value.mouseX}px`,
            top: `${charts.trendTooltip.value.mouseY}px`,
            transform: 'translate(-50%, -110%)',
          }"
        >
          <strong>{{ charts.trendTooltip.value.tier }}</strong> ·
          {{ charts.trendTooltip.value.bucketLabel }} ·
          {{
            charts.formatTrendValue(
              card.metricId as DailyTrendMetricId,
              charts.trendTooltip.value.value
            )
          }}
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text/80">
          <button
            v-for="serie in card.series"
            :key="`${card.metricId}-legend-${serie.tier}`"
            type="button"
            class="inline-flex items-center gap-1 rounded px-1 py-0.5 transition hover:bg-primary/20"
            :class="
              charts.isLegendTierVisible(serie.tier)
                ? 'text-text/85'
                : 'text-text/45 line-through opacity-70'
            "
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
    <p v-else class="text-text/70">{{ t('statisticsPage.noData') }}</p>
  </div>
</template>
