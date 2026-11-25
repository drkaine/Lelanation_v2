import { describe, expect, it } from 'vitest'
import {
  emptyRegionCompare,
  extremeRegions,
  formatSpread,
  parseRegionCompare,
  regionLabel,
} from '../regionCompare'

const region = (r: string, surrenderRate: number) => ({
  region: r,
  matches: 200,
  surrenderRate,
  earlySurrenderRate: 1,
  afkRate: 1,
  avgDurationMin: 30,
  avgKills: 30,
})

describe('regionCompare', () => {
  it('parse : réponse valide gardée, invalide → vide', () => {
    const ok = { ...emptyRegionCompare(), regions: [region('EUW1', 20)] }
    expect(parseRegionCompare(ok).regions).toHaveLength(1)
    expect(parseRegionCompare(null)).toEqual(emptyRegionCompare())
    expect(parseRegionCompare({ regions: 'x' })).toEqual(emptyRegionCompare())
  })

  it('extrêmes : région la plus haute et la plus basse sur une métrique', () => {
    const rows = [region('EUW1', 20), region('KR', 35), region('TR1', 10)]
    expect(extremeRegions(rows, 'surrenderRate')).toEqual({ high: 'KR', low: 'TR1' })
    expect(extremeRegions([region('EUW1', 20)], 'surrenderRate')).toEqual({ high: null, low: null })
  })

  it('libellé de région lisible', () => {
    expect(regionLabel('EUW1')).toBe('EUW')
    expect(regionLabel('EUN1')).toBe('EUNE')
    expect(regionLabel('KR')).toBe('KR')
    expect(regionLabel('XX9')).toBe('XX9')
  })

  it('écart formaté en points', () => {
    expect(formatSpread(12.345)).toBe('12.35 pts')
  })
})
