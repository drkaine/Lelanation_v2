import { describe, expect, it } from 'vitest'
import { trendTiersForLevel } from '../trendLevel'

const ALL = ['IRON', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'CHALLENGER']

describe('trendTiersForLevel', () => {
  it('garde tout pour « all »', () => {
    expect(trendTiersForLevel(ALL, 'all')).toEqual(ALL)
  })
  it('restreint aux divisions du niveau, ordre conservé', () => {
    expect(trendTiersForLevel(ALL, 'average')).toEqual(['IRON', 'GOLD'])
    expect(trendTiersForLevel(ALL, 'skilled')).toEqual(['PLATINUM', 'EMERALD', 'DIAMOND'])
    expect(trendTiersForLevel(ALL, 'elite')).toEqual(['DIAMOND', 'MASTER', 'CHALLENGER'])
  })
  it('vide si aucune division du niveau', () => {
    expect(trendTiersForLevel(['IRON'], 'elite')).toEqual([])
  })
})
