<template>
  <div class="space-y-3">
    <div>
      <p class="mb-1.5 text-xs font-medium text-text/80">
        {{ t('statisticsPage.surveillanceAlertFilterChampions') }}
      </p>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="filterId in championFilters"
          :key="filterId"
          type="button"
          class="rounded-md border px-2 py-1 text-[11px] transition"
          :class="
            isActive(filterId)
              ? 'border-primary/50 bg-primary/20 text-text-accent'
              : 'border-primary/25 bg-surface/20 text-text/65 hover:bg-primary/10'
          "
          :aria-pressed="isActive(filterId)"
          @click="toggle(filterId)"
        >
          {{ filterLabel(filterId) }}
        </button>
      </div>
    </div>

    <div>
      <p class="mb-1.5 text-xs font-medium text-text/80">
        {{ t('statisticsPage.surveillanceAlertFilterBuilds') }}
      </p>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="filterId in buildFilters"
          :key="filterId"
          type="button"
          class="rounded-md border px-2 py-1 text-[11px] transition"
          :class="
            isActive(filterId)
              ? 'border-primary/50 bg-primary/20 text-text-accent'
              : 'border-primary/25 bg-surface/20 text-text/65 hover:bg-primary/10'
          "
          :aria-pressed="isActive(filterId)"
          @click="toggle(filterId)"
        >
          {{ filterLabel(filterId) }}
        </button>
      </div>
    </div>

    <p v-if="modelValue.length > 0" class="text-[11px] text-text/50">
      {{ t('statisticsPage.surveillanceAlertFilterHint') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import {
  BUILD_SURVEILLANCE_ALERT_FILTERS,
  CHAMPION_SURVEILLANCE_ALERT_FILTERS,
  toggleSurveillanceAlertFilter,
  type SurveillanceAlertFilterId,
} from '~/utils/surveillanceAlertFilters'

const props = defineProps<{
  modelValue: SurveillanceAlertFilterId[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: SurveillanceAlertFilterId[]]
}>()

const { t } = useI18n()

const championFilters = CHAMPION_SURVEILLANCE_ALERT_FILTERS
const buildFilters = BUILD_SURVEILLANCE_ALERT_FILTERS

const FILTER_LABEL_KEYS: Record<SurveillanceAlertFilterId, string> = {
  championWinrateUp: 'statisticsPage.surveillanceAlertFilterChampionWinrateUp',
  championWinrateDown: 'statisticsPage.surveillanceAlertFilterChampionWinrateDown',
  championPickrateUp: 'statisticsPage.surveillanceAlertFilterChampionPickrateUp',
  championPickrateDown: 'statisticsPage.surveillanceAlertFilterChampionPickrateDown',
  championBanrateUp: 'statisticsPage.surveillanceAlertFilterChampionBanrateUp',
  championBanrateDown: 'statisticsPage.surveillanceAlertFilterChampionBanrateDown',
  championMin: 'statisticsPage.surveillanceAlertFilterChampionMin',
  championMax: 'statisticsPage.surveillanceAlertFilterChampionMax',
  buildNew: 'statisticsPage.surveillanceAlertFilterBuildNew',
  buildWinrateUp: 'statisticsPage.surveillanceAlertFilterBuildWinrateUp',
  buildWinrateDown: 'statisticsPage.surveillanceAlertFilterBuildWinrateDown',
  buildPickrateUp: 'statisticsPage.surveillanceAlertFilterBuildPickrateUp',
  buildPickrateDown: 'statisticsPage.surveillanceAlertFilterBuildPickrateDown',
  buildMin: 'statisticsPage.surveillanceAlertFilterBuildMin',
  buildMax: 'statisticsPage.surveillanceAlertFilterBuildMax',
}

function isActive(filterId: SurveillanceAlertFilterId): boolean {
  return props.modelValue.includes(filterId)
}

function toggle(filterId: SurveillanceAlertFilterId): void {
  emit('update:modelValue', toggleSurveillanceAlertFilter(props.modelValue, filterId))
}

function filterLabel(filterId: SurveillanceAlertFilterId): string {
  return t(FILTER_LABEL_KEYS[filterId])
}
</script>
