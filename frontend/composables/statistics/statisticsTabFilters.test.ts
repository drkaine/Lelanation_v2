import { describe, expect, it } from 'vitest'
import {
  appendStatisticsCohortParams,
  cohortFiltersForTab,
  statisticsTabFilterFlags,
} from './statisticsTabFilters'

describe('statisticsTabFilterFlags', () => {
  it('objectives: division only among cohort filters', () => {
    expect(statisticsTabFilterFlags('objectives')).toEqual({
      division: true,
      role: false,
      otp: false,
      championSearch: false,
    })
  })

  it('surrender: version/progression cohort only (no division/role/otp)', () => {
    expect(statisticsTabFilterFlags('surrender')).toEqual({
      division: false,
      role: false,
      otp: false,
      championSearch: false,
    })
  })

  it('bans: no otp', () => {
    expect(statisticsTabFilterFlags('bans').otp).toBe(false)
    expect(statisticsTabFilterFlags('bans').role).toBe(true)
  })

  it('overview and team: no champion search', () => {
    expect(statisticsTabFilterFlags('overview').championSearch).toBe(false)
    expect(statisticsTabFilterFlags('team').championSearch).toBe(false)
    expect(statisticsTabFilterFlags('championTable').championSearch).toBe(true)
  })
})

describe('appendStatisticsCohortParams', () => {
  const filters = {
    division: ['DIAMOND'],
    role: 'TOP',
    otp: 'solo' as const,
  }

  it('strips role and otp for objectives', () => {
    const params = new URLSearchParams()
    appendStatisticsCohortParams(params, 'objectives', filters, { alwaysSendOtp: true })
    expect(params.getAll('rankTier')).toEqual(['DIAMOND'])
    expect(params.get('role')).toBeNull()
    expect(params.get('otp')).toBeNull()
  })

  it('cohortFiltersForTab defaults otp to oui when tab ignores otp', () => {
    expect(cohortFiltersForTab('bans', filters).otp).toBe('oui')
    expect(cohortFiltersForTab('bans', filters).role).toBe('TOP')
  })
})
