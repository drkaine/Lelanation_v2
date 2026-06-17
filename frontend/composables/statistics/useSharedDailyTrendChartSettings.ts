import { ref, type Ref } from 'vue'
import {
  TREND_PRESET_TIERS,
  type DailyTrendDivisionPreset,
  type DailyTrendGranularity,
  type SharedDailyTrendChartUi,
} from '~/composables/statistics/useStatisticsDailyTrendCharts'

export function createSharedDailyTrendChartSettings(
  filterRank: Ref<string[]>
): SharedDailyTrendChartUi {
  const trendGranularity = ref<DailyTrendGranularity>('day')
  const trendRangeMode = ref<'7d' | '14d' | 'months'>('7d')
  const trendMonthsWindow = ref(1)
  const trendDivisionPreset = ref<DailyTrendDivisionPreset>('selected')
  const trendShowGlobalLine = ref(true)

  function setTrendDivisionPreset(preset: DailyTrendDivisionPreset): void {
    trendDivisionPreset.value = preset
    if (preset === 'selected') return
    filterRank.value = [...TREND_PRESET_TIERS[preset]]
  }

  return {
    trendGranularity,
    trendRangeMode,
    trendMonthsWindow,
    trendDivisionPreset,
    trendShowGlobalLine,
    setTrendDivisionPreset,
  }
}
