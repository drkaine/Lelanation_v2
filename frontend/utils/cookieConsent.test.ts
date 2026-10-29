import { describe, expect, it } from 'vitest'
import {
  CONSENT_MAX_AGE_MS,
  matomoCookieNames,
  parseStoredConsent,
  serializeConsent,
} from './cookieConsent'

const NOW = new Date('2026-10-29T12:00:00Z').getTime()

describe('parseStoredConsent', () => {
  it('reads a fresh choice', () => {
    expect(parseStoredConsent(serializeConsent('accepted', NOW - 1000), NOW)).toBe('accepted')
    expect(parseStoredConsent(serializeConsent('rejected', NOW), NOW)).toBe('rejected')
  })

  it('asks again after six months', () => {
    expect(CONSENT_MAX_AGE_MS).toBe(182 * 24 * 60 * 60 * 1000)
    expect(
      parseStoredConsent(serializeConsent('accepted', NOW - CONSENT_MAX_AGE_MS - 1), NOW)
    ).toBe('unknown')
    expect(
      parseStoredConsent(serializeConsent('rejected', NOW - CONSENT_MAX_AGE_MS - 1), NOW)
    ).toBe('unknown')
  })

  it('treats legacy undated values and garbage as unknown', () => {
    expect(parseStoredConsent('accepted', NOW)).toBe('unknown')
    expect(parseStoredConsent(null, NOW)).toBe('unknown')
    expect(parseStoredConsent('{"choice":"maybe","at":1}', NOW)).toBe('unknown')
    expect(parseStoredConsent('{', NOW)).toBe('unknown')
  })

  it('rejects dates in the future', () => {
    expect(parseStoredConsent(serializeConsent('accepted', NOW + 86_400_000), NOW)).toBe('unknown')
  })
})

describe('matomoCookieNames', () => {
  it('lists Matomo cookies only', () => {
    expect(matomoCookieNames('_pk_id.1.abcd=x; foo=1; _pk_ses.1.abcd=1; mtm_consent=1')).toEqual([
      '_pk_id.1.abcd',
      '_pk_ses.1.abcd',
      'mtm_consent',
    ])
    expect(matomoCookieNames('')).toEqual([])
  })
})
