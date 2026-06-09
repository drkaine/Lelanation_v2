import { describe, expect, it } from 'vitest'
import {
  aggregatePatchNotesRows,
  dominantChangeType,
  patchesInVersionRange,
} from '../../src/services/patchNotesAggregateLogic.js'

describe('StatsPatchNotesAggregateService', () => {
  it('dominantChangeType prefers up, then nerf, then ajust', () => {
    expect(dominantChangeType(2, 3, 1)).toBe('up')
    expect(dominantChangeType(3, 2, 1)).toBe('nerf')
    expect(dominantChangeType(1, 1, 2)).toBe('ajust')
  })

  it('patchesInVersionRange filters inclusive bounds', () => {
    const available = ['16.7', '16.8', '16.9', '16.10', '16.11']
    expect(patchesInVersionRange(available, '16.9', '16.10')).toEqual(['16.9', '16.10'])
    expect(patchesInVersionRange(available, null, '16.8')).toEqual(['16.7', '16.8'])
  })

  it('aggregatePatchNotesRows sums counts and computes regularity', () => {
    const rows = [
      {
        type_cible: 'champion',
        id_cible: 'Diana',
        game_version: '16.10',
        count_nerf: 0,
        count_up: 2,
        count_ajust: 0,
      },
      {
        type_cible: 'champion',
        id_cible: 'Diana',
        game_version: '16.11',
        count_nerf: 1,
        count_up: 0,
        count_ajust: 0,
      },
      {
        type_cible: 'items',
        id_cible: '3078',
        game_version: '16.11',
        count_nerf: 0,
        count_up: 0,
        count_ajust: 1,
      },
    ]

    const out = aggregatePatchNotesRows(rows, ['16.10', '16.11'], ['champion', 'items'])
    const diana = out.find(r => r.targetId === 'Diana')
    expect(diana).toMatchObject({
      countUp: 2,
      countNerf: 1,
      totalChanges: 3,
      patchesTouched: 2,
      totalPatches: 2,
      regularity: 1,
      lastModPatch: '16.11',
      lastModType: 'nerf',
    })
  })
})
