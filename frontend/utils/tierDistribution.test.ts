import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TIER_DISTRIBUTION,
  parseTierDistribution,
  tierDistributionValid,
} from './tierDistribution'

describe('tierDistribution (Gestion > Stats)', () => {
  it('défauts = anciennes constantes backend', () => {
    expect(DEFAULT_TIER_DISTRIBUTION).toEqual({
      bHalf: 35,
      sMin: 70,
      sPlusMin: 105,
      extremeGap: 30,
      extremeMax: 5,
    })
  })

  it('valide : ordre B < S ≤ S+, écart ≥ 0, max entier ≥ 0', () => {
    expect(tierDistributionValid(DEFAULT_TIER_DISTRIBUTION)).toBe(true)
    expect(tierDistributionValid({ ...DEFAULT_TIER_DISTRIBUTION, sMin: 35 })).toBe(false)
    expect(tierDistributionValid({ ...DEFAULT_TIER_DISTRIBUTION, sPlusMin: 60 })).toBe(false)
    expect(tierDistributionValid({ ...DEFAULT_TIER_DISTRIBUTION, bHalf: 0 })).toBe(false)
    expect(tierDistributionValid({ ...DEFAULT_TIER_DISTRIBUTION, extremeGap: -1 })).toBe(false)
    expect(tierDistributionValid({ ...DEFAULT_TIER_DISTRIBUTION, extremeMax: 1.5 })).toBe(false)
    expect(tierDistributionValid({ ...DEFAULT_TIER_DISTRIBUTION, sMin: Number.NaN })).toBe(false)
  })

  it('parse la réponse GET ; invalide → défauts', () => {
    const s = { bHalf: 10, sMin: 20, sPlusMin: 30, extremeGap: 0, extremeMax: 2 }
    expect(parseTierDistribution({ settings: s })).toEqual(s)
    expect(parseTierDistribution({ settings: { ...s, sMin: 5 } })).toEqual(
      DEFAULT_TIER_DISTRIBUTION
    )
    expect(parseTierDistribution({ settings: { bHalf: '10' } })).toEqual(DEFAULT_TIER_DISTRIBUTION)
    expect(parseTierDistribution(null)).toEqual(DEFAULT_TIER_DISTRIBUTION)
  })
})
