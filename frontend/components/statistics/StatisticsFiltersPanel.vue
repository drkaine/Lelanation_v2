<template>
  <div class="statistics-filters-layout flex min-h-0 w-full min-w-0 flex-1">
    <button
      v-if="showDesktopFiltersTrigger"
      type="button"
      class="statistics-filters-desktop-trigger hidden shrink-0 touch-manipulation lg:sticky lg:top-4 lg:z-20 lg:mr-2 lg:flex lg:flex-col lg:items-center lg:gap-1 lg:self-start"
      :aria-label="filtersOpen ? t('statisticsPage.closeFilters') : t('statisticsPage.openFilters')"
      :aria-expanded="filtersOpen"
      @click="toggleFiltersOpen"
    >
      <span class="filters-collapse-floating inline-flex" aria-hidden="true">
        <svg
          class="h-2 w-2 transition-transform duration-200"
          :class="filtersOpen ? 'rotate-180' : ''"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </span>
      <span class="max-w-[4.5rem] text-center text-[10px] font-semibold leading-tight text-text/85">
        {{ t('statisticsPage.filtersTitle') }}
      </span>
      <span
        v-if="activeFiltersCount > 0"
        class="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-background"
        :aria-label="`${activeFiltersCount} ${t('statisticsPage.filtersTitle')}`"
      >
        {{ activeFiltersCount }}
      </span>
    </button>

    <div
      v-if="filtersOpen && effectiveFiltersSheetMode"
      class="fixed inset-0 z-[10050] bg-black/50"
      aria-hidden="true"
      role="presentation"
      @click="closeFilters"
    />

    <aside
      v-show="filtersOpen || !effectiveFiltersSheetMode"
      :class="[
        'statistics-filters-panel flex shrink-0 flex-col overflow-hidden',
        effectiveFiltersSheetMode
          ? 'fixed inset-x-0 bottom-0 top-auto z-[10051] max-h-[85vh] w-full rounded-t-2xl bg-surface shadow-lg'
          : [
              'hidden w-0 opacity-0 transition-[width,opacity] duration-200',
              'lg:sticky lg:top-4 lg:z-0 lg:flex lg:h-auto lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:overflow-x-hidden',
              filtersOpen ? 'lg:w-64 lg:opacity-100' : 'lg:w-0 lg:opacity-0',
            ],
      ]"
      :role="effectiveFiltersSheetMode ? 'dialog' : undefined"
      :aria-modal="effectiveFiltersSheetMode ? true : undefined"
      :aria-label="t('statisticsPage.filtersTitle')"
      @click.stop
    >
      <div
        class="relative z-[1] flex shrink-0 items-center gap-2 border-b border-primary/25 p-2 lg:border-transparent lg:pb-2"
      >
        <button
          type="button"
          :class="[
            'mx-auto mb-1 flex h-6 w-14 shrink-0 touch-manipulation items-center justify-center rounded-full',
            effectiveFiltersSheetMode ? '' : 'lg:hidden',
          ]"
          :aria-label="t('statisticsPage.closeFilters')"
          @click="closeFilters"
        >
          <span class="h-1 w-10 rounded-full bg-primary/40" aria-hidden="true" />
        </button>
        <h2 class="min-w-0 flex-1 truncate text-lg font-semibold text-text-accent">
          {{ t('statisticsPage.filtersTitle') }}
        </h2>
        <button
          type="button"
          class="statistics-filters-reset ui-build-card-button inline-flex shrink-0 touch-manipulation items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold"
          @click="emit('reset')"
        >
          <span class="iconify i-mdi:refresh" aria-hidden="true" />
          Reset
        </button>
      </div>
      <div class="flex min-h-0 flex-1 flex-col overflow-y-auto p-2 lg:flex-none">
        <slot />
      </div>
      <div class="shrink-0 border-t border-primary/25 p-3 lg:hidden">
        <button
          type="button"
          class="statistics-filters-mobile-close lg:hidden"
          @click="closeFilters"
        >
          {{ t('statisticsPage.closeFilters') }}
        </button>
      </div>
    </aside>

    <div class="statistics-page-main min-w-0 flex-1 max-lg:pb-20">
      <slot name="main" />
    </div>

    <button
      v-if="!filtersOpen"
      type="button"
      :class="[
        'statistics-filters-fab fixed bottom-4 left-1/2 z-[58] flex -translate-x-1/2 items-center gap-2',
        filtersFabClass,
      ]"
      :aria-label="t('statisticsPage.openFilters')"
      @click="openFilters"
    >
      {{ t('statisticsPage.filtersTitle') }}
      <span
        v-if="activeFiltersCount > 0"
        class="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-background"
      >
        {{ activeFiltersCount }}
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { watch, onUnmounted } from 'vue'
import { useStatisticsUiStore } from '~/stores/StatisticsUiStore'

defineProps<{
  activeFiltersCount: number
}>()

const emit = defineEmits<{
  reset: []
}>()

const { t } = useI18n()
const statisticsUiStore = useStatisticsUiStore()
const { filtersOpen } = storeToRefs(statisticsUiStore)
const { effectiveFiltersSheetMode, showDesktopFiltersTrigger, filtersFabClass } =
  useStatisticsFiltersSheetMode()

function closeFilters(): void {
  statisticsUiStore.setFiltersOpen(false)
}

function openFilters(): void {
  statisticsUiStore.setFiltersOpen(true)
}

function toggleFiltersOpen(): void {
  if (filtersOpen.value) closeFilters()
  else openFilters()
}

watch([filtersOpen, effectiveFiltersSheetMode], () => {
  if (!import.meta.client) return
  const lock = effectiveFiltersSheetMode.value && filtersOpen.value
  document.body.style.overflow = lock ? 'hidden' : ''
})

onUnmounted(() => {
  if (import.meta.client) document.body.style.overflow = ''
})
</script>
