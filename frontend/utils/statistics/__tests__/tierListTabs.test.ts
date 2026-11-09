import { describe, expect, it } from 'vitest'
import { tierListTabOf, tierListTabState, tierListViewFromQuery } from '../tierListTabs'

describe('tierListTabs', () => {
  it('Graphique = score matchup (pbi), Méta = WR vs pick (bulles)', () => {
    expect(tierListTabState('chart')).toEqual({ view: 'chart', chartType: 'pbi', query: 'chart' })
    expect(tierListTabState('meta')).toEqual({ view: 'chart', chartType: 'bubble', query: 'meta' })
    expect(tierListTabState('table')).toEqual({ view: 'table', chartType: null, query: null })
  })

  it('onglet actif depuis la vue et le type de graphique', () => {
    expect(tierListTabOf('chart', 'pbi')).toBe('chart')
    expect(tierListTabOf('chart', 'bubble')).toBe('meta')
    expect(tierListTabOf('botlaneDuoRank', 'bubble')).toBe('botlaneDuoRank')
  })

  it('lit ?view=meta et ?view=chart', () => {
    expect(tierListViewFromQuery('meta')).toBe('meta')
    expect(tierListViewFromQuery('chart')).toBe('chart')
    expect(tierListViewFromQuery('autre')).toBeNull()
  })
})
