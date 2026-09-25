import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { pageRange, usePagination } from './usePagination'

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1)

describe('usePagination', () => {
  it('slices the current page and counts pages', () => {
    const rows = ref(range(45))
    const pg = usePagination(rows, { pageSize: 20 })
    expect(pg.totalRowsCount.value).toBe(45)
    expect(pg.totalPages.value).toBe(3)
    expect(pg.paginatedRows.value).toEqual(range(20))
    pg.page.value = 3
    expect(pg.paginatedRows.value).toEqual([41, 42, 43, 44, 45])
  })

  it('clamps an out-of-range page and keeps at least one page', () => {
    const rows = ref(range(5))
    const pg = usePagination(rows, { pageSize: 20 })
    pg.page.value = 9
    expect(pg.paginatedRows.value).toEqual(range(5))
    rows.value = []
    expect(pg.totalPages.value).toBe(1)
  })

  it('goes back to page 1 when page size or a reset source changes', async () => {
    const rows = ref(range(100))
    const filter = ref('a')
    const pg = usePagination(rows, { pageSize: 10, resetOn: [filter] })
    pg.page.value = 4
    filter.value = 'b'
    await nextTick()
    expect(pg.page.value).toBe(1)
    pg.page.value = 4
    pg.pageSize.value = 50
    await nextTick()
    expect(pg.page.value).toBe(1)
  })
})

describe('pageRange', () => {
  it('gives the 1-based bounds of the visible rows', () => {
    expect(pageRange(1, 20, 45)).toEqual({ from: 1, to: 20 })
    expect(pageRange(3, 20, 45)).toEqual({ from: 41, to: 45 })
  })

  it('clamps a page past the end to the last page', () => {
    expect(pageRange(9, 20, 45)).toEqual({ from: 41, to: 45 })
  })
})
