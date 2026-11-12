import { describe, expect, it } from 'vitest'
import {
  PATCH_NOTES_PERIODS,
  patchNotesBarSegments,
  patchNotesPeriodRange,
  patchNotesPeriodOf,
} from '~/utils/statistics/patchNotesBars'

describe('patchNotesBars', () => {
  it('segments buff/nerf/ajust proportionnels au total max', () => {
    expect(patchNotesBarSegments({ countUp: 13, countNerf: 20, countAjust: 13 }, 46)).toEqual([
      { type: 'up', pct: (13 / 46) * 100 },
      { type: 'nerf', pct: (20 / 46) * 100 },
      { type: 'adjust', pct: (13 / 46) * 100 },
    ])
    expect(patchNotesBarSegments({ countUp: 0, countNerf: 5, countAjust: 0 }, 10)).toEqual([
      { type: 'nerf', pct: 50 },
    ])
    expect(patchNotesBarSegments({ countUp: 1, countNerf: 0, countAjust: 0 }, 0)).toEqual([])
  })

  it('période → bornes de versions (liste triée décroissante)', () => {
    const v = ['16.22', '16.21', '16.20', '16.19', '16.18', '16.17']
    expect(PATCH_NOTES_PERIODS).toEqual(['all', 'last3', 'last5', 'last10'])
    expect(patchNotesPeriodRange(v, 'all')).toEqual({ from: '', to: '' })
    expect(patchNotesPeriodRange(v, 'last3')).toEqual({ from: '16.20', to: '16.22' })
    expect(patchNotesPeriodRange(v, 'last10')).toEqual({ from: '16.17', to: '16.22' })
    expect(patchNotesPeriodRange([], 'last3')).toEqual({ from: '', to: '' })
  })

  it('bornes → période (ou custom)', () => {
    const v = ['16.22', '16.21', '16.20', '16.19', '16.18']
    expect(patchNotesPeriodOf(v, '', '')).toBe('all')
    expect(patchNotesPeriodOf(v, '16.20', '16.22')).toBe('last3')
    expect(patchNotesPeriodOf(v, '16.18', '16.22')).toBe('last5')
    expect(patchNotesPeriodOf(v, '16.19', '16.21')).toBe('custom')
  })
})
