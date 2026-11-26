import { describe, expect, it } from 'vitest'
import { DEFAULT_OTP_SETTINGS, otpSettingsValid, parseOtpSettings } from './otpSettings'

describe('parseOtpSettings', () => {
  it('lit la réponse admin { settings }', () => {
    expect(parseOtpSettings({ settings: { thresholdPct: 80, minGames: 20 } })).toEqual({
      thresholdPct: 80,
      minGames: 20,
    })
  })
  it('réponse invalide : défauts 70 % / 10 parties', () => {
    expect(parseOtpSettings(null)).toEqual(DEFAULT_OTP_SETTINGS)
    expect(parseOtpSettings({ settings: { thresholdPct: 'x' } })).toEqual(DEFAULT_OTP_SETTINGS)
    expect(DEFAULT_OTP_SETTINGS).toEqual({ thresholdPct: 70, minGames: 10 })
  })
})

describe('otpSettingsValid', () => {
  it('seuil 1-100 et minGames entier >= 1', () => {
    expect(otpSettingsValid({ thresholdPct: 70, minGames: 10 })).toBe(true)
    expect(otpSettingsValid({ thresholdPct: 0, minGames: 10 })).toBe(false)
    expect(otpSettingsValid({ thresholdPct: 101, minGames: 10 })).toBe(false)
    expect(otpSettingsValid({ thresholdPct: 70, minGames: 0 })).toBe(false)
    expect(otpSettingsValid({ thresholdPct: 70, minGames: 2.5 })).toBe(false)
  })
})
