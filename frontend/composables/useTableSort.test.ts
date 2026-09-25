import { describe, expect, it } from 'vitest'
import { useTableSort } from './useTableSort'

type Key = 'rank' | 'name' | 'games'

describe('useTableSort', () => {
  it('flips direction on the active key and uses defaultDir for a new key', () => {
    const s = useTableSort<Key>({
      initialKey: 'rank',
      initialDir: 'asc',
      defaultDir: k => (k === 'rank' || k === 'name' ? 'asc' : 'desc'),
    })
    s.toggleSort('rank')
    expect([s.sortBy.value, s.sortDir.value]).toEqual(['rank', 'desc'])
    s.toggleSort('games')
    expect([s.sortBy.value, s.sortDir.value]).toEqual(['games', 'desc'])
    s.toggleSort('name')
    expect([s.sortBy.value, s.sortDir.value]).toEqual(['name', 'asc'])
  })

  it('cycles desc → asc → unsorted when resettable', () => {
    const s = useTableSort<Key>({ resettable: true })
    expect(s.sortBy.value).toBeNull()
    s.toggleSort('games')
    expect([s.sortBy.value, s.sortDir.value]).toEqual(['games', 'desc'])
    s.toggleSort('games')
    expect([s.sortBy.value, s.sortDir.value]).toEqual(['games', 'asc'])
    s.toggleSort('games')
    expect([s.sortBy.value, s.sortDir.value]).toEqual([null, 'desc'])
  })

  it('renders indicators in each style', () => {
    const tri = useTableSort<Key>({ initialKey: 'rank', initialDir: 'asc' })
    expect(tri.sortIcon('rank')).toBe(' ▲')
    expect(tri.sortIcon('games')).toBe(' ↕')
    tri.toggleSort('rank')
    expect(tri.sortIcon('rank')).toBe(' ▼')

    const arrows = useTableSort<Key>({ initialKey: 'rank', initialDir: 'asc', indicator: 'arrows' })
    expect(arrows.sortIcon('rank')).toBe(' ↑')
    expect(arrows.sortIcon('games')).toBe('')
  })
})
