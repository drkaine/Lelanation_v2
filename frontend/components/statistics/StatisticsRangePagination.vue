<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { pageRange } from '~/composables/usePagination'
import { PAGE_SIZE_OPTIONS } from '~/utils/statistics/statisticsTableFormat'

/**
 * Table footer: label slot, page size select, position ("from-to / total" or "page X of Y"), ‹ › buttons.
 * Hidden when empty.
 */
const props = withDefaults(
  defineProps<{
    totalCount: number
    totalPages: number
    pageSizeOptions?: readonly number[]
    indicator?: 'range' | 'pages'
  }>(),
  { pageSizeOptions: () => PAGE_SIZE_OPTIONS, indicator: 'range' }
)

const page = defineModel<number>('page', { required: true })
const pageSize = defineModel<number>('pageSize', { required: true })

const { t } = useI18n()

const range = computed(() => pageRange(page.value, pageSize.value, props.totalCount))
</script>

<template>
  <div v-if="totalCount > 0" class="flex flex-wrap items-center justify-between gap-2">
    <span v-if="$slots.default"><slot /></span>
    <div class="flex items-center gap-3">
      <label class="flex items-center gap-1.5">
        <span class="text-text/70">{{ t('statisticsPage.perPage') }}</span>
        <select
          v-model.number="pageSize"
          class="rounded border border-primary/40 bg-background px-2 py-1 text-text"
        >
          <option v-for="n in pageSizeOptions" :key="n" :value="n">{{ n }}</option>
        </select>
      </label>
      <span v-if="indicator === 'pages'" class="text-text/70">
        {{ t('statisticsPage.pageXOfY', { current: page, total: totalPages }) }}
      </span>
      <span v-else class="text-text/70">{{ range.from }}-{{ range.to }} / {{ totalCount }}</span>
      <div class="flex gap-1">
        <button
          type="button"
          class="statistics-pagination-btn text-text"
          :disabled="page <= 1"
          @click="page = Math.max(1, page - 1)"
        >
          ‹
        </button>
        <button
          type="button"
          class="statistics-pagination-btn text-text"
          :disabled="page >= totalPages"
          @click="page = Math.min(totalPages, page + 1)"
        >
          ›
        </button>
      </div>
    </div>
  </div>
</template>
