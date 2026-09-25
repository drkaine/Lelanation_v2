import { computed, ref, watch, type Ref, type WatchSource } from 'vue'

export type PaginationOptions = {
  pageSize?: number
  /** Sources that send the view back to page 1 when they change (page size always does). */
  resetOn?: WatchSource[]
}

export function usePagination<T>(rows: Ref<readonly T[]>, opts: PaginationOptions = {}) {
  const page = ref(1)
  const pageSize = ref(opts.pageSize ?? 20)

  const totalRowsCount = computed(() => rows.value.length)
  const totalPages = computed(() => Math.max(1, Math.ceil(totalRowsCount.value / pageSize.value)))
  const paginatedRows = computed(() => {
    const current = Math.min(page.value, totalPages.value)
    const start = (current - 1) * pageSize.value
    return rows.value.slice(start, start + pageSize.value)
  })

  watch([pageSize, ...(opts.resetOn ?? [])], () => {
    page.value = 1
  })

  return { page, pageSize, totalRowsCount, totalPages, paginatedRows }
}

/** 1-based bounds of the rows shown on `page` ("from-to / total"); a page past the end shows the last one. */
export function pageRange(page: number, pageSize: number, total: number) {
  const current = Math.min(page, Math.max(1, Math.ceil(total / pageSize)))
  return { from: (current - 1) * pageSize + 1, to: Math.min(current * pageSize, total) }
}
