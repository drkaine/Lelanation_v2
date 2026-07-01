<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  SHARED_DAILY_TREND_CHART_UI_KEY,
  type DailyTrendGranularity,
} from '~/composables/statistics/useStatisticsDailyTrendCharts'

withDefaults(
  defineProps<{
    title?: string
    showDivisionPresets?: boolean
    showGlobalLineToggle?: boolean
    /** Vertical layout for the statistics filters sidebar. */
    stacked?: boolean
  }>(),
  {
    title: undefined,
    showDivisionPresets: true,
    showGlobalLineToggle: true,
    stacked: false,
  }
)

const { t } = useI18n()
const charts = inject(SHARED_DAILY_TREND_CHART_UI_KEY)

const trendGranularityModel = computed({
  get: (): DailyTrendGranularity => charts?.trendGranularity.value ?? 'day',
  set: (value: DailyTrendGranularity) => {
    if (charts) charts.trendGranularity.value = value
  },
})

const trendMonthsWindowModel = computed({
  get: (): number => charts?.trendMonthsWindow.value ?? 1,
  set: (value: number) => {
    if (!charts) return
    charts.trendMonthsWindow.value = Math.max(1, Math.min(24, Number(value) || 1))
  },
})
</script>

<template>
  <div
    v-if="charts"
    :class="
      stacked
        ? 'statistics-trend-filters-fields flex flex-col gap-3'
        : 'flex flex-wrap items-center gap-x-3 gap-y-2 text-xs'
    "
  >
    <slot name="leading" />
    <h2 v-if="title && !stacked" class="shrink-0 text-base font-semibold text-text">
      {{ title }}
    </h2>
    <div :class="stacked ? 'space-y-1' : 'inline-flex shrink-0 items-center gap-2 text-text/80'">
      <div :class="stacked ? 'mb-1 text-sm font-medium text-text' : ''">
        {{ t('statisticsPage.championStatsTrendsGranularity') }}
      </div>
      <select
        v-model="trendGranularityModel"
        :class="
          stacked
            ? 'w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text'
            : 'rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text'
        "
      >
        <option value="day">{{ t('statisticsPage.championStatsTrendsDay') }}</option>
        <option value="week">{{ t('statisticsPage.championStatsTrendsWeek') }}</option>
        <option value="month">{{ t('statisticsPage.championStatsTrendsMonth') }}</option>
        <option value="patch">{{ t('statisticsPage.championStatsTrendsPatch') }}</option>
      </select>
    </div>
    <div :class="stacked ? 'space-y-1' : ''">
      <div v-if="stacked" class="mb-1 text-sm font-medium text-text">
        {{ t('statisticsPage.championStatsTrendsRangeLabel') }}
      </div>
      <div class="flex flex-wrap gap-1">
        <button
          type="button"
          class="rounded px-2 py-1 font-medium transition-colors"
          :class="
            charts.trendRangeMode.value === '7d'
              ? 'bg-info/20 text-primary-light ring-1 ring-info/60'
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
              ? 'bg-info/20 text-primary-light ring-1 ring-info/60'
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
              ? 'bg-info/20 text-primary-light ring-1 ring-info/60'
              : 'bg-black/20 text-text/85 hover:bg-white/10'
          "
          @click="charts.trendRangeMode.value = 'months'"
        >
          {{ t('statisticsPage.championStatsTrendsRangeMonths') }}
        </button>
      </div>
      <label
        v-if="charts.trendRangeMode.value === 'months'"
        class="mt-1 inline-flex items-center gap-1 text-text/80"
        :class="stacked ? 'w-full' : ''"
      >
        <span class="text-[11px]">{{ t('statisticsPage.championStatsTrendsMonthsLabel') }}</span>
        <input
          v-model.number="trendMonthsWindowModel"
          type="number"
          min="1"
          max="24"
          class="w-16 rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
        />
      </label>
    </div>
    <div v-if="showDivisionPresets" :class="stacked ? 'space-y-1' : ''">
      <div v-if="stacked" class="mb-1 text-sm font-medium text-text">
        {{ t('statisticsPage.championStatsTrendsDivisionPresets') }}
      </div>
      <div class="flex flex-wrap gap-1">
        <button
          type="button"
          class="rounded px-2 py-1 font-medium transition-colors"
          :class="
            charts.trendDivisionPreset.value === 'selected'
              ? 'bg-info/20 text-primary-light ring-1 ring-info/60'
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
              ? 'bg-info/20 text-primary-light ring-1 ring-info/60'
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
              ? 'bg-info/20 text-primary-light ring-1 ring-info/60'
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
              ? 'bg-info/20 text-primary-light ring-1 ring-info/60'
              : 'bg-black/20 text-text/85 hover:bg-white/10'
          "
          @click="charts.setTrendDivisionPreset('elite')"
        >
          Elite
        </button>
      </div>
      <label
        v-if="showGlobalLineToggle"
        class="mt-1 inline-flex items-center gap-1 text-[11px] text-text/80"
      >
        <input
          v-model="charts.trendShowGlobalLine.value"
          type="checkbox"
          class="rounded border-primary/50"
        />
        <span>{{ t('statisticsPage.championStatsTrendsGlobalLine') }}</span>
      </label>
    </div>
    <label
      v-else-if="showGlobalLineToggle"
      class="inline-flex items-center gap-1 text-text/80"
      :class="stacked ? 'text-[11px]' : ''"
    >
      <input
        v-model="charts.trendShowGlobalLine.value"
        type="checkbox"
        class="rounded border-primary/50"
      />
      <span>{{ t('statisticsPage.championStatsTrendsGlobalLine') }}</span>
    </label>
    <slot name="trailing" />
  </div>
</template>
