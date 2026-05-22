import { describe, expect, it } from 'vitest'
import { isTheorycraftRoutePath, stripLocalePrefix } from '../theorycraftRoute'

describe('theorycraftRoute', () => {
  it('stripLocalePrefix removes /en prefix', () => {
    expect(stripLocalePrefix('/builds/theorycraft')).toBe('/builds/theorycraft')
    expect(stripLocalePrefix('/en/builds/theorycraft')).toBe('/builds/theorycraft')
    expect(stripLocalePrefix('/en')).toBe('/')
  })

  it('isTheorycraftRoutePath matches both locales', () => {
    expect(isTheorycraftRoutePath('/builds/theorycraft')).toBe(true)
    expect(isTheorycraftRoutePath('/en/builds/theorycraft')).toBe(true)
    expect(isTheorycraftRoutePath('/builds/create')).toBe(false)
  })
})
