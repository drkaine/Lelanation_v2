<script setup lang="ts">
import { computed, watch } from 'vue'

export type StatisticsMobileSortDir = 'asc' | 'desc'

export type StatisticsMobileSortOption = {
  value: string
  label: string
}

const column = defineModel<string>('column', { required: true })
const direction = defineModel<StatisticsMobileSortDir>('direction', { required: true })

const props = withDefaults(
  defineProps<{
    options: StatisticsMobileSortOption[]
    id?: string
    /** Column values that default to ascending when chosen from the dropdown. */
    ascDefaultColumns?: string[]
    helpAriaLabel?: string
    helpText?: string
    helpSecondaryText?: string
  }>(),
  {
    id: undefined,
    ascDefaultColumns: () => [],
    helpAriaLabel: undefined,
    helpText: undefined,
    helpSecondaryText: undefined,
  }
)

const { t } = useI18n()
const { simplifiedStatsEnabled } = useSimplifiedStatsPreference()

const selectId = computed(() => props.id ?? 'statistics-mobile-sort')

const barVisibilityClass = computed(() =>
  simplifiedStatsEnabled.value ? 'flex' : 'flex md:hidden'
)

function toggleDirection(): void {
  direction.value = direction.value === 'desc' ? 'asc' : 'desc'
}

watch(column, (col, prev) => {
  if (prev == null || col === prev) return
  direction.value = props.ascDefaultColumns.includes(col) ? 'asc' : 'desc'
})
</script>

<template>
  <div
    :class="[
      'statistics-mobile-sort-bar flex-wrap items-end gap-2 rounded-lg border border-primary/25 bg-surface/50 p-2.5',
      barVisibilityClass,
    ]"
  >
    <div class="min-w-0 flex-1">
      <div class="mb-1 flex min-w-0 items-center gap-2">
        <label
          :for="selectId"
          class="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wide text-text/55"
        >
          {{ t('statisticsPage.mobileSortLabel') }}
        </label>
        <StatisticsTableHelpTooltip
          v-if="helpText"
          :aria-label="helpAriaLabel || helpText"
          :text="helpText"
          :secondary-text="helpSecondaryText"
          align="end"
        />
        <slot name="help" />
      </div>
      <select
        :id="selectId"
        v-model="column"
        class="w-full rounded border border-primary/40 bg-background px-2 py-1.5 text-xs font-medium text-text"
      >
        <option v-for="opt in options" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>
    <button
      type="button"
      class="inline-flex shrink-0 touch-manipulation items-center gap-1.5 rounded border border-primary/35 bg-background/80 px-3 py-1.5 text-xs font-semibold text-text transition-colors hover:bg-primary/15"
      :aria-label="t('statisticsPage.mobileSortDirectionAria')"
      @click="toggleDirection"
    >
      <span class="text-base leading-none" aria-hidden="true">{{
        direction === 'desc' ? '↓' : '↑'
      }}</span>
      <span>{{
        direction === 'desc'
          ? t('statisticsPage.mobileSortDesc')
          : t('statisticsPage.mobileSortAsc')
      }}</span>
    </button>
  </div>
</template>
