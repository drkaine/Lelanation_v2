<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    totalPages: number
    totalCount?: number
    pageSizeOptions?: number[]
  }>(),
  {
    totalCount: undefined,
    pageSizeOptions: () => [10, 20, 50, 100],
  }
)

const pageSize = defineModel<number>('pageSize', { required: true })
const page = defineModel<number>('page', { required: true })

const { t } = useI18n()

function goPrev() {
  page.value = Math.max(1, page.value - 1)
}

function goNext() {
  page.value = Math.min(props.totalPages, page.value + 1)
}
</script>

<template>
  <div
    class="statistics-tab-pagination flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2"
  >
    <div class="inline-flex flex-wrap items-center gap-2">
      <label class="inline-flex items-center gap-1.5">
        <span>{{ t('statisticsPage.perPage') }}</span>
        <select
          v-model.number="pageSize"
          class="rounded border border-primary/40 bg-background px-1.5 py-0.5 text-xs text-text"
        >
          <option v-for="size in pageSizeOptions" :key="size" :value="size">
            {{ size }}
          </option>
        </select>
      </label>
      <span v-if="totalCount != null" class="text-text/60">
        {{ totalCount.toLocaleString() }} {{ t('statisticsPage.resultsTotal') }}
      </span>
    </div>
    <div class="inline-flex items-center gap-2">
      <button
        type="button"
        class="rounded border border-primary/30 px-2 py-0.5 disabled:opacity-40"
        :disabled="page <= 1"
        @click="goPrev"
      >
        {{ t('statisticsPage.paginationPrev') }}
      </button>
      <span>{{ t('statisticsPage.pageXOfY', { current: page, total: totalPages }) }}</span>
      <button
        type="button"
        class="rounded border border-primary/30 px-2 py-0.5 disabled:opacity-40"
        :disabled="page >= totalPages"
        @click="goNext"
      >
        {{ t('statisticsPage.paginationNext') }}
      </button>
    </div>
  </div>
</template>
