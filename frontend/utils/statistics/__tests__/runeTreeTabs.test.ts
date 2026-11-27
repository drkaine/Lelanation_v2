import { describe, expect, it } from 'vitest'
import { runesDetailOpenByDefault, visibleRunePaths } from '../runeTreeTabs'

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

describe('runesDetailOpenByDefault', () => {
  it('page statistiques globale : toutes les runes et pages best/worst visibles', () => {
    expect(runesDetailOpenByDefault({})).toBe(true)
  })
  it('fiche champion (build ou carte unifiée) : détail replié', () => {
    expect(runesDetailOpenByDefault({ buildSummary: true })).toBe(false)
    expect(runesDetailOpenByDefault({ unifiedLayout: true })).toBe(false)
  })
})
