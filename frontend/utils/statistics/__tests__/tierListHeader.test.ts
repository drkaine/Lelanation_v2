import { describe, expect, it } from 'vitest'
import {
  TIER_LIST_VIEWS,
  tierListEyebrowParts,
  tierListViewQuery,
} from '~/utils/statistics/tierListHeader'

describe('tierListHeader', () => {
  it('quatre vues dans l’ordre de la maquette', () => {
    expect(TIER_LIST_VIEWS.map(v => v.id)).toEqual([
      'table',
      'chart',
      'botlaneMatchups',
      'botlaneDuoRank',
    ])
  })

  it('libellé court par vue pour le segment mobile', () => {
    expect(TIER_LIST_VIEWS.every(v => v.shortLabelKey.startsWith('statisticsPage.'))).toBe(true)
    expect(new Set(TIER_LIST_VIEWS.map(v => v.shortLabelKey)).size).toBe(4)
  })

  it('sur-titre : patch puis file', () => {
    expect(tierListEyebrowParts('16.21', 'Ranked Solo/Duo')).toEqual([
      'Patch 16.21',
      'Ranked Solo/Duo',
    ])
    expect(tierListEyebrowParts('', 'Ranked Solo/Duo')).toEqual(['Ranked Solo/Duo'])
  })

  it('vue → query de la page tier list', () => {
    expect(tierListViewQuery('table')).toBeUndefined()
    expect(tierListViewQuery('chart')).toBe('chart')
    expect(tierListViewQuery('botlaneMatchups')).toBe('botlane-matchups')
    expect(tierListViewQuery('botlaneDuoRank')).toBe('botlane-duos')
  })
})
