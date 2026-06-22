import { describe, expect, it } from 'vitest'
import {
  shouldRunScheduledSurveillanceCheck,
  SURVEILLANCE_ALERT_CHECK_MIN_INTERVAL_MS,
} from './surveillanceAlerts'

describe('shouldRunScheduledSurveillanceCheck', () => {
  it('returns true when never checked', () => {
    expect(shouldRunScheduledSurveillanceCheck(null)).toBe(true)
  })

  it('returns false when last check is within 24h', () => {
    const recent = new Date(
      Date.now() - SURVEILLANCE_ALERT_CHECK_MIN_INTERVAL_MS + 60_000
    ).toISOString()
    expect(shouldRunScheduledSurveillanceCheck(recent)).toBe(false)
  })

  it('returns true when last check is older than 24h', () => {
    const old = new Date(Date.now() - SURVEILLANCE_ALERT_CHECK_MIN_INTERVAL_MS - 1).toISOString()
    expect(shouldRunScheduledSurveillanceCheck(old)).toBe(true)
  })
})
