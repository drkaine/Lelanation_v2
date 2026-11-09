import { describe, expect, it } from 'vitest'
import { fmtLocNum, fmtLocSigned, deltaToneClass } from '../localeNum'

describe('localeNum', () => {
  it('formats with locale decimals', () => {
    expect(fmtLocNum(42.47, 1, 'fr')).toBe('42,5')
    expect(fmtLocNum(42.47, 1, 'en')).toBe('42.5')
    expect(fmtLocNum(null, 1, 'fr')).toBe('—')
  })
  it('signs deltas with true minus and = for zero', () => {
    expect(fmtLocSigned(1.934, 2, 'fr')).toBe('+1,93')
    expect(fmtLocSigned(-1.66, 2, 'fr')).toBe('−1,66')
    expect(fmtLocSigned(0.001, 2, 'fr')).toBe('=')
    expect(fmtLocSigned(null, 2, 'fr')).toBe('')
  })
  it('gives a tone class', () => {
    expect(deltaToneClass(0.3)).toBe('is-up')
    expect(deltaToneClass(-0.3)).toBe('is-down')
    expect(deltaToneClass(0)).toBe('')
    expect(deltaToneClass(-0.3, true)).toBe('is-up')
  })
})
