import { describe, expect, it } from 'vitest'
import { visibleRunePaths } from '../runeTreeTabs'

const paths = [{ id: 8000 }, { id: 8100 }, { id: 8200 }]

describe('visibleRunePaths', () => {
  it('returns all paths for "all"', () => {
    expect(visibleRunePaths(paths, 'all')).toEqual(paths)
  })
  it('returns only the selected tree', () => {
    expect(visibleRunePaths(paths, 8100)).toEqual([{ id: 8100 }])
  })
  it('falls back to all when the selected tree is unknown', () => {
    expect(visibleRunePaths(paths, 9999)).toEqual(paths)
  })
})
