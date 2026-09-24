import { describe, expect, it } from 'vitest'
import { formatDurationMin, incidentDurationMin, overallHealth } from './adminMonitoring'

describe('formatDurationMin', () => {
  it('format_duration_shows_minutes_when_under_one_hour', () => {
    expect(formatDurationMin(45)).toBe('45 min')
  })

  it('format_duration_shows_hours_and_padded_minutes_when_over_one_hour', () => {
    expect(formatDurationMin(65)).toBe('1 h 05')
  })

  it('format_duration_shows_days_when_over_one_day', () => {
    expect(formatDurationMin(60 * 24 * 2 + 90)).toBe('2 j 1 h')
  })
})

describe('incidentDurationMin', () => {
  it('incident_duration_uses_resolution_time_when_resolved', () => {
    expect(incidentDurationMin('2026-09-24T10:00:00.000Z', '2026-09-24T10:30:00.000Z', 0)).toBe(30)
  })

  it('incident_duration_uses_now_when_still_active', () => {
    expect(
      incidentDurationMin('2026-09-24T10:00:00.000Z', null, Date.parse('2026-09-24T11:00:00.000Z'))
    ).toBe(60)
  })
})

describe('overallHealth', () => {
  it('overall_health_is_ok_when_no_active_incident', () => {
    expect(overallHealth([])).toBe('ok')
  })

  it('overall_health_is_warning_when_only_warnings_are_active', () => {
    expect(overallHealth([{ severity: 'warning' }])).toBe('warning')
  })

  it('overall_health_is_critical_when_any_critical_is_active', () => {
    expect(overallHealth([{ severity: 'warning' }, { severity: 'critical' }])).toBe('critical')
  })
})
