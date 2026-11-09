import { describe, expect, it } from 'vitest'
import { STATS_OTP_SEGMENTS, divisionSummary } from '../filterBarOptions'

describe('divisionSummary', () => {
  it('aucune division = toutes', () => {
    expect(divisionSummary([])).toEqual({ kind: 'all' })
  })
  it('une division = son nom', () => {
    expect(divisionSummary(['GOLD'])).toEqual({ kind: 'one', tier: 'GOLD' })
  })
  it('plusieurs = compte', () => {
    expect(divisionSummary(['GOLD', 'SILVER'])).toEqual({ kind: 'many', count: 2 })
  })
})

describe('STATS_OTP_SEGMENTS', () => {
  it('ordre Exclus / Inclus / Seulement', () => {
    expect(STATS_OTP_SEGMENTS.map(s => s.value)).toEqual(['non', 'oui', 'solo'])
    expect(STATS_OTP_SEGMENTS.map(s => s.labelKey)).toEqual([
      'statisticsPage.filterBarOtpExcluded',
      'statisticsPage.filterBarOtpIncluded',
      'statisticsPage.filterBarOtpOnly',
    ])
  })
})
